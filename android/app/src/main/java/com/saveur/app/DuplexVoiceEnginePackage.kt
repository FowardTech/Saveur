package com.saveur.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers DuplexVoiceEngineModule with React Native -- see
 * MainApplication.kt's packageList, where this is added alongside the
 * autolinked packages. Same pattern as ShareIntentPackage.kt right next
 * to this file.
 */
class DuplexVoiceEnginePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(DuplexVoiceEngineModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
