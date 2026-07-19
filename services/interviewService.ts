import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Difficulty_Enum,
  EKeyAsyncStorage,
  Interview_Type_Enum,
  MockInterviewSessionProps,
  Practice_Mode_Enum,
  VideoAnalysisMetrics,
} from 'constants/Types';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// interviewService — real backend implementation for the Interviews domain
// (`/api/v1/interviews/*`). Follows the same pattern as services/authService.ts:
// screens keep calling these functions with (mostly) the same shapes they
// always have, the wire-format translation (snake_case <-> the app's
// camelCase types/enums) happens only in this file, and AsyncStorage is kept
// only as an offline-read fallback cache for the practice-history list, not
// as the source of truth.
//
// Wire-casing note: the backend contract spells out `type` values as
// lowercase (`behavioral`, `technical`, ... with hyphens for multi-word ones
// like `system-design`, `customer-service`) except Product Management, which
// is given literally as `PM` — see TYPE_TO_WIRE below, position-matched 1:1
// against the contract's type list. `mode` is `voice|text|video`. Difficulty
// values are NOT specified anywhere in the contract's request/response
// examples, so lowercase (`beginner|intermediate|advanced`) is assumed for
// consistency with the rest of the wire format — see DIFFICULTY_TO_WIRE.
// If the real backend turns out to expect different casing for either, only
// the maps below need to change, not any screen.
// ---------------------------------------------------------------------------

export interface StartSessionConfig {
  interviewType: Interview_Type_Enum;
  mode: Practice_Mode_Enum;
  difficulty: Difficulty_Enum;
  // Required by the real backend (fed into adaptive question generation) but
  // not collected by every existing call site yet (e.g. FindScreen's
  // "Coding Practice" shortcut skips the setup wizard entirely) — falls back
  // to a generic role derived from interviewType so those call sites don't
  // break. MockInterviewSetup now collects a real value for this (see that
  // screen's new "Target Role" input).
  role?: string;
  // Optional company this session is "targeted" at — purely used for
  // question-copy flavor server-side.
  company?: string;
  // Required by the real backend as `duration_min`. Falls back based on
  // `timed` for legacy callers that predate this field.
  durationMin?: number;
  // Legacy field from the mock's on/off "Timed Interview" toggle — no longer
  // sent to the backend directly (there's no `timed` field in the real
  // contract, only `duration_min`), kept only to derive a default
  // `durationMin` for callers that haven't been updated to pass it directly.
  timed?: boolean;
}

const FALLBACK_DURATION_MIN = 30;

// ---- Interview type <-> wire mapping ---------------------------------------
const TYPE_TO_WIRE: Record<Interview_Type_Enum, string> = {
  [Interview_Type_Enum.Behavioral]: 'behavioral',
  [Interview_Type_Enum.Technical]: 'technical',
  [Interview_Type_Enum.Coding]: 'coding',
  [Interview_Type_Enum.SystemDesign]: 'system-design',
  [Interview_Type_Enum.ProductManagement]: 'PM',
  [Interview_Type_Enum.Sales]: 'sales',
  [Interview_Type_Enum.Marketing]: 'marketing',
  [Interview_Type_Enum.Finance]: 'finance',
  [Interview_Type_Enum.Healthcare]: 'healthcare',
  [Interview_Type_Enum.CustomerService]: 'customer-service',
  [Interview_Type_Enum.Government]: 'government',
  [Interview_Type_Enum.Consulting]: 'consulting',
  [Interview_Type_Enum.Executive]: 'executive',
  [Interview_Type_Enum.Graduate]: 'graduate',
  [Interview_Type_Enum.Internship]: 'internship',
};
const WIRE_TO_TYPE: Record<string, Interview_Type_Enum> = Object.entries(TYPE_TO_WIRE).reduce(
  (acc, [type, wire]) => {
    acc[wire] = type as Interview_Type_Enum;
    return acc;
  },
  {} as Record<string, Interview_Type_Enum>,
);

// ---- Practice mode <-> wire mapping ----------------------------------------
const MODE_TO_WIRE: Record<Practice_Mode_Enum, 'voice' | 'text' | 'video'> = {
  [Practice_Mode_Enum.Voice]: 'voice',
  [Practice_Mode_Enum.Text]: 'text',
  [Practice_Mode_Enum.Video]: 'video',
};
const WIRE_TO_MODE: Record<string, Practice_Mode_Enum> = {
  voice: Practice_Mode_Enum.Voice,
  text: Practice_Mode_Enum.Text,
  video: Practice_Mode_Enum.Video,
};

// ---- Difficulty <-> wire mapping (casing assumed — see file header) -------
const DIFFICULTY_TO_WIRE: Record<Difficulty_Enum, string> = {
  [Difficulty_Enum.Beginner]: 'beginner',
  [Difficulty_Enum.Intermediate]: 'intermediate',
  [Difficulty_Enum.Advanced]: 'advanced',
};
const WIRE_TO_DIFFICULTY: Record<string, Difficulty_Enum> = {
  beginner: Difficulty_Enum.Beginner,
  intermediate: Difficulty_Enum.Intermediate,
  advanced: Difficulty_Enum.Advanced,
};

