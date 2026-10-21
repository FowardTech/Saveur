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
import {API_BASE_URL} from 'constants/env';

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

/** Live logo URL for a company, served by the backend (Saveur-Backend's
 * /api/v1/company-logos/img). The backend resolves the company's real domain,
 * pulls the actual brand icon from the company's own site (favicon service as
 * fallback), caches it and returns a normal PNG/JPEG/WebP -- so logos are
 * always fetched fresh, nothing is bundled in this app, and (unlike the old
 * SVG-returning geticon.dev URLs) React Native can actually render them.
 * Always pass the result through components/CompanyLogoAvatar.tsx, which
 * falls back to an icon when a logo can't be found. */
export function guessCompanyLogoUrl(company?: string | null): string | null {
  const name = (company ?? '').trim();
  if (!name) return null;
  const domain = KNOWN_DOMAIN_OVERRIDES[name.toLowerCase()];
  return liveLogoUrl(name, domain);
}

/** Logo for a fixed brand domain (Gmail/Outlook/Google sign-in buttons...).
 * `favicon` prefers the high-res favicon over scraping the homepage, which
 * gives the correct per-product icon for subdomains like mail.google.com. */
export function brandLogoUrl(domain: string): string {
  return liveLogoUrl('', domain, true);
}

function liveLogoUrl(name: string, domain?: string | null, favicon = false): string {
  const qs: string[] = [];
  if (name) qs.push(`name=${encodeURIComponent(name.slice(0, 100))}`);
  if (domain) qs.push(`domain=${encodeURIComponent(domain)}`);
  if (favicon) qs.push('prefer=favicon');
  return `${API_BASE_URL}/api/v1/company-logos/img?${qs.join('&')}`;
}
