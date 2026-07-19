import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// emailService — backend-triggered transactional email (Resend + Firebase
// Auth links under the hood). Contract:
//
//   POST /api/v1/email/send-verification   — auth required, no body
//                                             -> {sent: true}
//   POST /api/v1/email/send-password-reset — public (no auth), {email}
//                                             -> {sent: true} (always, even
//                                             if the email doesn't exist —
//                                             don't leak account existence)
//   POST /api/v1/email/resend-welcome      — auth required, no body
//                                             -> {sent: true}
//
// The actual signup/welcome email needs no client call at all — it fires
// automatically server-side the first time POST /api/users/me provisions a
// new user (see authService.provisionProfile / AuthContext.signUp).
// ---------------------------------------------------------------------------

/**
 * Sends a Firebase email-verification link to the signed-in user's own
 * address. AuthContext calls this once automatically right after an
 * email/password signUp (not for Google/Apple — those providers already
 * assert a verified email). Also wired to a manual "Resend verification
 * email" action wherever the unverified-email banner is shown.
 */
export async function sendVerificationEmail(): Promise<void> {
  await apiClient.post<{sent: boolean}>('/api/v1/email/send-verification');
}

/**
 * Sends a Firebase password-reset link to the given address. Public
 * endpoint — no auth header, since the user is by definition logged out on
 * the "Forgot password?" screen. The backend always responds {sent: true}
 * regardless of whether the address has an account, so don't treat the
 * response as confirmation the email exists.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  await apiClient.post<{sent: boolean}>('/api/v1/email/send-password-reset', {email});
}

/**
 * Re-sends the welcome email on demand (e.g. a "Resend welcome email" button
 * in account settings, for a user who missed/deleted the automatic one).
 */
export async function resendWelcomeEmail(): Promise<void> {
  await apiClient.post<{sent: boolean}>('/api/v1/email/resend-welcome');
}
