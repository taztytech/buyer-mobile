package `in`.tazty.buyer

import android.app.PictureInPictureParams
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.Rational
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.jvm.Volatile

class PipModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        @Volatile var autoPipEnabled: Boolean = false

        @Volatile private var appReactContext: ReactApplicationContext? = null

        private var pipRefreshHandler: Handler? = null
        private var pipRefreshRunnable: Runnable? = null

        /**
         * Called by MainActivity.onPictureInPictureModeChanged.
         * Emits the PiP state change to JS and starts/stops the native rendering heartbeat.
         */
        fun notifyPipModeChanged(isInPip: Boolean) {
            val ctx = appReactContext ?: return
            if (!ctx.hasActiveReactInstance()) return
            ctx.runOnJSQueueThread {
                try {
                    ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        ?.emit("onPictureInPictureModeChanged", isInPip)
                } catch (_: Exception) {}
            }
            if (isInPip) startPipViewRefresh() else stopPipViewRefresh()
        }

        /**
         * Calls decorView.requestLayout() every 150 ms while in PiP mode.
         *
         * requestLayout() propagates up to ViewRootImpl.scheduleTraversals() which posts a
         * Choreographer TRAVERSAL callback — the same path that touch events use internally.
         * This ensures any React Native view mutations committed after our fake-resume (e.g.
         * from FCM status updates) are drawn to the PiP surface within the next frame.
         */
        private fun startPipViewRefresh() {
            stopPipViewRefresh()
            val handler = Handler(Looper.getMainLooper())
            val runnable = object : Runnable {
                override fun run() {
                    try {
                        val activity = appReactContext?.currentActivity
                        if (activity != null && !activity.isFinishing) {
                            activity.window?.decorView?.requestLayout()
                        }
                    } catch (_: Exception) {}
                    handler.postDelayed(this, 150L)
                }
            }
            pipRefreshHandler = handler
            pipRefreshRunnable = runnable
            handler.post(runnable)
        }

        private fun stopPipViewRefresh() {
            pipRefreshRunnable?.let { pipRefreshHandler?.removeCallbacks(it) }
            pipRefreshHandler = null
            pipRefreshRunnable = null
        }
    }

    init {
        appReactContext = reactContext
    }

    override fun getName(): String = "PipModule"

    @ReactMethod
    fun setAutoPipEnabled(enabled: Boolean) {
        autoPipEnabled = enabled
    }

    @ReactMethod
    fun invalidateView() {
        val activity = reactApplicationContext.currentActivity ?: return
        activity.runOnUiThread {
            try {
                activity.window?.decorView?.requestLayout()
            } catch (_: Exception) {}
        }
    }

    @ReactMethod
    fun closePip() {
        val activity = reactApplicationContext.currentActivity ?: return
        activity.runOnUiThread {
            try {
                activity.moveTaskToBack(true)
            } catch (_: Exception) {}
        }
    }

    @ReactMethod
    fun enterPictureInPictureMode(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.reject("NOT_SUPPORTED", "PiP mode not supported on this Android version")
            return
        }

        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Activity doesn't exist")
            return
        }

        activity.runOnUiThread {
            tryEnterPip(activity, promise, retryCount = 0)
        }
    }

    private fun tryEnterPip(activity: android.app.Activity, promise: Promise, retryCount: Int) {
        try {
            if (activity.isFinishing || activity.isDestroyed) {
                promise.reject("ACTIVITY_INVALID", "Activity is not available")
                return
            }

            // enterPictureInPictureMode requires the activity to have window focus.
            // A heads-up notification or system overlay can steal focus briefly.
            // Retry up to 3 times (300 ms apart) until focus is restored.
            if (!activity.hasWindowFocus()) {
                if (retryCount < 3) {
                    Log.d("PipModule", "No window focus — retrying PiP in 300ms (attempt ${retryCount + 1})")
                    Handler(Looper.getMainLooper()).postDelayed({
                        tryEnterPip(activity, promise, retryCount + 1)
                    }, 300L)
                } else {
                    Log.w("PipModule", "PiP aborted — activity did not regain window focus after retries")
                    promise.reject("NO_FOCUS", "Activity does not have window focus")
                }
                return
            }

            val params = PictureInPictureParams.Builder()
                .setAspectRatio(Rational(9, 16))
                .build()
            val result = activity.enterPictureInPictureMode(params)
            if (result) {
                promise.resolve(true)
            } else {
                Log.w("PipModule", "enterPictureInPictureMode returned false (isFinishing=${activity.isFinishing})")
                promise.reject("PIP_FAILED", "Failed to enter PiP mode")
            }
        } catch (e: Exception) {
            promise.reject("PIP_ERROR", "Error entering PiP mode: ${e.message}")
        }
    }
}
