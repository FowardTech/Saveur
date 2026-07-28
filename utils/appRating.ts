import {Linking, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage} from 'constants/Types';
import * as configService from 'services/configService';

// ---------------------------------------------------------------------------
// App Store / Play Store review prompt — per explicit request, shown after
// the user's first completed mock interview OR first completed course,
// whichever happens first (only ever prompted once total — repeatedly
// nagging for a rating is against both platforms' review guidelines and is
// just bad UX).
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
