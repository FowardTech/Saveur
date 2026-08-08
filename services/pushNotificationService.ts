import {Platform, PermissionsAndroid} from 'react-native';
import messaging, {FirebaseMessagingTypes} from '@react-native-firebase/messaging';
import notifee, {AndroidImportance, AndroidStyle, EventType} from '@notifee/react-native';
import i18n from 'i18next';

import {JobAlertProps} from 'constants/Types';
import {
  navigateToJobAlertDetails,
  navigateToNotifications,
  navigateToWeeklyCareerReport,
  navigateToDailyIndustryNews,
  navigateToMockInterviewSetup,
  navigateToInterviewFeedback,
  navigateToPracticalScenarioFeedback,
  navigateToCareerRoadmap,
  navigateToLeaderboard,
  navigateToSubscription,
  navigateToPaymentHistory,
  navigateToHome,
  navigateToGoalTipDetail,
  navigateToDailyChallenge,
  navigateToSharedContentDetail,
  navigateToSharedWithMe,
  navigateToLearningCourses,
} from 'navigation/navigationRef';
import * as notificationService from './notificationService';
import * as scheduledInterviewService from './scheduledInterviewService';
import * as dailyCheckinService from './dailyCheckinService';

// ---------------------------------------------------------------------------
// Push notifications — the piece notificationService.ts's registerDeviceToken
// docstring flagged as "not called anywhere yet." Wires
// @react-native-firebase/messaging (added to package.json) so that:
//   1. a signed-in user's device gets registered against
//      POST /api/v1/notifications/device-token (called from AuthContext.tsx
//      right after sign-in, same fire-and-forget pattern as
//      gamificationService.checkin()), and
//   2. tapping an OS push notification for a job alert routes straight to
//      src/more/JobAlertDetails.tsx — the exact same screen and navigate()
//      call already used for tapping a job_alert row in the in-app bell
//      (src/home/Notification/index.tsx) or the Job Alerts list
//      (src/more/JobAlerts.tsx).
//
// Backend contract this assumes for a job-alert push: the notification's
// `data` payload (FCM data messages are always flat string->string maps,
// unlike the `notification` block) carries `type: "job_alert"` plus the same
// fields as job_alert on a GET /api/v1/notifications row, snake_case, all
// stringified — id, title, company, location?, source?, matched_role?,
// apply_url, posted_at? (unix ms as a string). This mirrors
// NotificationJobAlertWire in notificationService.ts; if the backend instead
// sends only a job id in `data`, this needs a follow-up fetch against
// GET /api/v1/job-alerts to resolve the full object before navigating.
//
// Foreground pushes: Firebase never auto-displays a system notification
// while the app is in the foreground (true on both platforms) — this used
// to be papered over with a plain in-app Alert.alert popup, which is not a
// real system notification (no tray entry, no lock-screen banner, doesn't
// match how every background/killed-state push already looks). Now uses
// @notifee/react-native to actually display a real local notification —
// same tray banner, same "default" Android channel the backend's own
// push_service.py already targets (channel_id="default"), same tap
// behavior as a genuine background push — so a foreground push looks
// identical to a background one instead of a jarring popup dialog. See
// setupForegroundPushHandler and ensureAndroidChannel below.
//
// NOTE: this adds a new native dependency (@notifee/react-native) — after
// pulling this change, run `npm install` then rebuild natively (`cd ios &&
// pod install` before the next iOS build; a normal Gradle sync picks it up
// automatically on Android).
//
// Also worth noting: every catch block in this file used to swallow errors
// completely silently (no logging at all) — meaning a failed permission
// request, a failed getToken(), or a failed device-token registration call
// left literally no trace anywhere. That's indistinguishable from "nothing's
// wrong" from the outside, which is exactly the kind of gap that makes "why
// am I not getting notifications" hard to debug. Kept these fire-and-forget
// (a push permission issue still shouldn't block sign-in or throw a user-
// facing error), but every catch now at least logs what failed.
// ---------------------------------------------------------------------------

