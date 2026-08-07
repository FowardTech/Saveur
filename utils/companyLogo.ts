// Product report: "in the company list in the interview mock setup screen,
// you should also display the logos of these company too." Mirrors the
// backend's guess-a-domain-then-hit-Clearbit's-logo-API approach (see
// Saveur-Backend's app/services/company_logo_service.py) — reimplemented
// client-side here because constants/Data.ts's DATA_COMPANIES is a small,
// static, hardcoded list with no backend round trip today; adding one just
// to resolve ~20 logos would be a needless network dependency for something
// this cheap to compute locally. Not meant to be a fully general company ->
// domain resolver (see that Python module's own comment on why a slug guess
// is sometimes wrong) — components/CompanyLogoAvatar.tsx already degrades
// gracefully to an initials avatar on a 404, same as everywhere else this
// pattern is used in this app.

// Small curated corrections for names in DATA_COMPANIES whose real domain
// the generic slug guess below would get wrong (verified real domains, not
// guesses) — cheap to maintain since that list is short and rarely changes.
const KNOWN_DOMAIN_OVERRIDES: Record<string, string> = {
  'boston consulting group': 'bcg.com',
  'johnson & johnson': 'jnj.com',
  'procter & gamble': 'pg.com',
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

/** Best-effort Clearbit logo URL for a company name, or null when nothing
 * usable could be guessed (e.g. an empty string). Always pass the result
 * through components/CompanyLogoAvatar.tsx rather than an Image directly —
 * it handles the "guess was wrong, logo 404s" fallback to initials. */
export function guessCompanyLogoUrl(company?: string | null): string | null {
  if (!company) return null;
  const domain = guessCompanyDomain(company);
  return domain ? `https://logo.clearbit.com/${domain}` : null;
}
