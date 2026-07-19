import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage, UserProfileProps} from 'constants/Types';
import apiClient from './apiClient';

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
  goals?: string[];
  industries?: string[];
  preferred_countries?: string[];
  locale?: string;
  subscription_tier?: 'free' | 'premium' | 'premium_plus';
}

function fromWire(wire: UserProfileWire): UserProfileProps {
  return {
    uid: wire.uid,
    email: wire.email,
    name: wire.name,
    goals: wire.goals ?? [],
    industries: wire.industries ?? [],
    preferredCountries: wire.preferred_countries ?? [],
    locale: wire.locale,
    subscriptionTier: wire.subscription_tier ?? 'free',
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
  if (partial.locale !== undefined) wire.locale = partial.locale;
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
 */
export async function provisionProfile(): Promise<UserProfileProps> {
  const {data} = await apiClient.post<UserProfileWire>('/api/users/me');
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
 * DELETE /api/users/me — spec §1. Deletes the backend user row. Callers
 * should also call `auth().currentUser?.delete()` (in AuthContext) to remove
 * the Firebase account itself — this only handles the backend side.
 */
export async function deleteAccount(): Promise<void> {
  await apiClient.delete('/api/users/me');
  await AsyncStorage.removeItem(EKeyAsyncStorage.userProfile);
}

/** Clears the local profile cache on sign-out. No network call needed. */
export async function clearCache(): Promise<void> {
  await AsyncStorage.removeItem(EKeyAsyncStorage.userProfile);
}
