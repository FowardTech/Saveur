import {Share} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage, JobAlertProps} from 'constants/Types';
import * as appsFlyerService from './appsFlyerService';
import * as jobAlertsService from './jobAlertsService';

// ---------------------------------------------------------------------------
// jobShareService — "share a job" (product request item): a non-app user
// who taps a shared job link gets sent to the App/Play Store, and after
// install + signup + subscribe, lands directly on that same job.
//
// shareJob() tries a real AppsFlyer OneLink first (deferred — works even if
// the recipient doesn't have the app yet) and falls back to a plain
// saveur://job?id=X link (works only if they already have the app — see
// App.tsx's Linking handler) when OneLink isn't configured yet. Either way
// the recipient ends up with a URL that, once resolved (immediately for an
// existing user, or after signup+subscribe for a new one — job data is
// @require_premium-gated server-side, see app/api/job_alerts.py's
// get_alert), lands on JobAlertDetails via the pending-job-id handoff
// below, same shape as referralService.ts's pending-code pattern.
// ---------------------------------------------------------------------------

// Public share-link domain (see Saveur-Backend's app/web.py — GET /j/<id>
// is served by that same Flask app, just reached through a second host).
// Deliberately NOT api.saveurnow.com (product/security concern raised
// explicitly: a recipient tapping a shared job link shouldn't see "api." in
// the URL bar, which exposes backend naming for no reason) — this is a
// dedicated subdomain (Caddy on the Droplet proxies it to the same backend;
// see Saveur-Backend's PUBLIC_SHARE_BASE_URL / .env.example) that only ever
// serves these public landing pages, never the JSON API itself. Matches the
// domain declared ALONGSIDE api.saveurnow.com (that one stays, so links
// already shared before this change keep working) in
// ios/caren_family/caren_family.entitlements' associated-domains entry and
// android/app/src/main/AndroidManifest.xml's autoVerify intent-filter, so a
// recipient who already has Saveur installed still gets taken straight
// into the app on tap (Universal Links/App Links) instead of ever seeing
// the /j/<id> browser page — that page (with proper Open Graph tags, so the
// shared link previews as "A job match from Saveur" rather than a bare
// URL) is only what a recipient WITHOUT the app installed, or without
// Universal Links wired up yet, actually sees.
const WEB_SHARE_BASE_URL = 'https://share.saveurnow.com';

export async function shareJob(job: JobAlertProps): Promise<void> {
  const message = `Check out this job: ${job.title} at ${job.company} — via the Saveur app.`;
  // `url` on both Share.share() calls below already carries the link (and
  // is what gives iOS its native Open-Graph link-preview card via web.py's
  // job_share_redirect page) — message used to ALSO have the same link
  // appended to it, which made iOS's share sheet show it twice: once
  // inside the message text, once as the separate preview card for `url`.
  const oneLink = await appsFlyerService.generateJobShareLink(job.id, job.title);
  if (oneLink) {
    await Share.share({message, url: oneLink}).catch(() => {});
    return;
  }
  // Fallback while AppsFlyer OneLink isn't configured yet (still-blank
  // onelink_id/onelink_subdomain — see appsFlyerService.ts): a real
  // https:// link to our own /j/<id> page, not a bare saveur://job?id=X
  // custom-scheme link. Not deferred (a recipient without the app installed
  // still just lands on the store-fallback page, same limitation as
  // before), but it DOES get real link-preview branding when pasted
  // anywhere, and — once Universal Links are live — opens the app directly
  // for anyone who already has it installed, neither of which a bare custom
  // scheme link can ever do.
  const fallbackLink = `${WEB_SHARE_BASE_URL}/j/${encodeURIComponent(job.id)}`;
  await Share.share({message, url: fallbackLink}).catch(() => {});
}

/** Extracts a job id from either a saveur://job?id=X URL (custom scheme —
 * a warm open while the app's already running, or the OS resolving the
 * scheme link on the /j/<id> page's own JS redirect) or a real
 * https://share.saveurnow.com/j/X Universal Link (domain-agnostic regex, so
 * this also still matches old https://api.saveurnow.com/j/X links shared
 * before WEB_SHARE_BASE_URL moved to the new domain). Mirrors
 * referralService.ts's extractCodeFromUrl — plain regex, not
 * URL()/URLSearchParams, since custom-scheme URLs don't always parse
 * cleanly across RN's JS engines. */
export function extractJobIdFromUrl(url: string | null | undefined): string | null {
  // Gate stays specific (contains "job", or is a /j/ path) rather than
  // matching a bare "?id=" against ANY incoming URL — this function runs
  // unconditionally on every deep link App.tsx sees (referral links,
  // LinkedIn OAuth callback, Stripe redirect), and "id" is generic enough
  // that a loose match could false-positive against one of those someday.
  if (!url || (!url.includes('job') && !/\/j\/[^/?#]+/i.test(url))) return null;
  const queryMatch = url.match(/[?&]id=([^&]+)/i);
  if (queryMatch) return decodeURIComponent(queryMatch[1]).trim();
  const pathMatch = url.match(/\/j\/([^/?#]+)/i);
  return pathMatch ? decodeURIComponent(pathMatch[1]).trim() : null;
}

export async function setPendingJobId(jobId: string): Promise<void> {
  await AsyncStorage.setItem(EKeyAsyncStorage.pendingJobId, jobId);
}

export async function getPendingJobId(): Promise<string | null> {
  return AsyncStorage.getItem(EKeyAsyncStorage.pendingJobId);
}

export async function clearPendingJobId(): Promise<void> {
  await AsyncStorage.removeItem(EKeyAsyncStorage.pendingJobId);
}

/**
 * Resolves a pending shared-job id (if any) into the real job data, for
 * HomeSrc.tsx to consume once the user is authenticated and has reached the
 * main app. Always clears the pending id regardless of outcome — a stale id
 * (job deleted/expired, or a 403 because the user still isn't subscribed)
 * shouldn't keep re-prompting on every future Home visit; if they still
 * want it, the share link/notification is still there to tap again.
 * Returns null if there was no pending id, or the fetch failed for any
 * reason (including "not entitled yet" — the caller can't usefully
 * distinguish a deleted job from a paywall without a second round trip
 * this flow doesn't need).
 */
export async function consumePendingJob(): Promise<JobAlertProps | null> {
  const jobId = await getPendingJobId();
  if (!jobId) return null;
  await clearPendingJobId();
  try {
    return await jobAlertsService.getJobAlertById(jobId);
  } catch {
    return null;
  }
}
