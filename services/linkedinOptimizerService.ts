import i18n from 'i18next';
import apiClient from './apiClient';

function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// linkedinOptimizerService — AI LinkedIn Optimizer (product request item,
// Pro Premium). The app's LinkedIn integration is sign-in only (no profile
// content access), so this critiques/rewrites whatever profile text the
// user pastes in themselves — see app/api/linkedin_optimizer.py's module
// docstring for the full reasoning.
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
