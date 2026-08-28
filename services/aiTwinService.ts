import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// aiTwinService — "AI Career Twin": one aggregated profile (headline/
// summary/skills/experience/education) merged from every resume-family row
// you already have (uploads, and anything built via GenerateResume.tsx's AI
// generator/section editor — see Saveur-Backend's app/api/ai_twin.py
// _profile_payload()), plus free-form Q&A grounded in that merged profile.
// Same "derived from what you actually do in the app, no separate form to
// fill out" philosophy as Career DNA (careerDnaService.ts) — src/more/
// AICareerTwin.tsx is the first (and, as of this pass, only) screen wired up
// to it.
//
// BUG FIX: this file used to assume a flat wire shape
// ({summary, skills, experience_highlights, imported_sources, updated_at})
// that never matched what the backend actually returns — a real response
// nests everything under `profile` (`{sources, resumes, documents, profile:
// {headline, summary, skills, experience, education}}`, see
// ai_twin.py's _profile_payload()) with no `updated_at`/"highlights" concept
// at all. Written speculatively before the backend endpoint existed (see
// git history), and never caught because nothing called it — fromWire below
// now matches the real shape.
// ---------------------------------------------------------------------------

const CACHE_KEY = 'aiTwinProfile';

// Loosely typed on purpose — Saveur-Backend's canonical resume section shape
// (resume_render_service.py) allows every field here to be missing on a
// partially-filled resume, and this Twin profile merges across however many
// resume rows a user has, each potentially partial in a different way.
export interface AiTwinExperienceEntry {
  title?: string;
  company?: string;
  location?: string;
  start?: string;
  end?: string;
  bullets?: string[];
}

export interface AiTwinEducationEntry {
  school?: string;
  degree?: string;
  field?: string;
  start?: string;
  end?: string;
}

export interface AiTwinProfile {
  headline: string | null;
  summary: string;
  skills: string[];
  experience: AiTwinExperienceEntry[];
  education: AiTwinEducationEntry[];
  // Resume.source values this profile was actually merged from, e.g.
  // ["resume", "manual"] — not the AiTwinImportSource wishlist below, since
  // nothing constrains a Resume row's `source` string to those four values.
  sources: string[];
  resumeCount: number;
  documentCount: number;
  // True once there's anything at all worth showing — lets the screen tell
  // "loaded, but genuinely nothing here yet" apart from "still loading",
  // same distinction careerDnaService.ts's CareerDnaProfile.hasProfile draws.
  hasProfile: boolean;
}

interface AiTwinProfileWire {
  headline?: string | null;
  summary?: string | null;
  skills?: unknown[];
  experience?: unknown[];
  education?: unknown[];
}

interface AiTwinWire {
  sources?: string[];
  resumes?: number;
  documents?: number;
  profile?: AiTwinProfileWire;
}

function fromWire(wire: AiTwinWire): AiTwinProfile {
  const profile = wire.profile ?? {};
  const skills = Array.isArray(profile.skills)
    ? profile.skills.filter((s): s is string => typeof s === 'string')
    : [];
  const experience = Array.isArray(profile.experience) ? (profile.experience as AiTwinExperienceEntry[]) : [];
  const education = Array.isArray(profile.education) ? (profile.education as AiTwinEducationEntry[]) : [];
  const headline = profile.headline ?? null;
  const summary = profile.summary ?? '';
  return {
    headline,
    summary,
    skills,
    experience,
    education,
    sources: Array.isArray(wire.sources) ? wire.sources : [],
    resumeCount: wire.resumes ?? 0,
    documentCount: wire.documents ?? 0,
    hasProfile: !!(headline || summary || skills.length || experience.length || education.length),
  };
}

const readCache = async (): Promise<AiTwinProfile | null> => {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AiTwinProfile;
  } catch {
    return null;
  }
};

const writeCache = async (profile: AiTwinProfile): Promise<AiTwinProfile> => {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(profile));
  return profile;
};

/**
 * GET /api/v1/ai-twin — the user's aggregated Career Twin profile, merged
 * server-side from every resume-family row already on the account (see this
 * file's own module comment). Falls back to the last-known cache when
 * offline; Premium-gated server-side (402 `premium_required` otherwise —
 * the screen should never reach this call for a non-Premium user, since
 * AICareerTwin.tsx checks AuthContext's `isPremium` before rendering
 * anything that would call it).
 */
export async function getAiTwin(): Promise<AiTwinProfile> {
  try {
    const {data} = await apiClient.get<AiTwinWire>('/api/v1/ai-twin');
    return writeCache(fromWire(data));
  } catch (e) {
    const cached = await readCache();
    if (cached) return cached;
    throw e;
  }
}

/**
 * POST /api/v1/ai-twin/ask — chat with your Career Twin (Q&A grounded in the
 * aggregated profile above).
 */
export async function askAiTwin(question: string): Promise<string> {
  const {data} = await apiClient.post<{answer?: string; response?: string; message?: string}>(
    '/api/v1/ai-twin/ask',
    {question, language: i18n.language || 'en'},
  );
  return data.answer ?? data.response ?? data.message ?? '';
}

// NOTE: this file used to also export importToAiTwin() (POST
// /api/v1/ai-twin/import), matching the backend's {source, data, file_key?,
// url?, content?} body. Deliberately not wired into AICareerTwin.tsx yet —
// the backend route only ever actually reads `data` (must be a plain dict,
// matching the canonical resume-section keys above) and `file_key`; `url`/
// `content` are accepted in the docstring but never read at all. That's not
// a shape a "paste your LinkedIn about section" or "upload a certificate"
// UI could honestly build against yet without either silently no-op'ing or
// requiring the caller to hand-construct a structured JSON blob. The
// profile above already gets real data for free from whatever's already in
// GenerateResume.tsx/MyDocuments.tsx — revisit an explicit "import a new
// source" UI once the backend route actually implements url/content.
