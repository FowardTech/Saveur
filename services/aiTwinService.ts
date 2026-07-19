import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// aiTwinService — real backend implementation, net-new domain.
//
// "AI Career Twin" — an aggregated profile built up from imported sources
// (LinkedIn, portfolio, certificates, transcript) that the user can then
// chat with. No screen in the app references an "AI Twin"/"Career Twin"
// concept today (grepped src/ for "twin"/"Twin" — zero matches), so this
// file is exposed for whichever screen picks the feature up next; nothing
// calls these functions yet.
//
// Wire-shape note: same defensive-mapping approach as the rest of this
// pass's services (coachService.ts, salaryNegotiationService.ts) — the task
// spec names the three endpoints/purposes but not exact JSON keys, so
// fromWire below checks a couple of plausible key spellings and degrades to
// an empty value rather than throwing if the real response shape differs.
// AsyncStorage is kept only as an offline-read fallback cache for the
// aggregated profile (getAiTwin) — never the source of truth, and not used
// at all for import/ask (those are one-shot actions, not something to serve
// stale from cache).
// ---------------------------------------------------------------------------

const CACHE_KEY = 'aiTwinProfile';

export type AiTwinImportSource = 'linkedin' | 'portfolio' | 'cert' | 'transcript';

export interface AiTwinProfile {
  summary: string;
  skills: string[];
  experienceHighlights: string[];
  importedSources: AiTwinImportSource[];
  updatedAt?: number;
}

interface AiTwinWire {
  summary?: string;
  skills?: string[];
  experience_highlights?: string[];
  experienceHighlights?: string[];
  imported_sources?: AiTwinImportSource[];
  importedSources?: AiTwinImportSource[];
  updated_at?: number | string;
  updatedAt?: number | string;
}

function fromWire(wire: AiTwinWire): AiTwinProfile {
  const updatedRaw = wire.updated_at ?? wire.updatedAt;
  return {
    summary: wire.summary ?? '',
    skills: wire.skills ?? [],
    experienceHighlights: wire.experience_highlights ?? wire.experienceHighlights ?? [],
    importedSources: wire.imported_sources ?? wire.importedSources ?? [],
    updatedAt:
      updatedRaw != null
        ? typeof updatedRaw === 'string'
          ? new Date(updatedRaw).getTime()
          : updatedRaw
        : undefined,
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
 * GET /api/v1/ai-twin — the user's aggregated Career Twin profile (built up
 * from whatever sources have been imported so far via importToAiTwin
 * below). Falls back to the last-known cache when offline.
 */
export async function getAiTwin(): Promise<AiTwinProfile | null> {
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
 * POST /api/v1/ai-twin/import — feed a new source into the Career Twin.
 * `data` is intentionally loosely typed (`Record<string, unknown> | string`)
 * since its shape depends entirely on `source` (e.g. a LinkedIn export blob
 * vs. a portfolio URL vs. raw certificate/transcript text) — nothing in this
 * pass's spec pins that down further.
 */
export async function importToAiTwin(
  source: AiTwinImportSource,
  data: Record<string, unknown> | string,
): Promise<AiTwinProfile> {
  const {data: wire} = await apiClient.post<AiTwinWire>('/api/v1/ai-twin/import', {
    source,
    data,
  });
  return writeCache(fromWire(wire));
}

/**
 * POST /api/v1/ai-twin/ask — chat with your Career Twin (Q&A grounded in the
 * aggregated profile built from imported sources).
 */
export async function askAiTwin(question: string): Promise<string> {
  const {data} = await apiClient.post<{answer?: string; response?: string; message?: string}>(
    '/api/v1/ai-twin/ask',
    {question},
  );
  return data.answer ?? data.response ?? data.message ?? '';
}
