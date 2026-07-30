import AsyncStorage from '@react-native-async-storage/async-storage';
import RNBlobUtil from 'react-native-blob-util';
import i18n from 'i18next';
import dayjs from 'utils/dayjs';
import {
  Difficulty_Enum,
  EKeyAsyncStorage,
  Interview_Type_Enum,
  MockInterviewSessionProps,
  Practice_Mode_Enum,
  VideoAnalysisMetrics,
} from 'constants/Types';
import apiClient from './apiClient';
import {notifyFirstInterviewCompleted} from 'utils/appRating';

// `language` per the backend's contract — constants/languages.ts,
// docs/BACKEND_SPEC_ADDENDUM_2026-07.md §16 — so interview questions
// generate in the user's preferred language, not just get read aloud in it.
function currentLanguage(): string {
  return i18n.language || 'en';
}

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
  [Interview_Type_Enum.Sports]: 'sports',
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
    language: currentLanguage(),
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
  const {data} = await apiClient.get<SessionWire>(`/api/v1/interviews/sessions/${sessionId}`, {
    params: {language: currentLanguage()},
  });
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
    {language: currentLanguage()},
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
  // Centralized here rather than in each of LiveInterviewSession.tsx/
  // CodingInterview.tsx (both call completeSession) — fires the App Store
  // review prompt the very first time a session is ever completed, no-ops
  // every time after. See utils/appRating.ts.
  notifyFirstInterviewCompleted().catch(() => {});
}

/**
 * POST /api/v1/interviews/sessions/{sessionId}/video — uploads the real
 * video file react-native-vision-camera recorded on-device throughout a
 * Video-mode session (see services/videoAnalysisService.ts's
 * startVideoRecording/stopVideoRecording, called from
 * LiveInterviewSession.tsx's onEnd). This is what makes "Video Interview
 * Replay" an actual video you can scrub/watch back, not just a
 * transcript+metrics reconstruction — see services/interviewReplayService.ts.
 *
 * Same multipart-upload shape as documentsService.uploadDocument (RN's
 * FormData understands `{uri, type, name}` directly, streaming from disk
 * rather than reading the whole file into memory first). Uses a much longer
 * per-request timeout than apiClient's 20s default — even a 'low'-bitrate
 * multi-minute recording can take well over 20s to upload on a typical
 * mobile connection, and this call already only fires once the interview
 * itself is over, so there's no live-session responsiveness to protect.
 *
 * Best-effort by design: throws are caught by the caller (LiveInterviewSession),
 * which logs and moves on — a failed video upload should never block
 * finishing/navigating away from a completed interview, since every other
 * part of the session (transcript, scores, camera/voice metrics) was
 * already saved independently of this call.
 */
export async function uploadSessionVideo(
  sessionId: string,
  localFileUri: string,
  durationSec?: number,
): Promise<void> {
  const formData = new FormData();
  formData.append('file', {
    uri: localFileUri,
    name: 'interview.mp4',
    type: 'video/mp4',
  });
  if (durationSec != null) {
    formData.append('duration_sec', String(durationSec));
  }
  await apiClient.post(`/api/v1/interviews/sessions/${sessionId}/video`, formData, {
    timeout: 180000,
  });
}

/** Diagnostic-only, best-effort report of WHY a Video-mode session ended up
 * with no recording to upload -- e.g. videoAnalysisService's
 * getRecordingError() (a VisionCamera error code like
 * "session/camera-not-ready" or "insufficient_storage: only 84MB free"), or
 * "upload_failed: <message>" when the recording existed but the upload
 * itself never succeeded. Every failure in this pipeline used to just be a
 * console.warn nobody could see on a real device -- see
 * Saveur-Backend's app/models/interview.py video_error column comment for
 * the full story. Never throws -- purely informational, so a failure here
 * must never surface to the caller (LiveInterviewSession is already deep in
 * best-effort teardown when this gets called). */
export async function reportVideoError(sessionId: string, reason: string, code?: string): Promise<void> {
  try {
    await apiClient.post(`/api/v1/interviews/sessions/${sessionId}/video-error`, {reason, code});
  } catch (err) {
    console.warn('[interviewService] reportVideoError itself failed (non-fatal)', err);
  }
}

/** Deletes the recorded video for a session, on the user's own request --
 * product ask: "There should be a delete button in the video interview so
 * that users can delete it anytime they want." Only removes the video
 * itself (storage file + video_key/video_duration_sec/video_content_type/
 * video_error on the session); transcript, scores, and feedback are
 * untouched. Lets this throw -- unlike the best-effort diagnostic calls
 * above, a delete the user explicitly tapped for should surface a real
 * error if it fails, not silently pretend to succeed. */
export async function deleteSessionVideo(sessionId: string): Promise<void> {
  await apiClient.delete(`/api/v1/interviews/sessions/${sessionId}/video`);
}

