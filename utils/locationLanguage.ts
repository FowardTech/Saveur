import {Platform, PermissionsAndroid} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import {isSupportedLanguageCode} from 'constants/languages';

// ---------------------------------------------------------------------------
// First-open location-based language detection — per explicit request:
// "Users should give location permission access on the first time opening
// the app so that the app can automatically be translated to the language
// spoken in that country or region. The language selection should still be
// there."
//
// FOLLOW-UP (this pass): "immediately the user selects grants the user
// location permission the content of the app should automatically change to
// the language spoken in that region or country" + "the user must grant [it]
// before continuing into the app" — this was previously fired silently and
// non-blockingly from a useEffect in App.tsx, with no UI at all, which meant
// there was no guaranteed moment where a grant/deny had actually resolved
// before the rest of the app rendered. It's now driven by a real blocking
// pre-app screen, components/LocationLanguageGate.tsx (rendered from App.tsx,
// gated on EKeyAsyncStorage.locationLanguageGateSeen so it only ever shows
// once, on the very first launch) which calls detectLanguageFromLocation()
// below directly and does not move on until that promise settles either way.
//
// This only ever sets the STARTING language, before the user has picked/
// cached one another way — the manual selector (SignupFirstStep at signup,
// Settings -> Language any time after) always takes precedence and is
// completely unaffected by this.
//
// Deliberately layered on top of the existing device-locale fallback
// (i18n/language-detector.ts uses react-native-localize's OS locale when
// nothing is cached) rather than replacing it: per explicit product
// direction, if the user denies location permission, the request fails, or
// the reverse-geocode call fails (no network on first launch, etc.), this
// silently no-ops, the gate still lets the user into the app immediately
// (never blocks forever on a denial), and the existing device-locale
// behavior is exactly what happens today — never a worse experience than
// before, only a potentially better one.
//
// Reverse geocoding uses BigDataCloud's free client-side reverse-geocode
// endpoint (https://www.bigdatacloud.com/geocoding-apis/free-reverse-geocode-to-city-api)
// specifically because it needs no API key/account at all — this app has no
// Google Maps/geocoding key configured anywhere, and this task shouldn't
// block on acquiring one just to map "lat/lng" -> "country code". Swap for
// Google's Geocoding API later if you'd rather standardize on one mapping
// provider across the app.
// ---------------------------------------------------------------------------

// Country (ISO 3166-1 alpha-2, as returned by BigDataCloud) -> one of this
// app's 12 supported language codes (constants/languages.ts). Not
// exhaustive — every country not listed here falls back to English, which
// is exactly what happens today anyway when nothing better is known.
const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  // Spanish
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es',
  EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es',
  SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', GQ: 'es',
  // French
  FR: 'fr', BE: 'fr', SN: 'fr', CI: 'fr', ML: 'fr', NE: 'fr',
  BF: 'fr', TG: 'fr', BJ: 'fr', GA: 'fr', CD: 'fr', CG: 'fr', HT: 'fr',
  LU: 'fr', MC: 'fr',
  // German (Switzerland is genuinely multilingual — a country-code-only
  // lookup can't tell which region the user is in, so this defaults CH to
  // its majority language rather than omitting it entirely)
  DE: 'de', AT: 'de', LI: 'de', CH: 'de',
  // Portuguese
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', GW: 'pt', ST: 'pt',
  TL: 'pt',
  // Italian
  IT: 'it', SM: 'it', VA: 'it',
  // Chinese (Simplified)
  CN: 'zh', SG: 'zh',
  // Japanese
  JP: 'ja',
  // Korean
  KR: 'ko', KP: 'ko',
  // Arabic
  SA: 'ar', AE: 'ar', EG: 'ar', QA: 'ar', KW: 'ar', BH: 'ar', OM: 'ar',
  JO: 'ar', LB: 'ar', IQ: 'ar', SY: 'ar', YE: 'ar', LY: 'ar', TN: 'ar',
  DZ: 'ar', MA: 'ar', SD: 'ar', PS: 'ar',
  // Hindi
  IN: 'hi',
  // Russian
  RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru',
};

async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return new Promise(resolve => {
      Geolocation.requestAuthorization(
        () => resolve(true),
        () => resolve(false),
      );
    });
  }
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      {
        title: 'Location access',
        message:
          "Saveur uses your approximate location just once, to set the app's language to the one spoken in your region. You can always change it later in Settings.",
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function getCurrentPosition(): Promise<{latitude: number; longitude: number} | null> {
  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      position => resolve({latitude: position.coords.latitude, longitude: position.coords.longitude}),
      () => resolve(null),
      {enableHighAccuracy: false, timeout: 10000, maximumAge: 0},
    );
  });
}

async function countryCodeFromCoords(latitude: number, longitude: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.countryCode === 'string' ? data.countryCode.toUpperCase() : null;
  } catch {
    return null;
  }
}

/**
 * Requests location permission, reverse-geocodes the result, and switches
 * the app's language to the one spoken in that country — called directly
 * from components/LocationLanguageGate.tsx's "Allow Location Access" button,
 * which awaits this before dismissing itself (that gate, not this function,
 * is what enforces "only ever runs once, on first launch" via
 * EKeyAsyncStorage.locationLanguageGateSeen).
 *
 * Always resolves, never rejects — a denied permission, a failed GPS fix, a
 * failed reverse-geocode call, or an unrecognized/unmapped country all just
 * no-op and fall through silently, leaving whatever language
 * i18n/language-detector.ts already picked (the device's own OS locale) in
 * place. The caller does not need to branch on success vs. failure.
 */
export async function detectLanguageFromLocation(): Promise<void> {
  try {
    // Respect an existing choice — this only ever sets the STARTING
    // language on a fresh install, never overrides a real pick (e.g. a
    // profile's own saved locale already restored by the time this runs).
    const alreadyCached = await AsyncStorage.getItem('lng');
    if (alreadyCached) return;

    const granted = await requestPermission();
    if (!granted) return;

    const coords = await getCurrentPosition();
    if (!coords) return;

    const country = await countryCodeFromCoords(coords.latitude, coords.longitude);
    if (!country) return;

    const language = COUNTRY_TO_LANGUAGE[country];
    if (!language || !isSupportedLanguageCode(language)) return;
    if (language === i18n.language) return;

    await i18n.changeLanguage(language);
  } catch {
    // Never let this block the gate from dismissing — the existing device-
    // locale fallback (i18n/language-detector.ts) already ran by the time
    // this executes, so a failure here just means that fallback stands.
  }
}
