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
}

interface WireBriefing {
  narrative?: string | null;
  priorities?: BriefingPriority[];
}

export async function getTodayBriefing(): Promise<HomeBriefing> {
  try {
    const { data } = await apiClient.get<WireBriefing>('/api/v1/career-os/briefing', {
      params: { language: currentLanguage() },
    });
    return { narrative: data.narrative ?? null, priorities: data.priorities ?? [] };
  } catch {
    return { narrative: null, priorities: [] };
  }
}
