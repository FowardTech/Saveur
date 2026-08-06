import apiClient from './apiClient';
import { SuggestedActionId } from 'constants/Types';

// ---------------------------------------------------------------------------
// careerDnaService — Career DNA (product request item, merges what was
// pitched separately as "Career DNA" and "Career Genome" — the exact same
// concept: a living behavioral profile the AI builds from real usage
// signals across the app, not a one-time onboarding quiz). See
// saveur-backend's app/api/career_dna.py + app/services/career_dna_service.py.
// ---------------------------------------------------------------------------

export interface CareerDnaTraits {
  personality_summary?: string;
  communication_style?: string;
  leadership_style?: string;
  technical_strengths?: string[];
  learning_speed?: string;
  confidence_pattern?: string;
  preferred_environment?: string;
  blind_spots?: string[];
  ideal_management_style?: string;
  ideal_company_size?: string;
  ideal_industries?: string[];
  learning_preferences?: string[];
  career_risks?: string[];
}

export interface CareerDnaProfile {
  hasProfile: boolean;
  traits: CareerDnaTraits;
  narrative: string;
  signalCount: number;
  version: number;
  generatedAt: string | null;
  // Product request item: "actionable next steps tied to blind spots" —
  // a small, AI-picked subset of the SAME action ids the Coach's
  // SUGGESTED_ACTION already uses (see services/suggestedActions.ts) —
  // never a free-text label of its own, so rendering/navigation is 100%
  // reused from that existing system.
  nextStepActionIds: SuggestedActionId[];
}

interface CareerDnaWire {
  has_profile?: boolean;
  traits?: CareerDnaTraits;
  narrative?: string;
  signal_count?: number;
  version?: number;
  generated_at?: string | null;
  next_step_action_ids?: string[];
}

function fromWire(data: CareerDnaWire): CareerDnaProfile {
  return {
    hasProfile: !!data.has_profile,
    traits: data.traits ?? {},
    narrative: data.narrative ?? '',
    signalCount: data.signal_count ?? 0,
    version: data.version ?? 1,
    generatedAt: data.generated_at ?? null,
    nextStepActionIds: (data.next_step_action_ids ?? []) as SuggestedActionId[],
  };
}

export interface CareerDnaHistoryEntry {
  version: number;
  narrative: string;
  generatedAt: string | null;
}

interface CareerDnaHistoryWire {
  version: number;
  narrative?: string;
  generated_at?: string | null;
}

export interface CareerDnaFitCheck {
  fitScore: number;
  fitSummary: string;
  styleStrengths: string[];
  potentialFrictionPoints: string[];
}

interface CareerDnaFitCheckWire {
  fit_score?: number;
  fit_summary?: string;
  style_strengths?: string[];
  potential_friction_points?: string[];
}

/** GET current profile — transparently regenerates server-side first if
 * enough new activity has accumulated since the last version. */
export async function getProfile(): Promise<CareerDnaProfile> {
  const {data} = await apiClient.get<CareerDnaWire>('/api/v1/career-dna');
  return fromWire(data);
}

/** User-initiated "refresh now" — bypasses the cooldown between
 * regenerations (still requires the minimum signal count for a genuinely
 * first-ever profile). */
export async function refreshProfile(): Promise<CareerDnaProfile> {
  const {data} = await apiClient.post<CareerDnaWire>('/api/v1/career-dna/refresh');
  return fromWire(data);
}

/** Product request item: "profile-over-time trend" — up to the last 10
 * regenerated versions, newest first. English-only (see
 * app/api/career_dna.py's /history route comment). */
export async function getHistory(): Promise<CareerDnaHistoryEntry[]> {
  const {data} = await apiClient.get<CareerDnaHistoryWire[]>('/api/v1/career-dna/history');
  return (data ?? []).map(w => ({
    version: w.version,
    narrative: w.narrative ?? '',
    generatedAt: w.generated_at ?? null,
  }));
}

/** Product request item: "compare against a job description" — a
 * work-style/culture fit read against a pasted JD, distinct from JD
 * Analyzer's resume/skills match (see app/api/career_dna.py's /fit-check
 * comment). Throws {error: "no_profile_yet", message} if there isn't a
 * Career DNA profile to compare yet. */
export async function fitCheck(jdText: string): Promise<CareerDnaFitCheck> {
  const {data} = await apiClient.post<CareerDnaFitCheckWire>('/api/v1/career-dna/fit-check', {jd_text: jdText});
  return {
    fitScore: data.fit_score ?? 0,
    fitSummary: data.fit_summary ?? '',
    styleStrengths: data.style_strengths ?? [],
    potentialFrictionPoints: data.potential_friction_points ?? [],
  };
}
