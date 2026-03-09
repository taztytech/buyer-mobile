package `in`.tazty.buyer
import expo.modules.splashscreen.SplashScreenManager

import android.os.Build
import android.os.Bundle
import android.app.PictureInPictureParams
import android.content.Intent
import android.content.res.Configuration
import android.util.Rational

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    // Keep the latest notification intent on the activity so JS-side
    // notification handlers can read the newest extras consistently.
    setIntent(intent)
  }

  /**
    * Only auto-enter PiP when JS has explicitly enabled it via PipModule.setAutoPipEnabled(true)
    * This lets us restrict PiP to the Track Order page only.
    */
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()

    if (!PipModule.autoPipEnabled) {
      // Auto-PiP not enabled from JS, do nothing special
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      try {
        val params = PictureInPictureParams.Builder()
          .setAspectRatio(Rational(9, 16))  // 9:16 portrait ratio for vertical layout
          .build()
        enterPictureInPictureMode(params)
      } catch (_: Exception) {
        // Ignore PiP failures; app will just go to background normally
      }
    }
  }

  /**
    * Handle Picture-in-Picture mode changes.
    * We notify the JS layer via PipModule so React can toggle PiP layout
    * reliably — useWindowDimensions heuristics alone are not sufficient because
    * Android only invokes configChanges for window-size changes when
    * smallestScreenSize is listed, and even then the timing is imprecise.
    */
  override fun onPictureInPictureModeChanged(
    isInPictureInPictureMode: Boolean,
    newConfig: Configuration
  ) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    // Emit the definitive PiP state to the JS side
    PipModule.notifyPipModeChanged(isInPictureInPictureMode)
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
