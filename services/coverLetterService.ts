import i18n from 'i18next';
import apiClient from './apiClient';

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
  company: string;
  role: string;
  hiringManager?: string;
  jdText?: string;
}

/** Throws on failure (network/provider error, or missing company/role) so the
 * screen can show a real error instead of silently producing nothing. */
export async function generateCoverLetter(input: CoverLetterInput): Promise<string> {
  const { data } = await apiClient.post<{ cover_letter?: string; error?: string; detail?: string }>(
    '/api/v1/resume/cover-letter',
    {
      company: input.company,
      role: input.role,
      hiring_manager: input.hiringManager || '',
      jd_text: input.jdText || '',
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
