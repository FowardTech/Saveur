import apiClient, {ApiError} from './apiClient';
import {RunResult} from './codingService';

// ---------------------------------------------------------------------------
// codingProjectsService — "Coding Projects": a persisted, multi-file/folder
// code workspace, part of the existing paid `coding_practice` add-on (same
// gate as codingService.ts's single-file LeetCode-style practice — see
// entitlementsService.ts's ADDON_CODES.codingPractice). Backed by
// Saveur-Backend commit 7fa99e9:
//   GET    /api/v1/coding/projects
//   POST   /api/v1/coding/projects
//   GET    /api/v1/coding/projects/<id>
//   PUT    /api/v1/coding/projects/<id>/files
//   POST   /api/v1/coding/projects/<id>/rename
//   DELETE /api/v1/coding/projects/<id>
//   POST   /api/v1/coding/projects/<id>/run   ("script" projects only)
//
// "web" type projects (HTML/CSS/JS) have no run endpoint at all — they're
// rendered client-side in a WebView (see CodingProjectEditor.tsx's preview
// mode), so there's no runProject-equivalent call for that type here.
//
// Wire format note: same snake_case-wire / camelCase-app-type split every
// other services/*.ts file in this app already follows (see codingService.ts's
// own module comment).
// ---------------------------------------------------------------------------

export type ProjectType = 'web' | 'script';

export interface CodingProjectSummary {
  id: string;
  name: string;
  projectType: ProjectType;
  languageHint?: string;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
  totalSizeBytes: number;
}

export interface CodingProjectFile {
  path: string;
  content: string;
  sizeBytes?: number;
  updatedAt?: string;
}

export interface CodingProjectDetail extends CodingProjectSummary {
  files: CodingProjectFile[];
}

export interface ProjectRunResult extends RunResult {
  entryPath: string;
  multiFileForwarded: boolean;
}

/** Mirrors the backend's PUT .../files 413 cap exactly (see that route's
 * own `max_bytes` field) — kept here as a client-side constant too so the
 * editor can show a running total against the same number before Save is
 * even tapped, per the product spec ("ideally show a running total
 * client-side before Save is even tapped"). */
export const MAX_PROJECT_BYTES = 52428800;

/** Thrown by saveProjectFiles specifically for the 413 case, with the byte
 * counts the plain ApiError shape can't carry (apiClient's response
 * interceptor only normalizes status/message/code/error — see
 * apiClient.ts's own comment — so this is assembled here from the fields
 * that DO survive that normalization plus the client's own local total,
 * which is already known before the request is even sent). */
export interface ProjectTooLargeError {
  tooLarge: true;
  maxBytes: number;
  actualBytes: number;
}

export function isProjectTooLargeError(e: unknown): e is ProjectTooLargeError {
  return !!e && typeof e === 'object' && (e as ProjectTooLargeError).tooLarge === true;
}

/** Total UTF-8 byte size of a file's `content` — same measure the backend's
 * 413 cap uses, so the client-side running total (shown before Save) and the
 * server's own check agree on what "50MB" means (JS string .length counts
 * UTF-16 code units, not bytes — this deliberately doesn't use that). */
export function utf8ByteLength(content: string): number {
  // TextEncoder is available in Hermes/RN's modern JS runtime; this file has
  // no other polyfill dependency so it's used directly rather than adding one
  // just for this.
  return new TextEncoder().encode(content).length;
}

export function totalProjectBytes(files: Array<{content: string}>): number {
  return files.reduce((sum, f) => sum + utf8ByteLength(f.content), 0);
}

/** "12.4 KB" / "3.1 MB" — shared display formatting for the hub's list rows
 * and the editor's running-size indicator. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ProjectSummaryWire {
  id: string;
  name: string;
  project_type: ProjectType;
  language_hint?: string;
  created_at: string;
  updated_at: string;
  file_count: number;
  total_size_bytes: number;
}

function fromSummaryWire(w: ProjectSummaryWire): CodingProjectSummary {
  return {
    id: w.id,
    name: w.name,
    projectType: w.project_type,
    languageHint: w.language_hint,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
    fileCount: w.file_count ?? 0,
    totalSizeBytes: w.total_size_bytes ?? 0,
  };
}

/** GET /api/v1/coding/projects — the project list hub's data source. */
export async function listProjects(): Promise<CodingProjectSummary[]> {
  const {data} = await apiClient.get<ProjectSummaryWire[]>('/api/v1/coding/projects');
  return (data ?? []).map(fromSummaryWire);
}

