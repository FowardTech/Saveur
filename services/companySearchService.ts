import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// companySearchService — AI web search fallback for the mock-interview
// setup screen's company picker (product request: "when users type the
// company and it's not part of the list already listed there the AI should
// search the web for that company and its logo... We should not limit the
// user to the few ones the app listed"). See
// Saveur-Backend's app/services/company_search_service.py — a real,
// citations-verified Perplexity search (not a blind name-slug guess), same
// "grounded web search, only trust what a citation backs" pattern the
// career-events discovery pipeline already uses.
//
//   POST /api/v1/companies/search — {query} -> {company: {name, domain,
//                                    logoUrl} | null}
// ---------------------------------------------------------------------------

export interface CompanySearchResult {
  name: string;
  domain: string;
  logoUrl: string | null;
}

interface CompanySearchWire {
  name: string;
  domain: string;
  logoUrl?: string | null;
}

/** Returns null when nothing was confidently identified — the caller
 * (MockInterviewSetup.tsx) treats that the same whether the search
 * genuinely found no such company or the lookup itself failed/is
 * unavailable, since a company field is always optional here. */
export async function searchCompany(query: string): Promise<CompanySearchResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  try {
    const {data} = await apiClient.post<{company: CompanySearchWire | null}>('/api/v1/companies/search', {
      query: trimmed,
    });
    if (!data.company) return null;
    return {
      name: data.company.name,
      domain: data.company.domain,
      logoUrl: data.company.logoUrl ?? null,
    };
  } catch {
    return null;
  }
}