async function requestPermission(): Promise<boolean> {
  // Android 13+ (API 33) requires a separate OS runtime permission prompt
  // for notifications — messaging().requestPermission() below only covers
  // iOS APNs authorization. AndroidManifest.xml already declares
  // POST_NOTIFICATIONS; this is what actually triggers the user-facing
  // prompt for it. No-op on older Android (permission is implicitly granted)
  // and iOS (the check is skipped entirely).
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;
  }
  const authStatus = await messaging().requestPermission();
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}

function jobFromPushData(
  data: FirebaseMessagingTypes.RemoteMessage['data'],
): JobAlertProps | null {
  if (!data || !data.id || !data.title || !data.company || !data.apply_url) {
    return null;
  }
  const postedAtRaw = data.posted_at ? Number(data.posted_at) : undefined;
  return {
    id: String(data.id),
    title: String(data.title),
    company: String(data.company),
    location: data.location ? String(data.location) : undefined,
    source: data.source ? String(data.source) : undefined,
    matchedRole: data.matched_role ? String(data.matched_role) : undefined,
    applyUrl: String(data.apply_url),
    postedAt: Number.isFinite(postedAtRaw) ? postedAtRaw : undefined,
    createdAt: Date.now(),
    read: false,
  };
}

/**
 * Previously only acted on `type: "job_alert"` pushes — tapping ANY other
 * notification (a plain "normal" push with no `data.type`, or a type this
 * client doesn't specifically know about) did nothing at all, which looked
 * identical to "push notifications aren't working" from the outside even
 * though the OS had genuinely delivered and displayed it. Now falls back to
 * opening the in-app Notification list for anything that isn't a
 * recognized job_alert, so a tap always goes somewhere.
 */
function handleNotificationTap(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage | null,
): void {
  if (!remoteMessage) return;
  handleDataTap(remoteMessage.data);
}

