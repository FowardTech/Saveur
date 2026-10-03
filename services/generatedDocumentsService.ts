import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// "My Documents" (product request item): every resume/CV, cover letter, and
// tailored resume variant a user has ever exported to PDF/DOCX, listed so a
// previous export can be redownloaded instead of regenerating it from
// scratch. See app/models/generated_document.py — this is purely an index
// over files that were already uploaded by resumeGenerationService's/
// coverLetterService's/resumeVariantsService's own export calls; nothing
// here creates a new file.
// ---------------------------------------------------------------------------

export type GeneratedDocumentKind = 'resume' | 'cover_letter' | 'resume_variant';

export interface GeneratedDocument {
  id: number;
  kind: GeneratedDocumentKind;
  label: string;
  format: string | null;
  url: string | null;
  // Cover letters only (product report: "when a CV or Cover letter is
  // generated and it's saved, the user should be able to come and edit
  // and update that same generated CV or cover later") — the plain-text
  // source, null for resume/resume_variant rows (their real editable
  // source is Resume Builder's structured sections instead). See
  // app/models/generated_document.py's own comment.
  content: string | null;
  /** The user's original text (editors load/save this); `content` may be a display translation. */
  originalContent: string | null;
  createdAt: string | null;
}

interface WireDocument {
  id?: number;
  kind?: string;
  label?: string;
  format?: string | null;
  url?: string | null;
  content?: string | null;
  content_original?: string | null;
  created_at?: string | null;
}

function mapDocument(w: WireDocument): GeneratedDocument {
  return {
    id: w.id ?? 0,
    kind: (w.kind as GeneratedDocumentKind) ?? 'resume',
    label: w.label ?? '',
    format: w.format ?? null,
    url: w.url ?? null,
    content: w.content ?? null,
    originalContent: w.content_original ?? w.content ?? null,
    createdAt: w.created_at ?? null,
  };
}

export async function listGeneratedDocuments(): Promise<GeneratedDocument[]> {
  try {
    const { data } = await apiClient.get<WireDocument[]>('/api/v1/resume/documents');
    return (Array.isArray(data) ? data : []).map(mapDocument);
  } catch {
    return [];
  }
}

export async function deleteGeneratedDocument(id: number): Promise<void> {
  try {
    await apiClient.delete(`/api/v1/resume/documents/${id}`);
  } catch {
    // best-effort — same pattern as resumeVariantsService.deleteVariant
  }
}

// Product request: "they should be able to rename the document" — throws on
// failure (unlike the best-effort delete above) so GeneratedDocuments.tsx's
// rename modal can tell the user it didn't actually save, instead of
// silently closing on a name that never took.
export async function renameGeneratedDocument(id: number, label: string): Promise<GeneratedDocument> {
  const { data } = await apiClient.patch<WireDocument>(`/api/v1/resume/documents/${id}`, { label });
  return mapDocument(data);
}

/**
 * Saves revised cover letter text back onto this same saved document —
 * PATCH /api/v1/resume/documents/{id} re-renders the PDF/DOCX in place and
 * updates its url, so redownloading it afterward returns the edited
 * version (product report: "when a CV or Cover letter is generated and
 * it's saved, the user should be able to come and edit and update that
 * same generated CV or cover later"). Cover letters only — 400s
 * server-side for any other kind. Optionally renames at the same time.
 * Throws on failure.
 */
export async function updateGeneratedDocumentContent(
  id: number,
  content: string,
  label?: string,
): Promise<GeneratedDocument> {
  const body: Record<string, string> = { content };
  if (label !== undefined) body.label = label;
  const { data } = await apiClient.patch<WireDocument>(`/api/v1/resume/documents/${id}`, body);
  return mapDocument(data);
}
