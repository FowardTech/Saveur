import i18n from 'i18next';
import apiClient from './apiClient';

function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// careerOsService — AI Career Operating System home briefing (product
// request item). GET /api/v1/career-os/briefing lazy-generates a synthesis
// of the user's real current state into one cohesive daily briefing — see
// app/api/career_os.py.
// ---------------------------------------------------------------------------

export interface BriefingPriority {
  label: string;
  action: string;
}

export interface HomeBriefing {
  narrative: string | null;
  priorities: BriefingPriority[];
  // True for the admin-editable "get started" teaser shown to a user with
  // nothing real to synthesize yet (see app/api/career_os.py's has_anything
  // branch) rather than a real AI-synthesized briefing — product request
  // item, task #42's free-tier variation. Lets the mobile card style/label
  // this differently (e.g. an "Upgrade" CTA for free users) instead of
  // presenting starter copy as if it were a personalized daily briefing.
  isTeaser: boolean;
}

interface WireBriefing {
  narrative?: string | null;
  priorities?: BriefingPriority[];
  is_teaser?: boolean;
}

export async function getTodayBriefing(): Promise<HomeBriefing> {
  try {
    const { data } = await apiClient.get<WireBriefing>('/api/v1/career-os/briefing', {
      params: { language: currentLanguage() },
    });
    return { narrative: data.narrative ?? null, priorities: data.priorities ?? [], isTeaser: !!data.is_teaser };
  } catch {
    return { narrative: null, priorities: [], isTeaser: false };
  }
}
