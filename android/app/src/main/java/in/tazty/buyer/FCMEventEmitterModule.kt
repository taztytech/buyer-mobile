package `in`.tazty.buyer

import android.content.Intent
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class FCMEventEmitterModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FCMEventEmitter"

    init {
        companionReactContext = reactContext
    }

    @ReactMethod
    fun getInitialNotificationData(promise: Promise) {
        try {
            val pending = pendingNotificationData
            if (pending != null) {
                pendingNotificationData = null
                promise.resolve(pending)
                return
            }

            val activity = reactContext.currentActivity
            val intent = activity?.intent
            val parsed = parseNotificationIntent(intent)
            if (parsed != null) {
                // Prevent the same intent from being returned repeatedly
                markIntentConsumed(intent)
                promise.resolve(parsed)
                return
            }

            promise.resolve(null)
        } catch (_: Exception) {
            promise.resolve(null)
        }
    }

    companion object {
        private const val NOTIFICATION_ACTION = "OPEN_FROM_NOTIFICATION"
        private const val CONSUMED_KEY = "_tazty_fcm_consumed"
        private var companionReactContext: ReactApplicationContext? = null
        private var pendingNotificationData: WritableMap? = null

        fun handleNotificationIntent(intent: Intent?) {
            val data = parseNotificationIntent(intent) ?: return
            val reactContext = companionReactContext
            if (reactContext != null && reactContext.hasActiveReactInstance()) {
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("FCMNotificationOpened", data)
            } else {
                pendingNotificationData = data
            }
            markIntentConsumed(intent)
        }

        private fun parseNotificationIntent(intent: Intent?): WritableMap? {
            if (intent == null) {
                return null
            }

            if (intent.getBooleanExtra(CONSUMED_KEY, false)) {
                return null
            }

            val extras = intent.extras ?: return null
            val hasOrderSignals =
                extras.containsKey("orderId") ||
                    extras.containsKey("order_id") ||
                    extras.containsKey("orderID") ||
                    extras.containsKey("order-id") ||
                    extras.containsKey("order_number") ||
                    extras.containsKey("orderNumber") ||
                    extras.containsKey("order-number")

            val hasStatusSignals =
                extras.containsKey("status") ||
                    extras.containsKey("new_status") ||
                    extras.containsKey("order_status") ||
                    extras.containsKey("current_status")

            // Process explicit notification intents OR intents that clearly carry order notification data.
            if (intent.action != NOTIFICATION_ACTION && !hasOrderSignals && !hasStatusSignals) {
                return null
            }

            val map = Arguments.createMap()
            for (key in extras.keySet()) {
                val value = extras.get(key)
                when (value) {
                    null -> map.putNull(key)
                    is String -> map.putString(key, value)
                    is Int -> map.putString(key, value.toString())
                    is Long -> map.putString(key, value.toString())
                    is Double -> map.putString(key, value.toString())
                    is Float -> map.putString(key, value.toString())
                    is Boolean -> map.putString(key, value.toString())
                    else -> map.putString(key, value.toString())
                }
            }
            return map
        }

        private fun markIntentConsumed(intent: Intent?) {
            if (intent == null) {
                return
            }
            intent.putExtra(CONSUMED_KEY, true)
            if (intent.action == NOTIFICATION_ACTION) {
                intent.action = null
            }
        }
    }
}

