import React from 'react';
import {Alert, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {appleAuth} from '@invertase/react-native-apple-authentication';
import i18n from 'i18next';

import {EKeyAsyncStorage, SignUpPayload, SubscriptionStatusProps, UserProfileProps} from 'constants/Types';
import {isSupportedLanguageCode} from 'constants/languages';
import * as authService from 'services/authService';
import * as billingService from 'services/billingService';
import * as emailService from 'services/emailService';
import * as gamificationService from 'services/gamificationService';
import {isProTier, isPremiumTier} from 'services/entitlementsService';
import {registerForPushNotifications} from 'services/pushNotificationService';
import * as linkedinAuthService from 'services/linkedinAuthService';
import * as twoFactorService from 'services/twoFactorService';
import * as crashReportingService from 'services/crashReportingService';
import {resetToMainAfterExternalSignIn} from 'navigation/navigationRef';

// The account's `locale` (set at signup or from Settings → Language, see
// constants/languages.ts) is the source of truth for the app's language —
// more authoritative than whatever's cached in AsyncStorage by i18next's own
// language-detector (i18n/language-detector.ts), since a user signing into a
// second device / after a reinstall should see their saved language, not the
// new device's default. Called every time a profile is fetched/refreshed
// below (sign-in, sign-up, Google/Apple sign-in) — a no-op if it already
// matches the current i18next language.
function syncLanguageFromProfile(profile: UserProfileProps | null): void {
  if (profile?.locale && isSupportedLanguageCode(profile.locale)) {
    // BUG FIX ("after logout the app should keep the user's language, not
    // fall back to English until they log back in"): this used to only ever
    // call i18n.changeLanguage — i18next keeps `i18n.language` purely in
    // memory (see i18n/config.ts's own comment: "i18next itself has no
    // persistence of its own"), and the ONLY on-disk record of the user's
    // language, EKeyAsyncStorage.preferredLocale, was solely written by the
    // pre-signup onboarding picker and then immediately cleared once
    // consumed (see reconcileLocale below) — normal sign-in never wrote it.
    // So a signed-in user's language lived only in `profile.locale` +
    // in-memory i18next state; the moment they signed out (profile -> null,
    // nothing left to restore from) and the app was cold-started again
    // (i18n/config.ts's bootstrap restore reads this same key), there was
    // nothing there and it defaulted to English until they logged back in.
    // Persisting the resolved language here every time keeps this key
    // current regardless of sign-in state — signOut() doesn't clear it
    // (authService.clearCache() only removes the cached profile), so a cold
    // start while signed out now correctly restores the last language that
    // was actually in effect instead of the onboarding-only default.
    AsyncStorage.setItem(EKeyAsyncStorage.preferredLocale, profile.locale).catch(() => {});
    if (profile.locale !== i18n.language) {
      i18n.changeLanguage(profile.locale).catch(() => {});
    }
  }
}

// Reported bug: pick a language on the onboarding carousel's dropdown (see
// src/onboarding/index.tsx), then tap "Log In" into an EXISTING account —
// everything reverted to English. Root cause: syncLanguageFromProfile above
// was written for a different scenario (a returning user opening the app on
// a second device should see their already-saved language, not that new
// device's default) and unconditionally pulls the account's stored `locale`
// down over whatever's active locally. That's exactly backwards for the
// onboarding picker's case — the user just told this device what language
// they want, and logging into an old account (whose locale was set who
// knows when, often still the 'en' default) silently overwrote it.
//
// Fix: the onboarding screen now writes its selection to
// EKeyAsyncStorage.preferredLocale (see i18n/config.ts's bootstrap restore,
// which is the other consumer of that key). Every sign-in path below calls
// this instead of syncLanguageFromProfile directly — if a pending onboarding
// selection exists and differs from the account's saved locale, it wins:
// pushed up to the account (so it also becomes the new saved preference,
// consistent with how Settings → Language behaves) rather than pulled down
// from it. The one-time flag is cleared right after so it doesn't keep
// re-asserting itself on later sign-ins once the user has had a chance to
// change their language again from Settings on any device.
async function reconcileLocale(profile: UserProfileProps | null): Promise<UserProfileProps | null> {
  if (!profile) return profile;
  try {
    const pending = await AsyncStorage.getItem(EKeyAsyncStorage.preferredLocale);
    if (pending && isSupportedLanguageCode(pending)) {
      if (pending !== profile.locale) {
        const updated = await authService.updateProfile({locale: pending});
        await AsyncStorage.removeItem(EKeyAsyncStorage.preferredLocale);
        syncLanguageFromProfile(updated);
        return updated;
      }
      await AsyncStorage.removeItem(EKeyAsyncStorage.preferredLocale);
      // Falls through to syncLanguageFromProfile below instead of an early
      // return here — that's also what re-persists this same key with
      // `profile.locale` right after clearing it (see that function's own
      // comment), so the key ends up holding the correct value instead of
      // sitting empty until some later, unrelated profile update happens to
      // call syncLanguageFromProfile again.
    }
  } catch {
    // Best-effort — fall through to the normal pull-from-profile sync below
    // rather than leaving the language in a half-applied state.
  }
  syncLanguageFromProfile(profile);
  return profile;
}

// ---------------------------------------------------------------------------
// Real Firebase Auth (native @react-native-firebase, not the JS SDK — see
// docs/BACKEND_API_SPEC.md §2 for why: the JS SDK was never initialized here
// and an earlier attempt to import it unconditionally crashed the app on
// launch). @react-native-firebase auto-initializes from
// android/app/google-services.json / ios GoogleService-Info.plist, so there's
// no explicit initializeApp() call needed here — just make sure those files
// are the REAL ones from your Firebase project before this will actually
// authenticate anyone (see the placeholder-file comments in
// android/app/google-services.json).
//
// Split of responsibilities: this file owns identity (Firebase sign-in/up/
// out, Google/Apple credential exchange). services/authService.ts owns the
// backend user-profile record (POST/GET/PATCH/DELETE /api/users/me).
// ---------------------------------------------------------------------------

// Web client ID from the "saveur-ac8ec" Firebase project's Google sign-in
// configuration — used as the audience the backend checks when verifying a
// Google ID token server-side.
//
// NOTE: this used to be '858767154827-dqr0eju92lonh32rft9ugvr9c69qte2m...',
// which belonged to a different, unrelated Google Cloud project (project
// number 858767154827, vs. saveur-ac8ec's actual 679326954548 — visible in
// both GoogleService-Info.plist and android/app/google-services.json).
// Mixing client IDs from two different projects is exactly what triggered
// "invalid_audience: The audience client and the client need to be in the
// same project." Pulled the correct one from Firebase Console →
// Authentication → Sign-in method → Google → Web SDK configuration.
const GOOGLE_WEB_CLIENT_ID =
  '679326954548-mfpnhhsj9e4qhj5ftvcpkef6ljh6e3g1.apps.googleusercontent.com';

// iOS-specific OAuth client ID (from GoogleService-Info.plist's CLIENT_ID),
// distinct from the web client ID above. This is what GIDConfiguration
// actually needs to launch the native sign-in flow on iOS — without it,
// GoogleSignin.signIn() throws "You must specify |clientID| in
// |GIDConfiguration|". Also see ios/caren_family/Info.plist's
// CFBundleURLTypes, which registers this client's REVERSED_CLIENT_ID as a
// URL scheme so Safari/the Google app can hand control back after sign-in.
const GOOGLE_IOS_CLIENT_ID =
  '679326954548-35emkamsh1t03e4md0ukaqnnm19hp806.apps.googleusercontent.com';

// ---------------------------------------------------------------------------
// Email-code 2FA (see services/twoFactorService.ts). Rather than requiring a
// fresh code on every single app open — which is what a naive "check on
// every onAuthStateChanged" would do, since Firebase's persisted session
// makes every cold start look identical to a fresh sign-in from this
// listener's point of view — this device is "trusted" for
// TWO_FACTOR_TRUST_DAYS after a successful verification, tracked per
// uid+device in AsyncStorage. This matches how most real 2FA
// implementations behave (verify once, not nagged again on the same device
// for a while) without needing new backend session-tracking infrastructure.
const TWO_FACTOR_TRUST_DAYS = 30;
const twoFactorTrustKey = (uid: string) => `twoFactorTrustedUntil:${uid}`;

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
});

