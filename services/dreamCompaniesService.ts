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
  // Same two fields Company Intelligence added (see
  // services/companyIntelService.ts's CompanyIntel) — this is the exact
  // same generation payload, just persisted here instead of discarded.
  salaryRange: string;
  interviewProcess: string;
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
  // Product report: "when users type the company they want the app should
  // display the logo of the company there too" — best-effort Clearbit logo
  // URL, computed server-side (see app/services/company_logo_service.py);
  // null/missing means no usable guess, in which case
  // components/CompanyLogoAvatar.tsx already falls back to an
  // initial-letter avatar (also its behavior on a wrong guess that 404s).
  logoUrl: string | null;
  targetRole: string | null;
  intel: DreamCompanyIntel | null;
  researchedAt: string | null;
  prepProgress: DreamCompanyPrepProgress;
  openJobsCount: number;
  researchStale: boolean;
  // Product request items — see app/api/dream_companies.py's own comments
  // for how each is computed (all pure arithmetic/queries over existing
  // real-activity data, no new AI calls).
  readinessScore: number;
  isTopChoice: boolean;
  hasNewJobAlert: boolean;
  // Product follow-up ("Why having this prompt that it's taking too long?
  // It supposed to be fast not slow") -- addDreamCompany() below now
  // returns immediately, before research finishes; true while the
  // backend's background research thread is still running for this row
  // (see app/api/dream_companies.py's add_company). DreamCompanies.tsx
  // polls while any row has this set, and shows a "researching…" state on
  // that card instead of the old "research not available yet" text.
  researchPending: boolean;
  // Product follow-up ("list the features you suggested for the dream
  // company dashboard... implement" -- "a personal notes field per
  // company") -- plain free-text the user owns, never touched by
  // research/refresh. Empty string, not null, when nothing's been written
  // yet (matches the backend's own `self.notes or ""` in to_dict).
  notes: string;
}

interface DreamCompanyIntelWire {
  overview?: string;
  recent_developments?: string[];
  culture_notes?: string;
  likely_questions?: string[];
  talking_points?: string[];
  salary_range?: string;
  interview_process?: string;
  sources?: string[];
}

interface DreamCompanyWire {
  id: number;
  company: string;
  logo_url?: string | null;
  target_role?: string | null;
  intel?: DreamCompanyIntelWire | null;
  researched_at?: string | null;
  prep_progress?: {sessions_practiced?: number; avg_score?: number | null; application_tracked?: boolean};
  open_jobs_count?: number;
  research_stale?: boolean;
  readiness_score?: number;
  is_top_choice?: boolean;
  has_new_job_alert?: boolean;
  research_pending?: boolean;
  notes?: string;
}

function intelFromWire(intel?: DreamCompanyIntelWire | null): DreamCompanyIntel | null {
  if (!intel) return null;
  return {
    overview: intel.overview ?? '',
    recentDevelopments: intel.recent_developments ?? [],
    cultureNotes: intel.culture_notes ?? '',
    likelyQuestions: intel.likely_questions ?? [],
    talkingPoints: intel.talking_points ?? [],
    salaryRange: intel.salary_range ?? '',
    interviewProcess: intel.interview_process ?? '',
    sources: intel.sources ?? [],
  };
}

function fromWire(w: DreamCompanyWire): DreamCompany {
  return {
    id: w.id,
    company: w.company,
    logoUrl: w.logo_url ?? null,
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
    readinessScore: w.readiness_score ?? 0,
    isTopChoice: !!w.is_top_choice,
    hasNewJobAlert: !!w.has_new_job_alert,
    researchPending: !!w.research_pending,
    notes: w.notes ?? '',
  };
}

export async function listDreamCompanies(): Promise<DreamCompany[]> {
  const {data} = await apiClient.get<DreamCompanyWire[]>('/api/v1/dream-companies');
  return (data ?? []).map(fromWire);
}

/** Prefetched research to hand straight to the backend instead of paying
 * for a second, redundant AI+web-search call — see CompanyIntelligence.tsx's
 * "Save to Dream Company Dashboard" action, which already has this exact
 * shape sitting in state from its own /company-intel/research call. */
export interface PrefetchedDreamCompanyIntel {
  company: string;
  overview: string;
  recentDevelopments: string[];
  cultureNotes: string;
  likelyQuestions: string[];
  talkingPoints: string[];
  salaryRange: string;
  interviewProcess: string;
  sources: string[];
}

/** Throws {error: "limit_reached" | "already_tracked", message?} on failure
 * so the screen can show a specific error. */
export async function addDreamCompany(
  company: string,
  role?: string,
  prefetchedIntel?: PrefetchedDreamCompanyIntel,
): Promise<DreamCompany> {
  const {data} = await apiClient.post<DreamCompanyWire>('/api/v1/dream-companies', {
    company,
    role: role || '',
    prefetched_intel: prefetchedIntel
      ? {
          company: prefetchedIntel.company,
          overview: prefetchedIntel.overview,
          recent_developments: prefetchedIntel.recentDevelopments,
          culture_notes: prefetchedIntel.cultureNotes,
          likely_questions: prefetchedIntel.likelyQuestions,
          talking_points: prefetchedIntel.talkingPoints,
          salary_range: prefetchedIntel.salaryRange,
          interview_process: prefetchedIntel.interviewProcess,
          sources: prefetchedIntel.sources,
        }
      : undefined,
  });
  return fromWire(data);
}

export async function refreshDreamCompany(id: number): Promise<DreamCompany> {
  const {data} = await apiClient.post<DreamCompanyWire>(`/api/v1/dream-companies/${id}/refresh`);
  return fromWire(data);
}

export async function removeDreamCompany(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/dream-companies/${id}`);
}

/** Body omitted = flip the current value server-side — see
 * app/api/dream_companies.py's toggle_priority. */
export async function toggleDreamCompanyPriority(id: number, isTopChoice?: boolean): Promise<DreamCompany> {
  const {data} = await apiClient.post<DreamCompanyWire>(`/api/v1/dream-companies/${id}/priority`,
    isTopChoice === undefined ? undefined : {is_top_choice: isTopChoice},
  );
  return fromWire(data);
}

/** Product follow-up ("a personal notes field per company") — plain
 * overwrite, same shape as toggleDreamCompanyPriority above. See
 * app/api/dream_companies.py's update_notes. */
export async function updateDreamCompanyNotes(id: number, notes: string): Promise<DreamCompany> {
  const {data} = await apiClient.post<DreamCompanyWire>(`/api/v1/dream-companies/${id}/notes`, {notes});
  return fromWire(data);
}
