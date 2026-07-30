import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage, UserProfileProps} from 'constants/Types';
import apiClient from './apiClient';
import * as referralService from './referralService';

// ---------------------------------------------------------------------------
// authService — real backend implementation.
//
// Identity (sign in/up/out, Google/Apple credentials) is owned by
// AuthContext.tsx, which wraps @react-native-firebase/auth directly. This
// file only owns the *profile* half of the contract — the /api/users/me
// endpoints described in docs/BACKEND_API_SPEC.md §1 — plus an AsyncStorage
// cache so the app still has something to render offline / on first paint
// before the network round trip resolves.
//
// Wire format note: the backend uses snake_case for a couple of fields
// (`preferred_countries`) while the rest of the app uses camelCase
// (`preferredCountries`) — fromWire/toWirePatch below are the single place
// that translation happens, so no screen needs to know about it.
// ---------------------------------------------------------------------------

interface UserProfileWire {
  uid?: string;
  email: string;
  name: string;
  // Random, non-identifying display handle generated server-side at signup
  // (see Saveur-Backend's app/services/username_service.py) — this, never
  // `name`, is what the leaderboard shows other users. Surfaced here too so
  // it can be shown under the real name in the profile/avatar header.
  username?: string;
  goals?: string[];
  industries?: string[];
  preferred_countries?: string[];
  desired_roles?: string[];
  locale?: string;
  avatar_url?: string;
  avatarUrl?: string;
  // Separate leaderboard-only avatar override — see
  // UserProfileProps.leaderboardAvatarUrl (constants/Types.tsx) for why this
  // must never be conflated with avatar_url above.
  leaderboard_avatar_url?: string | null;
  phone_number?: string;
  home_address?: string;
  subscription_tier?: 'free' | 'premium' | 'premium_plus';
  notifications_enabled?: boolean;
  job_alert_daily_limit?: number;
  two_factor_enabled?: boolean;
}

function fromWire(wire: UserProfileWire): UserProfileProps {
  return {
    uid: wire.uid,
    email: wire.email,
    name: wire.name,
    username: wire.username,
    goals: wire.goals ?? [],
    industries: wire.industries ?? [],
    preferredCountries: wire.preferred_countries ?? [],
    desiredRoles: wire.desired_roles ?? [],
    locale: wire.locale,
    avatarUrl: wire.avatar_url ?? wire.avatarUrl,
    leaderboardAvatarUrl: wire.leaderboard_avatar_url ?? undefined,
    phoneNumber: wire.phone_number ?? '',
    homeAddress: wire.home_address ?? '',
    subscriptionTier: wire.subscription_tier ?? 'free',
    notificationsEnabled: wire.notifications_enabled ?? true,
    jobAlertDailyLimit: wire.job_alert_daily_limit ?? 10,
    twoFactorEnabled: wire.two_factor_enabled ?? false,
  };
}

// Only the fields the backend's PATCH /api/users/me actually accepts (see
// spec §0.5 and §1) get forwarded. Note `subscriptionTier` is deliberately
// NOT included — per the spec, plan changes flow through the Billing/Stripe
// endpoints (checkout + webhook), not this endpoint. Until services/apiClient
// billing wiring lands, calling updateProfile({subscriptionTier}) will just
// silently not persist that field server-side.
function toWirePatch(partial: Partial<UserProfileProps>): Record<string, unknown> {
  const wire: Record<string, unknown> = {};
  if (partial.name !== undefined) wire.name = partial.name;
  if (partial.goals !== undefined) wire.goals = partial.goals;
  if (partial.industries !== undefined) wire.industries = partial.industries;
  if (partial.preferredCountries !== undefined) wire.preferred_countries = partial.preferredCountries;
  if (partial.desiredRoles !== undefined) wire.desired_roles = partial.desiredRoles;
  if (partial.locale !== undefined) wire.locale = partial.locale;
  if (partial.avatarUrl !== undefined) wire.avatar_url = partial.avatarUrl;
  // Empty string is a deliberate, valid value here (clears back to the
  // generated default) — only actual `undefined` (field not touched by this
  // partial) should be omitted, so this can't reuse the `!partial.x` pattern.
  if (partial.leaderboardAvatarUrl !== undefined) wire.leaderboard_avatar_url = partial.leaderboardAvatarUrl;
  if (partial.phoneNumber !== undefined) wire.phone_number = partial.phoneNumber;
  if (partial.homeAddress !== undefined) wire.home_address = partial.homeAddress;
  if (partial.notificationsEnabled !== undefined) wire.notifications_enabled = partial.notificationsEnabled;
  if (partial.jobAlertDailyLimit !== undefined) wire.job_alert_daily_limit = partial.jobAlertDailyLimit;
  return wire;
}

