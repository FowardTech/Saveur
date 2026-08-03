import i18n from 'i18next';
import {SkillScoreProps, StarBreakdownItemProps} from 'constants/Types';
import apiClient from './apiClient';

// `language` per the backend's contract — constants/languages.ts,
// docs/BACKEND_SPEC_ADDENDUM_2026-07.md §16. Only added to the two endpoints
// that generate natural-language commentary (session feedback); the
// camera-frame/camera-summary endpoints are pure numeric telemetry with
// nothing to localize.
function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// feedbackService — real backend implementation for the Feedback + camera-
// analysis domain (`/api/v1/feedback/*`). Split out from interviewService.ts
// into its own file because the backend contract itself splits these under a
// different base path than `/api/v1/interviews/*` — mirrors
// services/authService.ts's one-file-per-backend-domain pattern.
//
// Wire-shape note (read before "fixing" a field name here): the contract
// this was built against only names the scoring *dimensions*
// (confidence, communication, technical, leadership, problem-solving,
// creativity, critical-thinking, STAR) — it does not pin down the exact JSON
// keys GET /feedback/session/{id} returns for them. fromFeedbackWire below
// takes a literal snake_case reading of those dimension names (confidence,
// communication, technical, leadership, problem_solving, creativity,
// critical_thinking) but also checks a couple of plausible alternates
// (nested under `scores`, camelCase) so a slightly different real response
// shape degrades to a 0 for that one dimension instead of throwing/crashing
// the whole feedback screen. Tighten this once a real backend response has
// actually been seen.
// ---------------------------------------------------------------------------

// BUG FIX (product report: screenshot showing "Situation/Task/Action/Result"
// and "Confidence/Communication/..." rendering in English on an otherwise
// fully-French feedback screen): these used to be plain hardcoded English
// strings used BOTH as the internal dictionary key AND as the literal
// display label handed straight to the UI — so there was no way to
// translate the display text without breaking the lookup. Split into a
// stable internal SKILL_KEY (never shown to the user, never translated)
// and a separate skillLabel()/starLabel() function that resolves the
// user-facing text via i18n.t() at call time (not once at module load),
// so it reflects whatever language is active when the feedback screen
// actually renders.
const SKILL_KEYS = [
  'confidence',
  'communication',
  'technical',
  'leadership',
  'problem_solving',
  'creativity',
  'critical_thinking',
] as const;
type SkillKey = (typeof SKILL_KEYS)[number];

function skillLabel(key: SkillKey | 'storytelling'): string {
  const defaults: Record<SkillKey | 'storytelling', string> = {
    confidence: 'Confidence',
    communication: 'Communication',
    technical: 'Technical Skill',
    leadership: 'Leadership',
    problem_solving: 'Problem Solving',
    creativity: 'Creativity',
    critical_thinking: 'Critical Thinking',
    // Interview Heat Map (product request item) — synthetic 8th dimension,
    // averaged server-side from the 4 STAR scores (see feedback.py's
    // /heatmap). STAR itself IS a structured-storytelling framework, so
    // this reads as a genuine skill rather than a duplicate of the STAR
    // Breakdown section elsewhere.
    storytelling: 'Storytelling',
  };
  return i18n.t(`find:skill_${key}`, { defaultValue: defaults[key] });
}

const STAR_LETTERS: Array<StarBreakdownItemProps['letter']> = ['S', 'T', 'A', 'R'];
const STAR_LONG_KEYS: Record<StarBreakdownItemProps['letter'], string> = {
  S: 'situation',
  T: 'task',
  A: 'action',
  R: 'result',
};

function starLabel(letter: StarBreakdownItemProps['letter']): string {
  const defaults: Record<StarBreakdownItemProps['letter'], string> = {
    S: 'Situation',
    T: 'Task',
    A: 'Action',
    R: 'Result',
  };
  return i18n.t(`find:star_${STAR_LONG_KEYS[letter]}`, { defaultValue: defaults[letter] });
}

export interface FeedbackReport {
  overallScore: number;
  skillScores: SkillScoreProps[];
  starBreakdown: StarBreakdownItemProps[];
  // Passed through in case the backend does async scoring and this read
  // lands before the job finishes (e.g. 'pending' | 'ready') — InterviewFeedback
  // doesn't currently branch on this, but it's surfaced for future use.
  status?: string;
}

interface ScoresWire {
  confidence?: number;
  communication?: number;
  technical?: number;
  leadership?: number;
  problem_solving?: number;
  problemSolving?: number;
  creativity?: number;
  critical_thinking?: number;
  criticalThinking?: number;
}

interface StarItemWire {
  score?: number;
  note?: string;
}

interface StarWire {
  S?: StarItemWire;
  T?: StarItemWire;
  A?: StarItemWire;
  R?: StarItemWire;
  situation?: StarItemWire;
  task?: StarItemWire;
  action?: StarItemWire;
  result?: StarItemWire;
}

