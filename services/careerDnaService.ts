import apiClient from './apiClient';

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
}

interface CareerDnaWire {
  has_profile?: boolean;
  traits?: CareerDnaTraits;
  narrative?: string;
  signal_count?: number;
  version?: number;
  generated_at?: string | null;
}

function fromWire(data: CareerDnaWire): CareerDnaProfile {
  return {
    hasProfile: !!data.has_profile,
    traits: data.traits ?? {},
    narrative: data.narrative ?? '',
    signalCount: data.signal_count ?? 0,
    version: data.version ?? 1,
    generatedAt: data.generated_at ?? null,
  };
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
