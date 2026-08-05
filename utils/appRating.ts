import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage} from 'constants/Types';

// ---------------------------------------------------------------------------
// In-app rating prompt milestone triggers.
//
// Product request: "the rating should pop up after a user have completed 5
// interviews or has applied to at least 1 job or has just finished a
// conversation with the AI coach". This used to open the platform App
// Store/Play Store review page directly via Linking the instant a milestone
// hit — a silent permanent no-op on iOS until an admin configures a real
// App Store Connect id in services/configService.ts's StoreConfig (this app
// isn't published yet, so that id has never been set), and even once
// published, a jarring "leaves the app" redirect rather than the polished
// in-app modal (components/AppRatingModal.tsx) this app already has and
// that the product reference design shows (a centered card: icon, "Enjoying
// Saveur?", star row, "Not Now"). BUG FIX (product report: "the rating is
// not showing"): these three functions now just queue a local flag instead
// of calling Linking.openURL — HomeSrc.tsx's rating-prompt check (re-run on
// every Home focus, not just once per app session) shows the real in-app
// modal as soon as it sees this flag, independent of whatever the server's
// own periodic due-check (services/appRatingService.ts) says. Whichever
// condition is met first still only ever queues once total (hasPromptedAppReview
// guards that) — repeatedly nagging for a rating is against both platforms'
// review guidelines and is just bad UX.
// ---------------------------------------------------------------------------

async function hasPromptedAlready(): Promise<boolean> {
  return (await AsyncStorage.getItem(EKeyAsyncStorage.hasPromptedAppReview)) === 'true';
}

/**
 * Queues the in-app rating modal to show next time HomeSrc checks (see its
 * own comment), but only the very first time this is ever called for the
 * account (subsequent calls, from either milestone, are a no-op). Never
 * throws — a failure here should never affect whatever real feature flow
 * triggered it.
 */
async function maybePromptForReview(): Promise<void> {
  try {
    if (await hasPromptedAlready()) return;
    await AsyncStorage.setItem(EKeyAsyncStorage.hasPromptedAppReview, 'true');
    await AsyncStorage.setItem(EKeyAsyncStorage.ratingPromptQueued, 'true');
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