/** POST /api/v1/coding/projects — creates an empty project, returns the same
 * list-item shape listProjects() uses (201). */
export async function createProject(
  name: string,
  projectType: ProjectType = 'script',
  languageHint?: string,
): Promise<CodingProjectSummary> {
  const {data} = await apiClient.post<ProjectSummaryWire>('/api/v1/coding/projects', {
    name,
    project_type: projectType,
    ...(languageHint ? {language_hint: languageHint} : undefined),
  });
  return fromSummaryWire(data);
}

interface ProjectFileWire {
  path: string;
  content: string;
  size_bytes?: number;
  updated_at?: string;
}

interface ProjectDetailWire extends ProjectSummaryWire {
  files: ProjectFileWire[];
}

/** GET /api/v1/coding/projects/<id> — the full file tree + content, opened
 * by CodingProjectEditor.tsx on mount. */
export async function getProject(id: string): Promise<CodingProjectDetail> {
  const {data} = await apiClient.get<ProjectDetailWire>(`/api/v1/coding/projects/${id}`);
  return {
    ...fromSummaryWire(data),
    files: (data.files ?? []).map(f => ({
      path: f.path,
      content: f.content ?? '',
      sizeBytes: f.size_bytes,
      updatedAt: f.updated_at,
    })),
  };
}

/**
 * PUT /api/v1/coding/projects/<id>/files — full authoritative replace; the
 * caller (CodingProjectEditor.tsx) always sends the COMPLETE current file
 * tree, per the backend contract, not just whatever changed since the last
 * save.
 *
 * Rejects with a ProjectTooLargeError (see isProjectTooLargeError above),
 * not a plain ApiError, when the backend answers 413 `project_too_large` —
 * the caller should check that specifically before falling back to a
 * generic error alert, so it can show the actual byte counts instead of a
 * vague "something went wrong."
 */
export async function saveProjectFiles(
  id: string,
  files: Array<{path: string; content: string}>,
): Promise<void> {
  try {
    await apiClient.put(`/api/v1/coding/projects/${id}/files`, {files});
  } catch (e) {
    const apiError = e as ApiError;
    if (apiError.status === 413) {
      const thrown: ProjectTooLargeError = {
        tooLarge: true,
        maxBytes: MAX_PROJECT_BYTES,
        actualBytes: totalProjectBytes(files),
      };
      throw thrown;
    }
    throw e;
  }
}

/** POST /api/v1/coding/projects/<id>/rename */
export async function renameProject(id: string, name: string): Promise<void> {
  await apiClient.post(`/api/v1/coding/projects/${id}/rename`, {name});
}

/** DELETE /api/v1/coding/projects/<id> */
export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/coding/projects/${id}`);
}

/**
 * POST /api/v1/coding/projects/<id>/run — "script" projects only. Multi-file
 * execution is confirmed-reliable only for interpreted languages
 * (Python/Node/Ruby/PHP) per the backend contract — compiled languages are
 * best-effort there, so CodingProjectEditor.tsx's Run UI copy should not
 * overclaim reliability for those. Same normalized run-result shape as
 * codingService.ts's runCode() (RunResult), plus entryPath/
 * multiFileForwarded.
 */
export async function runProject(
  id: string,
  entryPath: string,
  language: string,
  stdin?: string,
): Promise<ProjectRunResult> {
  const {data} = await apiClient.post<{
    stdout?: string;
    stderr?: string;
    status?: string;
    exit_code?: number | null;
    time_ms?: number | null;
    memory_kb?: number | null;
    engine?: 'judge0' | 'ai';
    entry_path?: string;
    multi_file_forwarded?: boolean;
  }>(`/api/v1/coding/projects/${id}/run`, {entry_path: entryPath, language, stdin});
  return {
    stdout: data.stdout ?? '',
    stderr: data.stderr ?? '',
    status: data.status,
    exitCode: data.exit_code ?? null,
    timeMs: data.time_ms ?? null,
    memoryKb: data.memory_kb ?? null,
    engine: data.engine,
    entryPath: data.entry_path ?? entryPath,
    multiFileForwarded: !!data.multi_file_forwarded,
  };
}
