// ---------------------------------------------------------------------------
// Single source of truth for "preferred language" — used by:
//   - src/auth/Signup/SignupFirstStep.tsx (pick language at signup)
//   - src/home/MyFavorites/SelectLanguage.tsx (change language from Settings)
//   - services/speechService.ts / services/videoAnalysisService.ts (map the
//     app's short language code to a full BCP-47 locale for on-device
//     speech-to-text, since @dev-amirzubair/react-native-voice needs e.g.
//     "es-ES", not just "es")
//
// `code` is what's sent to the backend as UserProfileProps.locale (PATCH/GET
// /api/users/me already has this field wired — see services/authService.ts)
// and to POST /api/v1/tts/speak as `language`, and is what i18next's
// `resources` in i18n/config.ts are keyed by.
//
// Only list a language here once it has real i18next translation resources
// (see i18n/config.ts's `resources`) — otherwise picking it would silently
// leave most of the app in English while claiming to be, say, French, which
// is worse than not offering it at all. Adding a new language means: add its
// resources/en/*.json translations, register them in i18n/config.ts, add a
// row here, and tell the backend which ElevenLabs voice to use for it (see
// docs/BACKEND_SPEC_ADDENDUM_2026-07.md).
// ---------------------------------------------------------------------------

export interface SupportedLanguage {
  code: string; // ISO 639-1, sent to backend + i18next key (e.g. "en", "es")
  label: string; // English name, shown alongside the native name in pickers
  nativeLabel: string; // name written in that language
  sttLocale: string; // full BCP-47 tag for react-native-voice's Voice.start()
}

// Top 12 world languages by native-speaker count + major business reach — the
// user explicitly asked for "all the major languages in the world" rather
// than just English/Spanish. Every one of these has full i18next translation
// coverage across all 13 namespaces (see i18n/config.ts) — no partial/
// UI-chrome-only entries.
//
// Arabic (ar) note: this only covers TEXT (i18next strings) — it does not
// flip the app's layout to right-to-left. A true RTL mirror needs
// `I18nManager.forceRTL(true)` + an app restart, plus auditing every screen's
// flexDirection/absolute-positioning assumptions — a separate, larger native
// layout change not done here. Arabic text reads correctly today, but the
// surrounding UI chrome (icons, alignment, nav direction) still lays out LTR.
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  {code: 'en', label: 'English', nativeLabel: 'English', sttLocale: 'en-US'},
  {code: 'es', label: 'Spanish', nativeLabel: 'Español', sttLocale: 'es-ES'},
  {code: 'fr', label: 'French', nativeLabel: 'Français', sttLocale: 'fr-FR'},
  {code: 'de', label: 'German', nativeLabel: 'Deutsch', sttLocale: 'de-DE'},
  {code: 'pt', label: 'Portuguese', nativeLabel: 'Português', sttLocale: 'pt-BR'},
  {code: 'it', label: 'Italian', nativeLabel: 'Italiano', sttLocale: 'it-IT'},
  {code: 'zh', label: 'Chinese (Simplified)', nativeLabel: '中文（简体）', sttLocale: 'zh-CN'},
  {code: 'ja', label: 'Japanese', nativeLabel: '日本語', sttLocale: 'ja-JP'},
  {code: 'ko', label: 'Korean', nativeLabel: '한국어', sttLocale: 'ko-KR'},
  {code: 'ar', label: 'Arabic', nativeLabel: 'العربية', sttLocale: 'ar-SA'},
  {code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', sttLocale: 'hi-IN'},
  {code: 'ru', label: 'Russian', nativeLabel: 'Русский', sttLocale: 'ru-RU'},
];

export const DEFAULT_LANGUAGE_CODE = 'en';

export function isSupportedLanguageCode(code?: string | null): code is string {
  return !!code && SUPPORTED_LANGUAGES.some(l => l.code === code);
}

/** Full BCP-47 locale for on-device speech-to-text, given an app language
 * code (falls back to en-US for an unrecognized/undefined code). */
export function getSttLocale(code?: string | null): string {
  return SUPPORTED_LANGUAGES.find(l => l.code === code)?.sttLocale ?? 'en-US';
}

export function getLanguageLabel(code?: string | null): string {
  const match = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return match ? match.nativeLabel : SUPPORTED_LANGUAGES[0].nativeLabel;
}
