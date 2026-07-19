import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage} from 'constants/Types';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// resumeService — real backend implementation.
//
// Backs the ResumeBuilder screen: "import from X" sources, an ATS-score
// analysis, AI bullet rewriting, and (service-level, no UI yet) section
// updates + export. See docs/BACKEND_API_SPEC.md §6 for background — note the
// endpoint paths/request shapes below follow the up-to-date contract given
// for this task, which supersedes that doc in a couple of places (upload vs.
// import, ats-score vs. analyze, etc.); the doc should be refreshed to match.
//
// Wire format note: like authService.ts, the backend's field names
// (snake_case) are translated to/from the app's camelCase types in this one
// file so no screen needs to know about it. AsyncStorage is kept only as an
// offline-read fallback cache (see readCache/writeCache), never the source of
// truth — every read goes to the network first.
// ---------------------------------------------------------------------------

export type ResumeImportSourceKey =
  | 'resume'
  | 'linkedin'
  | 'portfolio'
  | 'certificates'
  | 'transcript';

export interface ImportedFileInfo {
  uri: string;
  name: string;
  sizeBytes?: number | null;
  mimeType?: string | null;
}

export interface ResumeAnalysisResult {
  atsScore: number;
  tips: string[];
}
export interface RewriteBulletResult {
  rewritten: string;
  explanation: string;
}

// ---- GET/PATCH /api/v1/resume wire shapes ----
interface ResumeSourceWire {
  source_key: string;
  file_name: string;
  size_bytes?: number;
  mime_type?: string;
  parsed_preview_url?: string;
}
interface ResumeWire {
  sources?: ResumeSourceWire[];
  sections?: Record<string, unknown>;
}

function fromWireSources(wire: ResumeWire | null | undefined): Record<string, ImportedFileInfo> {
  const result: Record<string, ImportedFileInfo> = {};
  for (const source of wire?.sources ?? []) {
    if (!source?.source_key) continue;
    result[source.source_key] = {
      uri: source.parsed_preview_url ?? '',
      name: source.file_name ?? 'Uploaded file',
      sizeBytes: source.size_bytes ?? null,
      mimeType: source.mime_type ?? null,
    };
  }
  return result;
}

const readCache = async (): Promise<Record<string, ImportedFileInfo>> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.resumeImportedSources);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    // Older cached shape was Record<string, boolean> — normalize away any
    // leftover boolean values instead of crashing screens that expect
    // ImportedFileInfo objects.
    const normalized: Record<string, ImportedFileInfo> = {};
    for (const [key, value] of Object.entries(parsed ?? {})) {
      if (value && typeof value === 'object' && 'name' in (value as object)) {
        normalized[key] = value as ImportedFileInfo;
      }
    }
    return normalized;
  } catch {
    return {};
  }
};

const writeCache = async (
  sources: Record<string, ImportedFileInfo>,
): Promise<Record<string, ImportedFileInfo>> => {
  await AsyncStorage.setItem(EKeyAsyncStorage.resumeImportedSources, JSON.stringify(sources));
  return sources;
};

/**
 * POST /api/v1/resume/upload — multipart/form-data upload of a document
 * picked from the device's real file system (via
 * @react-native-documents/picker — see ResumeBuilder.tsx, which opens the
 * native picker and passes the selected file's uri/name/size/mimeType here).
 * The backend parses + stores it against `sourceKey`.
 *
 * React Native's global FormData understands `{uri, type, name}` objects
 * directly, so the file at `file.uri` is streamed from disk rather than read
 * into memory first. Content-Type is intentionally left for axios/RN to set
 * automatically (it needs to include a generated multipart boundary that we
 * can't supply by hand).
 */
export async function importSource(
  sourceKey: ResumeImportSourceKey,
  file: ImportedFileInfo,
): Promise<void> {
  const formData = new FormData();
  formData.append('source_key', sourceKey);
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType ?? 'application/octet-stream',
  });
  await apiClient.post('/api/v1/resume/upload', formData);

  // Best-effort local echo so the "Uploaded" badge flips immediately without
  // waiting on a refetch; getImportedSources() below is still the real
  // source of truth on next load.
  const current = await readCache();
  current[sourceKey] = file;
  await writeCache(current);
}

/**
 * GET /api/v1/resume — the user's current resume record, including which
 * sources have been uploaded (with their parsed file's name/metadata), so
 * the screen can restore its "Uploaded" badges on mount instead of resetting
 * every time it's opened. Falls back to the last-known cache when offline.
 */
export async function getImportedSources(): Promise<Record<string, ImportedFileInfo>> {
  try {
    const {data} = await apiClient.get<ResumeWire>('/api/v1/resume');
    return writeCache(fromWireSources(data));
  } catch {
    return readCache();
  }
}

/**
 * PATCH /api/v1/resume — update resume sections (summary, experience,
 * education, skills, …). No section-editing UI exists in ResumeBuilder.tsx
 * yet, so this isn't called anywhere today — exposed for whichever screen
 * ends up owning that editor next.
 */
export async function updateResumeSections(sections: Record<string, unknown>): Promise<void> {
  await apiClient.patch('/api/v1/resume', {sections});
}

/**
 * POST /api/v1/resume/ats-score — run a real resume-parsing + ATS-scoring
 * pass server-side (contact info/section completeness/keyword density/
 * formatting issues) against the user's currently stored resume.
 */
export async function analyzeResume(): Promise<ResumeAnalysisResult> {
  const {data} = await apiClient.post<{score?: number; suggestions?: string[]}>(
    '/api/v1/resume/ats-score',
    {},
  );
  return {
    atsScore: data.score ?? 0,
    tips: data.suggestions ?? [],
  };
}

/**
 * POST /api/v1/resume/rewrite-bullet — real LLM rewrite of a single resume
 * bullet, with `role`/`tone` passed as context so any injected metric isn't
 * a generic placeholder.
 *
 * `role`/`tone` aren't collected anywhere in the ResumeBuilder UI today, so
 * callers may pass them explicitly (e.g. from the user's profile
 * goals/industries via AuthContext); if omitted, `tone` defaults to
 * 'professional' and `role` is left out of the request entirely (the backend
 * should treat a missing role as "unknown/generic").
 */
export async function rewriteBullet(
  text: string,
  opts?: {role?: string; tone?: string},
): Promise<RewriteBulletResult> {
  const trimmed = text.trim().replace(/^[-•*]\s*/, '');
  if (!trimmed) {
    return {rewritten: '', explanation: 'Paste a bullet point above to rewrite it.'};
  }

  const {data} = await apiClient.post<{rewritten: string; explanation: string}>(
    '/api/v1/resume/rewrite-bullet',
    {
      bullet: trimmed,
      role: opts?.role,
      tone: opts?.tone ?? 'professional',
    },
  );
  return {rewritten: data.rewritten, explanation: data.explanation};
}

/**
 * POST /api/v1/resume/export — render the stored resume as a PDF/DOCX and
 * return a download link. No "Export" action exists in ResumeBuilder.tsx's
 * UI yet, so this isn't wired to a button anywhere today — exposed for
 * whenever that action gets a home.
 */
export async function exportResume(format: 'pdf' | 'docx'): Promise<{url?: string}> {
  const {data} = await apiClient.post<{url?: string}>('/api/v1/resume/export', {format});
  return {url: data.url};
}