type Context = {
  isInitialized: boolean;
  isSignedIn: boolean;
  isIntro: boolean;
  profile: UserProfileProps | null;
  // Mirrors Firebase's `currentUser.emailVerified`. Federated providers
  // (Google/Apple) assert a verified email at sign-in time, so this is only
  // ever false for an email/password account that hasn't clicked its
  // verification link yet. Not auto-refreshed — Firebase only updates this
  // locally after an explicit `currentUser.reload()`, so call
  // `refreshEmailVerified()` (e.g. on app-foreground) to pick up a change
  // made by tapping the emailed link.
  emailVerified: boolean;
  // App-wide plan/entitlement state — see services/entitlementsService.ts for
  // the actual gating rules (e.g. free-tier session caps) built on top of
  // this. `subscription` is fetched here (not per-screen) so gating checks
  // anywhere in the app (Practice setup, future premium screens) don't each
  // need their own GET /billing/subscription call. Screens that show live
  // billing detail (Subscription.tsx) still keep their own local fetch for
  // display purposes, but should call `refreshSubscription()` after a
  // successful purchase/portal-return so this shared copy doesn't go stale.
  subscription: SubscriptionStatusProps | null;
  // True from the moment a signed-in user is detected until the very first
  // GET /billing/subscription call for this session has settled (success OR
  // failure). BUG FIX (product report: "when the app reloads it shows the
  // subscribe to basic plan stuff before it loads the chat app screen even
  // when the user have already subscribe to it") — `subscription` starts
  // `null` on every cold start and is only populated by a fire-and-forget
  // fetch kicked off alongside the profile fetch below (see
  // onAuthStateChanged), while `isInitialized`/`isSignedIn` flip true as
  // soon as just the profile/auth state resolves. `isPro` derives from
  // `subscription`, so for that in-between window `isPro` reads `false` for
  // EVERY user, including already-Pro ones — navigation/MainDrawer.tsx's
  // Coach tab used to read `!isPro` directly and had no way to tell "not
  // subscribed" apart from "haven't heard back yet," so it rendered the
  // Basic-plan paywall for a beat before flipping to the real chat screen
  // once this fetch landed. Consumers that gate on `isPro` should also check
  // `!isSubscriptionLoading` (or wait for it) before treating a false
  // `isPro` as definitive.
  isSubscriptionLoading: boolean;
  isPro: boolean;
  // True only for Pro Premium (was "Team") or Pro (Yearly) — the stricter
  // check gating Job Alerts and Learning Courses specifically. See
  // services/entitlementsService.ts's isPremiumTier for the full breakdown.
  // A user can be isPro true and isPremium false (plain monthly Pro).
  isPremium: boolean;
  refreshSubscription: () => Promise<SubscriptionStatusProps | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<void>;
  signInWithGoogle: (opts?: {isSignup?: boolean}) => Promise<void>;
  signInWithApple: (opts?: {isSignup?: boolean}) => Promise<void>;
  signInWithLinkedIn: (opts?: {isSignup?: boolean}) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (partial: Partial<UserProfileProps>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshEmailVerified: () => Promise<boolean>;
  resendVerificationEmail: () => Promise<void>;
  // Email-code 2FA — see services/twoFactorService.ts. twoFactorPending true
  // means a signed-in (Firebase-authenticated) user still needs to enter a
  // code before AppContainer will show them the real app;
  // twoFactorEmailHint is the masked address ("j***@example.com") to display
  // on that screen.
  twoFactorPending: boolean;
  twoFactorEmailHint: string | null;
  verifyTwoFactorLogin: (code: string) => Promise<void>;
  resendTwoFactorLoginCode: () => Promise<void>;
  cancelTwoFactorLogin: () => Promise<void>;
};

export const AuthContext = React.createContext<Context>({
  isInitialized: false,
  isSignedIn: false,
  isIntro: false,
  profile: null,
  emailVerified: false,
  subscription: null,
  // Defaults to true (not false) so any consumer rendered before the real
  // Provider value is available treats entitlement as "still loading"
  // rather than silently assuming "not Pro" — see the Context type's own
  // comment above.
  isSubscriptionLoading: true,
  isPro: false,
  isPremium: false,
  refreshSubscription: async () => null,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signInWithLinkedIn: async () => {},
  signOut: async () => {},
  updateProfile: async () => {},
  refreshProfile: async () => {},
  deleteAccount: async () => {},
  refreshEmailVerified: async () => false,
  resendVerificationEmail: async () => {},
  twoFactorPending: false,
  twoFactorEmailHint: null,
  verifyTwoFactorLogin: async () => {},
  resendTwoFactorLoginCode: async () => {},
  cancelTwoFactorLogin: async () => {},
});

export const AuthProvider: React.FC = ({children}) => {
  const [isInitialized, setInitialized] = React.useState(false);
  const [isSignedIn, setSignedIn] = React.useState(false);
  const [isIntro, setIsIntro] = React.useState(false);
  const [profile, setProfile] = React.useState<UserProfileProps | null>(null);
  const [emailVerified, setEmailVerified] = React.useState(false);
  const [subscription, setSubscription] = React.useState<SubscriptionStatusProps | null>(null);
  // See the Context type's own comment on this field. Starts true; flips to
  // false once the very first post-auth GET /billing/subscription for this
  // session settles (onAuthStateChanged below), or immediately if there's no
  // signed-in user to fetch a subscription for.
  const [isSubscriptionLoading, setIsSubscriptionLoading] = React.useState(true);
  // True while a signed-in (Firebase-authenticated) user still has an
  // unverified 2FA code pending — see the onAuthStateChanged handler below
  // and AppContainer.tsx, which renders a TwoFactorVerify gate instead of
  // the normal navigator whenever this is true.
  const [twoFactorPending, setTwoFactorPending] = React.useState(false);
  const [twoFactorEmailHint, setTwoFactorEmailHint] = React.useState<string | null>(null);

  // Single source of truth for isSignedIn: Firebase persists sessions
  // on-device and replays this listener with the restored user on cold
  // start, so we never flip isSignedIn manually from signIn/signUp/signOut
  // below — we just react to what Firebase tells us.
  React.useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async firebaseUser => {
      if (firebaseUser) {
        const rawProfile = await authService.getCurrentProfile();
        const nextProfile = await reconcileLocale(rawProfile);
        setProfile(nextProfile);
        setSignedIn(true);
        setEmailVerified(firebaseUser.emailVerified);
        // Crash/error reporting (see services/crashReportingService.ts) —
        // attaches this user to any Sentry event this session produces, so
        // a crash report is reproducible/attributable instead of anonymous.
        // A no-op call when SENTRY_DSN is unset.
        crashReportingService.setUser(firebaseUser.uid, firebaseUser.email);

        // 2FA gate — see the TWO_FACTOR_TRUST_DAYS comment above. Checked
        // here (not inside signIn/signInWithGoogle/etc.) because this
        // listener is the one place that's guaranteed to fire after EVERY
        // way a user ends up authenticated, including cold-start session
        // restore, so gating here covers every sign-in method uniformly
        // instead of needing to duplicate this check in each of them.
        if (nextProfile?.twoFactorEnabled) {
          const trustedUntilRaw = await AsyncStorage.getItem(twoFactorTrustKey(firebaseUser.uid));
          const trustedUntil = trustedUntilRaw ? parseInt(trustedUntilRaw, 10) : 0;
          if (Date.now() > trustedUntil) {
            setTwoFactorPending(true);
            // Auto-send the first code so the user doesn't have to tap
            // anything to get started — best-effort, the verify screen also
            // has its own "Resend" action if this fails silently.
            twoFactorService
              .sendCode('login')
              .then(setTwoFactorEmailHint)
              .catch(() => {});
          } else {
            setTwoFactorPending(false);
          }
        } else {
          setTwoFactorPending(false);
        }
        // POST /gamification/checkin — fires here rather than from a
        // dedicated "app open" hook because this listener already covers
        // both real triggers for that: cold start with a restored session,
        // and right after a fresh sign-in/sign-up. Best-effort/fire-and-
        // forget: a failed streak check-in shouldn't block auth state from
        // settling or surface an error the user can't act on. Safe to call
        // more than once in a day — the backend response just reflects
        // `checkedInToday` either way, it doesn't double-count.
        gamificationService.checkin().catch(() => {});
        // Same fire-and-forget rationale as checkin() above — requests
        // permission, gets an FCM token, and registers it via
        // POST /api/v1/notifications/device-token. A denied permission
        // prompt or a simulator without real push capability shouldn't
        // block auth state from settling. See
        // services/pushNotificationService.ts.
        registerForPushNotifications().catch(() => {});
        // Same fire-and-forget rationale — populates `subscription` for
        // app-wide entitlement checks (see services/entitlementsService.ts).
        // A failed fetch just leaves gating on its safe local fallback
        // rather than blocking auth state from settling. `isSubscriptionLoading`
        // stays true until this settles either way (success or failure) —
        // see this field's own comment on the Context type above for why
        // that matters (navigation/MainDrawer.tsx's Coach tab gate).
        setIsSubscriptionLoading(true);
        billingService
          .getSubscription()
          .then(setSubscription)
          .catch(() => {})
          .finally(() => setIsSubscriptionLoading(false));
      } else {
        setProfile(null);
        setSignedIn(false);
        setEmailVerified(false);
        setSubscription(null);
        // No signed-in user means nothing to fetch — don't leave this stuck
        // on true (which would leave a gate like MainDrawer's Coach tab
        // showing a spinner forever for a signed-out user, though in
        // practice that screen isn't reachable while signed out anyway).
        setIsSubscriptionLoading(false);
        setTwoFactorPending(false);
        setTwoFactorEmailHint(null);
        crashReportingService.clearUser();
      }
      setInitialized(true);
    });
    return unsubscribe;
  }, []);

  // Cold-start fallback for the LinkedIn OAuth redirect — see
  // services/linkedinAuthService.ts's setColdStartHandler for the full
  // reasoning. Android can kill the app while it's backgrounded on
  // LinkedIn's own login page (easily long enough for someone to type
  // credentials + consent), so the saveur://linkedin-redirect deep link
  // often lands on a freshly cold-started process rather than the one that
  // opened the browser — the in-memory promise signInWithLinkedIn() below
  // was waiting on no longer exists. This runs the same
  // signInWithCustomToken + provisionProfile steps directly instead of
  // letting the token get silently dropped.
  //
  // Getting isSignedIn to flip true here is NOT enough on its own to leave
  // the Login screen — AppContainer.tsx's Stack.Navigator only reads
  // `initialRouteName` on its first mount, so it doesn't reactively move
  // anywhere just because isSignedIn changed after that. Every OTHER
  // sign-in path (email/password, Google) gets to MainBottomTab via each
  // button handler's own explicit nextScreen('MainBottomTab') stack reset —
  // this fallback has no button handler to call that from (it's a plain
  // Firebase-listener callback with no navigation prop in scope), which is
  // exactly why a cold-start LinkedIn sign-in used to complete successfully
  // in the background while the screen stayed stuck on Login. Explicitly
  // resetting via navigationRef below closes that gap.
  React.useEffect(() => {
    linkedinAuthService.setColdStartHandler(async result => {
      if (!result.token) {
        if (result.error && !/cancel/i.test(result.error)) {
          Alert.alert(
            i18n.t('auth:sign_in_failed', {defaultValue: 'Sign in failed'}),
            // Reuses the existing err_linkedin_failed key (already translated
            // in all 12 languages) instead of a new ad-hoc key — this used to
            // be 'auth:linkedin_failed', which doesn't exist in any language
            // file, so every user saw the English defaultValue regardless of
            // app language.
            i18n.t('auth:err_linkedin_failed', {defaultValue: 'LinkedIn sign-in failed. Please try again.'}),
          );
        }
        return;
      }
      try {
        await auth().signInWithCustomToken(result.token);
        const rawProfile = await authService.provisionProfile();
        const nextProfile = await reconcileLocale(rawProfile);
        setProfile(nextProfile);
        resetToMainAfterExternalSignIn();
      } catch (e: any) {
        Alert.alert(
          i18n.t('auth:sign_in_failed', {defaultValue: 'Sign in failed'}),
          e?.message ?? i18n.t('auth:err_linkedin_failed', {defaultValue: 'LinkedIn sign-in failed. Please try again.'}),
        );
      }
    });
    return () => linkedinAuthService.setColdStartHandler(null);
  }, []);

  const refreshSubscription = React.useCallback(async () => {
    try {
      const status = await billingService.getSubscription();
      setSubscription(status);
      return status;
    } catch {
      return null;
    }
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const isIntroSeen = await AsyncStorage.getItem(EKeyAsyncStorage.intro);
    if (isIntroSeen && parseInt(isIntroSeen, 10)) {
      setIsIntro(!!parseInt(isIntroSeen, 10));
    }
    await auth().signInWithEmailAndPassword(email, password);
    // POST /api/users/me is an upsert (spec §0.3) — safe to call on every
    // sign-in, not just first sign-up.
    const rawProfile = await authService.provisionProfile();
    const nextProfile = await reconcileLocale(rawProfile);
    setProfile(nextProfile);
  }, []);

  const signUp = React.useCallback(async (payload: SignUpPayload) => {
    await auth().createUserWithEmailAndPassword(payload.email, payload.password);
    if (payload.name) {
      await auth().currentUser?.updateProfile({displayName: payload.name});
    }
    await authService.provisionProfile();
    // Persist the onboarding data collected across
    // SignupFirstStep/SignupSecondStep/SignupThirdStep in the same PATCH
    // call (spec §0.5). `locale` defaults to whatever's currently active in
    // i18next (SignupFirstStep already called changeLanguage on selection)
    // so this is never left unset even if a caller skips it.
    const nextProfile = await authService.updateProfile({
      name: payload.name,
      goals: payload.goals,
      industries: payload.industries,
      preferredCountries: payload.preferredCountries,
      desiredRoles: payload.desiredRoles,
      locale: payload.locale ?? i18n.language,
      leaderboardAvatarUrl: payload.leaderboardAvatarUrl,
    });
    setProfile(nextProfile);
    // Already applied via `locale` above — clear the onboarding-screen's
    // one-time pending flag (see reconcileLocale) so it doesn't linger and
    // get re-applied on some later sign-in after the user has since changed
    // their language again from Settings.
    AsyncStorage.removeItem(EKeyAsyncStorage.preferredLocale).catch(() => {});
    setEmailVerified(!!auth().currentUser?.emailVerified);
    // The welcome email fires automatically server-side (POST /api/users/me
    // above triggers it) — this is the one email that needs an explicit
    // call. Best-effort: an email/password account is genuinely unverified
    // at this point (unlike Google/Apple), but a failure to *send* the
    // verification link shouldn't fail the whole signup — the user can
    // always tap "Resend" later from the unverified-email banner.
    try {
      await emailService.sendVerificationEmail();
    } catch {
      // Swallowed intentionally — see comment above.
    }
  }, []);

  const signInWithGoogle = React.useCallback(async (opts?: {isSignup?: boolean}) => {
    await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
    // Once an account has been picked once and consent granted, GoogleSignin
    // caches that choice natively and silently reuses it on every later
    // signIn() call instead of showing the account picker again — expected
    // SDK behavior, not a bug, but wrong for a "Continue with Google" button
    // that should let someone pick (or switch to) an account every time.
    // signOut() here only clears that local native cache; it doesn't touch
    // the Firebase session or revoke the app's access, so it's safe to call
    // unconditionally (a no-op if nothing was cached).
    try {
      await GoogleSignin.signOut();
    } catch {
      // Nothing cached to clear — fine, proceed to signIn() below either way.
    }
    const response: any = await GoogleSignin.signIn();
    // @react-native-google-signin/google-signin v13+ wraps the result in
    // `{ type: 'success', data: {...} }`; older versions returned the user
    // object directly. Handle both so a future downgrade/upgrade doesn't
    // silently break this.
    const idToken = response?.data?.idToken ?? response?.idToken;
    if (!idToken) {
      throw new Error('Google Sign-In did not return an ID token.');
    }
    // GoogleSignin.signIn()'s response never includes accessToken (only
    // idToken) — but @react-native-firebase/auth's native Android
    // implementation of GoogleAuthProvider.credential() throws "accessToken
    // cannot be empty" if the second argument is omitted, even though the
    // iOS implementation has no such requirement. That mismatch is exactly
    // why this worked on iOS and failed on every Android device/emulator
    // with an unhelpful generic "sign in failed" — GoogleSignin.getTokens()
    // is the separate call that actually returns both tokens.
    const {accessToken} = await GoogleSignin.getTokens();
    const googleCredential = auth.GoogleAuthProvider.credential(idToken, accessToken);
    const userCredential = await auth().signInWithCredential(googleCredential);
    // Was surfacing whatever generic error Firebase/the native Google SDK
    // happened to throw for "this Google account is already registered"
    // (often nothing recognizable, showing up as a plain "cancelled or
    // failed" message) — signInWithCredential itself doesn't error just
    // because the account already exists under the SAME provider, it just
    // signs them back in, so the SignupThirdStep screen had no reliable way
    // to tell "brand new account" from "already had one" apart. Firebase's
    // own additionalUserInfo.isNewUser flag is the documented, reliable
    // signal for this — only checked when explicitly signing up (Login.tsx
    // calls this with no opts, where signing into an existing account is
    // exactly the intended, successful outcome).
    if (opts?.isSignup && userCredential.additionalUserInfo?.isNewUser === false) {
      await auth().signOut();
      const err: any = new Error('An account with this email already exists.');
      err.code = 'auth/email-already-in-use';
      throw err;
    }
    let nextProfile = await authService.provisionProfile();
    // Google accounts usually come with a profile photo — grab it once, on
    // first sign-in, so the real photo shows immediately instead of the
    // initials fallback. Only fills it in if nothing's already set, so it
    // never overwrites a photo the person later uploaded themselves in Edit
    // Profile.
    const googlePhotoUrl = auth().currentUser?.photoURL;
    if (googlePhotoUrl && !nextProfile.avatarUrl) {
      try {
        nextProfile = await authService.updateProfile({avatarUrl: googlePhotoUrl});
      } catch {
        // Best-effort — the initials fallback covers this case either way.
      }
    }
    setProfile(await reconcileLocale(nextProfile));
  }, []);

  const signInWithApple = React.useCallback(async (opts?: {isSignup?: boolean}) => {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS.');
    }
    const appleResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });
    const {identityToken, nonce} = appleResponse;
    if (!identityToken) {
      throw new Error('Apple Sign-In did not return an identity token.');
    }
    const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);
    const userCredential = await auth().signInWithCredential(appleCredential);
    // Same "already registered" detection as signInWithGoogle above.
    if (opts?.isSignup && userCredential.additionalUserInfo?.isNewUser === false) {
      await auth().signOut();
      const err: any = new Error('An account with this email already exists.');
      err.code = 'auth/email-already-in-use';
      throw err;
    }
    const nextProfile = await authService.provisionProfile();
    setProfile(await reconcileLocale(nextProfile));
  }, []);

  // LinkedIn has no first-party Firebase provider — services/linkedinAuthService.ts
  // drives a custom OAuth2 code-exchange against the backend (see
  // app/api/linkedin_auth.py), which hands back a Firebase custom token via a
  // saveur://linkedin-redirect deep link once the member approves on
  // LinkedIn's own page. signInWithCustomToken here is what actually
  // completes Firebase sign-in from that token, same end state as
  // signInWithCredential for Google/Apple above.
  const signInWithLinkedIn = React.useCallback(async (opts?: {isSignup?: boolean}) => {
    const result = await linkedinAuthService.signIn();
    if (result.error) {
      const isCancelled = /cancel/i.test(result.error);
      const isNoEmail = result.error === 'no_email_from_linkedin';
      const err: any = new Error('LinkedIn sign-in failed.');
      err.code = isCancelled
        ? 'auth/popup-closed-by-user'
        : isNoEmail
        ? 'linkedin/no-email'
        : 'linkedin/failed';
      throw err;
    }
    if (!result.token) {
      const err: any = new Error('LinkedIn sign-in failed.');
      err.code = 'linkedin/failed';
      throw err;
    }
    await auth().signInWithCustomToken(result.token);
    // Same "already registered" detection as signInWithGoogle/signInWithApple
    // above, just sourced from the backend's is_new_user flag (there's no
    // additionalUserInfo.isNewUser for a manually-minted custom token).
    if (opts?.isSignup && !result.isNewUser) {
      await auth().signOut();
      const err: any = new Error('An account with this email already exists.');
      err.code = 'auth/email-already-in-use';
      throw err;
    }
    let nextProfile = await authService.provisionProfile();
    const linkedInPhotoUrl = auth().currentUser?.photoURL;
    if (linkedInPhotoUrl && !nextProfile.avatarUrl) {
      try {
        nextProfile = await authService.updateProfile({avatarUrl: linkedInPhotoUrl});
      } catch {
        // Best-effort — the initials fallback covers this case either way.
      }
    }
    setProfile(await reconcileLocale(nextProfile));
  }, []);

  const signOut = React.useCallback(async () => {
    await auth().signOut();
    await authService.clearCache();
    setProfile(null);
    setSignedIn(false);
  }, []);

  const updateProfile = React.useCallback(async (partial: Partial<UserProfileProps>) => {
    const nextProfile = await authService.updateProfile(partial);
    setProfile(nextProfile);
    syncLanguageFromProfile(nextProfile);
  }, []);

  // Re-fetches the profile without going through updateProfile's PATCH —
  // needed after actions that change server-side profile fields through
  // their own dedicated endpoints rather than PATCH /api/users/me, e.g.
  // toggling 2FA (services/twoFactorService.ts) changes
  // User.two_factor_enabled directly, and this is how the Security settings
  // screen picks that up into shared `profile` state afterward.
  const refreshProfile = React.useCallback(async () => {
    const nextProfile = await authService.getCurrentProfile();
    if (nextProfile) setProfile(nextProfile);
  }, []);

  const deleteAccount = React.useCallback(async () => {
    // DELETE /api/users/me now deletes the Firebase Auth account itself
    // server-side (via the Admin SDK — see
    // saveur-backend/app/services/account_deletion_service.py), along with
    // cancelling any active Stripe subscription immediately. Previously this
    // also called auth().currentUser?.delete() afterward to remove the
    // Firebase account from the client side — that's not just redundant now,
    // it's wrong: by the time this resolves, the account it would be
    // operating on no longer exists, which is exactly the kind of call that
    // throws (or, worse, prompts a confusing "please sign in again" recent-
    // login error) for no reason. signOut() just clears the local session,
    // which is genuinely all that's left to do here.
    await authService.deleteAccount();
    await auth().signOut();
    setProfile(null);
    setSignedIn(false);
  }, []);

  // Firebase only updates `currentUser.emailVerified` locally after an
  // explicit reload — it doesn't push the change from tapping the emailed
  // link. Call this when the app returns to the foreground (same AppState
  // pattern used for Stripe checkout in Subscription.tsx) or from a manual
  // "I've verified — refresh" action. Returns the fresh value so callers
  // don't have to wait on a re-render to react to it.
  const refreshEmailVerified = React.useCallback(async () => {
    const user = auth().currentUser;
    if (!user) {
      setEmailVerified(false);
      return false;
    }
    await user.reload();
    const verified = !!auth().currentUser?.emailVerified;
    setEmailVerified(verified);
    // BUG FIX (product report: "the practice scenario is asking me to
    // verify email even after it has been verified") — `user.reload()`
    // only updates `currentUser.emailVerified` locally; it does NOT reissue
    // the cached Firebase ID token. Every backend call (see
    // services/apiClient.ts's `getIdToken()`, without forceRefresh) sends
    // that same token until it naturally expires, and the backend's
    // require_verified_email gate (Saveur-Backend/app/auth.py) reads
    // `email_verified` straight off the token's own JWT claims -- not a
    // fresh Firestore/Auth lookup. So the UI unlocks immediately (this
    // function's own React state is fresh) while every API call, including
    // POST /practical/sessions that starts a Practice Scenario, keeps
    // getting rejected with 403 email_not_verified using a token that can
    // be baked with the old `false` claim for up to ~1 hour. Forcing a
    // token refresh here (once, right after we already know the account IS
    // verified) reissues it immediately with the correct claim instead of
    // waiting on Firebase's own near-expiry refresh cycle.
    if (verified) {
      await user.getIdToken(true).catch(() => {});
    }
    return verified;
  }, []);

  const resendVerificationEmail = React.useCallback(async () => {
    await emailService.sendVerificationEmail();
  }, []);

  // Completes the pending login-time 2FA check (see twoFactorPending above).
  // On success, marks this device trusted for TWO_FACTOR_TRUST_DAYS so the
  // user isn't asked again on every app open.
  const verifyTwoFactorLogin = React.useCallback(async (code: string) => {
    await twoFactorService.verifyCode(code, 'login');
    const uid = auth().currentUser?.uid;
    if (uid) {
      const trustedUntil = Date.now() + TWO_FACTOR_TRUST_DAYS * 24 * 60 * 60 * 1000;
      await AsyncStorage.setItem(twoFactorTrustKey(uid), String(trustedUntil));
    }
    setTwoFactorPending(false);
  }, []);

  const resendTwoFactorLoginCode = React.useCallback(async () => {
    const hint = await twoFactorService.sendCode('login');
    setTwoFactorEmailHint(hint);
  }, []);

  // The user can't get into the app without verifying (there's no "skip" —
  // that would defeat the point), but they can always back out and sign in
  // again later rather than being stuck on the verify screen.
  const cancelTwoFactorLogin = React.useCallback(async () => {
    await auth().signOut();
    setTwoFactorPending(false);
    setTwoFactorEmailHint(null);
  }, []);

  const isPro = React.useMemo(() => isProTier(subscription), [subscription]);
  const isPremium = React.useMemo(() => isPremiumTier(subscription), [subscription]);

  return (
    <AuthContext.Provider
      value={{
        isInitialized,
        isSignedIn,
        isIntro,
        profile,
        emailVerified,
        subscription,
        isSubscriptionLoading,
        isPro,
        isPremium,
        refreshSubscription,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithApple,
        signInWithLinkedIn,
        signOut,
        updateProfile,
        refreshProfile,
        deleteAccount,
        refreshEmailVerified,
        resendVerificationEmail,
        twoFactorPending,
        twoFactorEmailHint,
        verifyTwoFactorLogin,
        resendTwoFactorLoginCode,
        cancelTwoFactorLogin,
      }}>
      {children}
    </AuthContext.Provider>
  );
};