const readCache = async (): Promise<UserProfileProps | null> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.userProfile);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfileProps;
  } catch {
    return null;
  }
};

const writeCache = async (profile: UserProfileProps): Promise<UserProfileProps> => {
  await AsyncStorage.setItem(EKeyAsyncStorage.userProfile, JSON.stringify(profile));
  return profile;
};

/**
 * POST /api/users/me — spec §0.3/§1. Call this immediately after a
 * successful Firebase sign-in/sign-up (AuthContext does this) with the
 * user's idToken already attached by apiClient's interceptor. The backend
 * verifies the token and upserts the User row, so this is safe to call on
 * every sign-in, not just first sign-up.
 *
 * Also forwards any referral code captured from a saveur://referral deep
 * link (see App.tsx, services/referralService.ts) as `referred_by_code` —
 * the backend only actually uses it on a genuinely new user's first sync,
 * but it's harmless to send on every call, so this doesn't need to know
 * whether the current sign-in is a first-time signup or a returning login.
 * The pending code is cleared after the call either way, so it's never
 * resent stale on a later, unrelated sign-in.
 */
export async function provisionProfile(): Promise<UserProfileProps> {
  const referredByCode = await referralService.getPendingCode();
  const {data} = await apiClient.post<UserProfileWire>('/api/users/me', {
    referred_by_code: referredByCode ?? undefined,
  });
  if (referredByCode) {
    referralService.clearPendingCode().catch(() => {});
  }
  return writeCache(fromWire(data));
}

/**
 * GET /api/users/me — spec §1. Used to hydrate the app on boot once a
 * Firebase session already exists (see AuthContext's onAuthStateChanged
 * handler), and anywhere else that wants a fresh profile without an update.
 */
export async function getCurrentProfile(): Promise<UserProfileProps | null> {
  try {
    const {data} = await apiClient.get<UserProfileWire>('/api/users/me');
    return writeCache(fromWire(data));
  } catch {
    // Offline, or no session yet — fall back to whatever's cached so the app
    // doesn't feel broken on a flaky connection.
    return readCache();
  }
}

/**
 * PATCH /api/users/me — spec §0.5/§1. Used both for the multi-step signup
 * wizard (goals/industries/preferredCountries collected across
 * SignupFirstStep/SignupSecondStep) and any later "Edit Profile" screen.
 */
export async function updateProfile(
  partial: Partial<UserProfileProps>,
): Promise<UserProfileProps> {
  const {data} = await apiClient.patch<UserProfileWire>('/api/users/me', toWirePatch(partial));
  return writeCache(fromWire(data));
}

/**
 * DELETE /api/users/me — permanently deletes the backend user row AND (as of
 * saveur-backend's account_deletion_service.py) the Firebase Auth account
 * itself server-side, plus immediately cancels any active Stripe
 * subscription. Callers don't need to separately delete the Firebase account
 * client-side afterward — see AuthContext.deleteAccount, which just signs
 * out locally once this resolves.
 */
export async function deleteAccount(): Promise<void> {
  await apiClient.delete('/api/users/me');
  await AsyncStorage.removeItem(EKeyAsyncStorage.userProfile);
}

/** Clears the local profile cache on sign-out. No network call needed. */
export async function clearCache(): Promise<void> {
  await AsyncStorage.removeItem(EKeyAsyncStorage.userProfile);
}
