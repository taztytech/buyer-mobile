package `in`.tazty.buyer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Build
import androidx.core.app.NotificationCompat

/**
 * The live order notification: one ongoing entry in the tray that follows an
 * order from the kitchen to the door.
 *
 * It is built here rather than by the system because a system-drawn FCM
 * notification cannot carry an action button, cannot stay put, and cannot have
 * its text rewritten as the rider moves. The trade-off is that the app is now
 * responsible for showing it at all, which is why the server can switch this
 * whole path off (ANDROID_DATA_ONLY_PUSH) and go back to system notifications
 * without an app release.
 *
 * The id is derived from the order, so every update replaces the same entry
 * instead of stacking a new one per status.
 */
object LiveOrderNotifier {

    const val CHANNEL_ID = "live_order"
    private const val CHANNEL_NAME = "Order updates"

    const val ACTION_TRACK = "in.tazty.buyer.TRACK_ORDER"
    const val ACTION_DISMISSED = "in.tazty.buyer.LIVE_ORDER_DISMISSED"

    const val EXTRA_ORDER_ID = "order_id"
    const val EXTRA_ORDER_NUMBER = "order_number"

    /** Keeps the notification id stable for an order across app restarts. */
    fun notificationId(orderKey: String): Int = 7000 + (orderKey.hashCode() and 0xFFFF)

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Where your order is, until it reaches you"
            enableVibration(true)
            setShowBadge(true)
        }
        manager.createNotificationChannel(channel)
    }

    /**
     * @param ongoing while the order is on its way: not swipeable below Android
     *   14, and put back by the service on 14+ where the system allows a swipe.
     * @param alert true only when the status itself changed. An ETA refresh
     *   every 45 seconds must never buzz the phone.
     */
    fun build(
        context: Context,
        orderKey: String,
        orderId: String?,
        orderNumber: String?,
        title: String,
        body: String,
        ongoing: Boolean,
        alert: Boolean,
        showTrackAction: Boolean,
        /**
         * Ask to be told when the customer swipes it away. Only worth setting
         * when a service is running to put it back - without one the broadcast
         * goes nowhere.
         */
        restoreOnDismiss: Boolean = false
    ): Notification {
        ensureChannel(context)

        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            action = "OPEN_FROM_NOTIFICATION"
            putExtra("type", "order")
            orderId?.let {
                putExtra(EXTRA_ORDER_ID, it)
                putExtra("orderId", it)
            }
            orderNumber?.let { putExtra(EXTRA_ORDER_NUMBER, it) }
        }
        val contentPending = PendingIntent.getActivity(
            context,
            notificationId(orderKey),
            openIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Same screen, but asking the app to open the live map straight away.
        val trackIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            action = "OPEN_FROM_NOTIFICATION"
            putExtra("type", "order")
            putExtra("open_tracking", "true")
            orderId?.let {
                putExtra(EXTRA_ORDER_ID, it)
                putExtra("orderId", it)
            }
            orderNumber?.let { putExtra(EXTRA_ORDER_NUMBER, it) }
        }
        val trackPending = PendingIntent.getActivity(
            context,
            notificationId(orderKey) + 1,
            trackIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        // Android 14 lets the customer swipe an ongoing notification away. This
        // tells the service it happened so it can put it back.
        val dismissPending = PendingIntent.getBroadcast(
            context,
            notificationId(orderKey) + 2,
            Intent(context, LiveOrderDismissReceiver::class.java).apply {
                action = ACTION_DISMISSED
                putExtra(EXTRA_ORDER_ID, orderId)
                putExtra(EXTRA_ORDER_NUMBER, orderNumber)
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(contentPending)
            .setOngoing(ongoing)
            .setAutoCancel(!ongoing)
            .setOnlyAlertOnce(!alert)
            .setPriority(if (alert) NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)

        try {
            BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher_round)?.let {
                builder.setLargeIcon(it)
            }
        } catch (_: Exception) {
            // A missing icon must not cost the customer the notification.
        }

        if (restoreOnDismiss) {
            builder.setDeleteIntent(dismissPending)
        }

        if (showTrackAction) {
            builder.addAction(0, "TRACK ORDER", trackPending)
        }

        return builder.build()
    }

    fun cancel(context: Context, orderKey: String) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(notificationId(orderKey))
    }
}