// Shared by both the real background/killed-state tap path above
// (Firebase's own system tray notification) and the notifee-displayed
// foreground notification below (setupForegroundPushHandler) — the `data`
// shape is identical either way (it's the same FCM data payload in both
// cases), so both taps resolve to the same screen.
//
// Exported so src/home/Notification/index.tsx's in-app notification list
// can route through this exact same data.type -> destination table instead
// of maintaining its own copy — that drift (a push tap knew where every
// notification type should go; a tap on the same notification's in-app row
// only ever handled job_alert) was the actual bug behind the product
// report "the notifications are not navigating to the individual screens
// concerned". The in-app list passes {type: item.type, ...item.data} (see
// app/models/tracker.py's Notification.data on the backend), the exact
// same shape a push's `data` payload already has.
export function handleDataTap(data: FirebaseMessagingTypes.RemoteMessage['data'] | Record<string, string> | undefined): void {
  if (data?.type === 'job_alert') {
    const job = jobFromPushData(data);
    if (job) {
      // Reverted per explicit follow-up request — back to landing on the
      // in-app job details screen (matches JobAlerts.tsx / Notification/
      // index.tsx's in-app tap behavior).
      navigateToJobAlertDetails(job);
      return;
    }
  }
  // Weekly Career Report / Daily Industry News (product request item:
  // "when users click on the updates in the push notification, it should
  // take them to the screen so they see the full details") — both pushes
  // carry no extra fields beyond `type` (see Saveur-Backend's
  // career_report_service.send_weekly_report_broadcast /
  // news_service.send_daily_news_broadcast), so there's nothing to parse
  // out of `data` here, just route to the matching screen, which re-fetches
  // its own content (and marks it seen server-side) on mount.
  if (data?.type === 'weekly_career_report') {
    navigateToWeeklyCareerReport();
    return;
  }
  if (data?.type === 'daily_industry_news') {
    navigateToDailyIndustryNews();
    return;
  }
  // Below: the rest of the product-request item "push notifications are not
  // navigating to the actual screens. They should its not only job alerts
  // that should navigate to the detail page" — every other data.type the
  // backend actually sends (see push_service.py / feedback_job.py /
  // practical_feedback_job.py / career_roadmap_service.py /
  // daily_broadcast_service.py / billing.py / student_service.py /
  // receipt_service.py / goal_tip_service.py / scheduled_interview_
  // service.py) now lands on the specific screen it's about, instead of all
  // of them falling through to the generic in-app notification list below.
  if (data?.type === 'feedback_ready') {
    navigateToInterviewFeedback(data.session_id);
    return;
  }
  if (data?.type === 'practical_feedback_ready') {
    const sid = Number(data.session_id);
    if (Number.isFinite(sid)) {
      navigateToPracticalScenarioFeedback(sid);
      return;
    }
  }
  // roadmap_step_unlocked/roadmap_complete (Saveur-Backend's
  // app/api/career_roadmap.py) reuse the same CareerRoadmap destination as
  // roadmap_ready — previously unhandled entirely (fell through to the
  // generic notification list on both push and in-app taps).
  if (
    data?.type === 'roadmap_ready' ||
    data?.type === 'roadmap_step_unlocked' ||
    data?.type === 'roadmap_complete'
  ) {
    navigateToCareerRoadmap();
    return;
  }
  // AI Curriculum Builder week-unlocked/course-complete (Saveur-Backend's
  // app/api/learning.py) — previously unhandled entirely, same gap as
  // roadmap_step_unlocked/roadmap_complete above.
  if (data?.type === 'curriculum_week_unlocked' || data?.type === 'curriculum_complete') {
    navigateToLearningCourses();
    return;
  }
  if (data?.type === 'daily_leaderboard_tip') {
    navigateToLeaderboard();
    return;
  }
  if (data?.type === 'payment_failed' || data?.type === 'graduation') {
    navigateToSubscription();
    return;
  }
  if (data?.type === 'payment') {
    navigateToPaymentHistory();
    return;
  }
  if (data?.type === 'goal_tip') {
    navigateToGoalTipDetail();
    return;
  }
  // Today's Surprise Challenge (Saveur-Backend's daily_challenge_service
  // sends data.type = "daily_challenge") — product request item: "the
  // todays challenge, todays tips should link to their individual screens
  // when users click on them on the notification tile or in the
  // notification center." Nothing to parse out of `data` here (same shape
  // as goal_tip above) — the detail screen fetches today's challenge itself.
  if (data?.type === 'daily_challenge') {
    navigateToDailyChallenge();
    return;
  }
  // Daily career-goal check-in evening reflection push (product request
  // item: "How did your day goal go?" — see Saveur-Backend's
  // daily_checkin_service.send_due_reflection_prompts). Nothing to parse
  // out of `data` here (same shape as weekly_career_report/
  // daily_industry_news above) — the reflection sheet itself lives on
  // Home, not its own screen, so this sets the same deferred-until-Home
  // pending flag jobShareService's pendingJobId uses, then navigates
  // there; HomeSrc.tsx's useFocusEffect picks it up and opens the sheet.
  if (data?.type === 'daily_checkin_reflection') {
    dailyCheckinService.setPendingReflectionPrompt().finally(navigateToHome);
    return;
  }
  if (data?.type === 'content_shared' && data.share_id) {
    navigateToSharedContentDetail(String(data.share_id));
    return;
  }
  // Connection-request gating (product request item: "Before a user can
  // share something with another Saveur user they must send a request
  // first..."). A connection_request tap lands directly on the Pending
  // Requests tab so the recipient can accept/decline right away;
  // connection_accepted has nothing specific to show, so it opens the
  // default "Shared with Me" tab.
  if (data?.type === 'connection_request') {
    navigateToSharedWithMe(1);
    return;
  }
  if (data?.type === 'connection_accepted') {
    navigateToSharedWithMe(0);
    return;
  }
  if (data?.type === 'scheduled_interview_reminder') {
    // The push payload only carries the id (see scheduled_interview_
    // service.py's send_due_reminders) -- resolve it against the user's
    // upcoming sessions to get the same interviewType/mode/difficulty/role/
    // company/durationMin HomeSrc.tsx's own "Upcoming Session" card tap
    // already passes into MockInterviewSetup, so a push tap lands on the
    // exact same pre-filled setup screen a manual tap would.
    const id = data.scheduled_interview_id;
    scheduledInterviewService
      .listUpcoming()
      .then(list => {
        const match = id ? list.find(s => s.id === id) : undefined;
        if (match) {
          navigateToMockInterviewSetup({
            interviewType: match.interviewType,
            mode: match.mode,
            difficulty: match.difficulty,
            role: match.role,
            company: match.company,
            durationMin: match.durationMin,
          });
        } else {
          // Already started, canceled, or expired by the time the tap
          // resolved -- Home (where the Upcoming Session card, or its
          // empty state, lives) beats a dead end.
          navigateToHome();
        }
      })
      .catch(() => navigateToHome());
    return;
  }
  // admin_broadcast / test / anything unrecognized: no specific screen to
  // go to, so the generic in-app notification list is the right fallback.
  navigateToNotifications();
}

