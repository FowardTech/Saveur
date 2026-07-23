import {Linking, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage} from 'constants/Types';

// ---------------------------------------------------------------------------
// App Store / Play Store review prompt — per explicit request, shown after
// the user's first completed mock interview OR first completed course,
// whichever happens first (only ever prompted once total — repeatedly
// nagging for a rating is against both platforms' review guidelines and is
// just bad UX).
//
// Fill in IOS_APP_STORE_ID once the app has a real App Store Connect listing
// (App Information -> Apple ID — the numeric id in the app's App Store URL,
// e.g. apps.apple.com/us/app/name/id1234567890 -> "1234567890"). Until then,
// the iOS path is a safe no-op rather than opening a broken/placeholder URL.
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

const IOS_APP_STORE_ID = ''; // e.g. '1234567890' — set once published
const ANDROID_PACKAGE_NAME = 'com.saveur.app';

function storeReviewUrl(): string | null {
  if (Platform.OS === 'ios') {
    if (!IOS_APP_STORE_ID) return null;
    return `itms-apps://itunes.apple.com/app/id${IOS_APP_STORE_ID}?action=write-review`;
  }
  return `market://details?id=${ANDROID_PACKAGE_NAME}`;
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

/**
 * Call once, right when interviewService.completeSession() first succeeds
 * for this account (see that function) — no-ops on every completion after
 * the first.
 */
export async function notifyFirstInterviewCompleted(): Promise<void> {
  try {
    const already = await AsyncStorage.getItem(EKeyAsyncStorage.hasCompletedFirstInterview);
    if (already === 'true') return;
    await AsyncStorage.setItem(EKeyAsyncStorage.hasCompletedFirstInterview, 'true');
    await maybePromptForReview();
  } catch {
    // Swallow — see maybePromptForReview's doc comment.
  }
}

/**
 * Call once, right when a Learning Course is completed for the first time
 * (see src/more/CourseSession.tsx) — no-ops on every completion after the
 * first.
 */
export async function notifyFirstCourseCompleted(): Promise<void> {
  try {
    const already = await AsyncStorage.getItem(EKeyAsyncStorage.hasCompletedFirstCourse);
    if (already === 'true') return;
    await AsyncStorage.setItem(EKeyAsyncStorage.hasCompletedFirstCourse, 'true');
    await maybePromptForReview();
  } catch {
    // Swallow — see maybePromptForReview's doc comment.
  }
}
