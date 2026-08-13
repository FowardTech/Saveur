// ---------------------------------------------------------------------------
// API_BASE_URL — points the app at the real backend (see
// docs/BACKEND_API_SPEC.md for the full endpoint list).
//
// Backend runs on a DigitalOcean Droplet (docker-compose: Postgres + Redis +
// Flask + worker), fronted by Caddy on the Droplet for automatic HTTPS
// (Let's Encrypt) against the real domain — replaced the old
// trycloudflare.com quick-tunnel stopgap, which was ephemeral and changed
// URL on every tunnel restart. This one is a real, stable domain and won't
// change on its own; if it ever needs to move to a different
// server/IP, just update DNS (api.saveurnow.com's A record) — this constant
// stays the same.
//
// TODO: swap this for a real build-time env solution (e.g. react-native-config)
// if you need per-environment (dev/staging/prod) values later — kept as a
// plain constant for now rather than adding another native dependency,
// given this project's history with native-linking pain.
// ---------------------------------------------------------------------------

export const API_BASE_URL = 'https://api.saveurnow.com';

// ---------------------------------------------------------------------------
// SENTRY_DSN — crash/error reporting (pre-launch readiness item: this app
// had zero crash visibility, a JS exception or native crash in production
// was simply invisible unless a user happened to report it). Left blank by
// default, which services/crashReportingService.ts's init() treats as
// "disabled" and never calls Sentry.init() at all — a true no-op, safe to
// ship as-is. Paste a real DSN from a Sentry project (platform: React
// Native) to turn this on. Same "plain constant, no react-native-config"
// convention as API_BASE_URL above, for the same reason.
// ---------------------------------------------------------------------------
export const SENTRY_DSN = '';
