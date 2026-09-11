import i18n from 'i18next';
import apiClient from './apiClient';

function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// practicalService — Practical Scenarios (product request): "coding practice
// already gives software engineers something hands-on to actually DO — every
// other career type only gets talk-based mock interviews." This is the
// hands-on equivalent for non-engineering tracks: a realistic, multi-step
// decision scenario for the learner's field, where each choice genuinely
// shapes what happens next (the backend generates the next situation live
// from the whole decision history, not from a fixed pre-authored tree — see
// Saveur-Backend/app/api/practical.py's _generate_step), and the AI scores
// judgment across the whole path at the end. Shares the same monthly free
// practice-session pool as mock interviews (see entitlementsService.ts).
// ---------------------------------------------------------------------------

export type PracticalType = 'healthcare' | 'sales' | 'marketing' | 'finance' | 'consulting' | 'science';

export interface PracticalChoice {
  id: string;
  text: string;
}

// Hands-on "task" steps (backend follow-up: PracticalStep.to_dict() now
// always includes step_type/task_prompt/response_text/task_feedback).
// Steps 3 and 5 of the 6-step session are always 'task', uniformly across
// every profession; step 1 and the final step 6 are always 'choice'.
export type PracticalStepType = 'choice' | 'task';

export interface PracticalTaskFeedback {
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface PracticalStep {
  order: number;
  stepType: PracticalStepType;
  situation: string;
  choices: PracticalChoice[];
  chosenChoiceId: string | null;
  // Only populated for stepType === 'task'; empty/null for 'choice' steps.
  taskPrompt: string | null;
  responseText: string | null;
  taskFeedback: PracticalTaskFeedback | null;
  isFinal: boolean;
}

export interface PracticalSessionSummary {
  id: number;
  type: PracticalType;
  role: string | null;
  status: 'active' | 'completed';
  startedAt: string | null;
  endedAt: string | null;
  overallScore: number | null;
}

export interface PracticalStepNote {
  order: number;
  note: string;
  isStrongMoment: boolean;
}

export interface PracticalFeedback {
  judgment: number | null;
  domainKnowledge: number | null;
  communication: number | null;
  criticalThinking: number | null;
  overall: number | null;
  summary: string;
  strengths: string[];
  improvements: string[];
  stepNotes: PracticalStepNote[];
}

export interface PracticalSessionDetail extends PracticalSessionSummary {
  steps: PracticalStep[];
  feedback: PracticalFeedback | null;
}

interface WireChoice {
  id?: string;
  text?: string;
}

interface WireTaskFeedback {
  feedback?: string;
  strengths?: string[];
  improvements?: string[];
}

interface WireStep {
  order?: number;
  step_type?: string;
  situation?: string;
  choices?: WireChoice[];
  chosen_choice_id?: string | null;
  task_prompt?: string | null;
  response_text?: string | null;
  task_feedback?: WireTaskFeedback | null;
  is_final?: boolean;
}

interface WireFeedback {
  judgment?: number | null;
  domain_knowledge?: number | null;
  communication?: number | null;
  critical_thinking?: number | null;
  overall?: number | null;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  step_notes?: { order?: number; note?: string; is_strong_moment?: boolean }[];
}

interface WireSession {
  id?: number;
  type?: string;
  role?: string | null;
  status?: string;
  started_at?: string | null;
  ended_at?: string | null;
  overall_score?: number | null;
  steps?: WireStep[];
  feedback?: WireFeedback | null;
}

function mapTaskFeedback(raw: WireTaskFeedback | null | undefined): PracticalTaskFeedback | null {
  if (!raw) return null;
  return {
    feedback: raw.feedback ?? '',
    strengths: raw.strengths ?? [],
    improvements: raw.improvements ?? [],
  };
}

function mapStep(raw: WireStep): PracticalStep {
  return {
    order: raw.order ?? 0,
    stepType: (raw.step_type as PracticalStepType) || 'choice',
    situation: raw.situation ?? '',
    choices: (raw.choices ?? []).map(c => ({ id: c.id ?? '', text: c.text ?? '' })),
    chosenChoiceId: raw.chosen_choice_id ?? null,
    taskPrompt: raw.task_prompt ?? null,
    responseText: raw.response_text ?? null,
    taskFeedback: mapTaskFeedback(raw.task_feedback),
    isFinal: raw.is_final ?? false,
  };
}

function mapFeedback(raw: WireFeedback | null | undefined): PracticalFeedback | null {
  if (!raw) return null;
  return {
    judgment: raw.judgment ?? null,
    domainKnowledge: raw.domain_knowledge ?? null,
    communication: raw.communication ?? null,
    criticalThinking: raw.critical_thinking ?? null,
    overall: raw.overall ?? null,
    summary: raw.summary ?? '',
    strengths: raw.strengths ?? [],
    improvements: raw.improvements ?? [],
    stepNotes: (raw.step_notes ?? []).map(n => ({
      order: n.order ?? 0,
      note: n.note ?? '',
      isStrongMoment: n.is_strong_moment ?? false,
    })),
  };
}

function mapSessionSummary(raw: WireSession): PracticalSessionSummary {
  return {
    id: raw.id ?? 0,
    type: (raw.type as PracticalType) || 'healthcare',
    role: raw.role ?? null,
    status: (raw.status as 'active' | 'completed') || 'active',
    startedAt: raw.started_at ?? null,
    endedAt: raw.ended_at ?? null,
    overallScore: raw.overall_score ?? null,
  };
}

/** GET /api/v1/practical/types — the career tracks with a practical-scenario mode. */
export async function getTypes(): Promise<PracticalType[]> {
  try {
    const { data } = await apiClient.get<{ types: PracticalType[] }>('/api/v1/practical/types');
    return data.types ?? [];
  } catch {
    return ['healthcare', 'sales', 'marketing', 'finance', 'consulting', 'science'];
  }
}

/**
 * POST /api/v1/practical/sessions — starts a new scenario and returns its
 * first AI-generated situation + choices. Throws a 402-shaped error (same
 * session_limit_reached contract as interviewService.startSession) when the
 * shared free-session cap is hit.
 */
export async function createSession(
  type: PracticalType,
  role?: string,
): Promise<{ session: PracticalSessionSummary; step: PracticalStep }> {
  const { data } = await apiClient.post<{ session: WireSession; step: WireStep }>(
    '/api/v1/practical/sessions',
    { type, role: role || '', language: currentLanguage() },
  );
  return { session: mapSessionSummary(data.session), step: mapStep(data.step) };
}

/**
 * POST /api/v1/practical/sessions/:id/choose — records the learner's pick
 * for the current step. Returns the next step if the scenario continues, or
 * {status: 'completed'} once the final step is reached (feedback generates
 * in the background — see PracticalScenarioFeedback.tsx's polling).
 */
export async function chooseOption(
  sessionId: number,
  choiceId: string,
): Promise<{ status: 'active'; step: PracticalStep } | { status: 'completed' }> {
  const { data } = await apiClient.post<{ status: string; step?: WireStep }>(
    `/api/v1/practical/sessions/${sessionId}/choose`,
    { choice_id: choiceId },
  );
  if (data.status === 'completed' || !data.step) {
    return { status: 'completed' };
  }
  return { status: 'active', step: mapStep(data.step) };
}

/**
 * POST /api/v1/practical/sessions/:id/submit-task — submits the learner's
 * free-text response for a "task"-type step (a hands-on deliverable, e.g.
 * "Write the SBAR note you'd hand off..."). The backend grades it and
 * returns that grading alongside the already-generated next step, so the
 * caller never needs a second fetch just to move on. Mirrors chooseOption's
 * shape/error-propagation conventions: 502 grading_failed / 503
 * llm_unavailable / 400s all surface through apiClient's normalized
 * `.message`. `status: 'completed'` is handled defensively even though
 * today's fixed step layout (see Saveur-Backend's app/api/practical.py)
 * makes a task step also being the session's final step unreachable.
 */
export async function submitTask(
  sessionId: number,
  responseText: string,
): Promise<
  | { status: 'active'; step: PracticalStep; taskFeedback: PracticalTaskFeedback | null }
  | { status: 'completed'; taskFeedback: PracticalTaskFeedback | null }
> {
  const { data } = await apiClient.post<{ status: string; step?: WireStep; task_feedback?: WireTaskFeedback | null }>(
    `/api/v1/practical/sessions/${sessionId}/submit-task`,
    { response_text: responseText },
  );
  const taskFeedback = mapTaskFeedback(data.task_feedback);
  if (data.status === 'completed' || !data.step) {
    return { status: 'completed', taskFeedback };
  }
  return { status: 'active', step: mapStep(data.step), taskFeedback };
}

/** GET /api/v1/practical/sessions/:id — full session with steps + feedback (once ready). */
export async function getSession(sessionId: number): Promise<PracticalSessionDetail> {
  const { data } = await apiClient.get<WireSession>(`/api/v1/practical/sessions/${sessionId}`);
  return {
    ...mapSessionSummary(data),
    steps: (data.steps ?? []).map(mapStep),
    feedback: mapFeedback(data.feedback),
  };
}

/** GET /api/v1/practical/sessions — practice history for this feature (mirrors interviewService.getPracticeHistory's shape, kept separate since it's a distinct session type). */
export async function listSessions(): Promise<PracticalSessionSummary[]> {
  const { data } = await apiClient.get<WireSession[]>('/api/v1/practical/sessions');
  return (data ?? []).map(mapSessionSummary);
}
