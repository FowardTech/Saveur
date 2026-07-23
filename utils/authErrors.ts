// ---------------------------------------------------------------------------
// mapFirebaseAuthError — every Login/Signup/ForgetPassword screen used to do
// `Alert.alert(title, e?.message ?? fallback)`, which shows Firebase's raw
// native error string verbatim, e.g.
//   "[auth/invalid-credential] The supplied auth credential is malformed or
//   has expired."
// That's an internal SDK message, not something a user should ever see.
// This maps the handful of codes @react-native-firebase/auth actually throws
// from this app's sign-in/sign-up/reset flows to plain, friendly copy. Falls
// back to a single generic line for anything not explicitly listed here
// (rather than ever showing the raw `[auth/...]` string), so a future
// Firebase SDK change can't reintroduce a raw error slipping through.
// ---------------------------------------------------------------------------

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': "That email or password doesn't look right. Please check and try again.",
  'auth/invalid-email': "That doesn't look like a valid email address.",
  'auth/user-not-found': "We couldn't find an account with that email.",
  'auth/wrong-password': 'That password is incorrect. Please try again.',
  'auth/user-disabled': 'This account has been disabled. Contact support if you think this is a mistake.',
  'auth/email-already-in-use': 'An account already exists with that email.',
  'auth/weak-password': 'Please choose a stronger password (at least 6 characters).',
  'auth/too-many-requests': "Too many attempts — please wait a moment before trying again.",
  'auth/network-request-failed': 'Network error — please check your connection and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method.',
  'auth/requires-recent-login': 'Please sign in again to continue — this action needs a recent login.',
  'auth/expired-action-code': 'That link has expired. Please request a new one.',
  'auth/invalid-action-code': 'That link is invalid or has already been used.',
  // Custom codes used by services/linkedinAuthService.ts / AuthContext's
  // signInWithLinkedIn — not real Firebase codes, but reuse this same map so
  // Login.tsx/SignupThirdStep.tsx only need one error-handling path across
  // every sign-in provider.
  'linkedin/no-email': "Your LinkedIn account doesn't have a verified email address, so it can't be used to sign in.",
  'linkedin/failed': 'LinkedIn sign-in failed. Please try again.',
};

const DEFAULT_MESSAGE = 'Something went wrong. Please try again in a moment.';

/**
 * Maps a caught Firebase Auth error (or any error-shaped object) to a
 * friendly, user-facing string. Safe to call with anything — non-Firebase
 * errors and unrecognized codes fall back to DEFAULT_MESSAGE rather than
 * leaking a raw `error.message`.
 */
export function mapFirebaseAuthError(error: unknown, fallback: string = DEFAULT_MESSAGE): string {
  const code = (error as {code?: string} | null | undefined)?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];
  return fallback;
}
