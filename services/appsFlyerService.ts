import appsFlyer from 'react-native-appsflyer';
import * as configService from './configService';

// ---------------------------------------------------------------------------
// appsFlyerService — thin wrapper around the react-native-appsflyer SDK.
//
// Two jobs:
//   1. init() — starts the SDK (install attribution + analytics) as soon as
//      the app boots, using the admin-configurable dev_key/appId (Admin >
//      System > "Job sharing") rather than a hardcoded value — see
//      configService.ts's AppsFlyerConfig.
//   2. generateJobShareLink() — turns a job id into a real OneLink URL for
//      the native share sheet (services/jobShareService.ts is the caller).
//
// Deferred-deep-link RESOLUTION (an install that started from a shared
// link) is handled by registerDeepLinkListeners() below, via the SDK's own
// onInstallConversionData (fires once, first app open after install) and
// onAppOpenAttribution (fires on every subsequent open via a OneLink, i.e.
// the app was already installed) callbacks — this is the actual "deferred"
// part: it works without any Universal Links/App Links native setup,
// because AppsFlyer resolves it server-side via device fingerprinting/
// referrer, not a URL the OS has to route.
//
// Every function here is best-effort and never throws — a misconfigured or
// unavailable AppsFlyer setup should degrade to "no attribution/no share
// link", never break app boot or the rest of the Job Alerts feature.
// ---------------------------------------------------------------------------

let initialized = false;

/** Starts the AppsFlyer SDK if configured. Call once from App.tsx, after
 * configService.loadAppConfig() has resolved (init needs the dev key/appId
 * from that config). No-ops if the admin hasn't turned this on or hasn't
 * set a dev_key yet. */
export async function init(): Promise<void> {
  if (initialized) return;
  const cfg = configService.getCachedConfig().appsflyer;
  if (!cfg?.enabled || !cfg.dev_key) return;
  try {
    await new Promise<void>((resolve) => {
      appsFlyer.initSdk(
        {
          devKey: cfg.dev_key,
          appId: cfg.ios_app_id || undefined, // iOS only; ignored on Android
          isDebug: false,
          onInstallConversionDataListener: true,
          onDeepLinkListener: true,
          timeToWaitForATTUserAuthorization: 10,
        },
        () => resolve(),
        () => resolve(), // still mark "attempted" on error — don't retry-loop on every app open
      );
    });
    initialized = true;
  } catch {
    // SDK/native module unavailable (e.g. not yet linked on this build) —
    // fail silently, same as every other best-effort call here.
  }
}

/** Extracts a job id from an AppsFlyer attribution payload, whatever shape
 * it arrives in — onInstallConversionData and onAppOpenAttribution don't
 * share an exact schema, and custom params set via generateJobShareLink's
 * userParams can come back either top-level or nested under `data`,
 * depending on SDK version/platform. Checks the conventional
 * `deep_link_value` key (AppsFlyer's own recommended field for exactly
 * this "which piece of content" use case) first, then a plain `job_id`
 * fallback in case a link was hand-built without going through
 * generateJobShareLink. */
export function extractJobId(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  const candidate = data.deep_link_value ?? data.job_id ?? payload.deep_link_value ?? payload.job_id;
  return candidate ? String(candidate) : null;
}

/**
 * Registers the two attribution listeners and calls `onJobId` whenever
 * either one resolves a shared job's id — covers both the deferred case
 * (fresh install, onInstallConversionData) and the warm case (app already
 * installed, re-opened via the OneLink, onAppOpenAttribution). Call once
 * from App.tsx alongside init(). Returns an unsubscribe function, same
 * convention as the existing Linking.addEventListener usage in App.tsx.
 */
export function registerDeepLinkListeners(onJobId: (jobId: string) => void): () => void {
  const unsubscribers: Array<() => void> = [];
  try {
    const installSub = appsFlyer.onInstallConversionData((payload: any) => {
      // is_first_launch distinguishes a genuine deferred-deep-link install
      // from every later app open, which also fires this same callback —
      // only a first launch should ever be treated as "arrived via a share".
      const isFirstLaunch = payload?.data?.is_first_launch === 'true' || payload?.data?.is_first_launch === true;
      if (!isFirstLaunch) return;
      const jobId = extractJobId(payload);
      if (jobId) onJobId(jobId);
    });
    if (typeof installSub === 'function') unsubscribers.push(installSub);
  } catch {
    // ignore — see module doc comment
  }
  try {
    const openSub = appsFlyer.onAppOpenAttribution((payload: any) => {
      const jobId = extractJobId(payload);
      if (jobId) onJobId(jobId);
    });
    if (typeof openSub === 'function') unsubscribers.push(openSub);
  } catch {
    // ignore
  }
  return () => unsubscribers.forEach(unsub => unsub());
}

/**
 * Generates a real OneLink deep-link URL carrying `jobId` as its
 * deep_link_value custom param. Returns null (not a throw) if OneLink
 * isn't configured yet (onelink_id/onelink_subdomain blank — an admin
 * hasn't finished AppsFlyer dashboard setup) or the SDK call fails, so
 * jobShareService.ts can fall back to a plain saveur:// link instead of
 * the share button silently doing nothing.
 */
export async function generateJobShareLink(jobId: string, jobTitle: string): Promise<string | null> {
  const cfg = configService.getCachedConfig().appsflyer;
  if (!cfg?.enabled || !cfg.onelink_id || !cfg.onelink_subdomain) return null;
  try {
    return await new Promise<string | null>((resolve) => {
      appsFlyer.generateInviteLink(
        {
          brandDomain: cfg.onelink_subdomain,
          channel: 'job_share',
          campaign: 'job_share',
          deeplinkPath: cfg.onelink_id,
          userParams: {
            deep_link_value: jobId,
            job_id: jobId,
            af_og_title: jobTitle,
          },
        },
        (link: string) => resolve(link || null),
        () => resolve(null),
      );
    });
  } catch {
    return null;
  }
}
