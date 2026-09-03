import i18n from 'i18next';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// interviewReplayService — Video Interview Replay (product request item).
// Now backed by a REAL recorded video when one exists: Video-mode sessions
// record locally via react-native-vision-camera throughout the live
// interview (see services/videoAnalysisService.ts's startVideoRecording/
// stopVideoRecording) and upload the finished file right after the session
// ends (interviewService.uploadSessionVideo) — see
// app/api/feedback.py's replay() docstring for the full backend side.
// `videoUrl` is null for Voice/Text-mode sessions (nothing was ever
// recorded) and for a Video-mode session whose upload hasn't landed yet —
// InterviewReplay.tsx falls back to the transcript+metrics timeline alone
// in that case, same as before this existed.
// ---------------------------------------------------------------------------

export interface ReplayTranscriptEntry {
  role: string;
  text: string;
  tMs: number;
}

export interface ReplayAnnotation {
  tMs: number;
  type: 'confidence_dip' | 'strong_moment' | string;
  label: string;
}

export interface ReplayVoiceMetrics {
  wordsPerMinute: number | null;
  fillerCount: number | null;
  longPauses: number | null;
}

/** Bug fix (mobile bug report: "when users view the interview replay of
 * coding interview instead of them seeing the practice problem they are
 * seeing the transcript of the AI interview... the user's answer and code
 * they wrote to solve the problem should also be in the replay"). A
 * "coding" session never has a real Q&A transcript to begin with — see
 * Saveur-Backend's app/api/feedback.py _replay_payload for the full
 * explanation — this is what shows INSTEAD, sourced from the same
 * submission the mock-interview screen sent at Finish. */
export interface ReplayCodingResult {
  language: string | null;
  code: string | null;
  problemStatement: string | null;
  testsPassed: number | null;
  testsTotal: number | null;
  /** Product follow-up ("build [scoring across multiple problems] out
   * too"): every problem attempted this session (including the one
   * already described by the flat fields above), when the "Next Problem"
   * button was used to cycle through more than one. Null for a plain
   * single-problem session. */
  attempts: ReplayCodingAttempt[] | null;
}

export interface ReplayCodingAttempt {
  problemSlug: string | null;
  problemTitle: string | null;
  problemStatement: string | null;
  language: string | null;
  code: string | null;
  testsPassed: number | null;
  testsTotal: number | null;
}

export interface SessionReplay {
  durationMs: number;
  /** Playable URL for the real recorded video, or null if this session has
   * none (Voice/Text mode, or a Video-mode upload that hasn't landed yet). */
  videoUrl: string | null;
  videoDurationSec: number | null;
  /** Raw diagnostic string (e.g. "insufficient_storage: only 84MB free",
   * "session/camera-not-ready: ...") set by POST .../video-error when this
   * was a Video-mode session and the client knows why videoUrl is null --
   * see Saveur-Backend's app/models/interview.py video_error column
   * comment. This is technical/internal by design; InterviewReplay.tsx maps
   * it to a short human sentence rather than ever showing it verbatim (same
   * mistake, same fix, as the "raw provider error in an Alert" bug). */
  videoError: string | null;
  /** Product report: "sometimes the video recording failed to save to the
   * server... when they click view video replay it should display a
   * message and show saving your video interview session." Drives
   * InterviewReplay.tsx's dedicated "Saving your video interview..." state
   * -- 'uploading' takes priority over a non-null videoError above (see
   * Saveur-Backend's app/api/feedback.py _replay_payload comment: an
   * interim "will retry" error can coexist with a still-in-flight upload).
   * 'none' means this was never a Video-mode session at all (Voice/Text
   * mode) or predates this field existing. */
  videoStatus: 'ready' | 'uploading' | 'failed' | 'none';
  /** Backs InterviewReplay.tsx's branch between the generic
   * transcript/video view (everything else) and a dedicated Problem +
   * Your Code view (sessionType === 'coding'). */
  sessionType: string | null;
  transcript: ReplayTranscriptEntry[];
  /** Only non-null when sessionType === 'coding' and the candidate actually
   * submitted something before Finish. */
  codingResult: ReplayCodingResult | null;
  voiceMetrics: ReplayVoiceMetrics | null;
  annotations: ReplayAnnotation[];
}

