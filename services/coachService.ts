import AsyncStorage from '@react-native-async-storage/async-storage';
import {CoachChatMessageProps, EKeyAsyncStorage, StarBreakdownItemProps} from 'constants/Types';
import apiClient from './apiClient';

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

/**
 * POST /api/v1/coach/advice — free-form career coach chat. Sends the user's
 * message (plus the last few turns of history as light context, since a
 * real assistant should have some conversational memory) and gets back a
 * single reply. Both the user's message and the coach's reply are persisted
 * locally so the thread survives navigating away from the Coach tab.
 *
 * Real network errors now propagate to the caller (Chat.tsx), which shows an
 * Alert — this used to be a keyword-matching mock that could never fail.
 */
export async function sendMessage(
  text: string,
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
 * Clear the chat history (e.g. a "Reset conversation" action). AsyncStorage-
 * only — no DELETE endpoint is part of this pass's contract.
 */
export async function clearChatHistory(): Promise<void> {
  await AsyncStorage.setItem(EKeyAsyncStorage.coachChatHistory, JSON.stringify([GREETING_MESSAGE]));
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
