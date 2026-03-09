package `in`.tazty.buyer

import android.app.PictureInPictureParams
import android.os.Build
import android.os.Handler
import android.os.Looper
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val activity = reactApplicationContext.currentActivity
                if (activity == null) {
                    promise.reject("NO_ACTIVITY", "Activity doesn't exist")
                    return
                }
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(9, 16))
                    .build()
                val result = activity.enterPictureInPictureMode(params)
                if (result) promise.resolve(true)
                else promise.reject("PIP_FAILED", "Failed to enter PiP mode")
            } catch (e: Exception) {
                promise.reject("PIP_ERROR", "Error entering PiP mode: ${e.message}")
            }
        } else {
            promise.reject("NOT_SUPPORTED", "PiP mode not supported on this Android version")
        }
    }
}
