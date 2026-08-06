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
  createdAt: string | null;
}

interface WireDocument {
  id?: number;
  kind?: string;
  label?: string;
  format?: string | null;
  url?: string | null;
  created_at?: string | null;
}

function mapDocument(w: WireDocument): GeneratedDocument {
  return {
    id: w.id ?? 0,
    kind: (w.kind as GeneratedDocumentKind) ?? 'resume',
    label: w.label ?? '',
    format: w.format ?? null,
    url: w.url ?? null,
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
