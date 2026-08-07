// Product report: "in the company list in the interview mock setup screen,
// you should also display the logos of these company too." Mirrors the
// backend's guess-a-domain-then-hit-a-logo-API approach (see
// Saveur-Backend's app/services/company_logo_service.py) — reimplemented
// client-side here because constants/Data.ts's DATA_COMPANIES is a small,
// static, hardcoded list with no backend round trip today; adding one just
// to resolve ~20 logos would be a needless network dependency for something
// this cheap to compute locally. Not meant to be a fully general company ->
// domain resolver (see that Python module's own comment on why a slug guess
// is sometimes wrong) — components/CompanyLogoAvatar.tsx already degrades
// gracefully to an icon fallback (never initials) on a 404, same as
// everywhere else this pattern is used in this app.
//
// BUG FIX (product report: "do you want to tell me that the AI in this app
// cant fetch the logos of these companies from online? At least google and
// amazon and many popular top big companies logo are online"): this used to
// build a logo.clearbit.com URL — that service shut down for good on Dec 8
// 2025 (HubSpot's own deprecation notice), so every lookup through it has
// been failing outright since, for every company including the largest,
// best-known ones. Swapped to geticon.dev (see company_logo_service.py's
// matching fix + its own comment on why that specific replacement, not
// logo.dev) and added verified domains for the major companies most likely
// to actually show up here, ahead of the generic slug-guessing fallback.
const KNOWN_DOMAIN_OVERRIDES: Record<string, string> = {
  'boston consulting group': 'bcg.com',
  'johnson & johnson': 'jnj.com',
  'procter & gamble': 'pg.com',
  google: 'google.com',
  alphabet: 'abc.xyz',
  amazon: 'amazon.com',
  microsoft: 'microsoft.com',
  apple: 'apple.com',
  meta: 'meta.com',
  facebook: 'meta.com',
  netflix: 'netflix.com',
  tesla: 'tesla.com',
  nvidia: 'nvidia.com',
  openai: 'openai.com',
  ibm: 'ibm.com',
  oracle: 'oracle.com',
  salesforce: 'salesforce.com',
  adobe: 'adobe.com',
  intel: 'intel.com',
  cisco: 'cisco.com',
  spotify: 'spotify.com',
  airbnb: 'airbnb.com',
  uber: 'uber.com',
  lyft: 'lyft.com',
  stripe: 'stripe.com',
  paypal: 'paypal.com',
  shopify: 'shopify.com',
  linkedin: 'linkedin.com',
  twitter: 'x.com',
  x: 'x.com',
  samsung: 'samsung.com',
  sony: 'sony.com',
  dell: 'dell.com',
  hp: 'hp.com',
  'hewlett packard': 'hp.com',
  walmart: 'walmart.com',
  target: 'target.com',
  costco: 'costco.com',
  jpmorgan: 'jpmorganchase.com',
  'jpmorgan chase': 'jpmorganchase.com',
  'goldman sachs': 'goldmansachs.com',
  'morgan stanley': 'morganstanley.com',
  visa: 'visa.com',
  mastercard: 'mastercard.com',
  'american express': 'americanexpress.com',
  mckinsey: 'mckinsey.com',
  deloitte: 'deloitte.com',
  accenture: 'accenture.com',
  ey: 'ey.com',
  kpmg: 'kpmg.com',
  pwc: 'pwc.com',
  bcg: 'bcg.com',
  bain: 'bain.com',
  'coca-cola': 'coca-colacompany.com',
  pepsico: 'pepsico.com',
  nike: 'nike.com',
  adidas: 'adidas.com',
  disney: 'disney.com',
  starbucks: 'starbucks.com',
  mcdonalds: 'mcdonalds.com',
  "mcdonald's": 'mcdonalds.com',
  boeing: 'boeing.com',
  airbus: 'airbus.com',
  ford: 'ford.com',
  'general motors': 'gm.com',
  toyota: 'toyota.com',
  siemens: 'siemens.com',
  sap: 'sap.com',
  atlassian: 'atlassian.com',
  slack: 'slack.com',
  zoom: 'zoom.us',
  dropbox: 'dropbox.com',
  github: 'github.com',
  gitlab: 'gitlab.com',
  figma: 'figma.com',
  notion: 'notion.so',
  asana: 'asana.com',
  hubspot: 'hubspot.com',
  twilio: 'twilio.com',
  snowflake: 'snowflake.com',
  databricks: 'databricks.com',
  palantir: 'palantir.com',
  anthropic: 'anthropic.com',
  coinbase: 'coinbase.com',
  doordash: 'doordash.com',
  pinterest: 'pinterest.com',
  reddit: 'reddit.com',
  etsy: 'etsy.com',
  ebay: 'ebay.com',
};

const CORPORATE_SUFFIXES = new Set([
  'incorporated', 'corporation', 'holdings', 'limited', 'company', 'group',
  'worldwide', 'global', 'international', 'technologies', 'solutions',
  'services', 'partners', 'llc', 'inc', 'ltd', 'corp', 'co', 'plc', 'gmbh',
  'sa', 'ag', 'nv', 'pty',
]);

function guessCompanyDomain(company: string): string | null {
  const name = company.trim().toLowerCase();
  if (!name) return null;
  const override = KNOWN_DOMAIN_OVERRIDES[name];
  if (override) return override;
  const words = (name.match(/[a-z0-9]+/g) ?? []).filter(w => !CORPORATE_SUFFIXES.has(w));
  const slug = words.join('');
  return slug ? `${slug}.com` : null;
}

/** Best-effort geticon.dev logo URL for a company name, or null when
 * nothing usable could be guessed (e.g. an empty string). Always pass the
 * result through components/CompanyLogoAvatar.tsx rather than an Image
 * directly — it handles the "guess was wrong, logo 404s" fallback to an
 * icon (never initials). */
export function guessCompanyLogoUrl(company?: string | null): string | null {
  if (!company) return null;
  const domain = guessCompanyDomain(company);
  return domain ? `https://geticon.dev/?url=${encodeURIComponent(domain)}` : null;
}
