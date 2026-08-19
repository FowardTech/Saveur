import AsyncStorage from '@react-native-async-storage/async-storage';
import {NativeEventEmitter, NativeModules, Platform} from 'react-native';
import {EKeyAsyncStorage} from 'constants/Types';

// ---------------------------------------------------------------------------
// shareIntentService — OS Share Sheet integration (product request:
// "Ability to share files to Saveur from the device and it will go
// directly to the document section of the app"). Thin JS-facing wrapper
// over the two native modules this feeds from:
//   - Android: android/app/src/main/java/com/saveur/app/ShareIntentModule.kt
//     (registered via ShareIntentPackage.kt in MainApplication.kt)
//   - iOS: ios/caren_family/ShareIntentModule.swift (paired with
//     ios/SaveurShareExtension/ShareViewController.swift, the actual Share
//     Extension target — see ios/SHARE_EXTENSION_SETUP.md for the Xcode
//     setup that extension target needs, which can't be done from this
//     repo's own file tree alone)
//
// Both platforms expose the exact same JS-facing shape
// (getPendingSharedFiles() -> SharedFile[]) so nothing above this file
// needs to branch on platform at all — see App.tsx's wiring and
// src/more/MyDocuments.tsx's pendingImport handling.
//
// Two different delivery mechanisms per platform, both funneling into the
// same getPendingSharedFiles() poll:
//   - Android: a genuine live NativeEventEmitter event
//     ("SaveurShareReceived") for a share that arrives while the app is
//     already running (MainActivity.onNewIntent), PLUS a "pending" slot
//     checked on next launch/foreground for a cold-start share
//     (MainActivity.onCreate).
//   - iOS: app extensions run in their own separate process and can't call
//     back into a running host app's JS runtime directly at all — the
//     Share Extension instead writes the shared file(s) into an App Group
//     container, then re-opens Saveur via a `saveur://shared-import` URL
//     (see ShareViewController.swift's completeAndReturn). App.tsx's
//     existing Linking 'url' handling (the same mechanism referral/
//     LinkedIn/email-connect deep links already use) routes that here via
//     handleIncomingUrl, which just flags "check for a pending share" —
//     there's no live in-app event on iOS, only this relaunch-triggered
//     poll.
// ---------------------------------------------------------------------------

export interface SharedFile {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
}

const nativeModule = NativeModules.ShareIntentModule;
const emitter = Platform.OS === 'android' && nativeModule ? new NativeEventEmitter(nativeModule) : null;

/**
 * Matches saveur://shared-import (see ShareViewController.swift's
 * completeAndReturn) — no-op for any other URL, same convention as
 * referralService.ts/linkedinAuthService.ts/etc.'s own handleIncomingUrl,
 * so App.tsx can call this unconditionally alongside all the others.
 * Returns whether this URL was actually a share-import trigger, so App.tsx
 * knows to immediately re-check getPendingSharedFiles() rather than
 * waiting for its own next mount/foreground poll.
 */
export function handleIncomingUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).host === 'shared-import' || url.includes('shared-import');
  } catch {
    return url.includes('shared-import');
  }
}

/**
 * Reads (and clears, natively) whatever share is currently pending —
 * a cold-start share on either platform, or an iOS share that just
 * relaunched the app via handleIncomingUrl above. Safe to call even when
 * nothing is pending (resolves to an empty array) or when the native
 * module itself isn't available yet (e.g. the iOS Share Extension target
 * hasn't been added in Xcode yet — see SHARE_EXTENSION_SETUP.md) — never
 * throws, so callers never need their own try/catch.
 */
export async function getPendingSharedFiles(): Promise<SharedFile[]> {
  if (!nativeModule?.getPendingSharedFiles) return [];
  try {
    const files = await nativeModule.getPendingSharedFiles();
    return Array.isArray(files) ? files : [];
  } catch {
    return [];
  }
}

/**
 * Android-only live event for a share that arrives while the app is
 * already running (see MainActivity.kt's onNewIntent) — iOS has no
 * equivalent (app extensions can't reach a running host app's JS runtime
 * directly), callers should rely on handleIncomingUrl +
 * getPendingSharedFiles for that platform instead. Returns a no-op
 * unsubscribe on iOS so callers can wire this up unconditionally without
 * a Platform.OS check of their own.
 */
export function addShareListener(callback: (files: SharedFile[]) => void): () => void {
  if (!emitter) return () => {};
  const subscription = emitter.addListener('SaveurShareReceived', (files: SharedFile[]) => {
    callback(Array.isArray(files) ? files : []);
  });
  return () => subscription.remove();
}

// App.tsx's own "never navigate directly, just stash a pending flag"
// convention (see jobShareService.ts's identical setPendingJobId/
// getPendingJobId/clearPendingJobId — same shape, just carrying a
// SharedFile[] instead of a single job id) — App.tsx captures whatever
// getPendingSharedFiles()/addShareListener above hand it and stores it
// here; HomeSrc.tsx's useFocusEffect is what actually reads it and
// navigates to My Documents, once the navigator exists and the user is
// authenticated (a cold-start share can arrive before either is true).
export async function setPendingSharedFiles(files: SharedFile[]): Promise<void> {
  if (!files.length) return;
  await AsyncStorage.setItem(EKeyAsyncStorage.pendingSharedFiles, JSON.stringify(files));
}

export async function getAndClearPendingSharedFiles(): Promise<SharedFile[]> {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.pendingSharedFiles);
  if (!raw) return [];
  await AsyncStorage.removeItem(EKeyAsyncStorage.pendingSharedFiles);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