// ---------------------------------------------------------------------------
// Resilient video upload (product bug fix): a user could complete a video
// interview normally -- transcript/metrics/score all saved fine via
// completeSession() above -- and still see "no video was recorded" on
// Interview Replay, with zero error shown anywhere. Root cause: onEnd() in
// LiveInterviewSession.tsx made exactly ONE attempt at uploadSessionVideo()
// and silently swallowed any failure (network blip right as the call ends,
// the app briefly backgrounded during the up-to-3-minute upload, a
// transient 5xx, etc.) -- InterviewReplay then correctly reports "no video"
// because video_key genuinely never got set, but the recording itself was
// real and just never made it off the device.
//
// uploadSessionVideoResilient() is what LiveInterviewSession.tsx now calls
// instead of the raw uploadSessionVideo() above: it retries a couple of
// times in-session, and if it still fails, persists the local file
// reference to AsyncStorage instead of discarding it, so
// flushPendingVideoUploads() (called from App.tsx on every foreground) can
// keep trying once the network/app state recovers -- without the user ever
// needing to redo the interview.
// ---------------------------------------------------------------------------

interface PendingVideoUpload {
  sessionId: string;
  localFileUri: string;
  durationSec?: number;
  attempts: number;
  firstFailedAt: number;
}

const RETRY_DELAYS_MS = [3000, 8000]; // in-session retries before falling back to the queue
const MAX_QUEUE_ATTEMPTS = 6; // spread across app foregrounds, not all at once
const MAX_QUEUE_AGE_MS = 48 * 60 * 60 * 1000; // the local CacheDir file itself may get purged by the OS well before this, but there's no earlier signal available to know that ahead of time

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPendingVideoQueue(): Promise<PendingVideoUpload[]> {
  try {
    const raw = await AsyncStorage.getItem(EKeyAsyncStorage.pendingVideoUploads);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function setPendingVideoQueue(queue: PendingVideoUpload[]): Promise<void> {
  await AsyncStorage.setItem(EKeyAsyncStorage.pendingVideoUploads, JSON.stringify(queue));
}

async function enqueuePendingVideoUpload(entry: Omit<PendingVideoUpload, 'attempts' | 'firstFailedAt'>): Promise<void> {
  const queue = await getPendingVideoQueue();
  if (queue.some(q => q.sessionId === entry.sessionId)) return; // already queued
  queue.push({...entry, attempts: 0, firstFailedAt: Date.now()});
  await setPendingVideoQueue(queue);
}

async function dequeuePendingVideoUpload(sessionId: string): Promise<void> {
  const queue = await getPendingVideoQueue();
  const next = queue.filter(q => q.sessionId !== sessionId);
  if (next.length !== queue.length) await setPendingVideoQueue(next);
}

/** Same upload, retried a couple of times before giving up -- covers the
 * common case (a brief network blip right as the interview ends) without
 * needing the slower cross-session queue at all. Falls back to queuing the
 * upload for later (rather than throwing) if every attempt fails, so the
 * caller's existing "best-effort, never blocks navigation" posture still
 * holds -- it just no longer means "give up forever" the way a single
 * silently-swallowed attempt did.
 *
 * The queue entry is now written FIRST, before any upload attempt is even
 * made -- not just as a last resort once every retry has failed. Root
 * cause of "still no video after feedback" reports surviving the earlier
 * version of this fix: LiveInterviewSession.tsx's onEnd() only waits up to
 * 20s for this whole function (withTimeout) before navigating away, but
 * this function itself keeps running detached for as long as ~9 minutes
 * (3 attempts x a 180s upload timeout, plus backoff delays) -- the
 * assumption was that a detached JS promise just keeps running in the
 * background regardless of navigation, which is true on a desktop runtime
 * but NOT reliably true on a real mobile OS: both iOS and Android suspend
 * a backgrounded app's JS execution, typically within seconds, and a user
 * has no reason to keep the app foregrounded once they've already been
 * navigated to Feedback. If that suspension happens before this function's
 * OWN retry loop ever reaches its last-attempt catch block, the
 * "enqueue for later" line never runs at all -- the upload is silently
 * lost forever, not just delayed, with nothing in the persistent queue for
 * flushPendingVideoUploads to ever pick back up. Enqueueing immediately
 * means a durable record of "this session's video still needs uploading"
 * exists on disk before the very first network byte goes out, regardless
 * of whether the app gets backgrounded a second later. */
export async function uploadSessionVideoResilient(
  sessionId: string,
  localFileUri: string,
  durationSec?: number,
): Promise<void> {
  await enqueuePendingVideoUpload({sessionId, localFileUri, durationSec});
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      await uploadSessionVideo(sessionId, localFileUri, durationSec);
      await dequeuePendingVideoUpload(sessionId);
      cleanupUploadedFile(localFileUri);
      return;
    } catch (err) {
      const isLastAttempt = attempt === RETRY_DELAYS_MS.length;
      console.warn(`[interviewService] video upload attempt ${attempt + 1} failed`, err);
      if (isLastAttempt) {
        // Already enqueued above -- nothing more to do here except let
        // flushPendingVideoUploads (App.tsx, on every foreground) pick it
        // up later.
        throw err;
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

/** Retries any video uploads that failed even after uploadSessionVideoResilient's
 * in-session attempts. Called from App.tsx whenever the app returns to the
 * foreground (same AppState pattern already used elsewhere -- see
 * AuthContext.tsx's refreshEmailVerified) -- cheap no-op when the queue is
 * empty, which is the overwhelmingly common case. */
export async function flushPendingVideoUploads(): Promise<void> {
  const queue = await getPendingVideoQueue();
  if (queue.length === 0) return;

  const remaining: PendingVideoUpload[] = [];

  for (const entry of queue) {
    const tooOld = Date.now() - entry.firstFailedAt > MAX_QUEUE_AGE_MS;
    const tooManyAttempts = entry.attempts >= MAX_QUEUE_ATTEMPTS;
    if (tooOld || tooManyAttempts) {
      // Give up for good -- the transcript/score for this session are still
      // intact either way, only the video itself is permanently lost.
      continue;
    }
    const barePath = entry.localFileUri.replace(/^file:\/\//, '');
    const stillExists = await RNBlobUtil.fs.exists(barePath).catch(() => false);
    if (!stillExists) {
      // The OS reclaimed the cache file before we got a chance to retry --
      // nothing left to upload.
      continue;
    }
    try {
      await uploadSessionVideo(entry.sessionId, entry.localFileUri, entry.durationSec);
      // Success -- drop it from the queue, and clean up the persistent
      // local copy (see stopVideoRecording's move-to-DocumentDir comment)
      // now that the backend has it durably.
      cleanupUploadedFile(entry.localFileUri);
    } catch (err) {
      console.warn('[interviewService] queued video upload retry failed', err);
      remaining.push({...entry, attempts: entry.attempts + 1});
    }
  }

  await setPendingVideoQueue(remaining);
}

/** Best-effort delete of a successfully-uploaded local video file — only
 * ever called after the backend has confirmed receipt, so a failure here
 * just leaves a harmless leftover file rather than losing anything. Scoped
 * to this app's own pending-interview-videos folder (see
 * videoAnalysisService.ts's stopVideoRecording), never the original
 * VisionCamera temp path, so this can't accidentally try to delete
 * something outside storage this app actually owns. */
function cleanupUploadedFile(localFileUri: string): void {
  const barePath = localFileUri.replace(/^file:\/\//, '');
  if (!barePath.includes('/pending-interview-videos/')) return;
  RNBlobUtil.fs.unlink(barePath).catch(() => {});
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

export interface WeeklyPracticeDay {
  day: string;
  sessions: number;
}

/**
 * Groups real practice-history sessions (getPracticeHistory) into the
 * CURRENT calendar week (Monday–Sunday), oldest first, so the Home
 * dashboard's "Weekly Practice" chart and the My Progress screen both show a
 * real bar chart instead of constants/Data.ts's DATA_WEEKLY_PRACTICE (a
 * static, same-for-everyone array that never reflected an actual account's
 * activity). Pure/local — takes whatever getPracticeHistory() already
 * returned rather than making its own network call, so callers control
 * caching/error-handling once and reuse the result for both a chart and any
 * other derived stats.
 *
 * Was a rolling trailing-7-days window (today back 6 days) — every bar was
 * always freshly recomputed from real session dates, so it was never
 * literally "stale", but a Wednesday's bar never actually reset to zero: it
 * just aged out of the window 7 days later. Per explicit request this now
 * anchors to Monday of dayjs()'s current week (dayjs's plain `.day()` is
 * 0=Sun..6=Sat regardless of locale, hence the `(dow + 6) % 7` shift rather
 * than relying on startOf('week'), which is locale/Sunday-based and not
 * pulled in as a plugin here anyway) — so every bar, including future days
 * in the current week that haven't happened yet, genuinely reads 0 until a
 * real session lands on that date, and the whole chart visibly resets each
 * Monday rather than just quietly sliding the window.
 */
export function computeWeeklyPractice(sessions: MockInterviewSessionProps[]): WeeklyPracticeDay[] {
  const today = dayjs();
  const daysSinceMonday = (today.day() + 6) % 7;
  const monday = today.subtract(daysSinceMonday, 'day').startOf('day');
  const days: WeeklyPracticeDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = monday.add(i, 'day');
    const count = sessions.filter(s => dayjs(s.date).isSame(d, 'day')).length;
    days.push({day: d.format('ddd'), sessions: count});
  }
  return days;
}
