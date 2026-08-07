import axios, {AxiosError} from 'axios';
import auth from '@react-native-firebase/auth';
import i18n from 'i18next';

import {API_BASE_URL} from 'constants/env';

// ---------------------------------------------------------------------------
// apiClient — the one shared axios instance every services/*.ts file should
// use to talk to the real backend (see docs/BACKEND_API_SPEC.md). Handles:
//   1. Attaching `Authorization: Bearer <idToken>` on every request, reading
//      the current Firebase user directly (decoupled from AuthContext's
//      React state, so this works from any service file without prop-drilling
//      a token through every function).
//   2. Normalizing errors into a consistent shape so screens can show
//      `error.message` without caring whether it was a network failure, a
//      4xx with a backend-provided message, or a 5xx.
// ---------------------------------------------------------------------------

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

// Firebase's native SDK persists sessions on-device, but restoring one on a
// cold start is itself async — auth().currentUser is briefly `null` for a
// beat after JS starts, before the first onAuthStateChanged fires (whether
// with a restored user or null). Any request fired in that window (e.g. the
// notification-badge fetch on Home's very first mount) previously read
// `currentUser` as null, sent with no Authorization header, and got a 401
// from the backend even though the user was, in fact, signed in — it just
// hadn't been confirmed yet. This promise resolves the first time Firebase
// reports ANY auth state (signed in or not), and every request now waits
// for it before reading currentUser, so "signed in but not confirmed yet"
// no longer looks identical to "signed out" to the backend.
let resolveAuthReady: () => void;
const authReady = new Promise<void>(resolve => {
  resolveAuthReady = resolve;
});
const unsubscribeAuthReady = auth().onAuthStateChanged(() => {
  resolveAuthReady();
  unsubscribeAuthReady();
});

apiClient.interceptors.request.use(async config => {
  await authReady;
  const user = auth().currentUser;
  if (user) {
    // Firebase caches the ID token locally and only makes a network call to
    // refresh it when it's actually within ~5 minutes of expiring, so it's
    // cheap to call this on every request rather than manually tracking
    // expiry ourselves.
    const idToken = await user.getIdToken();
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${idToken}`;
  }
  return config;
});

export interface ApiError {
  status?: number;
  message: string;
  code?: string;
  // Machine-readable error slug from the backend body's `error` field (e.g.
  // "llm_unavailable", "session_limit_reached", "premium_required") --
  // lets a screen show its own tailored copy/actions for a specific known
  // failure instead of just dumping `message` into a generic alert.
  error?: string;
}

// Normalizes any axios failure (network error, timeout, 4xx, 5xx) into a
// single shape. Every services/*.ts function that calls apiClient should let
// this rejection propagate — screens can catch it and read `.message`
// directly instead of each one re-deriving a user-facing string.
apiClient.interceptors.response.use(
  response => response,
  (error: AxiosError<{message?: string; detail?: string; code?: string; error?: string}>) => {
    const apiError: ApiError = {
      status: error.response?.status,
      error: error.response?.data?.error,
      // Backend error bodies are NOT consistent about the field name —
      // roughly 60% of endpoints use {"detail": "..."} (e.g. billing.py's
      // payment_sheet, which wraps the *actual* Stripe error message here:
      // "Invalid API Key provided", "This API call cannot be made with a
      // publishable API key", etc.), the rest use {"message": "..."}. This
      // interceptor only ever checked `message`, so every `detail`-shaped
      // error silently fell through to axios's generic "Request failed
      // with status code 5xx" — the real, actionable error text was in the
      // response the whole time, just never surfaced to the user (or to
      // whoever's debugging over their shoulder from an error alert).
      message:
        error.response?.data?.message ??
        error.response?.data?.detail ??
        (error.code === 'ECONNABORTED'
          ? i18n.t('common:request_timeout_message', {
              defaultValue: 'That took too long — check your connection and try again.',
            })
          : error.code === 'ERR_NETWORK'
          ? i18n.t('common:network_error_message', {
              defaultValue: 'No internet connection. Please check your connection and try again.',
            })
          : error.message) ??
        i18n.t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      code: error.response?.data?.code ?? error.code,
    };
    return Promise.reject(apiError);
  },
);

export default apiClient;
