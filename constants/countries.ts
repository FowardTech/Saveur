// Shared "which countries would you work in" list — was previously defined
// inline inside src/auth/Signup/SignupSecondStep.tsx only, with no way to
// edit the choice again after signup. Extracted here so
// src/more/JobPreferences.tsx (the "change it later" settings screen) can
// use the exact same list without drifting out of sync with signup.
export const COUNTRIES = [
  'Remote - Anywhere',
  'United States',
  'United Kingdom',
  'Canada',
  'Ireland',
  'Germany',
  'France',
  'Spain',
  'Portugal',
  'Italy',
  'Switzerland',
  'Austria',
  'Belgium',
  'Netherlands',
  'Luxembourg',
  'Denmark',
  'Sweden',
  'Norway',
  'Finland',
  'Iceland',
  'Poland',
  'Czech Republic',
  'Hungary',
  'Romania',
  'Greece',
  'Estonia',
  'Latvia',
  'Lithuania',
  'Australia',
  'New Zealand',
  'Singapore',
  'Malaysia',
  'Indonesia',
  'Philippines',
  'Thailand',
  'Vietnam',
  'Hong Kong',
  'Taiwan',
  'Japan',
  'South Korea',
  'China',
  'India',
  'Pakistan',
  'Bangladesh',
  'Sri Lanka',
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Israel',
  'Turkey',
  'Egypt',
  'Nigeria',
  'Kenya',
  'Ghana',
  'South Africa',
  'Morocco',
  'Brazil',
  'Mexico',
  'Argentina',
  'Chile',
  'Colombia',
  'Peru',
  'Costa Rica',
  'Uruguay',
];

// ISO 3166-1 alpha-2 code for every real country in COUNTRIES above (all
// but the synthetic "Remote - Anywhere" entry, which has no country and no
// flag). Product request: "when users are selecting countries during
// signup they should also see the flags of those countries beside them."
//
// Deliberately Unicode regional-indicator flag emoji rather than an SVG
// flag library (e.g. country-flag-icons): this repo's installed
// node_modules/package-lock is only reliably reproducible on the machine
// it was generated on (see this session's other notes on the sandbox's
// npm/Metro environment not matching the real project 1:1) -- a real `npm
// install` attempt for an SVG package failed outright in this sandbox with
// an arborist crash caused by pre-existing platform-specific optional-dep
// bookkeeping (macOS-only sharp-darwin-x64) it couldn't reconcile, which is
// exactly the kind of failure that's safe to hit here but would be
// dangerous to "fix" by force in a way that then ships to the real repo.
// Flag emoji need no new dependency and no native/JS bundle addition at
// all. The one real tradeoff -- some older/budget Android builds without
// Google's Noto Color Emoji installed render regional-indicator pairs as
// two plain letters instead of a flag glyph -- is a graceful, readable
// fallback (still shows the ISO code, not broken glyphs), not a crash or
// blank space, and every iOS device and the large majority of Android
// devices (Noto Color Emoji ships as a Google Play system font on stock
// Android 8+ and every major OEM skin) render it correctly.
const COUNTRY_ISO_CODES: Record<string, string> = {
  'United States': 'US',
  'United Kingdom': 'GB',
  Canada: 'CA',
  Ireland: 'IE',
  Germany: 'DE',
  France: 'FR',
  Spain: 'ES',
  Portugal: 'PT',
  Italy: 'IT',
  Switzerland: 'CH',
  Austria: 'AT',
  Belgium: 'BE',
  Netherlands: 'NL',
  Luxembourg: 'LU',
  Denmark: 'DK',
  Sweden: 'SE',
  Norway: 'NO',
  Finland: 'FI',
  Iceland: 'IS',
  Poland: 'PL',
  'Czech Republic': 'CZ',
  Hungary: 'HU',
  Romania: 'RO',
  Greece: 'GR',
  Estonia: 'EE',
  Latvia: 'LV',
  Lithuania: 'LT',
  Australia: 'AU',
  'New Zealand': 'NZ',
  Singapore: 'SG',
  Malaysia: 'MY',
  Indonesia: 'ID',
  Philippines: 'PH',
  Thailand: 'TH',
  Vietnam: 'VN',
  'Hong Kong': 'HK',
  Taiwan: 'TW',
  Japan: 'JP',
  'South Korea': 'KR',
  China: 'CN',
  India: 'IN',
  Pakistan: 'PK',
  Bangladesh: 'BD',
  'Sri Lanka': 'LK',
  'United Arab Emirates': 'AE',
  'Saudi Arabia': 'SA',
  Qatar: 'QA',
  Israel: 'IL',
  Turkey: 'TR',
  Egypt: 'EG',
  Nigeria: 'NG',
  Kenya: 'KE',
  Ghana: 'GH',
  'South Africa': 'ZA',
  Morocco: 'MA',
  Brazil: 'BR',
  Mexico: 'MX',
  Argentina: 'AR',
  Chile: 'CL',
  Colombia: 'CO',
  Peru: 'PE',
  'Costa Rica': 'CR',
  Uruguay: 'UY',
};

/** Converts an ISO 3166-1 alpha-2 code ("US") into its regional-indicator
 * flag emoji ("🇺🇸") -- each letter maps to one of the 26 Unicode Regional
 * Indicator Symbol code points (U+1F1E6..U+1F1FF for A..Z); rendering
 * software pairs two adjacent ones into a single flag glyph. */
function isoToFlagEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

/** Flag emoji for a COUNTRIES entry, or '' for "Remote - Anywhere" (and
 * anything else with no mapped code) -- callers should render nothing
 * (not a broken-glyph placeholder) when this comes back empty. */
export function countryFlagEmoji(countryName: string): string {
  const code = COUNTRY_ISO_CODES[countryName];
  return code ? isoToFlagEmoji(code) : '';
}
