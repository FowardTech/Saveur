// ---------------------------------------------------------------------------
// API_BASE_URL — points the app at the real backend (see
// docs/BACKEND_API_SPEC.md for the full endpoint list).
//
// Using the machine's LAN IP directly (rather than "localhost" or the
// Android-emulator-only 10.2.0.2 alias) since it works uniformly across the
// Android emulator, iOS simulator, AND a physical device on the same Wi-Fi —
// all three can reach the host machine at this address as long as they're on
// the same network.
//
// TODO: swap this for a real build-time env solution (e.g. react-native-config)
// if you need per-environment (dev/staging/prod) values later, or if this IP
// changes (e.g. different Wi-Fi network) — kept as a plain constant for now
// rather than adding another native dependency, given this project's history
// with native-linking pain.
// ---------------------------------------------------------------------------

export const API_BASE_URL = 'http://192.168.2.55:5050';
