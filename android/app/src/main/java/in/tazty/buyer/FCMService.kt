package `in`.tazty.buyer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.net.HttpURLConnection
import java.net.URL

class FCMService : FirebaseMessagingService() {
    
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "Refreshed token: $token")
        
        // Send token to React Native
        sendTokenToReactNative(token)
    }
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        Log.d(TAG, "From: ${remoteMessage.from}")
        Log.d(TAG, "Message data payload: ${remoteMessage.data}")
        
        val data = remoteMessage.data
        if (remoteMessage.notification != null) {
            // A notification block is present, so show it exactly as before.
            val notification = remoteMessage.notification!!
            Log.d(TAG, "Message Notification Body: ${notification.body}")
            val imageUrl = notification.imageUrl?.toString() ?: data["image"] ?: data["imageUrl"]
            showNotification(
                notification.title ?: "New Notification",
                notification.body ?: "",
                data,
                imageUrl
            )
        } else if (data.isNotEmpty()) {
            // Data-only message. Android shows nothing by itself, which is the
            // point: an order update is drawn here so it can stay ongoing, keep
            // one entry per order, and carry a TRACK ORDER button. Everything
            // else becomes an ordinary notification built from the same title
            // and body the server used to put in the notification block.
            handleDataOnlyMessage(data)
        }
        
        // Send message to React Native
        sendMessageToReactNative(remoteMessage)
    }
    
    /**
     * Route a data-only message. A live order owns one tray entry for its own
     * order, rewritten by every status push; anything else is a one-off
     * notification.
     */
    private fun handleDataOnlyMessage(data: Map<String, String>) {
        val title = data["title"] ?: "Tazty"
        val body = data["body"] ?: ""
        val orderId = data["order_id"] ?: data["orderId"]
        val orderNumber = data["order_number"] ?: data["orderNumber"]
        val orderKey = orderNumber ?: orderId
        val isOrder = (data["type"] ?: "") == "order" && orderKey != null
        if (!isOrder) {
            showNotification(title, body, data, data["image_url"] ?: data["imageUrl"])
            return
        }
        val live = (data["live_order"] ?: "false") == "true"

        if (live) {
            /**
             * One ongoing entry per order, rewritten by each status push, with
             * a TRACK ORDER button on it.
             *
             * Drawn straight from here rather than by a foreground service:
             * Play only grants FOREGROUND_SERVICE_DATA_SYNC against a demo
             * video of the feature working, so the service - and with it the
             * arrival time that refreshes itself - waits for the release where
             * that video exists. LiveOrderService and LiveOrderDismissReceiver
             * are kept for it and are not wired up in this build.
             *
             * The text still moves with every status, and on Android 13 and
             * below the entry cannot be swiped away.
             */
            val notification = LiveOrderNotifier.build(
                context = this,
                orderKey = orderKey!!,
                orderId = orderId,
                orderNumber = orderNumber,
                title = title,
                body = body,
                ongoing = true,
                alert = true,
                showTrackAction = true
            )
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.notify(LiveOrderNotifier.notificationId(orderKey), notification)
        } else {
            // Delivered, cancelled or refunded: the live entry goes, and the
            // final word is shown as an ordinary, dismissable notification.
            LiveOrderNotifier.cancel(this, orderKey!!)
            showNotification(title, body, data, data["image_url"] ?: data["imageUrl"])
        }
    }

    private fun sendTokenToReactNative(token: String) {
        val reactContext = (application as MainApplication).reactNativeHost.reactInstanceManager.currentReactContext
        reactContext?.let {
            val params = Arguments.createMap().apply {
                putString("token", token)
            }
            it
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("FCMTokenRefreshed", params)
        }
    }
    
    private fun sendMessageToReactNative(remoteMessage: RemoteMessage) {
        val reactContext = (application as MainApplication).reactNativeHost.reactInstanceManager.currentReactContext
        
        if (reactContext != null) {
            // App is in foreground, send event directly
            val params = Arguments.createMap().apply {
                // A data-only message carries its text in data, so fall back
                // to it - otherwise the foreground handler sees an empty title.
                putString(
                    "title",
                    remoteMessage.notification?.title ?: remoteMessage.data["title"]
                )
                putString(
                    "body",
                    remoteMessage.notification?.body ?: remoteMessage.data["body"]
                )
                val dataMap = Arguments.createMap()
                remoteMessage.data.forEach { (key, value) ->
                    dataMap.putString(key, value)
                }
                putMap("data", dataMap)
            }
            
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("FCMessageReceived", params)
        } else {
            // App is in background/quit state, use headless task
            val intent = Intent(this, FCMHeadlessTaskService::class.java).apply {
                putExtra("data", remoteMessage.data.toString())
                putExtra("title", remoteMessage.notification?.title ?: remoteMessage.data["title"])
                putExtra("body", remoteMessage.notification?.body ?: remoteMessage.data["body"])
            }
            startService(intent)
        }
    }
    
    private fun getAppLogoBitmap(): Bitmap? {
        return try {
            // Use explicit round launcher icon for consistent branding in notifications
            BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher_round)
        } catch (error: Exception) {
            Log.w(TAG, "Failed to decode app logo bitmap", error)
            null
        }
    }

    private fun downloadBitmapFromUrl(urlString: String): Bitmap? {
        var connection: HttpURLConnection? = null
        return try {
            val url = URL(urlString)
            connection = url.openConnection() as HttpURLConnection
            connection.doInput = true
            connection.connectTimeout = 5000
            connection.readTimeout = 5000
            connection.connect()
            connection.inputStream.use { input ->
                BitmapFactory.decodeStream(input)
            }
        } catch (error: Exception) {
            Log.w(TAG, "Failed to download notification image", error)
            null
        } finally {
            connection?.disconnect()
        }
    }

    private fun showNotification(
        title: String,
        body: String,
        data: Map<String, String>,
        imageUrl: String? = null
    ) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        // Create notification channel for Android O and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelId = "default"
            val channelName = "Default Channel"
            val channel = NotificationChannel(
                channelId,
                channelName,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Default notification channel"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 250, 250, 250)
            }
            notificationManager.createNotificationChannel(channel)
        }
        
        val intent = Intent(this, MainActivity::class.java).apply {
            // Bring the existing activity to front when possible instead of
            // clearing the whole task (which looks like an app restart).
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            // Add action to identify notification tap
            action = "OPEN_FROM_NOTIFICATION"
            // Pass all notification data as extras
            data.forEach { (key, value) ->
                putExtra(key, value)
            }
            // Ensure orderId is passed (support multiple field names)
            val orderId = data["orderId"] ?: data["order_id"] ?: data["orderID"] ?: data["order-id"]
            if (orderId != null) {
                putExtra("orderId", orderId)
            }
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        
        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val appLogoBitmap = getAppLogoBitmap()
        val notificationBuilder = NotificationCompat.Builder(this, "default")
            // Use explicit launcher icon so the same logo appears in collapsed and expanded views
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        appLogoBitmap?.let {
            notificationBuilder.setLargeIcon(it)
        }

        if (!imageUrl.isNullOrBlank()) {
            val bigPictureBitmap = downloadBitmapFromUrl(imageUrl)
            if (bigPictureBitmap != null) {
                val bigPictureStyle = NotificationCompat.BigPictureStyle()
                    .bigPicture(bigPictureBitmap)
                    .setSummaryText(body)
                appLogoBitmap?.let { logo ->
                    bigPictureStyle.bigLargeIcon(logo)
                }
                notificationBuilder.setStyle(bigPictureStyle)
            }
        }
        
        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }
    
    companion object {
        private const val TAG = "FCMService"
    }
}

