import i18n from 'i18next';
import apiClient from './apiClient';
import { ResumeSections } from './resumeGenerationService';

function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// coverLetterService — AI Cover Letter Generator (product request item).
// POST /api/v1/resume/cover-letter (Pro-gated, same tier as /resume/generate)
// pulls the caller's own stored resume server-side and writes a tailored
// letter for the given company/role. Generate-on-demand, no persistence —
// same pattern as resumeGenerationService.generateResumeContent.
// ---------------------------------------------------------------------------

export interface CoverLetterInput {
  // Both optional (product follow-up — JDAnalyzer's "Generate Cover
  // Letter" card no longer makes the user retype the company/role/hiring
  // manager the pasted JD already names; see JDCoverLetterGenerator.tsx).
  // The backend requires at least one of company/role/jdText — CANNOT all
  // be empty — and reads company/role out of jdText itself when they're
  // left blank. CoverLetterGenerator.tsx's general-purpose flow still
  // always supplies both explicitly, unaffected by this being optional.
  company?: string;
  role?: string;
  hiringManager?: string;
  jdText?: string;
  // The exact resume to write the letter from — e.g. the one just tailored
  // for this job by GenerateResume.tsx, still held in that screen's local
  // state (tailored resumes were never persisted anywhere the server could
  // find on its own — see JDCoverLetterGenerator.tsx's comment). Omitted =
  // server falls back to the caller's stored primary resume, same as
  // before this field existed.
  resumeSections?: ResumeSections | null;
}

// Mirrors resumeService.ts's private toSectionsWire — kept here too since
// that one isn't exported and this is the only other place a ResumeSections
// object needs to go out over the wire in snake_case.
function toWire(sections: ResumeSections): Record<string, unknown> {
  return {
    contact: sections.contact,
    summary: sections.summary,
    core_skills: sections.coreSkills,
    certifications: sections.certifications,
    experience: sections.experience.map(e => ({
      title: e.title, company: e.company, location: e.location,
      start: e.start, end: e.end, bullets: e.bullets,
    })),
    education: sections.education,
    projects: sections.projects,
    volunteer: sections.volunteer,
    awards: sections.awards,
    languages: sections.languages,
    references: sections.references,
    suggested_keywords: sections.suggestedKeywords,
  };
}

/** Throws on failure (network/provider error, or missing company/role/JD) so
 * the screen can show a real error instead of silently producing nothing. */
export async function generateCoverLetter(input: CoverLetterInput): Promise<string> {
  const { data } = await apiClient.post<{ cover_letter?: string; error?: string; detail?: string }>(
    '/api/v1/resume/cover-letter',
    {
      company: input.company || '',
      role: input.role || '',
      hiring_manager: input.hiringManager || '',
      jd_text: input.jdText || '',
      resume: input.resumeSections ? toWire(input.resumeSections) : undefined,
      language: currentLanguage(),
    },
  );
  if (!data.cover_letter) {
    throw new Error(data.detail || data.error || 'generation_failed');
  }
  return data.cover_letter;
}

/**
 * Renders the letter text the caller already has in memory into a real
 * PDF/DOCX (POST /api/v1/resume/cover-letter/export) and returns a
 * fetchable https download url. Cover letters aren't persisted server-side
 * (generate-on-demand, no DB row/id — see generateCoverLetter above), so
 * the text is sent back up rather than referenced by id. Was previously
 * missing entirely: CoverLetterGenerator.tsx's only action on a finished
 * letter was Share.share({message: letter}), a plain-text share since
 * there was no real file to hand the share sheet.
 */
export async function exportCoverLetter(
  text: string,
  format: 'pdf' | 'docx' = 'pdf',
): Promise<{url?: string}> {
  const {data} = await apiClient.post<{url?: string}>('/api/v1/resume/cover-letter/export', {
    text,
    format,
  });
  const isFetchableUrl = typeof data.url === 'string' && /^https?:\/\//i.test(data.url);
  return {url: isFetchableUrl ? data.url : undefined};
}