interface SessionWire {
  id?: string;
  session_id?: string;
  sessionId?: string;
  type?: string;
  role?: string;
  company?: string;
  difficulty?: string;
  duration_min?: number;
  mode?: string;
  status?: string;
  overall_score?: number;
  score?: number;
  created_at?: number | string;
  date?: number | string;
  first_question?: string;
  firstQuestion?: string;
}

function sessionIdFromWire(wire: SessionWire): string {
  return String(wire.id ?? wire.session_id ?? wire.sessionId ?? '');
}

function dateFromWire(value: number | string | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

// A session is only ever "Scheduled" (not yet completed) or "Completed" in
// this app's UI (see MockInterviewSessionProps) — anything the backend
// reports as ended/finished/scored maps to "Completed", everything else
// (in-progress, not-started) maps to "Scheduled" so it still surfaces
// somewhere on Practice History rather than disappearing.
function statusFromWire(status: string | undefined): 'Completed' | 'Scheduled' {
  const normalized = (status ?? '').toLowerCase();
  return ['completed', 'ended', 'finished', 'scored'].includes(normalized)
    ? 'Completed'
    : 'Scheduled';
}

function fromSessionWire(wire: SessionWire): MockInterviewSessionProps {
  return {
    id: sessionIdFromWire(wire),
    interviewType: (wire.type && WIRE_TO_TYPE[wire.type]) ?? Interview_Type_Enum.Behavioral,
    mode: (wire.mode && WIRE_TO_MODE[wire.mode]) ?? Practice_Mode_Enum.Voice,
    difficulty:
      (wire.difficulty && WIRE_TO_DIFFICULTY[wire.difficulty.toLowerCase()]) ??
      Difficulty_Enum.Intermediate,
    date: dateFromWire(wire.created_at ?? wire.date),
    durationMin: wire.duration_min ?? FALLBACK_DURATION_MIN,
    overallScore: wire.overall_score ?? wire.score,
    status: statusFromWire(wire.status),
    company: wire.company,
  };
}

function toStartSessionWire(config: StartSessionConfig) {
  const role = config.role?.trim() || `${config.interviewType} Candidate`;
  const durationMin =
    config.durationMin ?? (config.timed === false ? 15 : FALLBACK_DURATION_MIN);
  return {
    type: TYPE_TO_WIRE[config.interviewType],
    role,
    company: config.company,
    difficulty: DIFFICULTY_TO_WIRE[config.difficulty],
    duration_min: durationMin,
    mode: MODE_TO_WIRE[config.mode],
  };
}

const readCache = async (): Promise<MockInterviewSessionProps[]> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.practiceSessions);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as MockInterviewSessionProps[];
  } catch {
    return [];
  }
};

const writeCache = async (sessions: MockInterviewSessionProps[]): Promise<void> => {
  await AsyncStorage.setItem(EKeyAsyncStorage.practiceSessions, JSON.stringify(sessions));
};

/**
 * GET /api/v1/interviews/types — the backend's canonical list of interview
 * types. NOT currently wired into any screen: MockInterviewSetup's type
 * chips already enumerate all 15 Interview_Type_Enum values 1:1 (each with
 * its own local icon via DATA_INTERVIEW_TYPES in constants/Data.ts), so
 * switching that list to be backend-driven would only add value if the
 * backend could introduce a type with no local enum/icon mapping — which
 * would break the chip UI, not improve it. Exposed here in case a future
 * screen needs it (e.g. to detect a type the client doesn't know about yet).
 */
export async function getInterviewTypes(): Promise<Interview_Type_Enum[]> {
  const {data} = await apiClient.get<string[] | {types: string[]}>('/api/v1/interviews/types');
  const list = Array.isArray(data) ? data : data.types ?? [];
  return list.map(wire => WIRE_TO_TYPE[wire]).filter((t): t is Interview_Type_Enum => !!t);
}

/**
 * POST /api/v1/interviews/sessions — kicks off a real interview session.
 * Returns the sessionId to thread through navigation params the same way
 * the old mock did, plus an optional firstQuestion if the backend's adaptive
 * question generation returns one synchronously at creation time.
 */
export async function startSession(
  config: StartSessionConfig,
): Promise<{sessionId: string; firstQuestion?: string}> {
  const {data} = await apiClient.post<SessionWire>(
    '/api/v1/interviews/sessions',
    toStartSessionWire(config),
  );
  return {
    sessionId: sessionIdFromWire(data),
    firstQuestion: data.first_question ?? data.firstQuestion,
  };
}

/**
 * GET /api/v1/interviews/sessions/{sessionId} — full session detail. Not
 * currently called by any screen (there's no "session detail" view in this
 * app beyond the Practice History list + InterviewFeedback, both of which
 * are already served by getPracticeHistory/feedbackService) — exposed for
 * future use.
 */
