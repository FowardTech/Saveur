import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage, GamificationStreakProps, LeaderboardEntryProps} from 'constants/Types';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// gamificationService — real backend implementation of the streak/XP/
// leaderboard half of gamification.
//
//   GET  /api/v1/gamification/streak      — current streak + XP
//   POST /api/v1/gamification/checkin     — daily check-in
//   GET  /api/v1/gamification/leaderboard — top users
//
// Backs the streak/check-in/leaderboard UI on src/home/HomeSrc.tsx. Badge
// *definitions* (constants/Data.ts -> DATA_BADGES) and badge unlock state
// stay client-computed for now (see docs/BACKEND_API_SPEC.md §15 — that's
// explicitly out of scope here; only streak/XP/leaderboard talk to the real
// backend in this pass), but the streak day-count that feeds two of the
// badge unlock conditions (three_day_streak/five_day_streak) now comes from
// the real GET /streak response instead of a hardcoded value.
//
// Wire format note: like authService/billingService, assumed snake_case
// (`streak_days`, `checked_in_today`, `user_id`, `avatar_url`).
// ---------------------------------------------------------------------------

interface StreakWire {
  streak_days: number;
  longest_streak?: number;
  xp: number;
  checked_in_today: boolean;
}

interface LeaderboardEntryWire {
  user_id: string;
  // Despite the generic field name, the backend now always puts each
  // user's generated, non-identifying username here (see
  // Saveur-Backend's app/services/username_service.py + GET
  // /gamification/leaderboard) — never their real name. No client-side
  // change needed here beyond this note; this screen was always just
  // displaying whatever the backend sent as `name`.
  name: string;
  avatar_url?: string;
  xp: number;
  rank: number;
}

function fromStreakWire(wire: StreakWire): GamificationStreakProps {
  return {
    streakDays: wire.streak_days ?? 0,
    longestStreak: wire.longest_streak,
    xp: wire.xp ?? 0,
    checkedInToday: wire.checked_in_today ?? false,
  };
}

function fromLeaderboardWire(wire: LeaderboardEntryWire): LeaderboardEntryProps {
  // The backend isn't assumed to flag "is this row the caller" itself —
  // that's derived client-side by comparing against the signed-in Firebase
  // uid, the same identity apiClient's request interceptor uses to attach
  // the bearer token.
  const currentUid = auth().currentUser?.uid;
  return {
    id: wire.user_id,
    name: wire.name,
    avatarUrl: wire.avatar_url,
    xp: wire.xp ?? 0,
    rank: wire.rank,
    isCurrentUser: !!currentUid && wire.user_id === currentUid,
  };
}

const readStreakCache = async (): Promise<GamificationStreakProps | null> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.gamificationStreak);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GamificationStreakProps;
  } catch {
    return null;
  }
};

// Cache key is period-specific (`${base}:${period}`) — the three tabs are
// genuinely different rankings (see getLeaderboard's `period` param below),
// so a single shared cache slot would show the Daily tab's last-fetched
// list while offline on the Weekly tab and vice versa.
const leaderboardCacheKey = (period: LeaderboardPeriod) =>
  `${EKeyAsyncStorage.gamificationLeaderboard}:${period}`;

const readLeaderboardCache = async (period: LeaderboardPeriod): Promise<LeaderboardEntryProps[] | null> => {
  const raw = await AsyncStorage.getItem(leaderboardCacheKey(period));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LeaderboardEntryProps[];
  } catch {
    return null;
  }
};

/**
 * GET /api/v1/gamification/streak. Falls back to the last-known cached
 * value on a network failure (offline-read fallback only, not source of
 * truth) so the Home dashboard doesn't just show a blank stat card on a
 * flaky connection; propagates the error if nothing is cached yet.
 */
export async function getStreak(): Promise<GamificationStreakProps> {
  try {
    const {data} = await apiClient.get<StreakWire>('/api/v1/gamification/streak');
    const streak = fromStreakWire(data);
    await AsyncStorage.setItem(EKeyAsyncStorage.gamificationStreak, JSON.stringify(streak));
    return streak;
  } catch (error) {
    const cached = await readStreakCache();
    if (cached) return cached;
    throw error;
  }
}

/**
 * POST /api/v1/gamification/checkin — records today's daily check-in.
 * Assumed to respond with the updated streak/XP object (same shape as
 * GET /gamification/streak) so the caller can update its state directly
 * without a second round trip — mirrors billingService's checkout endpoint
 * returning state the caller needs immediately. Deliberately has no offline
 * fallback: a check-in is a write, not a read, so it has to actually reach
 * the server to count — silently "succeeding" from a stale local cache
 * while offline would let the user believe they extended their streak when
 * they didn't.
 */
export async function checkin(): Promise<GamificationStreakProps> {
  const {data} = await apiClient.post<StreakWire>('/api/v1/gamification/checkin', {});
  const streak = fromStreakWire(data);
  await AsyncStorage.setItem(EKeyAsyncStorage.gamificationStreak, JSON.stringify(streak));
  return streak;
}

export type LeaderboardPeriod = 'all' | 'daily' | 'weekly' | 'monthly';

/**
 * GET /api/v1/gamification/leaderboard?period=. `period` selects which
 * ranking the backend returns — "all" (default, lifetime User.xp, the
 * original behavior) or "daily"/"weekly"/"monthly" (XP earned within that
 * calendar window only, backed by the new XpEvent ledger — see that
 * endpoint's own docstring on Saveur-Backend for the exact cutoffs). Backs
 * the Daily/Weekly/Monthly tabs on src/home/Leaderboard.tsx, which were
 * previously presentational only (every tab showed the same all-time list).
 * Falls back to the last-known cached list *for that same period* on a
 * network failure, same offline-read-fallback pattern as the rest of this
 * file.
 */
export async function getLeaderboard(period: LeaderboardPeriod = 'all'): Promise<LeaderboardEntryProps[]> {
  try {
    const {data} = await apiClient.get<LeaderboardEntryWire[]>('/api/v1/gamification/leaderboard', {
      params: {period},
    });
    const entries = data.map(fromLeaderboardWire);
    await AsyncStorage.setItem(leaderboardCacheKey(period), JSON.stringify(entries));
    return entries;
  } catch (error) {
    const cached = await readLeaderboardCache(period);
    if (cached) return cached;
    throw error;
  }
}