interface WireReplay {
  duration_ms?: number;
  video_url?: string | null;
  video_duration_sec?: number | null;
  video_error?: string | null;
  video_status?: 'ready' | 'uploading' | 'failed' | 'none' | null;
  session_type?: string | null;
  transcript?: Array<{ role?: string; text?: string; t_ms?: number }>;
  coding_result?: {
    language?: string | null;
    code?: string | null;
    problem_statement?: string | null;
    tests_passed?: number | null;
    tests_total?: number | null;
    attempts?: Array<{
      problem_slug?: string | null;
      problem_title?: string | null;
      problem_statement?: string | null;
      language?: string | null;
      code?: string | null;
      tests_passed?: number | null;
      tests_total?: number | null;
    }> | null;
  } | null;
  voice_metrics?: { words_per_minute?: number; filler_count?: number; long_pauses?: number } | null;
  annotations?: Array<{ t_ms?: number; type?: string; label?: string }>;
}

export async function getSessionReplay(sessionId: string | number): Promise<SessionReplay> {
  const { data } = await apiClient.get<WireReplay>(`/api/v1/feedback/session/${sessionId}/replay`);
  return {
    durationMs: data.duration_ms ?? 0,
    videoUrl: data.video_url ?? null,
    videoDurationSec: data.video_duration_sec ?? null,
    videoError: data.video_error ?? null,
    videoStatus: data.video_status ?? 'none',
    sessionType: data.session_type ?? null,
    transcript: (data.transcript ?? []).map(m => ({
      role: m.role ?? '', text: m.text ?? '', tMs: m.t_ms ?? 0,
    })),
    codingResult: data.coding_result
      ? {
          language: data.coding_result.language ?? null,
          code: data.coding_result.code ?? null,
          problemStatement: data.coding_result.problem_statement ?? null,
          testsPassed: data.coding_result.tests_passed ?? null,
          testsTotal: data.coding_result.tests_total ?? null,
          attempts: data.coding_result.attempts
            ? data.coding_result.attempts.map(a => ({
                problemSlug: a.problem_slug ?? null,
                problemTitle: a.problem_title ?? null,
                problemStatement: a.problem_statement ?? null,
                language: a.language ?? null,
                code: a.code ?? null,
                testsPassed: a.tests_passed ?? null,
                testsTotal: a.tests_total ?? null,
              }))
            : null,
        }
      : null,
    voiceMetrics: data.voice_metrics
      ? {
          wordsPerMinute: data.voice_metrics.words_per_minute ?? null,
          fillerCount: data.voice_metrics.filler_count ?? null,
          longPauses: data.voice_metrics.long_pauses ?? null,
        }
      : null,
    annotations: (data.annotations ?? []).map(a => ({
      tMs: a.t_ms ?? 0,
      type: (a.type as ReplayAnnotation['type']) ?? '',
      // BUG FIX (product report: flagged-moment text like "Eye contact
      // dropped for a few seconds here" showing in English on an otherwise
      // fully-translated feedback screen): the backend (app/api/feedback.py)
      // sends `label` as a fixed, hardcoded-English template string per
      // annotation `type` — it's not AI-generated commentary, just a
      // constant per type, so there's nothing to localize server-side the
      // way AI replies are. `type` itself ('confidence_dip' /
      // 'strong_moment') IS a stable, translatable enum though, so derive
      // the display label from that client-side instead of trusting the
      // raw English `label` — same "prefer the stable code over the raw
      // text" fix already applied to the STAR breakdown in
      // feedbackService.ts. Falls back to the raw backend label for any
      // future annotation `type` this client doesn't recognize yet, so a
      // backend-only addition doesn't silently disappear.
      label: annotationLabel(a.type, a.label),
    })),
  };
}

function annotationLabel(type: string | undefined, rawLabel: string | undefined): string {
  if (type === 'confidence_dip') {
    return i18n.t('find:annotation_confidence_dip', {
      defaultValue: 'Eye contact dropped for a few seconds here',
    });
  }
  if (type === 'strong_moment') {
    return i18n.t('find:annotation_strong_moment', {
      defaultValue: 'Strong eye contact and a genuine smile here',
    });
  }
  return rawLabel ?? '';
}

export function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