interface StarBreakdownItemWire {
  letter: StarBreakdownItemProps['letter'];
  label?: string;
  score?: number;
  note?: string;
}

interface FeedbackWire extends ScoresWire {
  status?: string;
  overall_score?: number;
  overallScore?: number;
  scores?: ScoresWire;
  star?: StarWire;
  star_breakdown?: StarBreakdownItemWire[];
  starBreakdown?: StarBreakdownItemWire[];
  // A few plausible wrapper shapes seen from other endpoints in this app
  // (e.g. `{data: {...}}` / `{result: {...}}`) — checked in fromFeedbackWire
  // below before falling back to reading `wire` directly, same defensive
  // spirit as the scores/star handling above.
  data?: FeedbackWire;
  result?: FeedbackWire;
}

// Statuses meaning "the backend hasn't finished scoring this session yet" —
// distinct from a session that scored and genuinely got a 0. Not a confirmed
// backend contract (no real response has been seen yet), so this is
// deliberately permissive: anything that LOOKS like an in-progress status
// string is treated as pending rather than only matching one exact spelling.
const PENDING_STATUSES = new Set([
  'pending', 'processing', 'queued', 'in_progress', 'inprogress', 'scoring', 'running',
]);
export function isFeedbackPending(status?: string): boolean {
  return !!status && PENDING_STATUSES.has(status.toLowerCase());
}

function pickScore(wire: FeedbackWire, key: keyof ScoresWire, altKey?: keyof ScoresWire): number {
  const scores = wire.scores ?? {};
  const val =
    scores[key] ??
    (altKey ? scores[altKey] : undefined) ??
    wire[key] ??
    (altKey ? wire[altKey] : undefined);
  return typeof val === 'number' ? Math.round(val) : 0;
}

function fromFeedbackWire(rawWire: FeedbackWire): FeedbackReport {
  const wire = rawWire.data ?? rawWire.result ?? rawWire;
  const scoreByKey: Record<SkillKey, number> = {
    confidence: pickScore(wire, 'confidence'),
    communication: pickScore(wire, 'communication'),
    technical: pickScore(wire, 'technical'),
    leadership: pickScore(wire, 'leadership'),
    problem_solving: pickScore(wire, 'problem_solving', 'problemSolving'),
    creativity: pickScore(wire, 'creativity'),
    critical_thinking: pickScore(wire, 'critical_thinking', 'criticalThinking'),
  };
  const skillScores: SkillScoreProps[] = SKILL_KEYS.map(key => ({
    label: skillLabel(key),
    score: scoreByKey[key],
  }));

  const rawStarList = wire.star_breakdown ?? wire.starBreakdown;
  let starBreakdown: StarBreakdownItemProps[];
  if (Array.isArray(rawStarList) && rawStarList.length > 0) {
    starBreakdown = rawStarList.map(item => ({
      letter: item.letter,
      // Was `item.label ?? STAR_LABELS[item.letter]` — if the backend ever
      // sends its own `label` field (English, since the API contract
      // doesn't localize it), that raw English took priority over the
      // translated one. The letter (S/T/A/R) is a stable enum either way,
      // so always deriving the display label from it client-side is both
      // simpler and actually translatable.
      label: starLabel(item.letter),
      score: item.score ?? 0,
      note: item.note ?? '',
    }));
  } else {
    const star = wire.star ?? {};
    starBreakdown = STAR_LETTERS.map(letter => {
      const item = star[letter] ?? star[STAR_LONG_KEYS[letter] as keyof StarWire] ?? {};
      return {
        letter,
        label: starLabel(letter),
        score: item.score ?? 0,
        note: item.note ?? '',
      };
    });
  }

  const overallScore =
    wire.overall_score ??
    wire.overallScore ??
    Math.round(skillScores.reduce((sum, s) => sum + s.score, 0) / skillScores.length);

  return {overallScore, skillScores, starBreakdown, status: wire.status};
}

/**
 * GET /api/v1/feedback/session/{sessionId} — the full scored report for a
 * session that's already been finalized via
 * interviewService.completeSession() (POST .../end). Call from
 * InterviewFeedback on mount.
 */
export async function getSessionFeedback(sessionId: string): Promise<FeedbackReport> {
  const {data} = await apiClient.get<FeedbackWire>(`/api/v1/feedback/session/${sessionId}`, {
    params: {language: currentLanguage()},
  });
  return fromFeedbackWire(data);
}

/**
 * POST /api/v1/feedback/session/{sessionId}/regenerate — re-runs scoring for
 * an already-ended session. Wired to a "Regenerate Feedback" action on
 * InterviewFeedback, next to the overall-score card.
 */
export async function regenerateFeedback(sessionId: string): Promise<FeedbackReport> {
  const {data} = await apiClient.post<FeedbackWire>(
    `/api/v1/feedback/session/${sessionId}/regenerate`,
    {language: currentLanguage()},
  );
  return fromFeedbackWire(data);
}

