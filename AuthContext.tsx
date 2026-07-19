import React from 'react';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {appleAuth} from '@invertase/react-native-apple-authentication';

import {EKeyAsyncStorage, SignUpPayload, UserProfileProps} from 'constants/Types';
import * as authService from 'services/authService';
import * as emailService from 'services/emailService';
import * as gamificationService from 'services/gamificationService';

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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: SignUpPayload) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (partial: Partial<UserProfileProps>) => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshEmailVerified: () => Promise<boolean>;
  resendVerificationEmail: () => Promise<void>;
};

export const AuthContext = React.createContext<Context>({
  isInitialized: false,
  isSignedIn: false,
  isIntro: false,
  profile: null,
  emailVerified: false,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signOut: async () => {},
  updateProfile: async () => {},
  deleteAccount: async () => {},
  refreshEmailVerified: async () => false,
  resendVerificationEmail: async () => {},
});

export const AuthProvider: React.FC = ({children}) => {
  const [isInitialized, setInitialized] = React.useState(false);
  const [isSignedIn, setSignedIn] = React.useState(false);
  const [isIntro, setIsIntro] = React.useState(false);
  const [profile, setProfile] = React.useState<UserProfileProps | null>(null);
  const [emailVerified, setEmailVerified] = React.useState(false);

  // Single source of truth for isSignedIn: Firebase persists sessions
  // on-device and replays this listener with the restored user on cold
  // start, so we never flip isSignedIn manually from signIn/signUp/signOut
  // below — we just react to what Firebase tells us.
  React.useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async firebaseUser => {
      if (firebaseUser) {
        const nextProfile = await authService.getCurrentProfile();
        setProfile(nextProfile);
        setSignedIn(true);
        setEmailVerified(firebaseUser.emailVerified);
        // POST /gamification/checkin — fires here rather than from a
        // dedicated "app open" hook because this listener already covers
        // both real triggers for that: cold start with a restored session,
        // and right after a fresh sign-in/sign-up. Best-effort/fire-and-
        // forget: a failed streak check-in shouldn't block auth state from
        // settling or surface an error the user can't act on. Safe to call
        // more than once in a day — the backend response just reflects
        // `checkedInToday` either way, it doesn't double-count.
        gamificationService.checkin().catch(() => {});
      } else {
        setProfile(null);
        setSignedIn(false);
        setEmailVerified(false);
      }
      setInitialized(true);
    });
    return unsubscribe;
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const isIntroSeen = await AsyncStorage.getItem(EKeyAsyncStorage.intro);
    if (isIntroSeen && parseInt(isIntroSeen, 10)) {
      setIsIntro(!!parseInt(isIntroSeen, 10));
    }
    await auth().signInWithEmailAndPassword(email, password);
    // POST /api/users/me is an upsert (spec §0.3) — safe to call on every
    // sign-in, not just first sign-up.
    const nextProfile = await authService.provisionProfile();
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
    // call (spec §0.5).
    const nextProfile = await authService.updateProfile({
      name: payload.name,
      goals: payload.goals,
      industries: payload.industries,
      preferredCountries: payload.preferredCountries,
    });
    setProfile(nextProfile);
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

  const signInWithGoogle = React.useCallback(async () => {
    await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
    const response: any = await GoogleSignin.signIn();
    // @react-native-google-signin/google-signin v13+ wraps the result in
    // `{ type: 'success', data: {...} }`; older versions returned the user
    // object directly. Handle both so a future downgrade/upgrade doesn't
    // silently break this.
    const idToken = response?.data?.idToken ?? response?.idToken;
    if (!idToken) {
      throw new Error('Google Sign-In did not return an ID token.');
    }
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    await auth().signInWithCredential(googleCredential);
    const nextProfile = await authService.provisionProfile();
    setProfile(nextProfile);
  }, []);

  const signInWithApple = React.useCallback(async () => {
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
    await auth().signInWithCredential(appleCredential);
    const nextProfile = await authService.provisionProfile();
    setProfile(nextProfile);
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
  }, []);

  const deleteAccount = React.useCallback(async () => {
    await authService.deleteAccount();
    await auth().currentUser?.delete();
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
    return verified;
  }, []);

  const resendVerificationEmail = React.useCallback(async () => {
    await emailService.sendVerificationEmail();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isInitialized,
        isSignedIn,
        isIntro,
        profile,
        emailVerified,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithApple,
        signOut,
        updateProfile,
        deleteAccount,
        refreshEmailVerified,
        resendVerificationEmail,
      }}>
      {children}
    </AuthContext.Provider>
  );
};
