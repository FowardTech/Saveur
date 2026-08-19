package com.saveur.app

import android.content.Intent
import android.os.Bundle
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  // Must run before super.onCreate(), per the SplashScreen API contract.
  // This Activity's manifest theme (Theme.App.SplashScreen, in styles.xml)
  // is what's actually shown and why — this call just wires the platform
  // API up to that theme instead of leaving Android 12+'s own automatic,
  // icon-derived splash screen in charge (that auto-derivation was the
  // extra/oversized splash screen previously reported).
  override fun onCreate(savedInstanceState: Bundle?) {
    installSplashScreen()
    super.onCreate(savedInstanceState)
    // OS Share Sheet integration (product request: "Ability to share files
    // to Saveur from the device") -- a cold start caused by tapping
    // Saveur in another app's Share sheet hands its ACTION_SEND/
    // ACTION_SEND_MULTIPLE intent to THIS onCreate's own `intent`, not
    // onNewIntent (that only fires for an already-running instance -- see
    // below). Stashed for ShareIntentModule.getPendingSharedFiles() to
    // pick up once JS has mounted and is ready to ask for it.
    if (intent?.action == Intent.ACTION_SEND || intent?.action == Intent.ACTION_SEND_MULTIPLE) {
      ShareIntentModule.pendingShareIntent = intent
    }
  }

  // MainActivity is singleTask (see AndroidManifest.xml) so a share tapped
  // while the app is already running/backgrounded reuses this same
  // instance and arrives here instead of a fresh onCreate. Both paths are
  // handled: stash it the same way onCreate does (covers a share that
  // arrives before any JS listener is attached yet) AND emit the live
  // event for a listener that's already up (see
  // services/shareIntentService.ts).
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    if (intent.action == Intent.ACTION_SEND || intent.action == Intent.ACTION_SEND_MULTIPLE) {
      ShareIntentModule.pendingShareIntent = intent
      // Best-effort live emit for a listener that's already mounted (see
      // shareIntentService.ts) -- pendingShareIntent above is the real
      // guaranteed-delivery path (picked up on next launch/foreground
      // regardless of whether this emit succeeds), so this is deliberately
      // wrapped rather than left to crash the whole share if this app's
      // exact React Native version ever changes this accessor.
      // reactHost (not the older reactInstanceManager, which New
      // Architecture/bridgeless mode -- see MainApplication.kt's own
      // reactHost -- doesn't reliably expose) is the current, documented
      // way to reach the live ReactContext from an Activity.
      try {
        val context = (application as MainApplication).reactHost.currentReactContext
        if (context != null) {
          ShareIntentModule(context).emitShareReceived(intent)
        }
      } catch (e: Exception) {
        // Fall through -- pendingShareIntent still gets picked up on the
        // next foreground check.
      }
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "caren_family"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