// Interview Heat Map (product request item) — cross-session average per
// skill dimension (see feedback.py's /heatmap), for My Progress's aggregate
// bar view, distinct from InterviewFeedback.tsx's existing single-session
// ring breakdown.
export interface HeatMapEntry {
  key: string;
  label: string;
  score: number;
}

export interface HeatMapReport {
  sessionCount: number;
  dimensions: HeatMapEntry[];
}

interface HeatMapDimensionWire {
  key?: string;
  score?: number;
}

interface HeatMapWire {
  session_count?: number;
  dimensions?: HeatMapDimensionWire[];
}

export async function getHeatMap(): Promise<HeatMapReport> {
  const {data} = await apiClient.get<HeatMapWire>('/api/v1/feedback/heatmap');
  const dimensions = (data.dimensions ?? []).map(d => ({
    key: d.key ?? '',
    label: skillLabel((d.key ?? '') as SkillKey | 'storytelling'),
    score: typeof d.score === 'number' ? Math.round(d.score) : 0,
  }));
  return {sessionCount: data.session_count ?? 0, dimensions};
}

// ---- Camera analysis (Video-mode sessions only) ----------------------------
// Voice/Text-mode sessions never call any of the functions below — see
// src/practice/LiveInterviewSession.tsx, which only wires this up inside its
// `isVideoMode` branch.

// One real, on-device face-detection sample, as produced by
// services/videoAnalysisService.ts's frame buffer (see `drainFrameBuffer` on
// that hook). Deliberately mirrors that hook's naming, not the wire format —
// toCameraFrameWire below is the only place that translation happens.
export interface CameraFrameSample {
  ts: number;
  lookingAtCamera: boolean;
  smiling: boolean;
  yaw: number;
  pitch: number;
}

interface CameraFrameWire {
  ts: number;
  eye_contact: boolean;
  smile: boolean;
  head_yaw: number;
  head_pitch: number;
}

function toCameraFrameWire(sample: CameraFrameSample): CameraFrameWire {
  return {
    ts: sample.ts,
    eye_contact: sample.lookingAtCamera,
    smile: sample.smiling,
    head_yaw: sample.yaw,
    head_pitch: sample.pitch,
  };
}

/**
 * POST /api/v1/feedback/session/{sessionId}/camera-frame — batched ingestion
 * of real on-device face-detection samples. Called on an interval (every few
 * seconds) from LiveInterviewSession while a Video-mode session is live, NOT
 * once per ML-Kit detection (which can fire 15-30x/sec and would flood the
 * network) — see videoAnalysisService's frame-buffer throttle for where the
 * per-sample rate is actually controlled.
 *
 * Deliberately best-effort: a dropped batch is telemetry, not a user action,
 * so callers should catch/log rather than surface this failure to the user
 * or let it interrupt the live interview.
 *
 * `posture`/`expression` from the contract's example body are intentionally
 * omitted — nothing in the on-device pipeline produces them today
 * (react-native-vision-camera-face-detector is configured with
 * `landmarkMode: 'none'`/`contourMode: 'none'` for performance, see
 * FACE_DETECTION_OPTIONS in videoAnalysisService.ts) and fabricating them
 * would misrepresent what's real signal vs. not.
 */
export async function postCameraFrames(
  sessionId: string,
  frames: CameraFrameSample[],
): Promise<void> {
  if (frames.length === 0) return;
  await apiClient.post(`/api/v1/feedback/session/${sessionId}/camera-frame`, {
    frames: frames.map(toCameraFrameWire),
  });
}

export interface CameraSummary {
  eyeContactPct: number;
  smilePct: number;
  avgHeadYaw: number;
  avgHeadPitch: number;
}

interface CameraSummaryWire {
  eye_contact_pct?: number;
  smile_pct?: number;
  avg_head_yaw?: number;
  avg_head_pitch?: number;
}

/**
 * GET /api/v1/feedback/session/{sessionId}/camera-summary — server-side
 * aggregation of the frame-level samples streamed via postCameraFrames.
 * Called once, when a Video-mode session ends, from LiveInterviewSession —
 * used there as a cross-check/replacement for the eye-contact/smile/head-yaw
 * /head-pitch numbers the on-device hook already aggregated locally. Speech
 * metrics (filler words, speaking rate, silence gaps, confidenceScore) are
 * NOT part of this endpoint's contract and stay client-computed — see that
 * file for how the two are merged.
 */
export async function getCameraSummary(sessionId: string): Promise<CameraSummary> {
  const {data} = await apiClient.get<CameraSummaryWire>(
    `/api/v1/feedback/session/${sessionId}/camera-summary`,
  );
  return {
    eyeContactPct: Math.round(data.eye_contact_pct ?? 0),
    smilePct: Math.round(data.smile_pct ?? 0),
    avgHeadYaw: data.avg_head_yaw ?? 0,
    avgHeadPitch: data.avg_head_pitch ?? 0,
  };
}
