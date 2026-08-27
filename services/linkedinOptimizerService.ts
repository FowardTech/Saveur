import i18n from 'i18next';
import apiClient from './apiClient';

function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// linkedinOptimizerService — AI LinkedIn Optimizer (product request item,
// Pro Premium). The app's LinkedIn integration is sign-in only (no profile
// content access), so this critiques/rewrites profile text the screen
// pre-fills from the user's already-uploaded resume/LinkedIn export
// (src/more/LinkedInOptimizer.tsx's prefilledFromResume effect, backed by
// resumeService.getStoredResumeSections()) or that the user pastes/edits in
// themselves — see app/api/linkedin_optimizer.py's module docstring for the
// full reasoning on why this can't read a live LinkedIn profile instead.
// ---------------------------------------------------------------------------

export interface SuggestionField {
  suggestion: string;
  feedback: string;
}

export interface BulletSuggestion {
  original: string;
  suggestion: string;
}

export interface OptimizationResult {
  headline: SuggestionField | null;
  about: SuggestionField | null;
  experienceBullets: BulletSuggestion[];
  overallFeedback: string;
  profileStrengthScore: number | null;
}

interface WireResult {
  headline?: SuggestionField | null;
  about?: SuggestionField | null;
  experience_bullets?: BulletSuggestion[];
  overall_feedback?: string;
  profile_strength_score?: number | null;
}

// A single past optimize() run — GET /api/v1/linkedin/history (product
// request item: score history, so a user can see their profile-strength
// score improve over time instead of every past run being lost the moment
// they navigate away). `response` is the same shape optimizeProfile()
// returns, wire-cased, so a past run can be re-opened and read in full.
export interface OptimizationHistoryEntry {
  id: number;
  targetRole: string | null;
  profileStrengthScore: number | null;
  response: WireResult | null;
  createdAt: string | null;
}

interface WireHistoryEntry {
  id: number;
  target_role: string | null;
  profile_strength_score: number | null;
  response: WireResult | null;
  created_at: string | null;
}

export interface PrefillResult {
  headline: string;
  about: string;
  experienceBullets: string[];
}

interface WirePrefill {
  headline?: string;
  about?: string;
  experience_bullets?: string[];
}

/**
 * GET /api/v1/linkedin/prefill — bug fix (product report: "I thought i
 * asked to auto populate the linkedIn optimizer by extracting the
 * linkedin portfolio that the user uploads. You did not do that").
 * LinkedInOptimizer.tsx previously prefilled itself from
 * resumeService.getStoredResumeSections(), which only reads STRUCTURED
 * resume sections (populated by the AI resume generator or a manual
 * section edit) — a raw file uploaded via ResumeBuilder's "LinkedIn"
 * import slot never populates those, only best-effort extracted text, so
 * that prefill silently did nothing for anyone who'd only ever uploaded
 * their LinkedIn export. This endpoint is the real fix: the backend looks
 * specifically for that LinkedIn upload first, and if it's raw
 * (unstructured) extracted text, runs a real LLM extraction pass to pull
 * a headline/about/bullets out of it — see app/api/linkedin_optimizer.py's
 * prefill() docstring for the full reasoning.
 *
 * Returns null when the user has no LinkedIn upload and no other resume
 * on file yet (real 204, not an error) — the screen falls back to a
 * blank paste box in that case, same as before this existed.
 */
export async function getPrefill(): Promise<PrefillResult | null> {
  // BUG FIX (product report: LinkedIn Optimizer's "About Me" prefill text
  // still showing English on a Chinese locale) -- this LLM-extraction call
  // was the one call in this file NOT sending `language`, unlike
  // optimizeProfile() below (line ~134). Same currentLanguage() param that
  // one already sends.
  const { data, status } = await apiClient.get<WirePrefill>('/api/v1/linkedin/prefill', {
    params: { language: currentLanguage() },
    validateStatus: s => s === 200 || s === 204,
  });
  if (status === 204 || !data) return null;
  const headline = data.headline ?? '';
  const about = data.about ?? '';
  const experienceBullets = data.experience_bullets ?? [];
  if (!headline && !about && !experienceBullets.length) return null;
  return { headline, about, experienceBullets };
}

/** Throws on failure so the screen can show a real error. */
export async function getHistory(): Promise<OptimizationHistoryEntry[]> {
  const { data } = await apiClient.get<{history: WireHistoryEntry[]}>('/api/v1/linkedin/history');
  return (data.history ?? []).map(h => ({
    id: h.id,
    targetRole: h.target_role,
    profileStrengthScore: h.profile_strength_score,
    response: h.response,
    createdAt: h.created_at,
  }));
}

/** Throws on failure so the screen can show a real error. */
export async function optimizeProfile(input: {
  headline?: string;
  about?: string;
  experienceBullets?: string[];
  targetRole?: string;
}): Promise<OptimizationResult> {
  const { data } = await apiClient.post<WireResult>('/api/v1/linkedin/optimize', {
    headline: input.headline || '',
    about: input.about || '',
    experience_bullets: input.experienceBullets || [],
    target_role: input.targetRole || '',
    language: currentLanguage(),
  });
  return {
    headline: data.headline ?? null,
    about: data.about ?? null,
    experienceBullets: data.experience_bullets ?? [],
    overallFeedback: data.overall_feedback ?? '',
    profileStrengthScore: data.profile_strength_score ?? null,
  };
}
