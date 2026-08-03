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
//
// BUG FIX (full-app translation sweep, product report: "check any other
// parts of this app that refuse to translate"): every one of these was a
// raw English string baked into a module-scope object evaluated once at
// import time — so regardless of the user's selected app language, every
// auth error (wrong password, account exists, expired link, etc.) always
// rendered in English. `messages()` now builds the map fresh on every call
// via i18n.t(...), so it reflects whatever language is active *at the time
// of the error*, not whatever was active when the app first loaded.
// ---------------------------------------------------------------------------
import i18n from 'i18next';

function messages(): Record<string, string> {
  return {
    'auth/invalid-credential': i18n.t('auth:err_invalid_credential', {
      defaultValue: "That email or password doesn't look right. Please check and try again.",
    }),
    'auth/invalid-email': i18n.t('auth:err_invalid_email', {
      defaultValue: "That doesn't look like a valid email address.",
    }),
    'auth/user-not-found': i18n.t('auth:err_user_not_found', {
      defaultValue: "We couldn't find an account with that email.",
    }),
    'auth/wrong-password': i18n.t('auth:err_wrong_password', {
      defaultValue: 'That password is incorrect. Please try again.',
    }),
    'auth/user-disabled': i18n.t('auth:err_user_disabled', {
      defaultValue: 'This account has been disabled. Contact support if you think this is a mistake.',
    }),
    'auth/email-already-in-use': i18n.t('auth:err_email_in_use', {
      defaultValue: 'An account already exists with that email.',
    }),
    'auth/weak-password': i18n.t('auth:err_weak_password', {
      defaultValue: 'Please choose a stronger password (at least 6 characters).',
    }),
    'auth/too-many-requests': i18n.t('auth:err_too_many_requests', {
      defaultValue: 'Too many attempts — please wait a moment before trying again.',
    }),
    'auth/network-request-failed': i18n.t('auth:err_network', {
      defaultValue: 'Network error — please check your connection and try again.',
    }),
    'auth/popup-closed-by-user': i18n.t('auth:err_signin_cancelled', {
      defaultValue: 'Sign-in was cancelled.',
    }),
    'auth/cancelled-popup-request': i18n.t('auth:err_signin_cancelled', {
      defaultValue: 'Sign-in was cancelled.',
    }),
    'auth/account-exists-with-different-credential': i18n.t('auth:err_account_exists_different_method', {
      defaultValue: 'An account already exists with this email using a different sign-in method.',
    }),
    'auth/requires-recent-login': i18n.t('auth:err_requires_recent_login', {
      defaultValue: 'Please sign in again to continue — this action needs a recent login.',
    }),
    'auth/expired-action-code': i18n.t('auth:err_expired_link', {
      defaultValue: 'That link has expired. Please request a new one.',
    }),
    'auth/invalid-action-code': i18n.t('auth:err_invalid_link', {
      defaultValue: 'That link is invalid or has already been used.',
    }),
    // Custom codes used by services/linkedinAuthService.ts / AuthContext's
    // signInWithLinkedIn — not real Firebase codes, but reuse this same map
    // so Login.tsx/SignupThirdStep.tsx only need one error-handling path
    // across every sign-in provider.
    'linkedin/no-email': i18n.t('auth:err_linkedin_no_email', {
      defaultValue: "Your LinkedIn account doesn't have a verified email address, so it can't be used to sign in.",
    }),
    'linkedin/failed': i18n.t('auth:err_linkedin_failed', {
      defaultValue: 'LinkedIn sign-in failed. Please try again.',
    }),
  };
}

function defaultMessage(): string {
  return i18n.t('auth:err_default', {
    defaultValue: 'Something went wrong. Please try again in a moment.',
  });
}

/**
 * Maps a caught Firebase Auth error (or any error-shaped object) to a
 * friendly, user-facing string. Safe to call with anything — non-Firebase
 * errors and unrecognized codes fall back to `fallback` (or, if not given,
 * a generic translated message) rather than leaking a raw `error.message`.
 */
export function mapFirebaseAuthError(error: unknown, fallback?: string): string {
  const code = (error as {code?: string} | null | undefined)?.code;
  const msgs = messages();
  if (code && msgs[code]) return msgs[code];
  return fallback ?? defaultMessage();
}
