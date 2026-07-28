import i18n from 'i18next';
import apiClient from './apiClient';
import { ResumeSections } from './resumeService';

function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// resumeVariantsService — AI Resume Evolution (product request item, Pro
// Premium). Multiple independently AI-tailored resume variants saved side
// by side — see app/api/resume_variants.py. Reuses ResumeSections
// (services/resumeService.ts) for the section shape so a variant can be
// rendered with the same toPlainTextResume/export machinery as the base
// resume.
// ---------------------------------------------------------------------------

export interface ResumeVariant {
  id: number;
  label: string;
  targetRole: string;
  targetCompany: string | null;
  sections: ResumeSections;
  createdAt: string | null;
  updatedAt: string | null;
}

interface WireVariant {
  id?: number;
  label?: string;
  target_role?: string;
  target_company?: string | null;
  sections?: any;
  created_at?: string | null;
  updated_at?: string | null;
}

function emptySections(): ResumeSections {
  return {
    contact: { name: '', email: '', phone: '', location: '', links: [] },
    summary: '', coreSkills: [], certifications: [], experience: [],
    education: [], projects: [], volunteer: [], awards: [], languages: [],
    references: [], suggestedKeywords: [],
  };
}

function mapSections(raw: any): ResumeSections {
  if (!raw) return emptySections();
  return {
    contact: {
      name: raw.contact?.name ?? '', email: raw.contact?.email ?? '',
      phone: raw.contact?.phone ?? '', location: raw.contact?.location ?? '',
      links: raw.contact?.links ?? [],
    },
    summary: raw.summary ?? '',
    coreSkills: raw.core_skills ?? [],
    certifications: raw.certifications ?? [],
    experience: raw.experience ?? [],
    education: raw.education ?? [],
    projects: raw.projects ?? [],
    volunteer: raw.volunteer ?? [],
    awards: raw.awards ?? [],
    languages: raw.languages ?? [],
    references: raw.references ?? [],
    suggestedKeywords: raw.suggested_keywords ?? [],
  };
}

function mapVariant(w: WireVariant): ResumeVariant {
  return {
    id: w.id ?? 0,
    label: w.label ?? '',
    targetRole: w.target_role ?? '',
    targetCompany: w.target_company ?? null,
    sections: mapSections(w.sections),
    createdAt: w.created_at ?? null,
    updatedAt: w.updated_at ?? null,
  };
}

export async function listVariants(): Promise<ResumeVariant[]> {
  try {
    const { data } = await apiClient.get<{ items?: WireVariant[] }>('/api/v1/resume/variants');
    return (data.items ?? []).map(mapVariant);
  } catch {
    return [];
  }
}

/** Throws on failure so the create screen can show a real error. */
export async function createVariant(input: {
  label: string; targetRole: string; targetCompany?: string; jdText?: string;
}): Promise<ResumeVariant> {
  const { data } = await apiClient.post<WireVariant>('/api/v1/resume/variants', {
    label: input.label,
    target_role: input.targetRole,
    target_company: input.targetCompany || '',
    jd_text: input.jdText || '',
    language: currentLanguage(),
  });
  return mapVariant(data);
}

export async function deleteVariant(id: number): Promise<void> {
  try {
    await apiClient.delete(`/api/v1/resume/variants/${id}`);
  } catch {
    // best-effort
  }
}

/**
 * Renders this variant's own tailored sections to a real PDF/DOCX and
 * returns a fetchable https download URL (POST /api/v1/resume/variants/
 * <id>/export — see app/api/resume_variants.py's export_variant). Was
 * missing entirely: the Resume Evolution share button used to fall back to
 * Share.share({message: text}), a plain-text dump with no real file, since
 * there was nothing else to share. Same isFetchableUrl guard as
 * resumeGenerationService.generateResumeDocument — never hand the caller a
 * raw backend filesystem path.
 */
export async function exportVariant(
  id: number,
  format: 'pdf' | 'docx' = 'pdf',
): Promise<{url?: string}> {
  const {data} = await apiClient.post<{url?: string}>(
    `/api/v1/resume/variants/${id}/export`,
    {format},
  );
  const isFetchableUrl = typeof data.url === 'string' && /^https?:\/\//i.test(data.url);
  return {url: isFetchableUrl ? data.url : undefined};
}
