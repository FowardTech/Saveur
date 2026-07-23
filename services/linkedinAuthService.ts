import {Linking} from 'react-native';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// "Sign in with LinkedIn" — LinkedIn has no first-party Firebase/RN SDK, so
// this drives a custom OAuth2 code-exchange flow against saveur-backend's
// app/api/linkedin_auth.py:
//   1. GET /api/v1/auth/linkedin/start -> a LinkedIn authorize URL (opened in
//      the system browser via Linking.openURL, same pattern already used for
//      Stripe's Customer Portal in Subscription.tsx).
//   2. The member approves on LinkedIn's own page. LinkedIn can only redirect
//      to an https URL it has registered (not a custom scheme), so it lands
//      on the BACKEND's callback route, which exchanges the code, mints a
//      Firebase custom token, and 302s the browser to
//      saveur://linkedin-redirect?token=...&is_new_user=... — the app's own
//      existing custom scheme (registered natively for Stripe's return).
//   3. App.tsx's Linking listener (already wired for the referral deep link)
//      forwards every incoming URL to handleIncomingUrl below, which resolves
//      whatever signIn() call is currently waiting.
//   4. AuthContext.signInWithLinkedIn takes the token from there and calls
//      auth().signInWithCustomToken(token) to actually complete sign-in.
// ---------------------------------------------------------------------------

export interface LinkedInRedirectResult {
  token?: string;
  isNewUser: boolean;
  error?: string;
}

async function getAuthorizeUrl(): Promise<string> {
  const {data} = await apiClient.get<{url: string}>('/api/v1/auth/linkedin/start');
  return data.url;
}

// Plain regex rather than the URL()/URLSearchParams constructors — custom
// scheme URLs (saveur://...) don't always parse cleanly across RN's JS
// engines, same reasoning as referralService.ts's extractCodeFromUrl.
function parseRedirect(url: string): LinkedInRedirectResult | null {
  if (!url.includes('linkedin-redirect')) return null;
  const tokenMatch = url.match(/[?&]token=([^&]+)/);
  const errorMatch = url.match(/[?&]error=([^&]+)/);
  const isNewUserMatch = url.match(/[?&]is_new_user=([^&]+)/);
  return {
    token: tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined,
    error: errorMatch ? decodeURIComponent(errorMatch[1]) : undefined,
    isNewUser: isNewUserMatch ? isNewUserMatch[1] === '1' : false,
  };
}

let pendingResolve: ((result: LinkedInRedirectResult) => void) | null = null;

// Fallback for when the redirect arrives but nothing is `await`ing signIn()
// below — happens whenever Android kills the app while it's backgrounded
// during the LinkedIn login page (typing credentials/consent easily takes
// long enough for this on a real device) and the app cold-starts fresh off
// the saveur://linkedin-redirect deep link. In that fresh process,
// pendingResolve is null (nobody in this process ever called signIn()), so
// without this fallback the token would just be silently dropped — the app
// reopens straight to the Login screen with no error and no sign-in, which
// is exactly the "redirected back but nothing happens" symptom this fixes.
// AuthContext.tsx registers this once, at the top level, so it can complete
// the sign-in itself even with no caller waiting.
let coldStartHandler: ((result: LinkedInRedirectResult) => void) | null = null;

export function setColdStartHandler(handler: ((result: LinkedInRedirectResult) => void) | null): void {
  coldStartHandler = handler;
}

/** Called from App.tsx's Linking handler for every incoming URL — a no-op
 * for anything that isn't this specific redirect (e.g. the referral link or
 * Stripe's own saveur://stripe-redirect). */
export function handleIncomingUrl(url: string | null | undefined): void {
  if (!url) return;
  const result = parseRedirect(url);
  if (!result) return;
  if (pendingResolve) {
    pendingResolve(result);
    pendingResolve = null;
  } else if (coldStartHandler) {
    coldStartHandler(result);
  }
}

// There's no reliable native "user backed out of the browser" signal for a
// system-browser hand-off (same limitation the existing Stripe portal flow
// has) — if the redirect never arrives, time this out rather than leaving
// the caller hanging forever.
const REDIRECT_TIMEOUT_MS = 5 * 60 * 1000;

/** Opens LinkedIn's authorize page in the system browser and resolves once
 * the app receives the callback redirect (or rejects on timeout/no browser). */
export async function signIn(): Promise<LinkedInRedirectResult> {
  const url = await getAuthorizeUrl();
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error('This device cannot open the LinkedIn sign-in page.');
  }

  const resultPromise = new Promise<LinkedInRedirectResult>((resolve, reject) => {
    pendingResolve = resolve;
    setTimeout(() => {
      if (pendingResolve) {
        pendingResolve = null;
        reject(new Error('LinkedIn sign-in timed out.'));
      }
    }, REDIRECT_TIMEOUT_MS);
  });

  await Linking.openURL(url);
  return resultPromise;
}
