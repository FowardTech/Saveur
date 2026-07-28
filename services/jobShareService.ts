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

export async function shareJob(job: JobAlertProps): Promise<void> {
  const message = `Check out this job: ${job.title} at ${job.company} — via the Saveur app.`;
  const oneLink = await appsFlyerService.generateJobShareLink(job.id, job.title);
  if (oneLink) {
    await Share.share({message: `${message}\n${oneLink}`, url: oneLink}).catch(() => {});
    return;
  }
  // Fallback: a plain custom-scheme link. Not deferred (does nothing useful
  // if the recipient doesn't already have the app installed), but still a
  // real, working link rather than the share button doing nothing while
  // OneLink setup is incomplete.
  const fallbackLink = `saveur://job?id=${encodeURIComponent(job.id)}`;
  await Share.share({message: `${message}\n${fallbackLink}`}).catch(() => {});
}

/** Extracts a job id from a plain saveur://job?id=X URL (the non-deferred
 * fallback link above, or App.tsx's existing Linking listener for a warm
 * open when the app was already running). Mirrors referralService.ts's
 * extractCodeFromUrl — plain regex, not URL()/URLSearchParams, since
 * custom-scheme URLs don't always parse cleanly across RN's JS engines. */
export function extractJobIdFromUrl(url: string | null | undefined): string | null {
  if (!url || !url.includes('job')) return null;
  const match = url.match(/[?&]id=([^&]+)/i);
  return match ? decodeURIComponent(match[1]).trim() : null;
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
