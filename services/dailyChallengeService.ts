import i18n from 'i18next';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// dailyChallengeService — Surprise Daily Challenge (product request item):
// one unpredictable practice challenge a day (elevator pitch, coding
// problem, salary negotiation, leadership scenario, public speaking). See
// saveur-backend's app/api/daily_challenge.py +
// app/services/daily_challenge_service.py, and configService.ts's
// DailyChallengeConfig for the (already-translated) type-name catalog.
//
// BUG FIX ("the content of this refused to translate" — promptText/
// aiFeedback stayed English on an otherwise fully-Portuguese screen): this
// was the one AI-content service in the app that never sent `language` at
// all. The backend endpoints DO already resolve/honor it (see
// Saveur-Backend's language_service.resolve_language + this module's own
// GET/POST handlers calling it) and fall back to the account's stored
// profile.locale when omitted — but that stored value can drift out of
// sync with the app's actual live i18next language (e.g. the fire-and-
// forget PATCH /users/me on a language switch never lands), so it's not a
// safe substitute for sending the real value on every call. Every other
// AI-generation service in this app (coachService.ts, resumeService.ts,
// roadmapService.ts, etc.) already sends `language: i18n.language` on
// every request per the confirmed backend contract (see
// coachService.ts's currentLanguage() comment) — this file just never
// followed that pattern.
// ---------------------------------------------------------------------------

function currentLanguage(): string {
  return i18n.language || 'en';
}

export interface DailyChallenge {
  id: number;
  day: string;
  challengeType: string;
  promptText: string;
  responseText: string | null;
  aiFeedback: string | null;
  completed: boolean;
  skipped: boolean;
  xpAwarded: number;
}

interface DailyChallengeWire {
  id: number;
  day?: string;
  challenge_type?: string;
  prompt_text?: string;
  response_text?: string | null;
  ai_feedback?: string | null;
  completed?: boolean;
  skipped?: boolean;
  xp_awarded?: number;
}

function fromWire(w: DailyChallengeWire): DailyChallenge {
  return {
    id: w.id,
    day: w.day ?? '',
    challengeType: w.challenge_type ?? '',
    promptText: w.prompt_text ?? '',
    responseText: w.response_text ?? null,
    aiFeedback: w.ai_feedback ?? null,
    completed: !!w.completed,
    skipped: !!w.skipped,
    xpAwarded: w.xp_awarded ?? 0,
  };
}

export async function getTodayChallenge(): Promise<DailyChallenge> {
  const {data} = await apiClient.get<DailyChallengeWire>('/api/v1/daily-challenge/today', {
    params: {language: currentLanguage()},
  });
  return fromWire(data);
}

export async function submitChallengeResponse(response: string): Promise<DailyChallenge> {
  const {data} = await apiClient.post<DailyChallengeWire>('/api/v1/daily-challenge/submit', {
    response,
    language: currentLanguage(),
  });
  return fromWire(data);
}

export async function skipTodayChallenge(): Promise<DailyChallenge> {
  const {data} = await apiClient.post<DailyChallengeWire>('/api/v1/daily-challenge/skip', {
    language: currentLanguage(),
  });
  return fromWire(data);
}
