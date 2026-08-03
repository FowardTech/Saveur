import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// dreamCompaniesService — Dream Company Dashboard (product request item):
// a persisted, tracked list of target companies with cached AI research
// (same generation as Company Intelligence — services/companyIntelService.ts
// — just persisted here instead of generate-on-demand) and real prep-
// progress signal. See saveur-backend's app/api/dream_companies.py.
// ---------------------------------------------------------------------------

export interface DreamCompanyIntel {
  overview: string;
  recentDevelopments: string[];
  cultureNotes: string;
  likelyQuestions: string[];
  talkingPoints: string[];
  sources: string[];
}

export interface DreamCompanyPrepProgress {
  sessionsPracticed: number;
  avgScore: number | null;
  applicationTracked: boolean;
}

export interface DreamCompany {
  id: number;
  company: string;
  targetRole: string | null;
  intel: DreamCompanyIntel | null;
  researchedAt: string | null;
  prepProgress: DreamCompanyPrepProgress;
  openJobsCount: number;
  researchStale: boolean;
}

interface DreamCompanyIntelWire {
  overview?: string;
  recent_developments?: string[];
  culture_notes?: string;
  likely_questions?: string[];
  talking_points?: string[];
  sources?: string[];
}

interface DreamCompanyWire {
  id: number;
  company: string;
  target_role?: string | null;
  intel?: DreamCompanyIntelWire | null;
  researched_at?: string | null;
  prep_progress?: {sessions_practiced?: number; avg_score?: number | null; application_tracked?: boolean};
  open_jobs_count?: number;
  research_stale?: boolean;
}

function intelFromWire(intel?: DreamCompanyIntelWire | null): DreamCompanyIntel | null {
  if (!intel) return null;
  return {
    overview: intel.overview ?? '',
    recentDevelopments: intel.recent_developments ?? [],
    cultureNotes: intel.culture_notes ?? '',
    likelyQuestions: intel.likely_questions ?? [],
    talkingPoints: intel.talking_points ?? [],
    sources: intel.sources ?? [],
  };
}

function fromWire(w: DreamCompanyWire): DreamCompany {
  return {
    id: w.id,
    company: w.company,
    targetRole: w.target_role ?? null,
    intel: intelFromWire(w.intel),
    researchedAt: w.researched_at ?? null,
    prepProgress: {
      sessionsPracticed: w.prep_progress?.sessions_practiced ?? 0,
      avgScore: w.prep_progress?.avg_score ?? null,
      applicationTracked: !!w.prep_progress?.application_tracked,
    },
    openJobsCount: w.open_jobs_count ?? 0,
    researchStale: !!w.research_stale,
  };
}

export async function listDreamCompanies(): Promise<DreamCompany[]> {
  const {data} = await apiClient.get<DreamCompanyWire[]>('/api/v1/dream-companies');
  return (data ?? []).map(fromWire);
}

/** Throws {error: "limit_reached" | "already_tracked", message?} on failure
 * so the screen can show a specific error. */
export async function addDreamCompany(company: string, role?: string): Promise<DreamCompany> {
  const {data} = await apiClient.post<DreamCompanyWire>('/api/v1/dream-companies', {company, role: role || ''});
  return fromWire(data);
}

export async function refreshDreamCompany(id: number): Promise<DreamCompany> {
  const {data} = await apiClient.post<DreamCompanyWire>(`/api/v1/dream-companies/${id}/refresh`);
  return fromWire(data);
}

export async function removeDreamCompany(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/dream-companies/${id}`);
}
