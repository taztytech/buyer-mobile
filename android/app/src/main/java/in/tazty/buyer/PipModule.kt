package `in`.tazty.buyer

import android.app.PictureInPictureParams
import android.os.Build
import android.util.Rational
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.jvm.Volatile

class PipModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        // Flag read by MainActivity to decide if it should auto-enter PiP
        @Volatile
        var autoPipEnabled: Boolean = false

        // Held so MainActivity can emit JS events without needing MainApplication
        @Volatile
        private var appReactContext: ReactApplicationContext? = null

        /**
         * Called by MainActivity.onPictureInPictureModeChanged to propagate the
         * PiP state change to the JavaScript layer via DeviceEventEmitter.
         * This is the ONLY reliable source of truth for PiP mode detection —
         * useWindowDimensions heuristics are unreliable because the system may
         * not invoke configChanges for window-only resizes without smallestScreenSize.
         */
        fun notifyPipModeChanged(isInPip: Boolean) {
            try {
                appReactContext
                    ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("onPictureInPictureModeChanged", isInPip)
            } catch (_: Exception) {
                // Ignore — JS bridge may not be ready yet
            }
        }
    }

    init {
        // Store a reference so the companion object can emit JS events
        appReactContext = reactContext
    }

    override fun getName(): String {
        return "PipModule"
    }

    @ReactMethod
    fun setAutoPipEnabled(enabled: Boolean) {
        autoPipEnabled = enabled
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

                // Build PiP params with 9:16 portrait aspect ratio
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(9, 16))  // Portrait ratio
                    .build()

                // Enter PiP mode with the specified params
                val result = activity.enterPictureInPictureMode(params)

                if (result) {
                    promise.resolve(true)
                } else {
                    promise.reject("PIP_FAILED", "Failed to enter PiP mode")
                }
            } catch (e: Exception) {
                promise.reject("PIP_ERROR", "Error entering PiP mode: ${e.message}")
            }
        } else {
            promise.reject("NOT_SUPPORTED", "PiP mode not supported on this Android version")
        }
    }
}