// Android 8+ requires every notification to belong to a channel — this id
// matches the one the backend's push_service.py already targets
// (`channel_id="default"` in its AndroidNotification config), so a
// background push (delivered by FCM/the OS directly) and a foreground push
// (displayed by notifee below) both land in the same channel with the same
// user-configurable sound/importance settings. Idempotent — safe to call
// on every app start; notifee no-ops if the channel already exists.
let androidChannelReady = false;
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || androidChannelReady) return;
  try {
    await notifee.createChannel({
      id: 'default',
      name: 'Default',
      importance: AndroidImportance.HIGH,
    });
    androidChannelReady = true;
  } catch (err) {
    console.warn('[push] ensureAndroidChannel failed', err);
  }
}

let tapListenersRegistered = false;

/**
 * Registers the two tap-handling paths Firebase splits background vs. killed
 * state across:
 *   - onNotificationOpenedApp: app was backgrounded, user tapped the push.
 *   - getInitialNotification: app was fully killed, tapping the push is what
 *     launched it — checked once on cold start.
 * Call once, near the app root (App.tsx), independent of auth state (a
 * killed-app tap can resolve before AuthContext's onAuthStateChanged does).
 * Returns an unsubscribe function for the onNotificationOpenedApp listener.
 */
export function setupNotificationTapListeners(): () => void {
  if (tapListenersRegistered) return () => {};
  tapListenersRegistered = true;

  const unsubscribe = messaging().onNotificationOpenedApp(handleNotificationTap);

  messaging()
    .getInitialNotification()
    .then(handleNotificationTap)
    .catch(err => console.warn('[push] getInitialNotification failed', err));

  return unsubscribe;
}

let foregroundHandlerRegistered = false;
let foregroundTapListenerRegistered = false;

// Stringifies every data value (notifee, like FCM, only accepts a flat
// string->string map) and drops undefined entries, since jobFromPushData
// above expects the same string-valued shape FCM itself sends.
function stringifyData(data: FirebaseMessagingTypes.RemoteMessage['data']): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(data ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) out[key] = String(value);
  });
  return out;
}

/**
 * Displays a real local notification (via @notifee/react-native) for a push
 * that arrives while the app is already open — Firebase itself never shows
 * a system notification in that state (true on both platforms), so without
 * this a foreground push was previously either silently invisible or (the
 * older version of this function) surfaced as a plain in-app Alert.alert
 * popup, which doesn't look or behave like a real notification. This now
 * renders in the same Android "default" channel and looks the same as a
 * background/killed-state push, and tapping it routes through the same
 * handleDataTap logic as a real system-tray tap (see the
 * notifee.onForegroundEvent listener registered alongside this).
 *
 * Falls back to logging (not displaying anything) only for a push that has
 * neither a `notification` block nor a recognized `data.type` — there's
 * nothing human-readable to show in that case.
 */
