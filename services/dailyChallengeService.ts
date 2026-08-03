import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// dailyChallengeService — Surprise Daily Challenge (product request item):
// one unpredictable practice challenge a day (elevator pitch, coding
// problem, salary negotiation, leadership scenario, public speaking). See
// saveur-backend's app/api/daily_challenge.py +
// app/services/daily_challenge_service.py, and configService.ts's
// DailyChallengeConfig for the (already-translated) type-name catalog.
// ---------------------------------------------------------------------------

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
  const {data} = await apiClient.get<DailyChallengeWire>('/api/v1/daily-challenge/today');
  return fromWire(data);
}

export async function submitChallengeResponse(response: string): Promise<DailyChallenge> {
  const {data} = await apiClient.post<DailyChallengeWire>('/api/v1/daily-challenge/submit', {response});
  return fromWire(data);
}

export async function skipTodayChallenge(): Promise<DailyChallenge> {
  const {data} = await apiClient.post<DailyChallengeWire>('/api/v1/daily-challenge/skip');
  return fromWire(data);
}
