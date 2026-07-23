import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import {CoachChatMessageProps, EKeyAsyncStorage, StarBreakdownItemProps} from 'constants/Types';
import apiClient from './apiClient';

// `language` (ISO 639-1, e.g. "en"/"es" — constants/languages.ts) is sent on
// every AI-generation call below per the backend's confirmed contract: field
// name `language` in the POST body / `?language=` query param on GETs,
// falling back to profile.locale then English if omitted/unrecognized. Safe
// to always send i18n.language — see docs/BACKEND_SPEC_ADDENDUM_2026-07.md §16.
function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// coachService — real backend implementation.
//
// Backs the "Coach" tab chat (src/messages/Chat.tsx) via POST /api/v1/coach/advice,
// and exposes a standalone STAR-breakdown helper via POST /api/v1/coach/star
// (see getStarBreakdown below — no screen calls this today, see its doc
// comment).
//
// Wire-shape note: the task spec that defines these endpoints only names the
// paths/purpose, not exact request/response JSON keys, so — following the
// same defensive-mapping approach as feedbackService.ts's STAR parsing — the
// response readers below check a couple of plausible key spellings
// (message/reply/text, snake_case/camelCase) and degrade to an empty/zero
// value rather than throwing if the real response shape differs slightly.
//
// Chat history itself (GET/DELETE) has no corresponding endpoint in this
// pass's spec, so it stays AsyncStorage-only, same as before — NOT a
// network-backed source of truth. Only the reply-generation call
// (sendMessage) hits the real backend now.
// ---------------------------------------------------------------------------

const GREETING_MESSAGE: CoachChatMessageProps = {
  id: 'msg_greeting',
  role: 'coach',
  text:
    "Hi, I'm your AI Career Coach. Ask me about interview nerves, salary negotiation, your resume, networking, or anything else on your job search — I'll do my best to point you in the right direction.",
  createdAt: 0,
};

const readHistory = async (): Promise<CoachChatMessageProps[]> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.coachChatHistory);
  if (raw) {
    try {
      return JSON.parse(raw) as CoachChatMessageProps[];
    } catch {
      // Corrupted/partial write — fall through and re-seed below.
    }
  }
  const seeded = [GREETING_MESSAGE];
  await AsyncStorage.setItem(EKeyAsyncStorage.coachChatHistory, JSON.stringify(seeded));
  return seeded;
};

const writeHistory = async (messages: CoachChatMessageProps[]): Promise<void> => {
  await AsyncStorage.setItem(EKeyAsyncStorage.coachChatHistory, JSON.stringify(messages));
};

/**
 * Read the full persisted chat history (seeded with a greeting on first
 * run). AsyncStorage-only — no GET history endpoint is part of this pass's
 * contract.
 */
export async function getChatHistory(): Promise<CoachChatMessageProps[]> {
  return readHistory();
}

export interface CoachUserContext {
  goals?: string[];
  industries?: string[];
  desiredRoles?: string[];
  preferredCountries?: string[];
}

/**
 * POST /api/v1/coach/advice — free-form career coach chat. Sends the user's
 * message (plus the last few turns of history as light context, since a
 * real assistant should have some conversational memory) and gets back a
 * single reply. Both the user's message and the coach's reply are persisted
 * locally so the thread survives navigating away from the Coach tab.
 *
 * `context` is the authenticated user's own profile summary (goals,
 * industries, desiredRoles, preferredCountries — see Chat.tsx's caller,
 * which reads these off AuthContext). This is handed to the backend
 * directly rather than relying solely on it looking the user up
 * server-side from the auth token — a request already carries this data,
 * so the backend doesn't need its own profile-lookup step to personalize a
 * reply. (It should still also use the authenticated user's stored profile
 * where richer signal — resume content, practice history — matters more
 * than can fit in a lightweight per-request payload; see the backend spec
 * addendum for the fuller expectation.)
 *
 * Real network errors now propagate to the caller (Chat.tsx), which shows an
 * Alert — this used to be a keyword-matching mock that could never fail.
 */