export function setupForegroundPushHandler(): () => void {
  if (foregroundHandlerRegistered) return () => {};
  foregroundHandlerRegistered = true;

  ensureAndroidChannel();

  if (!foregroundTapListenerRegistered) {
    foregroundTapListenerRegistered = true;
    notifee.onForegroundEvent(({type, detail}) => {
      if (type === EventType.PRESS) {
        handleDataTap(detail.notification?.data as Record<string, string> | undefined);
      }
    });
    // notifee requires a background handler to be registered at module
    // scope even though this app's own foreground-displayed notifications
    // are only ever pressed while already in the foreground — an unhandled
    // background event otherwise logs a noisy warning every launch.
    notifee.onBackgroundEvent(async ({type, detail}) => {
      if (type === EventType.PRESS) {
        handleDataTap(detail.notification?.data as Record<string, string> | undefined);
      }
    });
  }

  return messaging().onMessage(async remoteMessage => {
    const data = stringifyData(remoteMessage.data);
    let title: string | undefined;
    let body: string | undefined;

    if (data.type === 'job_alert') {
      const job = jobFromPushData(remoteMessage.data);
      if (job) {
        title = i18n.t('common:push_new_role', { role: job.title, defaultValue: `New role: ${job.title}` });
        body = [job.company, job.location].filter(Boolean).join(' · ') || i18n.t('common:push_tap_to_view', { defaultValue: 'Tap to view' });
      }
    }
    title = title ?? remoteMessage.notification?.title ?? undefined;
    body = body ?? remoteMessage.notification?.body ?? undefined;

    // App-icon badge count (product report: "Saveur's app icon doesn't show
    // a notification badge count like other apps do"). iOS already gets
    // this for free from the push's `aps.badge` field even in this
    // foreground case — APNs applies it independently of whether a banner
    // is shown. Android has no such mechanism at all, and this
    // onMessage-only-fires-in-foreground handler is one of only two places
    // (see index.js's background handler for the other) where client code
    // actually runs to set it via notifee. Applied unconditionally
    // (regardless of whether there's a title/body to show below) since the
    // backend stamps badge_count on every push send_to_user/broadcast make,
    // not just ones with a visible notification.
    const badgeRaw = data.badge_count;
    const badgeCount = badgeRaw !== undefined ? Number(badgeRaw) : NaN;
    if (Number.isFinite(badgeCount)) {
      notifee.setBadgeCount(badgeCount).catch(err => {
        console.warn('[push] setBadgeCount (foreground) failed', err);
      });
    }

    if (!title && !body) {
      // A data-only push with no notification block and no recognized
      // type — nothing human-readable to show; log it instead of
      // displaying a blank notification, so it's still visible while
      // debugging "not receiving notifications" reports.
      console.warn('[push] foreground message with no notification/body and unrecognized type', remoteMessage);
      return;
    }

    // Daily leaderboard + tip push (see app/services/daily_broadcast_service.py) —
    // the only push type today that ships an image (the leaderboard leader's
    // generated, friendly avatar, never a real photo). Android renders
    // remoteMessage.notification.android.imageUrl automatically for a
    // background/killed-state push with zero client code, but a
    // notifee-displayed FOREGROUND notification needs to be told explicitly
    // to render as a big-picture style, hence this branch. iOS has no
    // equivalent here (or in the background/killed case) without a native
    // Notification Service Extension, which this project doesn't have yet —
    // the notification still displays fine on iOS, just without the image.
    const leaderAvatarUrl = data.type === 'daily_leaderboard_tip' ? data.leader_avatar_url : undefined;

    try {
      await notifee.displayNotification({
        title,
        body,
        data,
        android: {
          channelId: 'default',
          pressAction: {id: 'default'},
          // BUG FIX (product report: "the icon for the push notification is
          // still showing the old one instead of the new icon") — was
          // 'ic_launcher', the full-color app icon (opaque blue square).
          // Android's status bar always renders notification icons as a
          // flat white silhouette derived from the image's ALPHA channel
          // only, discarding color entirely — a fully-opaque square source
          // like ic_launcher has no transparency to silhouette against, so
          // it rendered as a plain solid white block, not the "S" mark, in
          // EITHER the old or new logo era; this was never actually
          // rendering any recognizable logo. 'ic_stat_saveur' (see
          // android/app/src/main/res/drawable-*dpi/) is a proper
          // white-on-transparent notification icon generated from the same
          // "S" line-art used everywhere else brand-tinted (assets/images/
          // logo_mark.png), sized per Android's notification-icon density
          // guidelines — this is what a status-bar notification icon is
          // actually supposed to look like.
          smallIcon: 'ic_stat_saveur',
          // Same brand-blue tint AndroidManifest.xml's
          // default_notification_color meta-data applies to the
          // background/killed-state path, so the silhouette icon reads as
          // blue instead of plain white/gray on either path.
          color: '#0063f8',
          ...(leaderAvatarUrl
            ? {
                largeIcon: leaderAvatarUrl,
                style: {type: AndroidStyle.BIGPICTURE, picture: leaderAvatarUrl},
              }
            : null),
        },
        ios: {
          sound: 'default',
        },
      });
    } catch (err) {
      console.warn('[push] displayNotification failed', err);
    }
  });
}

