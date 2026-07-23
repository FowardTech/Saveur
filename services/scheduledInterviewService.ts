import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Difficulty_Enum,
  EKeyAsyncStorage,
  Interview_Type_Enum,
  Practice_Mode_Enum,
  ScheduledInterviewProps,
} from 'constants/Types';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// scheduledInterviewService — backs the real "Upcoming Session" feature on
// Home (src/home/HomeSrc.tsx) and the new src/practice/ScheduleInterview.tsx
// setup screen. Previously "Upcoming Session" was a single hardcoded
// DATA_UPCOMING_SESSIONS entry (constants/Data.ts) that never changed and
// couldn't be created/dismissed by the user.
//
// Proposed backend contract (not yet implemented server-side — see the
// backend spec addendum):
//   GET    /api/v1/interviews/scheduled       — list this user's upcoming
//                                                (future) scheduled interviews
//   POST   /api/v1/interviews/scheduled       — create one
//   DELETE /api/v1/interviews/scheduled/{id}  — cancel one
//
// Same defensive pattern as the rest of this service layer: try the network
// call first, fall back to an AsyncStorage-cached copy on failure so the
// feature still works end-to-end (create/list/cancel) even before the
// backend implements these three endpoints — a locally-created entry just
// won't sync to another device until it does.
// ---------------------------------------------------------------------------

interface ScheduledInterviewWire {
  id: string;
  interview_type: string;
  mode: string;
  difficulty: string;
  role: string;
  company?: string | null;
  duration_min: number;
  scheduled_at: number; // unix seconds
}

const MODE_TO_WIRE: Record<Practice_Mode_Enum, string> = {
  [Practice_Mode_Enum.Voice]: 'voice',
  [Practice_Mode_Enum.Text]: 'text',
  [Practice_Mode_Enum.Video]: 'video',
  [Practice_Mode_Enum.Coding]: 'coding',
};
const WIRE_TO_MODE: Record<string, Practice_Mode_Enum> = {
  voice: Practice_Mode_Enum.Voice,
  text: Practice_Mode_Enum.Text,
  video: Practice_Mode_Enum.Video,
  coding: Practice_Mode_Enum.Coding,
};

const TYPE_TO_WIRE: Record<Interview_Type_Enum, string> = Object.fromEntries(
  Object.values(Interview_Type_Enum).map(v => [v, String(v).toLowerCase().replace(/\s+/g, '_')]),
) as Record<Interview_Type_Enum, string>;
const WIRE_TO_TYPE: Record<string, Interview_Type_Enum> = Object.fromEntries(
  Object.values(Interview_Type_Enum).map(v => [String(v).toLowerCase().replace(/\s+/g, '_'), v]),
);

const DIFFICULTY_TO_WIRE: Record<Difficulty_Enum, string> = Object.fromEntries(
  Object.values(Difficulty_Enum).map(v => [v, String(v).toLowerCase()]),
) as Record<Difficulty_Enum, string>;
const WIRE_TO_DIFFICULTY: Record<string, Difficulty_Enum> = Object.fromEntries(
  Object.values(Difficulty_Enum).map(v => [String(v).toLowerCase(), v]),
);

function toWire(input: Omit<ScheduledInterviewProps, 'id'>) {
  return {
    interview_type: TYPE_TO_WIRE[input.interviewType] ?? input.interviewType,
    mode: MODE_TO_WIRE[input.mode] ?? input.mode,
    difficulty: DIFFICULTY_TO_WIRE[input.difficulty] ?? input.difficulty,
    role: input.role,
    company: input.company ?? null,
    duration_min: input.durationMin,
    scheduled_at: Math.round(input.scheduledAt / 1000),
  };
}

function fromWire(wire: ScheduledInterviewWire): ScheduledInterviewProps {
  return {
    id: wire.id,
    interviewType: WIRE_TO_TYPE[wire.interview_type] ?? Interview_Type_Enum.Behavioral,
    mode: WIRE_TO_MODE[wire.mode] ?? Practice_Mode_Enum.Voice,
    difficulty: WIRE_TO_DIFFICULTY[wire.difficulty] ?? Difficulty_Enum.Intermediate,
    role: wire.role,
    company: wire.company ?? undefined,
    durationMin: wire.duration_min,
    scheduledAt: wire.scheduled_at * 1000,
  };
}

const readCache = async (): Promise<ScheduledInterviewProps[]> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.scheduledInterviews);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ScheduledInterviewProps[];
  } catch {
    return [];
  }
};

const writeCache = async (items: ScheduledInterviewProps[]): Promise<void> => {
  await AsyncStorage.setItem(EKeyAsyncStorage.scheduledInterviews, JSON.stringify(items));
};

function extractList(raw: unknown): ScheduledInterviewWire[] {
  if (Array.isArray(raw)) return raw as ScheduledInterviewWire[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as ScheduledInterviewWire[];
    if (Array.isArray(obj.scheduled)) return obj.scheduled as ScheduledInterviewWire[];
  }
  return [];
}

/**
 * GET /api/v1/interviews/scheduled. Returns future scheduled interviews,
 * soonest first. Falls back to the local cache (filtered to the future, in
 * case a stale past entry lingers) if the network call fails or the
 * endpoint doesn't exist yet.
 */
export async function listUpcoming(): Promise<ScheduledInterviewProps[]> {
  const now = Date.now();
  try {
    const {data} = await apiClient.get<unknown>('/api/v1/interviews/scheduled');
    const items = extractList(data).map(fromWire);
    await writeCache(items);
    return items.filter(i => i.scheduledAt >= now).sort((a, b) => a.scheduledAt - b.scheduledAt);
  } catch {
    const cached = await readCache();
    return cached.filter(i => i.scheduledAt >= now).sort((a, b) => a.scheduledAt - b.scheduledAt);
  }
}

/**
 * POST /api/v1/interviews/scheduled. On network failure, still creates the
 * reminder locally (with a client-generated id) so scheduling isn't blocked
 * on the backend endpoint existing yet — it just won't sync to another
 * device until it does.
 */
export async function createScheduled(
  input: Omit<ScheduledInterviewProps, 'id'>,
): Promise<ScheduledInterviewProps> {
  try {
    const {data} = await apiClient.post<ScheduledInterviewWire>('/api/v1/interviews/scheduled', toWire(input));
    const created = fromWire(data);
    const cached = await readCache();
    await writeCache([...cached, created]);
    return created;
  } catch {
    const created: ScheduledInterviewProps = {...input, id: `local_${Date.now()}`};
    const cached = await readCache();
    await writeCache([...cached, created]);
    return created;
  }
}

/**
 * DELETE /api/v1/interviews/scheduled/{id}. Also removed from the local
 * cache regardless of whether the network call succeeds, so a user can
 * always clear a reminder they've already acted on (e.g. right before
 * navigating into the interview it was reminding them about) even offline.
 */
export async function removeScheduled(id: string): Promise<void> {
  try {
    await apiClient.delete(`/api/v1/interviews/scheduled/${id}`);
  } catch {
    // Best-effort — still clear it locally below regardless.
  }
  const cached = await readCache();
  await writeCache(cached.filter(i => i.id !== id));
}