export async function getSessionDetail(sessionId: string): Promise<MockInterviewSessionProps> {
  const {data} = await apiClient.get<SessionWire>(`/api/v1/interviews/sessions/${sessionId}`);
  return fromSessionWire(data);
}

export interface NextQuestionResult {
  questionId?: string;
  text: string;
}

/**
 * POST /api/v1/interviews/sessions/{sessionId}/next-question — asks the
 * backend for the adaptive next question. Called from
 * src/practice/LiveInterviewSession.tsx at the same trigger point the old
 * mock used to just advance a local index (every ADVANCE_INTERVAL_SEC of
 * listening time) — that screen falls back to its static local question
 * bank if this call fails, since (unlike the mock) a real network call can
 * fail mid-interview and the session must not get stuck with no question.
 */
export async function getNextQuestion(sessionId: string): Promise<NextQuestionResult> {
  const {data} = await apiClient.post<{question_id?: string; text?: string; question?: string}>(
    `/api/v1/interviews/sessions/${sessionId}/next-question`,
  );
  const text = data.text ?? data.question;
  if (!text) {
    throw new Error('Backend returned an empty next question.');
  }
  return {questionId: data.question_id, text};
}

export interface SubmitAnswerPayload {
  questionId: string;
  text?: string;
  audioUrl?: string;
  videoUrl?: string;
}

/**
 * POST /api/v1/interviews/sessions/{sessionId}/answer — records the
 * candidate's answer to a specific question. Implemented for completeness
 * against the contract, but NOT currently called anywhere: neither Voice/
 * Text mode (no answer-transcript capture UI exists at all today — see
 * services/recordingService.ts, which is fully simulated and never produces
 * real audio/text) nor Video mode (services/videoAnalysisService.ts
 * accumulates one running on-device transcript for the *whole* session, not
 * segmented per question, so there's no clean per-question `text` to send
 * without a real rework of that pipeline's accumulation strategy — out of
 * scope here per the "don't force a risky change" guidance). Left available
 * for whichever of those gaps gets addressed first.
 */
export async function submitAnswer(
  sessionId: string,
  payload: SubmitAnswerPayload,
): Promise<void> {
  await apiClient.post(`/api/v1/interviews/sessions/${sessionId}/answer`, {
    question_id: payload.questionId,
    text: payload.text,
    audio_url: payload.audioUrl,
    video_url: payload.videoUrl,
  });
}

/**
 * POST /api/v1/interviews/sessions/{sessionId}/end — finalizes the session
 * and triggers the backend's feedback/scoring job. Kept under the same
 * `completeSession` name and call signature the mock used
 * (sessionId, videoMetrics?, askedQuestions?) so LiveInterviewSession.tsx,
 * CodingInterview.tsx, and InterviewFeedback.tsx's callers don't all need to
 * change — but unlike the mock, this no longer returns the scored result
 * synchronously (the real contract splits scoring into its own endpoint,
 * GET /api/v1/feedback/session/{sessionId} — see services/feedbackService.ts).
 * `InterviewFeedback` no longer calls this at all; it only fetches feedback.
 *
 * `videoMetrics` is accepted for backward compatibility with existing call
 * sites but isn't resent here — LiveInterviewSession already streams the raw
 * per-frame samples to POST /camera-frame throughout the session and fetches
 * /camera-summary separately once it ends (see that file), so the backend
 * already has the video signal by the time this fires.
 */
export async function completeSession(
  sessionId: string,
  _videoMetrics?: VideoAnalysisMetrics,
  askedQuestions?: string[],
): Promise<void> {
  await apiClient.post(`/api/v1/interviews/sessions/${sessionId}/end`, {
    asked_questions: askedQuestions,
  });
}

/**
 * GET /api/v1/interviews/sessions — the user's session history (most recent
 * first), backing Practice History + the Home dashboard's recent-sessions
 * summary. Falls back to whatever was cached from the last successful fetch
 * if the network call fails, same offline-read-fallback pattern as
 * services/authService.ts::getCurrentProfile — no fabricated placeholder
 * data is seeded anymore (the old mock seeded DATA_UPCOMING_SESSIONS /
 * DATA_PAST_SESSIONS on first read so the screen wasn't empty on a fresh
 * install; a real backend has no equivalent, so a genuinely-empty account
 * now correctly renders the empty state instead of fake sessions).
 */
export async function getPracticeHistory(): Promise<MockInterviewSessionProps[]> {
  try {
    const {data} = await apiClient.get<SessionWire[] | {sessions?: SessionWire[]; items?: SessionWire[]}>(
      '/api/v1/interviews/sessions',
    );
    const list = Array.isArray(data) ? data : data.sessions ?? data.items ?? [];
    const sessions = list.map(fromSessionWire);
    await writeCache(sessions);
    return sessions;
  } catch {
    return readCache();
  }
}
