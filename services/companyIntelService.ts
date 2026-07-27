import i18n from 'i18next';
import apiClient from './apiClient';

function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// companyIntelService — Company Intelligence (product request item):
// pre-interview research + likely question generation, grounded in real web
// search — see app/api/company_intel.py.
// ---------------------------------------------------------------------------

export interface CompanyIntel {
  company: string;
  overview: string;
  recentDevelopments: string[];
  cultureNotes: string;
  likelyQuestions: string[];
  talkingPoints: string[];
  sources: string[];
}

interface WireIntel {
  company?: string;
  overview?: string;
  recent_developments?: string[];
  culture_notes?: string;
  likely_questions?: string[];
  talking_points?: string[];
  sources?: string[];
}

/** Throws on failure so the screen can show a real error. */
export async function researchCompany(company: string, role?: string): Promise<CompanyIntel> {
  const { data } = await apiClient.post<WireIntel>('/api/v1/company-intel/research', {
    company, role: role || '', language: currentLanguage(),
  });
  return {
    company: data.company ?? company,
    overview: data.overview ?? '',
    recentDevelopments: data.recent_developments ?? [],
    cultureNotes: data.culture_notes ?? '',
    likelyQuestions: data.likely_questions ?? [],
    talkingPoints: data.talking_points ?? [],
    sources: data.sources ?? [],
  };
}