let tokenRefreshRegistered = false;

/**
 * Requests notification permission, gets an FCM token, and registers it via
 * notificationService.registerDeviceToken (POST
 * /api/v1/notifications/device-token). Call after a successful sign-in (see
 * AuthContext.tsx's onAuthStateChanged) — fire-and-forget, same as
 * gamificationService.checkin(): a denied permission or a simulator without
 * real push capability shouldn't block sign-in or surface an error the user
 * can't act on.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    const granted = await requestPermission();
    if (!granted) {
      console.warn('[push] permission not granted — device token was not registered');
      return;
    }

    // Required as of the newer @react-native-firebase/messaging "modular"
    // API this app is on (v25) — iOS's getToken() now throws
    // "[messaging/unregistered] You must be registered for remote messages
    // before calling getToken" if this isn't called first. Used to be
    // implicit/automatic on older RNFirebase versions, which is exactly why
    // this was missing here — every single call to getToken() below was
    // failing on iOS with that exact error, which is what made push
    // registration silently never produce an iOS device token at all
    // (Android hits this too, but it's a documented no-op there — safe to
    // call unconditionally on both platforms rather than gating on
    // Platform.OS).
    await messaging().registerDeviceForRemoteMessages();

    const token = await messaging().getToken();
    if (!token) {
      console.warn('[push] messaging().getToken() returned empty — device token was not registered');
      return;
    }
    try {
      await notificationService.registerDeviceToken(token);
    } catch (err) {
      // This is the one most likely to explain "I'm not getting
      // notifications" silently — a failed POST here means the backend
      // never has a token to send a push to at all, no matter what it does
      // server-side afterward.
      console.warn('[push] registerDeviceToken failed', err);
    }

    if (!tokenRefreshRegistered) {
      tokenRefreshRegistered = true;
      messaging().onTokenRefresh(newToken => {
        notificationService.registerDeviceToken(newToken).catch(err => {
          console.warn('[push] registerDeviceToken (refresh) failed', err);
        });
      });
    }
  } catch (err) {
    // Still swallowed — a push-permission/registration issue shouldn't
    // block sign-in or surface a user-facing error — but now at least
    // logged so it's visible while debugging instead of invisible.
    console.warn('[push] registerForPushNotifications failed', err);
  }
}
