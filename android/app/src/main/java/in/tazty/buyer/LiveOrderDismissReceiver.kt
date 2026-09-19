package `in`.tazty.buyer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Android 14 lets a customer swipe an ongoing notification away, and no app can
 * refuse that. This hears the swipe and asks the service to put the live order
 * back, so the tray still shows where the food is - which is the whole point of
 * the notification, and what they asked for.
 *
 * If the service has already stopped (order delivered), nothing comes back.
 */
class LiveOrderDismissReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != LiveOrderNotifier.ACTION_DISMISSED) return

        val orderId = intent.getStringExtra(LiveOrderNotifier.EXTRA_ORDER_ID)
        val orderNumber = intent.getStringExtra(LiveOrderNotifier.EXTRA_ORDER_NUMBER)
        if (orderId.isNullOrBlank() && orderNumber.isNullOrBlank()) return

        Log.d("LiveOrderDismiss", "Live order notification dismissed; restoring")

        val extras = mutableMapOf<String, String>()
        orderId?.let { extras["order_id"] = it }
        orderNumber?.let { extras["order_number"] = it }
        // Silent: the customer has already been told this status.
        extras["status_changed"] = "false"

        val serviceIntent = Intent(context, LiveOrderService::class.java).apply {
            action = LiveOrderService.ACTION_REPOST
            extras.forEach { (k, v) -> putExtra(k, v) }
        }
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        } catch (e: Exception) {
            // Android forbids starting a service from the background in some
            // states; the next status update restores the notification anyway.
            Log.w("LiveOrderDismiss", "Could not restore live order: ${e.message}")
        }
    }
}
