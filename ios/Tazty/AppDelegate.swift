import FirebaseCore
import FirebaseMessaging
import React
import ReactAppDependencyProvider
import React_RCTAppDelegate
import GoogleMaps
import UserNotifications

@main
class AppDelegate: RCTAppDelegate {

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    GMSServices.provideAPIKey("AIzaSyByxizUPOdWROrVV1IikPFPrI-F6EmACk0")
    self.moduleName = "main"
    self.dependencyProvider = RCTAppDependencyProvider()
    self.initialProps = [:]

#if os(iOS) || os(tvOS)
FirebaseApp.configure()
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Required for the background / data-only notification event.
  public override func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable : Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    // Forward the message to Firebase Messaging
    Messaging.messaging().appDidReceiveMessage(userInfo)
    
    completionHandler(.newData)
  }

  // Forward APNS device token to Firebase Messaging explicitly
  public override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    #if DEBUG
    Messaging.messaging().setAPNSToken(deviceToken, type: .sandbox)
    #else
    Messaging.messaging().setAPNSToken(deviceToken, type: .prod)
    #endif
  }

  public override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    print("❌ FCM: Failed to register for remote notifications: \(error.localizedDescription)")
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
