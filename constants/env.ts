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
