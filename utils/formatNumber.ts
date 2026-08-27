import i18n from 'i18next';

// Product request: "all numbers and digits in the app too must be
// translated to the user's preferred language." Locale-aware numeral
// system via BCP-47's `-u-nu-` (numbering system) extension + Intl.
// NumberFormat -- verified this actually works on-device, not just in a
// Node/sandbox test: React Native 0.82 (this app's version) ships Hermes
// with full ICU4C statically linked by default, so Intl.NumberFormat with
// a numbering-system override resolves real digit glyphs on both iOS and
// Android, not just a silent no-op fallback to Western digits (older RN/
// JSC setups without the "international variant" would NOT have worked
// here -- worth re-verifying if this app is ever moved off Hermes).
//
// SCOPE (deliberate, not every single number in the app): applied to
// plain user-facing QUANTITIES -- XP, streak days, step/test counts,
// percentages, item counts. Deliberately NOT applied to currency amounts,
// phone numbers, order/tracking IDs, app version numbers, or dates (dayjs
// already handles locale-aware date formatting separately, see utils/
// dayjs.ts) -- these need to stay in a single canonical digit system for
// correctness/interoperability regardless of UI language, the same
// convention every major localized app (banking, e-commerce, OS-level
// settings) follows. Real-world precedent for the "only some locales
// actually change" behavior below: mainland Chinese/Japanese/Korean/
// Russian software overwhelmingly uses Western Arabic digits for UI
// quantities even in the native language -- native numeral systems
// (Chinese 一二三四五六, Japanese kanji numerals) are a formal/
// traditional-writing convention, not a UI one, so those locales
// resolve to the same digits either way and this is safe to call
// unconditionally wherever a plain quantity is displayed.
const NUMERAL_LOCALE: Record<string, string> = {
  ar: 'ar-u-nu-arab', // ٠١٢٣٤٥٦٧٨٩
  hi: 'hi-u-nu-deva', // ०१२३४५६७८९
};

function toLocaleDigits(digits: string): string {
  const locale = NUMERAL_LOCALE[i18n.language];
  if (!locale) return digits;
  try {
    return new Intl.NumberFormat(locale, {useGrouping: false}).format(Number(digits));
  } catch {
    return digits;
  }
}

export function formatNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null) return '';
  const value = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(value)) return String(n);
  return toLocaleDigits(String(value));
}

// Use this to wrap the RESULT of a t() call rather than feeding a
// formatNumber()'d string into t()'s interpolation options. i18next's own
// TS types declare the reserved `count` option (used for plural-form
// selection) as strictly `count?: number`, and feeding it a pre-formatted
// string broke that -- plus, in this codebase's very overload-heavy `t()`
// signature (typed straight off every namespace's JSON, see i18n/config.ts),
// one bad call let TS's overload resolution fall back to a wider
// `DefaultTFuncReturn` return type that then tripped up other, unrelated
// t() calls project-wide. Post-processing the already-built string sidesteps
// all of that: t() keeps getting plain numbers exactly as before (correct
// for plural selection too), and this just swaps the rendered digit glyphs.
export function localizeDigits(s: string | null | undefined): string {
  if (!s) return '';
  const locale = NUMERAL_LOCALE[i18n.language];
  if (!locale) return s;
  return s.replace(/\d+/g, (match) => toLocaleDigits(match));
}
