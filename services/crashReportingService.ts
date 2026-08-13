// Crash/error reporting (Sentry) — pre-launch readiness item: this app
// previously had no crash visibility at all (no Sentry/Crashlytics/Bugsnag
// wired anywhere), meaning a JS exception, unhandled promise rejection, or
// native crash in production was simply invisible unless a user happened to
// describe it well enough to reproduce. This module is the single place
// that decides whether crash reporting is active — every other file in the
// app (App.tsx, AuthContext.tsx) only ever calls the functions below, never
// `@sentry/react-native` directly, so there's exactly one on/off switch.
//
// True no-op today: SENTRY_DSN (constants/env.ts) defaults to '' , and
// init() below returns immediately without ever calling Sentry.init() when
// it's blank — nothing is captured, nothing is sent, and every other
// function here (captureException/setUser/clearUser/wrap) degrades to a
// harmless no-op too (guarded by the same `enabled` flag), so importing
// this module changes nothing about the app's behavior until a real DSN is
// pasted into SENTRY_DSN.
import type React from 'react';
import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from 'constants/env';

let enabled = false;

export function init(): void {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    // "production"/"staging"/"development" would ideally come from a real
    // per-environment build config; this app doesn't have one yet (see
    // constants/env.ts's own TODO on API_BASE_URL), so everything reports
    // as "production" for now — still far better than no reporting at all,
    // and easy to split later once per-environment builds exist.
    environment: 'production',
    // Errors only, no performance tracing — matches the backend's own
    // default (see Saveur-Backend's SENTRY_TRACES_SAMPLE_RATE), keeping
    // this within a free/low-volume Sentry tier until there's an actual
    // perf-monitoring need.
    tracesSampleRate: 0,
    // Firebase uid/email are attached explicitly via setUser() below
    // (called from AuthContext.tsx on sign-in) rather than relying on
    // Sentry's automatic PII collection, so this stays off — request/
    // device data sent by default should not include anything beyond
    // what setUser() explicitly opts in.
    sendDefaultPii: false,
  });
  enabled = true;
}

// Called from AuthContext.tsx's onAuthStateChanged (the single source of
// truth for sign-in state — see that file's own comment) so every crash
// report is attributable to a real user for reproducing a support ticket,
// without needing to ask "which account was this?" after the fact.
export function setUser(uid: string, email?: string | null): void {
  if (!enabled) return;
  Sentry.setUser({ id: uid, email: email ?? undefined });
}

export function clearUser(): void {
  if (!enabled) return;
  Sentry.setUser(null);
}

// For call sites that already catch an error for their own UI purposes
// (e.g. showing an Alert) but want it reported too, instead of only ever
// silently swallowing it — see e.g. the various `.catch(() => {})`
// fire-and-forget calls sprinkled through this codebase that would
// otherwise never surface anywhere.
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

// Wraps the root App component with Sentry's error boundary + native crash
// handling hook (see App.tsx). Deliberately gated on SENTRY_DSN directly,
// NOT the `enabled` flag above: App.tsx calls this at its own module-eval
// time, which (via index.js's `import App from './App'` being hoisted
// ahead of index.js's own top-level code) happens BEFORE index.js's
// init() call ever runs — `enabled` would still read false here even with
// a real DSN configured. SENTRY_DSN is a plain constant available
// immediately, so it's the only thing safe to branch on at this point.
// Sentry.wrap itself doesn't require init() to have already run — it just
// attaches an error boundary that talks to whatever Sentry client exists
// once a render actually errors, which by then always has (init() runs
// synchronously, immediately, before AppRegistry ever mounts anything).
export function wrap(component: React.ComponentType<Record<string, unknown>>): React.ComponentType<Record<string, unknown>> {
  if (!SENTRY_DSN) return component;
  return Sentry.wrap(component);
}
