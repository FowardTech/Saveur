import axios, {AxiosError} from 'axios';
import auth from '@react-native-firebase/auth';

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
}

// Normalizes any axios failure (network error, timeout, 4xx, 5xx) into a
// single shape. Every services/*.ts function that calls apiClient should let
// this rejection propagate — screens can catch it and read `.message`
// directly instead of each one re-deriving a user-facing string.
apiClient.interceptors.response.use(
  response => response,
  (error: AxiosError<{message?: string; code?: string}>) => {
    const apiError: ApiError = {
      status: error.response?.status,
      message:
        error.response?.data?.message ??
        (error.code === 'ECONNABORTED'
          ? 'That took too long — check your connection and try again.'
          : error.message) ??
        'Something went wrong. Please try again.',
      code: error.response?.data?.code ?? error.code,
    };
    return Promise.reject(apiError);
  },
);

export default apiClient;
