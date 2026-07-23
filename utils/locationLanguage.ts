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
// This runs ONCE ever, on the app's very first cold start (guarded by
// AsyncStorage — see maybeDetectLanguageFromLocation below), and only if the
// user hasn't already picked/cached a language some other way (the manual
// selector — SignupFirstStep at signup, Settings -> Language any time after
// — always takes precedence and is completely unaffected by this; this only
// ever sets the STARTING point before that choice exists).
//
// Deliberately layered on top of the existing device-locale fallback
// (i18n/language-detector.ts uses react-native-localize's OS locale when
// nothing is cached) rather than replacing it: if the user denies location
// permission, the request fails, or the reverse-geocode call fails (no
// network on first launch, etc.), this silently no-ops and the existing
// device-locale behavior is exactly what happens today — never a worse
// experience than before, only a potentially better one.
//
// Reverse geocoding uses BigDataCloud's free client-side reverse-geocode
// endpoint (https://www.bigdatacloud.com/geocoding-apis/free-reverse-geocode-to-city-api)
// specifically because it needs no API key/account at all — this app has no
// Google Maps/geocoding key configured anywhere, and this task shouldn't
// block on acquiring one just to map "lat/lng" -> "country code". Swap for
// Google's Geocoding API later if you'd rather standardize on one mapping
// provider across the app.
// ---------------------------------------------------------------------------

const HAS_ATTEMPTED_KEY = 'hasAttemptedLocationLanguageDetection';

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

async function hasAttempted(): Promise<boolean> {
  return (await AsyncStorage.getItem(HAS_ATTEMPTED_KEY)) === 'true';
}

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
 * Call once, at app startup (see App.tsx). No-ops after the very first
 * successful-or-failed attempt ever, and no-ops if the user already has a
 * cached language preference (manual pick always wins).
 */
export async function maybeDetectLanguageFromLocation(): Promise<void> {
  try {
    if (await hasAttempted()) return;
    await AsyncStorage.setItem(HAS_ATTEMPTED_KEY, 'true');

    // Respect an existing choice — this is only ever meant to set the
    // STARTING language on a fresh install, never override a real pick.
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
    // Never let this affect app startup — the existing device-locale
    // fallback (i18n/language-detector.ts) already ran by the time this
    // executes, so a failure here just means that fallback stands.
  }
}
