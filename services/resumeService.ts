import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import {EKeyAsyncStorage} from 'constants/Types';
import apiClient from './apiClient';

// `language` per the backend's contract — constants/languages.ts,
// docs/BACKEND_SPEC_ADDENDUM_2026-07.md §16.
function currentLanguage(): string {
  return i18n.language || 'en';
}

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

// ---- Structured resume/CV sections ----
// Canonical shape returned by POST /api/v1/resume/generate and stored/
// rendered as-is by PATCH /api/v1/resume + POST /api/v1/resume/export (see
// the backend's app/services/resume_render_service.py module docstring).
// Deliberately no "highlights" field — resumes use the standard section
// set below instead of a generic highlights bucket.
export interface ResumeContact {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  links?: string[];
}
export interface ResumeExperienceEntry {
  title?: string;
  company?: string;
  location?: string;
  start?: string;
  end?: string;
  bullets: string[];
}
export interface ResumeEducationEntry {
  school?: string;
  degree?: string;
  field?: string;
  start?: string;
  end?: string;
}
export interface ResumeProjectEntry {
  name?: string;
  description?: string;
  link?: string;
}
export interface ResumeVolunteerEntry {
  org?: string;
  role?: string;
  description?: string;
}
export interface ResumeReferenceEntry {
  name?: string;
  relationship?: string;
  contact?: string;
}
export interface ResumeSections {
  contact: ResumeContact;
  summary: string;
  coreSkills: string[];
  certifications: string[];
  experience: ResumeExperienceEntry[];
  education: ResumeEducationEntry[];
  projects: ResumeProjectEntry[];
  volunteer: ResumeVolunteerEntry[];
  awards: string[];
  languages: string[];
  references: ResumeReferenceEntry[];
  suggestedKeywords: string[];
}

interface ResumeSectionsWire {
  contact?: {name?: string; email?: string; phone?: string; location?: string; links?: string[]};
  summary?: string;
  core_skills?: string[];
  certifications?: string[];
  experience?: {title?: string; company?: string; location?: string; start?: string; end?: string; bullets?: string[]}[];
  education?: {school?: string; degree?: string; field?: string; start?: string; end?: string}[];
  projects?: {name?: string; description?: string; link?: string}[];
  volunteer?: {org?: string; role?: string; description?: string}[];
  awards?: string[];
  languages?: string[];
  references?: {name?: string; relationship?: string; contact?: string}[];
  suggested_keywords?: string[];
}

function fromSectionsWire(wire: ResumeSectionsWire): ResumeSections {
  return {
    contact: {
      name: wire.contact?.name,
      email: wire.contact?.email,
      phone: wire.contact?.phone,
      location: wire.contact?.location,
      links: wire.contact?.links ?? [],
    },
    summary: wire.summary ?? '',
    coreSkills: wire.core_skills ?? [],
    certifications: wire.certifications ?? [],
    experience: (wire.experience ?? []).map(e => ({
      title: e.title, company: e.company, location: e.location,
      start: e.start, end: e.end, bullets: e.bullets ?? [],
    })),
    education: wire.education ?? [],
    projects: wire.projects ?? [],
    volunteer: wire.volunteer ?? [],
    awards: wire.awards ?? [],
    languages: wire.languages ?? [],
    references: wire.references ?? [],
    suggestedKeywords: wire.suggested_keywords ?? [],
  };
}

function toSectionsWire(sections: ResumeSections): Record<string, unknown> {
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
 * education, skills, …). Used by src/more/GenerateResume.tsx after AI
 * generation, and available for any future manual section editor.
 */
export async function updateResumeSections(sections: Record<string, unknown>): Promise<void> {
  await apiClient.patch('/api/v1/resume', {sections});
}

/**
 * POST /api/v1/resume/generate (Pro feature — gated server-side via
 * @require_pro) — a real LLM pass that returns a full resume in the
 * standard section shape (contact, summary, core skills, certifications,
 * professional experience, education, projects, volunteer, awards,
 * languages, references) tailored to a target role and, optionally, a job
 * description. Replaces the old client-side template + per-bullet-rewrite
 * approach in resumeGenerationService.ts now that this endpoint exists.
 */
export async function generateResume(input: {
  targetRole?: string;
  jdText?: string;
  jdAnalysisId?: string;
  existingResume?: ResumeSections | null;
}): Promise<ResumeSections> {
  const {data} = await apiClient.post<ResumeSectionsWire>('/api/v1/resume/generate', {
    target_role: input.targetRole,
    jd_text: input.jdText,
    jd_analysis_id: input.jdAnalysisId,
    existing_resume: input.existingResume ? toSectionsWire(input.existingResume) : undefined,
    language: currentLanguage(),
  });
  return fromSectionsWire(data);
}

/**
 * POST /api/v1/resume/ats-score — run a real resume-parsing + ATS-scoring
 * pass server-side (contact info/section completeness/keyword density/
 * formatting issues) against the user's currently stored resume.
 */
export async function analyzeResume(): Promise<ResumeAnalysisResult> {
  const {data} = await apiClient.post<{score?: number; suggestions?: string[]}>(
    '/api/v1/resume/ats-score',
    {language: currentLanguage()},
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
      language: currentLanguage(),
    },
  );
  return {rewritten: data.rewritten, explanation: data.explanation};
}

/**
 * POST /api/v1/resume/export — renders the user's stored structured resume
 * sections (see ResumeSections above) into a real .docx/.pdf file
 * server-side (app/services/resume_render_service.py) and returns an
 * https download link. Used by src/more/GenerateResume.tsx after first
 * saving generated/edited content via updateResumeSections above.
 *
 * `style` is optional and purely cosmetic (accent color emphasis). `docType`
 * picks between a standard "resume" and a "cv" — both render the exact same
 * section schema, "cv" only changes the document title to "Curriculum
 * Vitae"; there's one shared section model rather than two parallel ones.
 */
export async function exportResume(
  format: 'pdf' | 'docx',
  style?: string,
  docType: 'resume' | 'cv' = 'resume',
): Promise<{url?: string}> {
  const {data} = await apiClient.post<{url?: string}>('/api/v1/resume/export', {
    format,
    style,
    doc_type: docType,
    language: currentLanguage(),
  });
  return {url: data.url};
}
