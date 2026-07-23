package com.saveur.app

import com.facebook.react.views.text.ReactFontManager

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Font family names registered here must be the EXACT strings requested
    // via `fontFamily` in JS (constants/theme/mapping.json's text-font-family*
    // tokens, and components/BrandWordmark.tsx's hardcoded one) — Android's
    // ReactFontManager does a plain string-equality lookup against whatever
    // was registered here, with no normalization. This used to register
    // "Gotham Pro" / "D-DIN Condensed" (with spaces/hyphens that don't match
    // anything actually requested — mapping.json asks for "GothamPro",
    // "GothamPro-Medium", "DCondensed-Bold"), so every lookup silently missed
    // and Android fell back to the system font for ALL text, with no error —
    // fonts looked "fine" on iOS (which resolves fontFamily by the font's own
    // internal PostScript name, already an exact match there) and simply
    // never applied on Android. Also registers MontserratAlternates-Black,
    // used directly by BrandWordmark.tsx for the "Saveur" logo wordmark and
    // previously not registered under any name at all on Android.
    ReactFontManager.getInstance().addCustomFont(this, "GothamPro", R.font.gothampro_regular)
    ReactFontManager.getInstance().addCustomFont(this, "GothamPro-Medium", R.font.gothampro_medium)
    ReactFontManager.getInstance().addCustomFont(this, "DCondensed-Bold", R.font.dcondensed_bold)
    ReactFontManager.getInstance().addCustomFont(this, "MontserratAlternates-Black", R.font.montserratalternates_black)
    loadReactNative(this)
  }
}
