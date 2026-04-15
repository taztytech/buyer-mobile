package `in`.tazty.buyer

import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.app.PictureInPictureParams
import android.content.Intent
import android.content.res.Configuration
import android.util.Rational

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Set when we call onResume() from our Handler to re-activate React Native in PiP mode.
   * Cleared either by a natural (non-fake) onResume() call or by onStop() after it handles it.
   */
  private var needsPairedPauseOnStop = false

  /**
   * True only while we are inside our own fake onResume() invocation, so that our
   * onResume() override knows not to clear needsPairedPauseOnStop prematurely.
   */
  private var isExecutingFakeResume = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    // Handle cold-start notification intents.
    FCMEventEmitterModule.handleNotificationIntent(intent)
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return object : DefaultReactActivityDelegate(
      this,
      mainComponentName,
      fabricEnabled
    ) {}
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    // Keep the latest notification intent on the activity so JS-side
    // notification handlers can read the newest extras consistently.
    setIntent(intent)
    // Handle notification taps while app is already running/backgrounded.
    FCMEventEmitterModule.handleNotificationIntent(intent)
  }

  /**
   * ROOT CAUSE FIX — why map and status freeze in PiP mode:
   *
   * On Android 8–11 (API 26–30), entering PiP calls Activity.onPause(). This propagates
   * through ReactActivity → ReactActivityDelegate → onHostPause() / onActivityPause(),
   * which pauses React Native's ENTIRE rendering pipeline and throttles JS timers.
   * Both the WebView map and the status text are driven by this pipeline, so both freeze.
   * Only touch events "woke" React Native because they flush the bridge queue.
   *
   * WHY previous fixes (ReactInstanceManager.onHostResume, reactNativeHost.reactInstanceManager)
   * silently failed: this project has newArchEnabled=true (Fabric / bridgeless mode).
   * In bridgeless mode, reactNativeHost.reactInstanceManager throws UnsupportedOperationException.
   * The try/catch swallowed it, so React Native was never re-activated.
   *
   * CORRECT FIX — call this.onResume() / this.onPause() directly:
   *   • Goes through mDelegate.onResume() / mDelegate.onPause()
   *   • The delegate handles BOTH old and new architecture internally
   *   • No ReactInstanceManager access needed — works on Fabric/bridgeless
   *
   * LIFECYCLE CONSISTENCY:
   *   • super.onPause() MUST always be called (Android throws SuperNotCalledException if omitted).
   *   • After super.onPause() we schedule onResume() via Handler.post to re-activate React Native.
   *   • needsPairedPauseOnStop tracks that we did a "fake resume" so onStop() can call onPause()
   *     before truly stopping, ensuring React Native is in PAUSED state when the activity stops.
   *     Without this, onHostResume() on the next app reopen is a no-op → blank screen.
   */
  override fun onPause() {
    super.onPause() // Required — Android throws SuperNotCalledException if skipped

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isInPictureInPictureMode) {
      Handler(Looper.getMainLooper()).post {
        // Re-check: only re-activate if we are still in PiP (not if it closed quickly)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isInPictureInPictureMode) {
          isExecutingFakeResume = true
          onResume()            // Re-activates React Native through the delegate (new + old arch)
          isExecutingFakeResume = false
          needsPairedPauseOnStop = true
        }
      }
    }
  }

  /**
   * When Android naturally calls onResume() (user expands PiP to full screen, or the app
   * reopens after stop), clear the flag — lifecycle is now consistent, no paired pause needed.
   */
  override fun onResume() {
    if (!isExecutingFakeResume) {
      needsPairedPauseOnStop = false
    }
    super.onResume()
  }

  /**
   * When the activity stops (PiP window closed, app going fully to background), we must
   * pair our fake-resume with a real pause so React Native's lifecycle state is PAUSED.
   * Without this, onHostResume() on the next app reopen would be a no-op (already RESUMED)
   * → blank screen.
   */
  override fun onStop() {
    if (needsPairedPauseOnStop) {
      needsPairedPauseOnStop = false
      onPause() // Pair the fake-resume; isInPictureInPictureMode is false here so super.onPause() fires normally
    }
    super.onStop()
  }

  /**
   * Only auto-enter PiP when JS has explicitly enabled it via PipModule.setAutoPipEnabled(true).
   */
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()

    if (!PipModule.autoPipEnabled) {
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      try {
        val params = PictureInPictureParams.Builder()
          .setAspectRatio(Rational(9, 16))
          .build()
        enterPictureInPictureMode(params)
      } catch (_: Exception) {
        // Ignore PiP failures; app will go to background normally
      }
    }
  }

  override fun onPictureInPictureModeChanged(
    isInPictureInPictureMode: Boolean,
    newConfig: Configuration
  ) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    PipModule.notifyPipModeChanged(isInPictureInPictureMode)
  }

  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              super.invokeDefaultOnBackPressed()
          }
          return
      }
      super.invokeDefaultOnBackPressed()
  }
}
