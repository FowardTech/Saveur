import {Platform} from 'react-native';

// Font handling per platform.
// - iOS: the system font (San Francisco, Apple's own typeface) -- families are
//   "System" and the weight picks the face.
// - Android: Plus Jakarta Sans (bundled; Apple's San Francisco can't be shipped
//   in an Android app). Android resolves a custom font by file name, so the
//   weight is encoded in the family name (PlusJakartaSans-Regular / -Medium /
//   -Bold) and every numeric weight is reset to normal.
const isAndroid = Platform.OS === 'android';

const familyForWeight = (w: string | number | undefined): string => {
  const n = Number(w);
  if (n >= 700) return 'PlusJakartaSans-Bold';
  if (n >= 500) return 'PlusJakartaSans-Medium';
  return 'PlusJakartaSans-Regular';
};

const isNumericWeight = (v: unknown) => typeof v === 'string' && /^\d{3}$/.test(v);

/** Applies the Android font mapping to UI Kitten's custom mapping JSON. */
export function platformMapping<T>(mapping: T): T {
  if (!isAndroid) return mapping;
  const clone = JSON.parse(JSON.stringify(mapping));
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (typeof val === 'object') {
        walk(val);
        continue;
      }
      if (key === 'text-font-family') node[key] = 'PlusJakartaSans-Regular';
      else if (key === 'text-font-family-medium') node[key] = 'PlusJakartaSans-Medium';
      else if (/FontFamily$/.test(key) && val === 'System') {
        const wKey = key.replace(/FontFamily$/, 'FontWeight');
        node[key] = familyForWeight(isNumericWeight(node[wKey]) ? node[wKey] : undefined);
      }
    }
    // Zero out numeric weights last (family was derived from them above).
    for (const key of Object.keys(node)) {
      if (/(FontWeight|font-weight)$/.test(key) && isNumericWeight(node[key])) node[key] = 'normal';
    }
  };
  walk(clone);
  return clone;
}

/** Same for the theme variables JSON (font-family entries only). */
export function platformTheme<T>(theme: T): T {
  if (!isAndroid) return theme;
  const clone: any = JSON.parse(JSON.stringify(theme));
  for (const key of Object.keys(clone)) {
    if (!/font-family/.test(key) || clone[key] !== 'System') continue;
    const semibold = key === 'text-font-family-medium' || /heading-\d+-font-family$/.test(key) || /subtitle/.test(key);
    clone[key] = semibold ? 'PlusJakartaSans-Medium' : 'PlusJakartaSans-Regular';
  }
  return clone;
}

/** For the shared Text component and a few fixed styles. */
export function fontStyle(weight: 'regular' | 'medium' | 'bold') {
  if (isAndroid) {
    const fontFamily =
      weight === 'bold' ? 'PlusJakartaSans-Bold' : weight === 'medium' ? 'PlusJakartaSans-Medium' : 'PlusJakartaSans-Regular';
    return {fontFamily, fontWeight: 'normal' as const};
  }
  return {fontFamily: 'System', fontWeight: (weight === 'bold' ? '700' : weight === 'medium' ? '500' : '400') as '700' | '500' | '400'};
}
