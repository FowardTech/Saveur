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
