import {Linking, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage} from 'constants/Types';
import * as configService from 'services/configService';

// ---------------------------------------------------------------------------
// App Store / Play Store review prompt.
//
// BUG FIX (product report: "Ratings is not working well. The rating should
// pop up after a user have completed 5 interviews or has applied to at
// least 1 job or has just finished a conversation with the AI coach") —
// this used to fire after the user's first completed mock interview OR
// first completed course, whichever happened first. That's replaced
// entirely by the three conditions above (course completion is no longer
// one of them at all). Whichever condition is met first still only ever
// prompts once total — repeatedly nagging for a rating is against both
// platforms' review guidelines and is just bad UX.
//
// ios_app_store_id / android_package_name are admin-configurable (product
// request item) — see services/configService.ts's StoreConfig and
// saveur-backend's app_config_service.py's "store" section. Used to be
// hardcoded constants here, which meant the iOS review prompt could only
// ever start working after someone edited this file and shipped a new app
// release, once the App Store Connect listing existed. Now an admin pastes
// the numeric Apple ID into the dashboard the moment the app goes live — no
// release needed. Still a safe no-op on iOS until that id is set, same
// fail-open behavior as before.
//
// Deliberately uses Linking to the store listing rather than the native
// in-app review popup (SKStoreReviewController on iOS / Play In-App Review
// API on Android, as wrapped by libraries like react-native-in-app-review).
// This app is React Native's New Architecture only, and none of the
// community wrappers for that native popup have a confirmed-compatible
// release for New Architecture as of this writing — adding one blind, with
// no way to actually build/test it from here, risked breaking the native
// build over a UX nicety. Linking needs no native module at all and always
// works, at the cost of leaving the app instead of showing a modal. Swap in
// a native in-app-review library later once you've verified it builds
// cleanly against this project's New Architecture setup.
// ---------------------------------------------------------------------------

function storeReviewUrl(): string | null {
  const store = configService.getCachedConfig().store;
  if (Platform.OS === 'ios') {
    if (!store.ios_app_store_id) return null;
    return `itms-apps://itunes.apple.com/app/id${store.ios_app_store_id}?action=write-review`;
  }
  return `market://details?id=${store.android_package_name || 'com.saveur.app'}`;
}

async function hasPromptedAlready(): Promise<boolean> {
  return (await AsyncStorage.getItem(EKeyAsyncStorage.hasPromptedAppReview)) === 'true';
}

/**
 * Opens the platform store's review page, but only the very first time this
 * is ever called for the account (subsequent calls, from either milestone,
 * are a no-op). Never throws — a failure here should never affect whatever
 * real feature flow triggered it.
 */
async function maybePromptForReview(): Promise<void> {
  try {
    if (await hasPromptedAlready()) return;
    const url = storeReviewUrl();
    if (!url) return; // iOS: no App Store ID configured yet (app not published)
    await AsyncStorage.setItem(EKeyAsyncStorage.hasPromptedAppReview, 'true');
    // Small delay so this doesn't collide with whatever success screen/toast
    // is already appearing right as the milestone completes.
    setTimeout(() => {
      Linking.openURL(url).catch(() => {});
    }, 800);
  } catch {
    // Swallow — see doc comment above.
  }
}

// Trigger condition #1 (of 3 — see this file's header comment): 5
// completed interviews, not just the first one.
const INTERVIEWS_BEFORE_RATING_PROMPT = 5;

/**
 * Call every time interviewService.completeSession() succeeds for this
 * account (see that function) — increments a running count and prompts
 * once the count reaches INTERVIEWS_BEFORE_RATING_PROMPT. maybePromptForReview
 * itself still only ever shows the prompt once total, so this is a safe
 * no-op on every call after whichever condition fires first.
 */
export async function notifyInterviewCompleted(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(EKeyAsyncStorage.completedInterviewCount);
    const count = (parseInt(raw ?? '0', 10) || 0) + 1;
    await AsyncStorage.setItem(EKeyAsyncStorage.completedInterviewCount, String(count));
    if (count >= INTERVIEWS_BEFORE_RATING_PROMPT) {
      await maybePromptForReview();
    }
  } catch {
    // Swallow — see maybePromptForReview's doc comment.
  }
}

/**
 * Trigger condition #2: call once the user has successfully tracked a job
 * application (see services/applicationsService.ts's addApplication) —
 * fires on the very first one, no count needed.
 */
export async function notifyJobApplicationTracked(): Promise<void> {
  await maybePromptForReview();
}

/**
 * Trigger condition #3: call once the user finishes a real back-and-forth
 * with the AI career coach — see services/coachService.ts's sendMessage/
 * sendVoiceMessage, called right after a real reply comes back (so a
 * failed send never counts). Fires on the very first successful exchange,
 * no count needed.
 */
export async function notifyCoachConversationExchanged(): Promise<void> {
  await maybePromptForReview();
}