export async function sendMessage(
  text: string,
  context?: CoachUserContext,
): Promise<{userMessage: CoachChatMessageProps; coachMessage: CoachChatMessageProps}> {
  const history = await readHistory();

  const userMessage: CoachChatMessageProps = {
    id: `msg_${Date.now()}_u`,
    role: 'user',
    text,
    createdAt: Date.now(),
  };

  const recentTurns = history.slice(-8).map(m => ({role: m.role, text: m.text}));

  let replyText: string;
  try {
    const {data} = await apiClient.post<{
      reply?: string;
      message?: string;
      text?: string;
      response?: string;
    }>('/api/v1/coach/advice', {
      question: text,
      history: recentTurns,
      language: currentLanguage(),
      profile_context: context
        ? {
            goals: context.goals,
            industries: context.industries,
            desired_roles: context.desiredRoles,
            preferred_countries: context.preferredCountries,
          }
        : undefined,
    });
    replyText =
      data.reply ?? data.message ?? data.response ?? data.text ?? "I'm not sure how to answer that yet.";
  } catch (e) {
    // Persist at least the user's own message before propagating the error
    // — Chat.tsx already shows it optimistically, so the cache shouldn't
    // "lose" it on a reload just because the reply failed.
    await writeHistory([...history, userMessage]);
    throw e;
  }

  const coachMessage: CoachChatMessageProps = {
    id: `msg_${Date.now()}_c`,
    role: 'coach',
    text: replyText,
    createdAt: Date.now() + 1,
  };

  await writeHistory([...history, userMessage, coachMessage]);
  return {userMessage, coachMessage};
}

/**
 * POST /api/v1/coach/advice with mode: "voice" — backs the live-voice
 * coach conversation (src/messages/VoiceCoachView.tsx). Shares the exact
 * same persisted history as sendMessage above (both write to the same
 * AsyncStorage thread), so switching between Voice and Text mode on the
 * Coach tab shows one continuous conversation either way — this is
 * deliberately not a separate thread. `mode: "voice"` tells the backend to
 * pull in the user's real app-activity context (recent interview scores,
 * streak, career diary, learning progress, etc. — not just static profile
 * fields) and to keep replies short and speakable, since this text is
 * handed straight to TTS rather than displayed.
 */
export async function sendVoiceMessage(
  text: string,
  context?: CoachUserContext,
): Promise<{userMessage: CoachChatMessageProps; coachMessage: CoachChatMessageProps}> {
  const history = await readHistory();

  const userMessage: CoachChatMessageProps = {
    id: `msg_${Date.now()}_u`,
    role: 'user',
    text,
    createdAt: Date.now(),
  };

  const recentTurns = history.slice(-8).map(m => ({role: m.role, text: m.text}));

  let replyText: string;
  try {
    const {data} = await apiClient.post<{
      reply?: string;
      message?: string;
      text?: string;
      response?: string;
    }>('/api/v1/coach/advice', {
      question: text,
      history: recentTurns,
      language: currentLanguage(),
      mode: 'voice',
      profile_context: context
        ? {
            goals: context.goals,
            industries: context.industries,
            desired_roles: context.desiredRoles,
            preferred_countries: context.preferredCountries,
          }
        : undefined,
    });
    replyText =
      data.reply ?? data.message ?? data.response ?? data.text ?? "I'm not sure how to answer that yet.";
  } catch (e) {
    await writeHistory([...history, userMessage]);
    throw e;
  }

  const coachMessage: CoachChatMessageProps = {
    id: `msg_${Date.now()}_c`,
    role: 'coach',
    text: replyText,
    createdAt: Date.now() + 1,
  };

  await writeHistory([...history, userMessage, coachMessage]);
  return {userMessage, coachMessage};
}

/**
 * POST /api/v1/coach/advice — same real endpoint as sendMessage above, but
 * for one-off generation asks that aren't part of the Coach tab's
 * conversation thread (e.g. services/learningService.ts's course-module
 * content, where each call is its own self-contained prompt, not a chat
 * turn). Deliberately does NOT read/write the coach chat history —
 * persisting these into that thread would pollute a user's real
 * conversation with the AI coach with unrelated course content.
 */
export async function askOneOff(prompt: string, context?: CoachUserContext): Promise<string> {
  const {data} = await apiClient.post<{
    reply?: string;
    message?: string;
    text?: string;
    response?: string;
  }>('/api/v1/coach/advice', {
    question: prompt,
    history: [],
    language: currentLanguage(),
    profile_context: context
      ? {
          goals: context.goals,
          industries: context.industries,
          desired_roles: context.desiredRoles,
          preferred_countries: context.preferredCountries,
        }
      : undefined,
  });
  return data.reply ?? data.message ?? data.response ?? data.text ?? '';
}

/**
 * Clear the chat history (e.g. a "Reset conversation" action). AsyncStorage-
 * only — no DELETE endpoint is part of this pass's contract.
 */
export async function clearChatHistory(): Promise<void> {
  await AsyncStorage.setItem(EKeyAsyncStorage.coachChatHistory, JSON.stringify([GREETING_MESSAGE]));
}

