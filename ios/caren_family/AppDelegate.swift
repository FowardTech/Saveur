import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // @react-native-firebase/app normally auto-configures itself via an
    // Objective-C `+load` swizzle on the app delegate, but that isn't
    // reliably triggered before JS starts executing under this project's
    // New Architecture bridgeless startup (RCTReactNativeFactory). Calling
    // this explicitly guarantees the default Firebase app exists — reading
    // GoogleService-Info.plist — before any JS code (e.g. AuthContext) can
    // touch `auth()`.
    FirebaseApp.configure()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "caren_family",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  // Without these two overrides, iOS's incoming custom-URL-scheme and
  // universal-link events are dropped at the native layer and never reach
  // RCTLinkingManager — meaning React Native's `Linking` module never fires
  // its JS `url` event. This is exactly why saveur://linkedin-redirect
  // (LinkedIn OAuth's callback — see services/linkedinAuthService.ts) was
  // silently swallowed on iOS while working fine on Android (whose
  // AndroidManifest.xml intent-filter already routes the same scheme
  // correctly): the JS-side listener in App.tsx was always correct, but
  // nothing on iOS was ever forwarding the URL to it. Stripe's own
  // saveur://stripe-redirect return (Subscription.tsx) happened to work
  // anyway only because that flow re-checks subscription status on
  // app-foreground (AppState listener) rather than depending on the actual
  // deep link being delivered — LinkedIn's flow has no such fallback, so it
  // surfaced here first.
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return RCTLinkingManager.application(app, open: url, options: options)
  }

  func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    return RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
