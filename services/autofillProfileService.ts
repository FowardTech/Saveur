import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// autofillProfileService — product request item 2 ("the app should be able
// to extract the user's information from the documents such as resume,
// certificate, portfolio etc already in the app and auto fill the job
// application input field in the webview when the user wants to apply for
// the job").
//
// GET /api/v1/autofill/profile (app/api/autofill.py, Pro-gated same as the
// adjacent AI resume/cover-letter features) does the actual extraction
// server-side — it gathers the user's account profile fields, any
// AI-generated resume sections, and text-extracted from every uploaded
// document, then folds all of that into ONE flat, autofill-shaped JSON via
// a single LLM call. This file just calls it and shapes the response for
// the WebView autofill engine (see utils/webviewAutofill.ts) to consume.
//
// Deliberately no client-side caching beyond a single in-memory value for
// the current WebView session (see WebViewScreen.tsx) — re-fetching each
// time the user opens a new application page picks up any resume/document
// change for free, and this is a real LLM call so a wrong stale value
// silently reused on old data would be worse than the extra round trip.
// ---------------------------------------------------------------------------

export interface AutofillProfile {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  githubUrl?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  yearsExperience?: number | null;
  highestDegree?: string | null;
  school?: string | null;
  skills?: string[];
  summary?: string | null;
}

interface AutofillProfileWire {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  github_url?: string | null;
  current_title?: string | null;
  current_company?: string | null;
  years_experience?: number | null;
  highest_degree?: string | null;
  school?: string | null;
  skills?: string[];
  summary?: string | null;
}

interface AutofillResponseWire {
  profile: AutofillProfileWire | null;
  sources_used: number;
}

function fromWire(wire: AutofillProfileWire): AutofillProfile {
  return {
    firstName: wire.first_name ?? null,
    lastName: wire.last_name ?? null,
    fullName: wire.full_name ?? null,
    email: wire.email ?? null,
    phone: wire.phone ?? null,
    addressLine1: wire.address_line1 ?? null,
    city: wire.city ?? null,
    state: wire.state ?? null,
    postalCode: wire.postal_code ?? null,
    country: wire.country ?? null,
    linkedinUrl: wire.linkedin_url ?? null,
    portfolioUrl: wire.portfolio_url ?? null,
    githubUrl: wire.github_url ?? null,
    currentTitle: wire.current_title ?? null,
    currentCompany: wire.current_company ?? null,
    yearsExperience: wire.years_experience ?? null,
    highestDegree: wire.highest_degree ?? null,
    school: wire.school ?? null,
    skills: wire.skills ?? [],
    summary: wire.summary ?? null,
  };
}

/**
 * GET /api/v1/autofill/profile — returns null when there's nothing at all
 * to work with yet (no profile fields, no resume, no documents), so the
 * caller can show a "add a resume first" prompt instead of a confusing
 * empty autofill pass.
 */
export async function getAutofillProfile(): Promise<AutofillProfile | null> {
  const {data} = await apiClient.get<AutofillResponseWire>('/api/v1/autofill/profile');
  return data?.profile ? fromWire(data.profile) : null;
}