// ---- Suggested topics (GET /api/v1/coach/suggested-topics) ----------------
// Used to be constants/Data.ts's DATA_MESSAGES — a hardcoded array of 4
// fixed strings with no service call anywhere, so literally every user saw
// the exact same "suggested" topics and hero subtitle. Tries the real
// backend first (which can genuinely personalize using the user's full
// history), and if that's unavailable/not yet implemented, falls back to
// building topics from data this app already has client-side
// (profile.goals/desiredRoles, collected at signup) rather than a fixed
// list — so even the fallback differs per account instead of being static.

export interface SuggestedTopic {
  id: string;
  title: string;
}

interface SuggestedTopicsWire {
  topics?: Array<{id?: string; title?: string; prompt?: string}>;
}

export interface SuggestedTopicsContext {
  goals?: string[];
  desiredRoles?: string[];
}

function buildFallbackTopics(context?: SuggestedTopicsContext): SuggestedTopic[] {
  const role = context?.desiredRoles?.[0];
  const goal = context?.goals?.[0];
  const topics: SuggestedTopic[] = [];
  if (role) {
    topics.push({id: 'role_prep', title: `What should I focus on to prepare for a ${role} interview?`});
  }
  if (goal) {
    topics.push({id: 'goal_next_step', title: `What's my next step toward "${goal}"?`});
  }
  topics.push(
    {id: 'resume_review', title: 'Can you review my resume and suggest improvements?'},
    {id: 'salary_negotiation', title: 'How should I approach negotiating my salary?'},
    {id: 'interview_nerves', title: 'How do I stay calm and confident during interviews?'},
  );
  return topics.slice(0, 3);
}

export async function getSuggestedTopics(context?: SuggestedTopicsContext): Promise<SuggestedTopic[]> {
  try {
    const {data} = await apiClient.get<SuggestedTopicsWire>('/api/v1/coach/suggested-topics', {
      params: {language: currentLanguage()},
    });
    const list = (data.topics ?? [])
      .map((t, i) => ({id: t.id ?? `topic_${i}`, title: t.title ?? t.prompt ?? ''}))
      .filter(t => t.title);
    if (list.length > 0) return list;
  } catch {
    // Not implemented yet / offline — fall through to the personalized
    // client-side fallback below rather than showing nothing.
  }
  return buildFallbackTopics(context);
}

// ---- STAR breakdown (POST /api/v1/coach/star) ------------------------------
// No existing screen shows a STAR-format breakdown of an arbitrary practice
// answer (InterviewFeedback.tsx's `starBreakdown` is a different feature —
// it's the S/T/A/R scoring of a *completed interview session*, sourced from
// feedbackService.getSessionFeedback()/GET /api/v1/feedback/session/{id}).
// This function is exposed for whichever screen ends up owning "paste an
// answer, get a STAR breakdown" next; nothing calls it today.

export interface StarBreakdownResult {
  breakdown: StarBreakdownItemProps[];
  overallNote?: string;
}

const STAR_LETTERS: Array<StarBreakdownItemProps['letter']> = ['S', 'T', 'A', 'R'];
const STAR_LABELS: Record<StarBreakdownItemProps['letter'], string> = {
  S: 'Situation',
  T: 'Task',
  A: 'Action',
  R: 'Result',
};

interface StarBreakdownItemWire {
  letter?: StarBreakdownItemProps['letter'];
  label?: string;
  score?: number;
  note?: string;
  feedback?: string;
}
interface StarBreakdownWire {
  breakdown?: StarBreakdownItemWire[];
  star_breakdown?: StarBreakdownItemWire[];
  starBreakdown?: StarBreakdownItemWire[];
  overall_note?: string;
  overallNote?: string;
}

/**
 * POST /api/v1/coach/star — run a real STAR (Situation/Task/Action/Result)
 * breakdown of a single free-text answer (e.g. a behavioral-interview
 * answer the user is drafting outside of a live session).
 */
export async function getStarBreakdown(
  answer: string,
  opts?: {question?: string},
): Promise<StarBreakdownResult> {
  const {data} = await apiClient.post<StarBreakdownWire>('/api/v1/coach/star', {
    answer,
    question: opts?.question,
    language: currentLanguage(),
  });
  const rawList = data.breakdown ?? data.star_breakdown ?? data.starBreakdown;
  const breakdown: StarBreakdownItemProps[] =
    Array.isArray(rawList) && rawList.length > 0
      ? STAR_LETTERS.map(letter => {
          const item = rawList.find(i => i.letter === letter) ?? {};
          return {
            letter,
            label: item.label ?? STAR_LABELS[letter],
            score: item.score ?? 0,
            note: item.note ?? item.feedback ?? '',
          };
        })
      : STAR_LETTERS.map(letter => ({letter, label: STAR_LABELS[letter], score: 0, note: ''}));

  return {breakdown, overallNote: data.overall_note ?? data.overallNote};
}
