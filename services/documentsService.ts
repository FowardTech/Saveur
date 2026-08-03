import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// documentsService — real backend implementation.
//
// Generic S3-backed document storage — POST/GET/DELETE /api/v1/documents —
// separate from the resume-specific upload already wired to
// POST /api/v1/resume/upload in resumeService.ts's importSource().
// listDocuments()/uploadDocument() back the "choose from My Documents"
// picker (see components/DocumentPickerModal.tsx, used by
// ResumeBuilder.tsx's import cards and JDAnalyzer.tsx's "tailor an
// existing resume" flow) and the standalone My Documents screen
// (src/more/MyDocuments.tsx).
//
// Follows the same multipart-upload pattern as resumeService.importSource():
// React Native's global FormData understands `{uri, type, name}` objects
// directly, so the file at `file.uri` is streamed from disk rather than read
// into memory first, and Content-Type is left for axios/RN to set
// automatically (it needs a generated multipart boundary we can't supply by
// hand).
// ---------------------------------------------------------------------------

export interface UploadableFile {
  uri: string;
  name: string;
  sizeBytes?: number | null;
  mimeType?: string | null;
  // Free-text document category (e.g. "Resume", "Cover Letter",
  // "Certificate", "Transcript", "Portfolio") — not part of the minimal
  // {id, url} contract this endpoint returns, but sent along as extra
  // multipart metadata (same idea as resumeService.importSource's
  // `source_key` field) in case the backend stores/uses it.
  docType?: string;
}

export interface DocumentRecord {
  id: string;
  url: string;
  name?: string;
  sizeBytes?: number | null;
  mimeType?: string | null;
  // Was stored server-side (every /documents/upload call sends a doc_type/
  // kind) but never actually round-tripped back on GET /api/v1/documents —
  // every consumer had to treat every row as an undifferentiated
  // "document" with no way to tell a resume from a certificate/portfolio
  // file apart. Now returned as `kind` (see app/api/documents.py's
  // _to_wire) so screens like JDAnalyzer's "tailor an uploaded resume"
  // picker can filter to resume-like files instead of showing everything.
  kind?: string | null;
  createdAt?: number;
}

interface DocumentWire {
  id: string;
  url: string;
  name?: string;
  file_name?: string;
  size_bytes?: number;
  mime_type?: string;
  kind?: string | null;
  created_at?: number | string;
  createdAt?: number | string;
}

function fromWire(wire: DocumentWire): DocumentRecord {
  const createdRaw = wire.created_at ?? wire.createdAt;
  return {
    id: wire.id,
    url: wire.url,
    name: wire.name ?? wire.file_name,
    sizeBytes: wire.size_bytes ?? null,
    mimeType: wire.mime_type ?? null,
    kind: wire.kind ?? null,
    createdAt:
      createdRaw != null
        ? typeof createdRaw === 'string'
          ? new Date(createdRaw).getTime()
          : createdRaw
        : undefined,
  };
}

/**
 * POST /api/v1/documents/upload — multipart upload of an arbitrary file
 * (picked from the device's file system, e.g. via
 * @react-native-documents/picker like ResumeBuilder.tsx does for resume
 * sources). Returns the stored document's id + a fetchable URL.
 */
export async function uploadDocument(file: UploadableFile): Promise<DocumentRecord> {
  const formData = new FormData();
  if (file.docType) formData.append('doc_type', file.docType);
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? 'application/octet-stream',
  });
  const {data} = await apiClient.post<DocumentWire>('/api/v1/documents/upload', formData);
  return fromWire(data);
}

/**
 * GET /api/v1/documents — list the current user's uploaded documents.
 */
export async function listDocuments(): Promise<DocumentRecord[]> {
  const {data} = await apiClient.get<DocumentWire[]>('/api/v1/documents');
  return (data ?? []).map(fromWire);
}

/**
 * DELETE /api/v1/documents/{id} — remove a stored document.
 */
export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/documents/${id}`);
}
