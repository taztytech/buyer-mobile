package `in`.tazty.buyer

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Keeps one live order notification alive and honest until the food arrives.
 *
 * Runs as a foreground service so it survives the customer swiping the app
 * away - a plain background task does not, and this is exactly the stretch of
 * time when the app is closed and the customer still wants to know where their
 * food is.
 *
 * Every 45 seconds it asks the delivery tracking API where the rider is and
 * rewrites the notification text. It stops itself the moment the order is
 * delivered or cancelled, and gives up after MAX_RUNTIME_MS so a stuck order
 * can never leave a service running on someone's phone all day.
 */
class LiveOrderService : Service() {

    companion object {
        private const val TAG = "LiveOrderService"

        const val ACTION_START = "in.tazty.buyer.LIVE_ORDER_START"
        const val ACTION_STOP = "in.tazty.buyer.LIVE_ORDER_STOP"
        const val ACTION_REPOST = "in.tazty.buyer.LIVE_ORDER_REPOST"

        private const val POLL_INTERVAL_MS = 45_000L
        private const val MAX_RUNTIME_MS = 3 * 60 * 60 * 1000L

        /** Rider is this close: stop counting and say "arriving now". */
        private const val ARRIVING_METERS = 150.0
        /** Straight-line distance is optimistic; roads are not straight. */
        private const val ROAD_FACTOR = 1.3
        /** Handing the food over takes a minute or two on top of the ride. */
        private const val HANDOVER_SECONDS = 120

        private const val MIN_SPEED_MPS = 2.2   // ~8 km/h, heavy traffic
        private const val MAX_SPEED_MPS = 8.3   // ~30 km/h, clear road
        private const val DEFAULT_SPEED_MPS = 5.0 // ~18 km/h, city average

        /** Moved less than this between checks counts as not moving. */
        private const val STATIONARY_METERS = 50.0
        /** Three quiet checks in a row (~2 min) before we call it a delay. */
        private const val STATIONARY_CHECKS_FOR_DELAY = 3
        private const val DELAY_BLOCK_SECONDS = 180
        private const val OVERRUN_BLOCK_SECONDS = 120

        private val FINISHED_STATUSES = setOf(
            "delivered", "completed", "cancelled", "canceled", "rejected"
        )

        fun start(context: Context, extras: Map<String, String>) {
            val intent = Intent(context, LiveOrderService::class.java).apply {
                action = ACTION_START
                extras.forEach { (k, v) -> putExtra(k, v) }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context, extras: Map<String, String>) {
            val intent = Intent(context, LiveOrderService::class.java).apply {
                action = ACTION_STOP
                extras.forEach { (k, v) -> putExtra(k, v) }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    private var worker: HandlerThread? = null
    private var handler: Handler? = null

    private var orderKey: String = ""
    private var orderId: String? = null
    private var orderNumber: String? = null
    private var restaurantName: String = ""
    private var trackBaseUrl: String = "https://delivery.tazty.in"
    private var status: String = ""
    private var pushTitle: String = "Order update"
    private var pushBody: String = ""
    private var dropLat: Double? = null
    private var dropLng: Double? = null

    private var startedAt = 0L
    private var lastRiderLat: Double? = null
    private var lastRiderLng: Double? = null
    private var lastRiderAt = 0L
    private var stationaryChecks = 0
    /** The number the customer is looking at. It only goes down, never up,
     *  unless a delay is detected - then it goes up in whole blocks. */
    private var shownEtaSeconds: Int? = null
    private var delayed = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START
        val incomingKey = intent?.getStringExtra("order_key")
            ?: intent?.getStringExtra("order_number")
            ?: intent?.getStringExtra("order_id")
            ?: orderKey

        if (action == ACTION_STOP) {
            LiveOrderNotifier.cancel(this, incomingKey)
            stopSelfSafely()
            return START_NOT_STICKY
        }

        // A different order arriving replaces the tracked one; a phone shows one
        // live order at a time, and the newer one is the one being watched.
        val isNewOrder = incomingKey.isNotEmpty() && incomingKey != orderKey
        if (isNewOrder) {
            resetEtaState()
        }

        intent?.let { readExtras(it) }
        if (orderKey.isEmpty()) {
            stopSelfSafely()
            return START_NOT_STICKY
        }
        if (startedAt == 0L) startedAt = System.currentTimeMillis()

        val statusChanged = action == ACTION_START && intent?.getStringExtra("status_changed") != "false"
        postNotification(alert = statusChanged && action != ACTION_REPOST)

        ensureWorker()
        scheduleNextPoll(immediate = true)
        return START_STICKY
    }

    private fun readExtras(intent: Intent) {
        intent.getStringExtra("order_key")?.let { orderKey = it }
        intent.getStringExtra("order_id")?.let { orderId = it }
        intent.getStringExtra("order_number")?.let {
            orderNumber = it
            if (orderKey.isEmpty()) orderKey = it
        }
        if (orderKey.isEmpty()) orderKey = orderId ?: ""
        intent.getStringExtra("restaurant_name")?.let { restaurantName = it }
        intent.getStringExtra("track_base_url")
            ?.takeIf { it.isNotBlank() }
            ?.let { trackBaseUrl = it.trimEnd('/') }
        intent.getStringExtra("status")?.let { status = it.lowercase() }
        intent.getStringExtra("title")?.takeIf { it.isNotBlank() }?.let { pushTitle = it }
        intent.getStringExtra("body")?.takeIf { it.isNotBlank() }?.let { pushBody = it }
        intent.getStringExtra("drop_lat")?.toDoubleOrNull()?.let { dropLat = it }
        intent.getStringExtra("drop_lng")?.toDoubleOrNull()?.let { dropLng = it }
    }

    private fun resetEtaState() {
        shownEtaSeconds = null
        delayed = false
        stationaryChecks = 0
        lastRiderLat = null
        lastRiderLng = null
        lastRiderAt = 0L
        startedAt = System.currentTimeMillis()
    }

    private fun ensureWorker() {
        if (worker != null) return
        worker = HandlerThread("live-order-poll").apply { start() }
        handler = Handler(worker!!.looper)
    }

    private fun scheduleNextPoll(immediate: Boolean = false) {
        val h = handler ?: return
        h.removeCallbacksAndMessages(null)
        h.postDelayed({ poll() }, if (immediate) 1_000L else POLL_INTERVAL_MS)
    }

    private fun poll() {
        try {
            if (System.currentTimeMillis() - startedAt > MAX_RUNTIME_MS) {
                Log.w(TAG, "Live order $orderKey ran past its time limit; stopping")
                LiveOrderNotifier.cancel(this, orderKey)
                stopSelfSafely()
                return
            }

            val trackingRef = orderNumber ?: orderId
            if (trackingRef.isNullOrBlank()) {
                scheduleNextPoll()
                return
            }

            val json = fetchStatus(trackingRef)
            if (json != null) {
                val remoteStatus = json.optString("status", "").lowercase()
                if (remoteStatus in FINISHED_STATUSES) {
                    LiveOrderNotifier.cancel(this, orderKey)
                    stopSelfSafely()
                    return
                }
                applyRiderPosition(json)
            }

            postNotification(alert = false)
        } catch (e: Exception) {
            // A failed poll keeps the last good line on screen rather than
            // blanking the notification the customer is watching.
            Log.w(TAG, "Live order poll failed: ${e.message}")
        }
        scheduleNextPoll()
    }

    private fun fetchStatus(trackingRef: String): JSONObject? {
        var connection: HttpURLConnection? = null
        return try {
            val url = URL("$trackBaseUrl/api/track/$trackingRef/status")
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 10_000
                setRequestProperty("Accept", "application/json")
            }
            if (connection.responseCode !in 200..299) return null
            val text = connection.inputStream.bufferedReader().use { it.readText() }
            val root = JSONObject(text)
            // The API answers either the payload itself or { data: payload }.
            if (root.has("data") && root.opt("data") is JSONObject) {
                root.getJSONObject("data")
            } else {
                root
            }
        } catch (e: Exception) {
            Log.w(TAG, "Track status request failed: ${e.message}")
            null
        } finally {
            connection?.disconnect()
        }
    }

    private fun applyRiderPosition(json: JSONObject) {
        val rider = json.optJSONObject("rider") ?: return
        val location = rider.optJSONObject("current_location") ?: return
        val lat = location.optDouble("lat", Double.NaN)
        val lng = location.optDouble("lng", Double.NaN)
        if (lat.isNaN() || lng.isNaN()) return

        val now = System.currentTimeMillis()
        val previousLat = lastRiderLat
        val previousLng = lastRiderLng
        val movedMeters = if (previousLat != null && previousLng != null) {
            distanceMeters(previousLat, previousLng, lat, lng)
        } else {
            null
        }
        val elapsedSeconds = if (lastRiderAt > 0) (now - lastRiderAt) / 1000.0 else 0.0

        lastRiderLat = lat
        lastRiderLng = lng
        lastRiderAt = now

        val drop = dropLat to dropLng
        val dLat = drop.first
        val dLng = drop.second
        if (dLat == null || dLng == null) return

        val remaining = distanceMeters(lat, lng, dLat, dLng) * ROAD_FACTOR

        if (remaining <= ARRIVING_METERS || status == "agent-nearby") {
            shownEtaSeconds = 0
            delayed = false
            return
        }

        // Speed from the rider's own recent movement, kept inside sane city
        // limits so one bad GPS point cannot promise a two-minute delivery.
        val speed = if (movedMeters != null && elapsedSeconds > 10) {
            min(max(movedMeters / elapsedSeconds, MIN_SPEED_MPS), MAX_SPEED_MPS)
        } else {
            DEFAULT_SPEED_MPS
        }
        val computed = (remaining / speed).roundToInt() + HANDOVER_SECONDS

        // Standing still: traffic, a lift, a wrong turn. Rather than let the
        // countdown run out in the customer's face, add a few minutes and say so.
        if (movedMeters != null && movedMeters < STATIONARY_METERS && remaining > 300) {
            stationaryChecks += 1
        } else {
            stationaryChecks = 0
            delayed = false
        }

        val current = shownEtaSeconds
        var next = when {
            current == null -> computed
            // Only ever count down, so the number never jitters upwards.
            computed < current -> computed
            else -> current - (elapsedSeconds.roundToInt().coerceAtLeast(0))
        }

        if (stationaryChecks >= STATIONARY_CHECKS_FOR_DELAY) {
            next += DELAY_BLOCK_SECONDS
            delayed = true
            stationaryChecks = 0
        }

        // The clock ran out but the rider is still away: add a small block, and
        // keep adding for as long as it takes.
        if (next <= 0 && remaining > ARRIVING_METERS) {
            next = OVERRUN_BLOCK_SECONDS
            delayed = true
        }

        shownEtaSeconds = max(next, 0)
    }

    private fun postNotification(alert: Boolean) {
        val eta = shownEtaSeconds
        val riding = status == "picked" || status == "out-for-delivery" || status == "agent-nearby"

        val title: String
        val body: String
        if (riding && eta != null) {
            title = when {
                eta <= 60 -> "Arriving now 🛵"
                else -> "Arriving in ${(eta / 60.0).roundToInt().coerceAtLeast(1)} min 🛵"
            }
            val distanceText = distanceText()
            body = when {
                delayed && distanceText != null ->
                    "Running a few minutes late · $distanceText"
                delayed -> "Running a few minutes late"
                distanceText != null && restaurantName.isNotBlank() ->
                    "$distanceText · $restaurantName"
                distanceText != null -> distanceText
                else -> pushBody
            }
        } else {
            title = pushTitle
            body = if (pushBody.isNotBlank()) pushBody else restaurantName
        }

        val notification = LiveOrderNotifier.build(
            context = this,
            orderKey = orderKey,
            orderId = orderId,
            orderNumber = orderNumber,
            title = title,
            body = body,
            ongoing = true,
            alert = alert,
            showTrackAction = true
        )

        val id = LiveOrderNotifier.notificationId(orderKey)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(id, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(id, notification)
        }
        // startForeground already posts it; this keeps the text fresh on the
        // updates that follow.
        NotificationManagerCompat.from(this).notify(id, notification)
    }

    private fun distanceText(): String? {
        val lat = lastRiderLat ?: return null
        val lng = lastRiderLng ?: return null
        val dLat = dropLat ?: return null
        val dLng = dropLng ?: return null
        val meters = distanceMeters(lat, lng, dLat, dLng)
        return when {
            meters < 400 -> "Rider is close by"
            meters < 1000 -> "Rider ${(meters / 100).roundToInt() * 100} m away"
            else -> "Rider ${String.format("%.1f", meters / 1000)} km away"
        }
    }

    private fun distanceMeters(
        lat1: Double,
        lng1: Double,
        lat2: Double,
        lng2: Double
    ): Double {
        val earthRadius = 6371000.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
            sin(dLng / 2) * sin(dLng / 2)
        return earthRadius * 2 * atan2(sqrt(a), sqrt(1 - a))
    }

    private fun stopSelfSafely() {
        handler?.removeCallbacksAndMessages(null)
        worker?.quitSafely()
        worker = null
        handler = null
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
    }

    override fun onDestroy() {
        handler?.removeCallbacksAndMessages(null)
        worker?.quitSafely()
        worker = null
        handler = null
        super.onDestroy()
    }
}
