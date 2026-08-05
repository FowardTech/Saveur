import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';
import {EKeyAsyncStorage} from 'constants/Types';

// ---------------------------------------------------------------------------
// dailyCheckinService — Daily career-goal check-in (product request item):
// on login, a bottom sheet asks "what's your career goal for today?"
// (type-or-speak — see components/DailyCheckInSheet.tsx), used to
// personalize that day's coaching content. Explicitly distinct from the
// one-time, signup-time general career goal (AuthContext's profile.goals).
// A push later that day ("How did your day goal go?") opens a matching
// reflection sheet. See Saveur-Backend's app/api/daily_checkin.py +
// app/services/daily_checkin_service.py.
// ---------------------------------------------------------------------------

export interface DailyCheckIn {
  id: number | null;
  day: string | null;
  goalText: string | null;
  goalAnswered: boolean;
  reflectionText: string | null;
  reflectionAnswered: boolean;
}

interface DailyCheckInWire {
  id: number | null;
  day: string | null;
  goal_text: string | null;
  goal_answered: boolean;
  reflection_text: string | null;
  reflection_answered: boolean;
}

function fromWire(w: DailyCheckInWire): DailyCheckIn {
  return {
    id: w.id,
    day: w.day,
    goalText: w.goal_text,
    goalAnswered: !!w.goal_answered,
    reflectionText: w.reflection_text,
    reflectionAnswered: !!w.reflection_answered,
  };
}

// Read-only — never creates a row server-side (see the backend model's
// docstring for why). HomeSrc.tsx's login popup uses `goalAnswered` to
// decide whether to show the morning prompt at all.
export async function getToday(): Promise<DailyCheckIn> {
  const {data} = await apiClient.get<DailyCheckInWire>('/api/v1/daily-checkin/today');
  return fromWire(data);
}

export async function submitGoal(text: string): Promise<DailyCheckIn> {
  const {data} = await apiClient.post<DailyCheckInWire>('/api/v1/daily-checkin/goal', {text});
  return fromWire(data);
}

export async function submitReflection(text: string): Promise<DailyCheckIn> {
  const {data} = await apiClient.post<DailyCheckInWire>('/api/v1/daily-checkin/reflection', {text});
  return fromWire(data);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Local-only "already asked (and dismissed without answering) today" flag —
// see EKeyAsyncStorage.dailyCheckinGoalDismissedDay's own comment for why
// the server-side `goalAnswered` flag alone isn't enough to stop the popup
// from reappearing every time Home regains focus the same day.
export async function wasGoalPromptDismissedToday(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(EKeyAsyncStorage.dailyCheckinGoalDismissedDay);
  return stored === todayIso();
}

export async function dismissGoalPromptForToday(): Promise<void> {
  await AsyncStorage.setItem(EKeyAsyncStorage.dailyCheckinGoalDismissedDay, todayIso());
}

// "How did your day go?" push tap (see pushNotificationService.ts) sets
// this before Home has necessarily regained focus yet; HomeSrc.tsx
// consumes it once mounted, same deferred pattern as
// jobShareService.consumePendingJob.
export async function setPendingReflectionPrompt(): Promise<void> {
  await AsyncStorage.setItem(EKeyAsyncStorage.pendingDailyCheckinReflection, '1');
}

export async function consumePendingReflectionPrompt(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(EKeyAsyncStorage.pendingDailyCheckinReflection);
  if (stored) await AsyncStorage.removeItem(EKeyAsyncStorage.pendingDailyCheckinReflection);
  return !!stored;
}
