import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import {EKeyAsyncStorage, GoalTipProps} from 'constants/Types';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// goalTipsService — real backend implementation of "daily AI-generated tips
// for the goals you set at signup" (profile.goals — see AuthContext.tsx /
// authService.ts).
//
//   GET /api/v1/goals/tips/today — one AI-generated tip per goal the user
//   currently has set, refreshed once per day server-side. This app never
//   asks the backend to *generate* a tip on demand — it just reads whatever
//   the backend has for "today"; the daily generation itself is a
//   backend-owned job (see the backend spec written up alongside this file's
//   introduction for the exact contract expected here).
//
// Backs the "Today's Goal Tips" card on src/home/HomeSrc.tsx. Same
// offline-read-fallback + snake_case-wire pattern as every other service in
// this app (see billingService.ts/notificationService.ts for the same
// shape).
// ---------------------------------------------------------------------------

interface GoalTipWire {
  id: string;
  goal: string;
  tip: string;
  created_at: string | number;
}

function toMillis(value: string | number): number {
  if (typeof value === 'number') {
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function fromWire(wire: GoalTipWire): GoalTipProps {
  return {
    id: wire.id,
    goal: wire.goal,
    tip: wire.tip,
    createdAt: toMillis(wire.created_at),
  };
}

const readCache = async (): Promise<GoalTipProps[] | null> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.goalTipsCache);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GoalTipProps[];
  } catch {
    return null;
  }
};

const writeCache = async (tips: GoalTipProps[]): Promise<void> => {
  await AsyncStorage.setItem(EKeyAsyncStorage.goalTipsCache, JSON.stringify(tips));
};

/**
 * GET /api/v1/goals/tips/today — today's AI-generated tip for each goal the
 * user currently has set. Falls back to the last-known cached list on a
 * network failure (e.g. viewing the Home dashboard offline) so the card
 * isn't just blank; a hard failure with nothing cached yet propagates so the
 * caller can show a real empty/error state instead of silently looking done.
 */
export async function getTodayTips(): Promise<GoalTipProps[]> {
  try {
    // `language` per the backend's contract (constants/languages.ts,
    // docs/BACKEND_SPEC_ADDENDUM_2026-07.md §16) — one of the two GET
    // endpoints this was specifically confirmed for, so today's tips come
    // back written in the user's preferred language.
    const {data} = await apiClient.get<GoalTipWire[]>('/api/v1/goals/tips/today', {
      params: {language: i18n.language || 'en'},
    });
    const tips = data.map(fromWire);
    await writeCache(tips);
    return tips;
  } catch (error) {
    const cached = await readCache();
    if (cached) return cached;
    throw error;
  }
}
