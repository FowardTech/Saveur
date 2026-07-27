import i18n from 'i18next';
import apiClient from './apiClient';

function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// emotionalCoachService — AI Emotional Coach (product request item, Pro
// Premium). See app/api/emotional_coach.py for the full scope note — this
// is job-search stress support, not a therapy/crisis service.
// ---------------------------------------------------------------------------

export type Mood = 'great' | 'okay' | 'stressed' | 'overwhelmed' | 'discouraged';
export const MOODS: Mood[] = ['great', 'okay', 'stressed', 'overwhelmed', 'discouraged'];

export interface MoodCheckIn {
  id: number;
  mood: Mood;
  note: string | null;
  aiResponse: string;
  suggestedActions: string[];
  createdAt: string | null;
}

interface WireCheckIn {
  id?: number;
  mood?: Mood;
  note?: string | null;
  ai_response?: string;
  suggested_actions?: string[];
  created_at?: string | null;
}

function mapCheckIn(w: WireCheckIn): MoodCheckIn {
  return {
    id: w.id ?? 0,
    mood: (w.mood as Mood) ?? 'okay',
    note: w.note ?? null,
    aiResponse: w.ai_response ?? '',
    suggestedActions: w.suggested_actions ?? [],
    createdAt: w.created_at ?? null,
  };
}

/** Throws on failure so the screen can show a real error. */
export async function checkIn(mood: Mood, note?: string): Promise<MoodCheckIn> {
  const { data } = await apiClient.post<WireCheckIn>('/api/v1/emotional-coach/check-in', {
    mood, note: note || '', language: currentLanguage(),
  });
  return mapCheckIn(data);
}

export async function getHistory(): Promise<MoodCheckIn[]> {
  try {
    const { data } = await apiClient.get<{ items?: WireCheckIn[] }>('/api/v1/emotional-coach/history');
    return (data.items ?? []).map(mapCheckIn);
  } catch {
    return [];
  }
}
