import React, { memo } from 'react';
import { Alert, AppState, InteractionManager, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleService, useStyleSheet, Icon, Button, Spinner } from '@ui-kitten/components';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';

import Content from 'components/Content';
import Container from 'components/Container';
import HeaderHome from './Components/HeaderHome';
import ContinueLearningCard from './ContinueLearningCard';
import UpcomingSessionHomeCard from './UpcomingSessionHomeCard';
import DailyChallengeCard from './DailyChallengeCard';
import DailyNewsBanner from './DailyNewsBanner';
import DailyTipsBanner from './DailyTipsBanner';
import AnnouncementBanner from './AnnouncementBanner';
import RecentActivityList from './RecentActivityList';
import CircularProgress from 'components/CircularProgress';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from 'navigation/types';
import Text from 'components/Text';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { AdvertisementProps, EKeyAsyncStorage, GamificationStreakProps, accountScopedKey } from 'constants/Types';
import * as notificationService from 'services/notificationService';
import * as adsService from 'services/adsService';
import * as jobShareService from 'services/jobShareService';
import * as gamificationService from 'services/gamificationService';
import { navigateToJobAlertDetails } from 'navigation/navigationRef';
import AdPopupModal from 'components/AdPopupModal';
import AppTour from 'components/AppTour';
import AppRatingModal from 'components/AppRatingModal';
import DailyCheckInSheet, { DailyCheckInMode } from 'components/DailyCheckInSheet';
import PeriodicCheckInSheet from 'components/PeriodicCheckInSheet';
import * as appRatingService from 'services/appRatingService';
import * as dailyCheckinService from 'services/dailyCheckinService';
import * as studentCheckinService from 'services/studentCheckinService';
import { StudentCheckIn } from 'services/studentCheckinService';
import useModal from 'hooks/useModal';
import { AuthContext } from '../../AuthContext';
import * as configService from 'services/configService';

// Defined at module scope (not inline in JSX) so it's a stable component
// reference across renders — see Subscription.tsx's renderCheckoutSpinner
// for the same reasoning.
const renderCheckInSpinner = () => <Spinner size="tiny" status="control" />;

// BUG FIX (product report: homescreen freezing on scroll, every load, both
// platforms) — root cause: `useTranslation(['home', 'common'])` used to
// pass a brand-new array literal as its namespace argument on every render,
// which this app's react-i18next version doesn't deep-compare, so the
// returned `t` function's own reference could change on every render even
// with no real language change. Hoisting this array to a stable module-level
// constant closes off that root cause. See git history for the fuller
// mechanism (this file used to have several dashboard widgets whose data-
// loading useCallbacks fed straight into mount effects with `t` in their own
// dependency arrays — the exact loop that made this matter).
const HOME_I18N_NAMESPACES = ['home', 'common'] as const;

// Home redesign v2 (product request: "restructure the homescreen UI of
// this app to be like the layout in the [reference] screenshots... I just
// want the kind of layout and the look and feel not the texts" — two
// reference screenshots were provided, a light healthcare-app mockup and a
// dark "Sundae" AI-voice-assistant mockup; user explicitly picked the
// second one's STRUCTURE while confirming "layout only, keep light theme"
// when asked — so this adopts that mockup's four structural building
// blocks (a greeting header, a grid of square quick-action tiles, a
// recent-activity list, and a floating center nav button — the last of
// those lives in navigation/MainBottomTab.tsx since the bottom nav is
// shared chrome, not something owned by this screen) using Saveur's own
// existing light color palette, icons, and copy throughout — none of the
// reference mockup's own dark theme, iconography, or text made it in).
//
// This is actually the SECOND redesign of this screen (see git history for
// the original "two-big-card 'what do you want to do' landing screen" this
// replaces) — the underlying content is unchanged from that pass (header,
// verify-email banner, Continue Learning/Upcoming Session compact row, then
// Career Coach / Practice / Dream Company Dashboard / Refer & Earn as the
// four things to do), just re-laid-out: those four now render as
// QuickActionGrid tiles instead of stacked full-width cards, and a new
// RecentActivityList (reusing the same GET /api/v1/activity/day data
// components/DayActivityModal.tsx already shows behind a calendar-day tap)
// sits underneath, giving the screen the mockup's "here's what to do, here's
// what you've been doing" two-part read. The four auto-triggered overlays
// (App Tour, daily check-in sheet, rating prompt, ad popup) and their shared
// one-at-a-time arbitration queue are UNCHANGED — app-wide engagement
// mechanisms triggered independently of what's laid out on screen.
const HomeSrc = memo(() => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(HOME_I18N_NAMESPACES);
  const { isSignedIn, emailVerified, resendVerificationEmail, refreshEmailVerified, profile } =
    React.useContext(AuthContext);

  // Home redesign (product follow-up: shown a wellness-app reference —
  // soft gradient "score" hero card with a progress ring + stat chips,
  // a "Today's plan" row, and quiet pastel-tinted action rows grouped
  // under "More for you" — "I love this UI, use this UI and layout, let's
  // see"). This replaces the previous stack of full-width dark-gradient
  // hero cards (Career Coach / Dream Company Dashboard / Refer & Earn, see
  // git history) with that structure, built from real data instead of the
  // reference's placeholder numbers: the ring/streak/XP below come from
  // GET /api/v1/gamification/streak (services/gamificationService.ts),
  // the same endpoint src/home/Leaderboard.tsx's own streak card already
  // uses (shown in both places for now — Leaderboard's card is untouched).
  // The Fortune-500 logo stack the old Dream Company Dashboard card had
  // doesn't fit this row-based "More for you" format and is dropped here
  // (constants/Data.ts's dreamCompanyLogoNames is still there if a future
  // pass wants it back).
  const [streak, setStreak] = React.useState<GamificationStreakProps | null>(null);
  React.useEffect(() => {
    if (!isSignedIn) return;
    gamificationService.getStreak().then(setStreak).catch(() => {
      // Non-critical — the hero card just hides itself (see the JSX below)
      // rather than showing broken/stale numbers on a failed fetch.
    });
  }, [isSignedIn]);
  // Same "streak toward a 7-day week" framing Leaderboard.tsx's own ring
  // already uses, so the two don't disagree with each other.
  const streakRingPct = streak ? Math.min(100, (streak.streakDays / 7) * 100) : 0;

  // BUG FIX (product report: "the Today's Plan section in the homescreen,
  // nothing is there its empty") — see the "Today's plan" JSX below for
  // the full story; these track whether ContinueLearningCard/
  // UpcomingSessionHomeCard actually have anything to show, so the section
  // label can hide along with them instead of floating above an empty row.
  const [continuePlanVisible, setContinuePlanVisible] = React.useState(true);
  const [upcomingPlanVisible, setUpcomingPlanVisible] = React.useState(true);

  // Bell badge — GET /api/v1/notifications (see services/notificationService.ts).
  const [unreadCount, setUnreadCount] = React.useState(0);
  const loadUnreadCount = React.useCallback(async () => {
    try {
      const list = await notificationService.listNotifications();
      setUnreadCount(list.filter(n => !n.read).length);
    } catch {
      // Non-critical — the badge just stays at its last-known count on a
      // failed refresh rather than surfacing an error for a header icon.
    }
  }, []);
  React.useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  // BUG FIX (repeat product report: "the pop up advert is still freezing
  // the app... I thought you have solved this issue already?") — this
  // screen has FOUR separate auto-triggered overlays that each
  // independently decide, on their own effect, to flip their own `visible`
  // state to true on Home mount/focus — the App Tour walkthrough (below),
  // the daily goal check-in sheet, the app-rating prompt, and the ad popup
  // itself — every one of them a real native RN <Modal> (three of the four
  // already `transparent`). None of them has ever known whether one of the
  // OTHERS is already open. A brand new or returning user can easily
  // satisfy two of these conditions at once — when that happens, TWO native
  // Modals end up mounted at the same time, which is a well-documented
  // Android RN failure mode (simultaneous Modals fight over the same native
  // Window for touch dispatch) and matches "loads then freezes, won't
  // scroll, won't dismiss" exactly.
  //
  // This tiny queue makes sure only ONE of the four is ever visible at a
  // time: each overlay "requests" its slot instead of just setting its own
  // visible flag on its own, waits (still queued, not shown) if someone
  // else already holds the slot, and "releases" it on dismiss/submit/close
  // so the next queued one (if any) gets its turn. OVERLAY_PRIORITY governs
  // which queued overlay goes next when a slot frees up with more than one
  // waiting — roughly most-important-first (the one-time tour, then the
  // time-sensitive morning check-in, then the rating ask, then the ad
  // last, since it's the least essential and already the only one of the
  // four with its own deliberate entry delay).
  // 'studentCheckin' added (product request: "check up on [students]
  // regularly until their graduation date") right after the daily
  // check-in slot -- same "time-sensitive, but not as urgent as the
  // one-time tour" reasoning, and since it's weekly (not daily) it should
  // still win over the rating ask/ad when both happen to be due at once.
  const OVERLAY_PRIORITY = ['tour', 'checkin', 'studentCheckin', 'rating', 'ad'] as const;
  type AutoOverlayKey = (typeof OVERLAY_PRIORITY)[number];
  const [activeOverlay, setActiveOverlay] = React.useState<AutoOverlayKey | null>(null);
  const activeOverlayRef = React.useRef<AutoOverlayKey | null>(null);
  activeOverlayRef.current = activeOverlay;
  const overlayQueueRef = React.useRef<AutoOverlayKey[]>([]);
  const requestOverlay = React.useCallback((key: AutoOverlayKey) => {
    if (activeOverlayRef.current === null) {
      setActiveOverlay(key);
      return;
    }
    if (activeOverlayRef.current !== key && !overlayQueueRef.current.includes(key)) {
      overlayQueueRef.current.push(key);
    }
  }, []);
  const releaseOverlay = React.useCallback((key: AutoOverlayKey) => {
    overlayQueueRef.current = overlayQueueRef.current.filter(k => k !== key);
    if (activeOverlayRef.current !== key) return;
    overlayQueueRef.current.sort(
      (a, b) => OVERLAY_PRIORITY.indexOf(a) - OVERLAY_PRIORITY.indexOf(b),
    );
    setActiveOverlay(overlayQueueRef.current.shift() ?? null);
  }, []);

  // One-time "how this app works" walkthrough (components/AppTour.tsx) —
  // checked on every Home focus (not just mount) rather than once, so
  // MoreSrc.tsx's "Show app tour" replay entry (which clears this same
  // flag and navigates back to Home) actually reopens it without needing
  // Home to remount.
  const [showTour, setShowTour] = React.useState(false);
  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem(accountScopedKey(EKeyAsyncStorage.appTourSeen, profile?.uid)).then(seen => {
        if (!seen) {
          setShowTour(true);
          requestOverlay('tour'); // see OVERLAY_PRIORITY's own comment above
        }
      });
    }, [requestOverlay, profile?.uid]),
  );
  const onCloseTour = React.useCallback(() => {
    setShowTour(false);
    releaseOverlay('tour');
    AsyncStorage.setItem(accountScopedKey(EKeyAsyncStorage.appTourSeen, profile?.uid), '1').catch(() => { });
  }, [releaseOverlay, profile?.uid]);

  // Regular QA rating prompt (product request item: "a regular if not
  // weekly or monthly app rating that will pop up as modal... for quality
  // assurance purposes", PLUS "the rating should pop up after a user have
  // completed 5 interviews or has applied to at least 1 job or has just
  // finished a conversation with the AI coach") — two independent signals
  // decide whether to show this: the server's own periodic due-check
  // (services/appRatingService.ts's isRatingPromptDue, admin-configurable
  // interval, default 30 days) for the "regular" cadence, OR a local flag
  // (EKeyAsyncStorage.ratingPromptQueued) that utils/appRating.ts's three
  // milestone functions set the instant one of those three conditions
  // fires, for the "right after a real accomplishment" cadence.
  const [showRatingPrompt, setShowRatingPrompt] = React.useState(false);
  // A ref always reads the current value — see the module's own history for
  // why the `[]`-deps useCallback below can't just read `showRatingPrompt`
  // directly.
  const showRatingPromptRef = React.useRef(false);
  React.useEffect(() => {
    showRatingPromptRef.current = showRatingPrompt;
  }, [showRatingPrompt]);
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  useFocusEffect(
    React.useCallback(() => {
      if (showRatingPromptRef.current) return; // already showing -- don't re-check mid-display
      (async () => {
        // Local backstop (see EKeyAsyncStorage.ratingPromptLastShownAt's own
        // comment) — checked BEFORE either trigger path below, so a
        // silently-failed dismiss/submit POST from a previous showing can
        // never cause this to re-fire on the very next focus.
        const lastShownRaw = await AsyncStorage.getItem(EKeyAsyncStorage.ratingPromptLastShownAt);
        if (lastShownRaw && Date.now() - Number(lastShownRaw) < WEEK_MS) return;
        const queued = (await AsyncStorage.getItem(EKeyAsyncStorage.ratingPromptQueued)) === 'true';
        if (queued) {
          setShowRatingPrompt(true);
          requestOverlay('rating'); // see OVERLAY_PRIORITY's own comment above
          AsyncStorage.setItem(EKeyAsyncStorage.ratingPromptLastShownAt, String(Date.now())).catch(() => {});
          return;
        }
        const due = await appRatingService.isRatingPromptDue();
        if (due) {
          setShowRatingPrompt(true);
          requestOverlay('rating');
          AsyncStorage.setItem(EKeyAsyncStorage.ratingPromptLastShownAt, String(Date.now())).catch(() => {});
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestOverlay]),
  );
  const onSubmitRating = React.useCallback(async (score: number, comment?: string) => {
    try {
      await appRatingService.submitRating(score, comment);
      // Only close on success -- a failed submit keeps the modal open
      // (with whatever the user already picked still showing) so they can
      // just retry, rather than silently losing the rating they were
      // trying to send.
      setShowRatingPrompt(false);
      releaseOverlay('rating');
      AsyncStorage.removeItem(EKeyAsyncStorage.ratingPromptQueued).catch(() => {});
    } catch (e: any) {
      Alert.alert(
        t('common:rating_submit_failed_title', { defaultValue: "Couldn't send your rating" }),
        e?.message ?? t('common:try_again_later', { defaultValue: 'Please try again in a moment.' }),
      );
    }
  }, [t, releaseOverlay]);
  const onDismissRating = React.useCallback(() => {
    setShowRatingPrompt(false);
    releaseOverlay('rating');
    appRatingService.dismissRatingPrompt().catch(() => { });
    AsyncStorage.removeItem(EKeyAsyncStorage.ratingPromptQueued).catch(() => {});
  }, [releaseOverlay]);

  // Daily career-goal check-in (product request item): on login, ask
  // "what's your career goal for today?" — explicitly distinct from the
  // one-time signup goal (profile.goals). Checked once on mount (due-ness
  // can't flip back to true within the same session without an explicit
  // submit/dismiss). Skipped entirely if the user already answered today
  // (server-side) OR already dismissed it once today without answering
  // (local-only flag — see dailyCheckinService.wasGoalPromptDismissedToday's
  // own comment). Only auto-shows before noon local time (product report:
  // "should only appear once a day and that should be the starting of the
  // day which is in the morning").
  const [checkinSheet, setCheckinSheet] = React.useState<DailyCheckInMode | null>(null);
  React.useEffect(() => {
    if (!isSignedIn) return;
    if (new Date().getHours() >= 12) return;
    (async () => {
      try {
        const [today, dismissed] = await Promise.all([
          dailyCheckinService.getToday(),
          dailyCheckinService.wasGoalPromptDismissedToday(),
        ]);
        if (!today.goalAnswered && !dismissed) {
          setCheckinSheet('goal');
          requestOverlay('checkin'); // see OVERLAY_PRIORITY's own comment above
        }
      } catch {
        // Non-critical — a failed fetch just means no popup this session,
        // not a broken Home screen.
      }
    })();
  }, [isSignedIn, requestOverlay]);

  // "How did your day go?" push tap (see pushNotificationService.ts) sets a
  // pending flag rather than assuming Home is already mounted/focused —
  // same deferred-until-Home pattern as the shared-job deep link below.
  // Checked on every focus (not just mount, unlike the goal prompt above)
  // since a user could tap the push while already sitting on Home, which
  // wouldn't remount this component at all.
  useFocusEffect(
    React.useCallback(() => {
      dailyCheckinService.consumePendingReflectionPrompt().then(pending => {
        if (pending) {
          setCheckinSheet('reflection');
          requestOverlay('checkin');
        }
      });
    }, [requestOverlay]),
  );

  const onSubmitCheckin = React.useCallback(async (text: string) => {
    if (checkinSheet === 'goal') {
      await dailyCheckinService.submitGoal(text);
    } else if (checkinSheet === 'reflection') {
      await dailyCheckinService.submitReflection(text);
    }
    setCheckinSheet(null);
    releaseOverlay('checkin');
  }, [checkinSheet, releaseOverlay]);

  const onDismissCheckin = React.useCallback(() => {
    // Only the morning goal prompt has a "don't ask again today" local
    // flag — a dismissed reflection prompt should still be reachable by
    // tapping the same push notification again (or just doesn't need
    // re-prompting, since there's no follow-up push for it today).
    if (checkinSheet === 'goal') {
      dailyCheckinService.dismissGoalPromptForToday().catch(() => { });
    }
    setCheckinSheet(null);
    releaseOverlay('checkin');
  }, [checkinSheet, releaseOverlay]);

  // Weekly student "how's this term going?" check-in (product request:
  // "For students I want the App to always check up on them too regularly
  // until their graduation date"). Checked on every focus (not just mount)
  // so both the organic "you're due for one" case and a push tap (which
  // sets the same pending flag dailyCheckinService's reflection prompt
  // uses -- see studentCheckinService.setPendingCheckInPrompt /
  // pushNotificationService.ts) surface it the moment Home is actually
  // visible. getPendingCheckIn() itself is the only gate needed for "is
  // this even an active student" -- the backend only ever creates a
  // check-in row for a currently active verified student (see
  // student_checkin_service.py), so a non-student caller always just gets
  // null back, same as any other week with nothing due.
  const [studentCheckin, setStudentCheckin] = React.useState<StudentCheckIn | null>(null);
  const dismissedStudentCheckinIdsRef = React.useRef<Set<number>>(new Set());
  useFocusEffect(
    React.useCallback(() => {
      if (!isSignedIn) return;
      studentCheckinService.getPendingCheckIn().then(found => {
        if (found && dismissedStudentCheckinIdsRef.current.has(found.id)) return;
        if (found) {
          setStudentCheckin(found);
          requestOverlay('studentCheckin');
        }
      });
    }, [isSignedIn, requestOverlay]),
  );
  const onSubmitStudentCheckin = React.useCallback(async (text: string) => {
    if (!studentCheckin) return;
    await studentCheckinService.submitCheckIn(studentCheckin.id, text);
    setStudentCheckin(null);
    releaseOverlay('studentCheckin');
  }, [studentCheckin, releaseOverlay]);
  const onDismissStudentCheckin = React.useCallback(() => {
    if (studentCheckin) dismissedStudentCheckinIdsRef.current.add(studentCheckin.id);
    setStudentCheckin(null);
    releaseOverlay('studentCheckin');
  }, [studentCheckin, releaseOverlay]);

  // "Share a job" deep-link landing (product request item) — a pending job
  // id captured by App.tsx's AppsFlyer listeners / saveur://job fallback
  // link (see services/jobShareService.ts) sits in AsyncStorage until the
  // user actually reaches Home, which by definition only happens once
  // they're authenticated (Home is behind AuthContext's signed-in gate) —
  // so this is naturally the right moment to resolve it. consumePendingJob()
  // clears the stored id itself (success or failure) so this only ever
  // fires once per shared link, not on every future Home visit.
  React.useEffect(() => {
    jobShareService.consumePendingJob().then(job => {
      if (job) navigateToJobAlertDetails(job);
    });
  }, []);
  // Refresh whenever the app returns to the foreground (e.g. after visiting
  // the Notification screen and marking things read) — same AppState pattern
  // used elsewhere in this file/Subscription.tsx.
  React.useEffect(() => {
    const listener = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') loadUnreadCount();
    });
    return () => listener.remove();
  }, [loadUnreadCount]);

  // Non-blocking "verify your email" banner — see AuthContext.emailVerified's
  // doc comment. Deliberately NOT a hard gate on the rest of the app: an
  // interview-prep tool has no action that strictly requires a verified
  // email today, and a hard gate risks locking someone out entirely if a
  // verification email gets lost/delayed. Only ever true for an
  // email/password account — Google/Apple sign-ins are pre-verified. Kept
  // here (not moved to My Progress with everything else) since it's a
  // time-sensitive account action, not a content card.
  const [resendingVerification, setResendingVerification] = React.useState(false);
  const onResendVerification = React.useCallback(async () => {
    if (resendingVerification) return;
    setResendingVerification(true);
    try {
      await resendVerificationEmail();
      Alert.alert(
        t('home:verification_resent_title', { defaultValue: 'Email sent' }),
        t('home:verification_resent_body', { defaultValue: 'Check your inbox for the verification link.' }),
      );
    } catch (error: any) {
      Alert.alert(
        t('home:verification_resend_failed_title', { defaultValue: "Couldn't send that" }),
        error?.message ?? t('common:try_again_later', { defaultValue: 'Please try again in a moment.' }),
      );
    } finally {
      setResendingVerification(false);
    }
  }, [resendingVerification, resendVerificationEmail, t]);

  // Firebase only learns the user tapped the emailed link after an explicit
  // reload — refresh whenever the app returns to the foreground (matching
  // Subscription.tsx's AppState pattern for Stripe checkout) so the banner
  // clears itself without the user having to do anything extra.
  React.useEffect(() => {
    if (!isSignedIn || emailVerified) return;
    const listener = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        refreshEmailVerified();
      }
    });
    return () => listener.remove();
  }, [isSignedIn, emailVerified, refreshEmailVerified]);

  // Admin-configured ad popup — GET /api/v1/ads/next (see
  // services/adsService.ts). Mirrors the existing "AI Coach feedback ready"
  // popup pattern (navigation/MainBottomTab.tsx): only shown when there's a
  // real, still-eligible ad (the backend already enforces the admin's own
  // "how many times to show" cap per user), fetched once per mount rather
  // than on every focus so revisiting the Home tab within one sitting can't
  // burn through that cap. adRef mirrors the feedbackNotifRef pattern
  // elsewhere in this codebase — lets the dismiss/tap handlers below read
  // the latest fetched ad without needing it in their own dependency arrays.
  const [pendingAd, setPendingAd] = React.useState<AdvertisementProps | null>(null);
  const adRef = React.useRef<AdvertisementProps | null>(null);
  const { visible: adVisible, show: showAd, hide: hideAd } = useModal();
  React.useEffect(() => {
    let cancelled = false;
    let cleanupInteraction: (() => void) | null = null;
    adsService.getNextAd().then(ad => {
      if (cancelled || !ad) return;
      adRef.current = ad;
      setPendingAd(ad);
      setTimeout(() => {
        if (cancelled) return;
        // BUG FIX (product report: "the pop up advert is still freezing the
        // app when it loads the homescreen"): this 1500ms timer fires
        // completely blind to whatever the user is physically doing on
        // screen at that exact moment. Android has a well-documented RN
        // issue where presenting a native `Modal` while the view underneath
        // still has an ACTIVE touch responder (e.g. a ScrollView mid-drag)
        // can leave that responder stuck — the touch stream gets cut off
        // mid-gesture with no proper "cancelled" event, so the ScrollView
        // never releases its own internal "I'm being touched" state and
        // simply stops responding to new touches afterward.
        // InteractionManager.runAfterInteractions defers the callback until
        // the JS thread reports no animations/gestures are currently in
        // flight — the standard, documented React Native pattern for
        // exactly this "don't mount something heavy while the user might be
        // mid-touch" scenario.
        const interactionHandle = InteractionManager.runAfterInteractions(() => {
          if (cancelled) return;
          showAd();
          // See OVERLAY_PRIORITY's own comment above — `requestOverlay` here
          // just reserves this screen's single overlay slot; the Modal
          // itself (see its render below) also checks
          // `activeOverlay === 'ad'` before actually going visible, so if
          // another overlay already holds the slot, the ad silently waits
          // its turn (still fetched and ready) rather than opening on top
          // of it.
          requestOverlay('ad');
        });
        cleanupInteraction = () => interactionHandle.cancel();
      }, 1500);
    }).catch(() => {
      // Offline or the request failed — no ad this session, same
      // fail-quiet behavior as checkFeedbackNotification's catch in
      // MainBottomTab.tsx.
    });
    return () => {
      cancelled = true;
      cleanupInteraction?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestOverlay]);
  // Records the impression only once the popup has ACTUALLY rendered on
  // screen (both showAd() fired AND this screen's shared overlay slot is
  // really held by 'ad', not just requested/queued behind another overlay)
  // — a fetched-but-never-actually-shown ad shouldn't burn one of its
  // limited views.
  const hasRecordedAdImpressionRef = React.useRef(false);
  React.useEffect(() => {
    if (!adVisible || activeOverlay !== 'ad' || !pendingAd) return;
    if (hasRecordedAdImpressionRef.current) return;
    hasRecordedAdImpressionRef.current = true;
    adsService.recordImpression(pendingAd.id).catch(() => { });
  }, [adVisible, activeOverlay, pendingAd]);
  const onDismissAd = React.useCallback(() => {
    hideAd();
    releaseOverlay('ad');
  }, [hideAd, releaseOverlay]);
  const onOpenAd = React.useCallback(() => {
    hideAd();
    releaseOverlay('ad');
    if (adRef.current) {
      navigate('AdDetails', { ad: adRef.current });
    }
  }, [hideAd, releaseOverlay, navigate]);

  return (
    <Container style={styles.container}>
      {/* Product request: "add a banner in the homescreen at the top top
          for regular informations like policy change, change in terms and
          conditions etc." — literally above HeaderHome, not inside the
          scrollable Content below (where DailyNewsBanner/DailyTipsBanner
          live), so it's the very first thing visible with no scrolling.
          Self-contained: renders null on its own whenever the admin hasn't
          published anything, or the current user already dismissed this
          exact content — see that component's own doc comment. */}
      <AnnouncementBanner />
      <HeaderHome
        name={profile?.name || t('home:default_user_name', { defaultValue: 'there' })}
        username={profile?.username}
        avatarUrl={profile?.avatarUrl}
        email={profile?.email ?? ''}
        notification={unreadCount}
      />
      <Content contentContainerStyle={styles.content} padder>
        {/* Product request: "Daily News and daily tips banners should
            display at the top of the HomeScreen." Placed as the very first
            content below the greeting header — both are self-contained and
            render null with nothing to show (DailyNewsBanner: non-Premium
            or no digest yet; DailyTipsBanner: no goals set yet), same
            convention as every other card on this screen, so neither one
            reserves space or shows a placeholder when empty.
            BUG FIX (pre-launch redundancy/flow audit): DailyNewsBanner had
            been left commented out from an earlier pass — the whole Daily
            Industry News digest was invisible on Home even though the
            component and its data source were fully built. Restored. */}
        <DailyNewsBanner />
        <DailyTipsBanner />

        {/* Streak/XP hero (see this file's module comment above for the
            reference this redesign is based on) — a 7-day progress ring,
            same real streak data src/home/Leaderboard.tsx's own card
            already shows. Hides itself entirely rather than showing a
            zeroed-out ring on a failed fetch or a signed-out visit
            (AuthContext gates this whole screen behind sign-in in
            practice, but the null check here covers the same brief
            pre-auth frame everything else on this screen already guards
            against).
            Product follow-up (revert): "make the practice streak in the
            homescreen the complete background color #0063f8 no more
            linear gradient" -- the two-stop LinearGradient (#0063f8 ->
            #7EA8E2) from the immediately preceding follow-up is gone
            again; this is back to a single flat fill, this app's own
            brand blue #0063f8. */}
        {streak ? (
          // BUG FIX (pre-launch redundancy/flow audit): this card showed the
          // exact same streak data as Leaderboard.tsx's own card, but had no
          // onPress at all — a user seeing "Not yet" under Today's check-in
          // had no way to act on it from here, only a trophy-icon detour
          // elsewhere. Now tappable straight into Leaderboard, where the
          // real Check-In/Badges buttons live.
          <TouchableOpacity activeOpacity={0.85} onPress={() => navigate('Leaderboard')}>
          <View style={[styles.streakHero, styles.streakHeroOuter]}>
            <Flex justify="flex-start" itemsCenter mb={6}>
              <Icon pack="eva" name="flash-outline" style={[globalStyle.icon16, { tintColor: '#fff' }]} />
              <Text category="h10" bold ml={6} style={{ color: 'rgba(255,255,255,0.85)' }}>
                {t('home:streak_hero_label', { defaultValue: 'Practice streak' })}
              </Text>
            </Flex>
            <Flex justify="space-between" itemsCenter>
              <View style={globalStyle.flexOne}>
                <Text category="h3" bold style={{ color: '#fff' }}>
                  {t('home:streak_hero_days', { defaultValue: '{{days}} days', days: streak.streakDays })}
                </Text>
                <Text category="h10" mt={4} style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {streak.longestStreak && streak.longestStreak > streak.streakDays
                    ? t('home:streak_hero_subtitle_chasing', {
                        defaultValue: 'Best is {{best}} days — keep going!',
                        best: streak.longestStreak,
                      })
                    : t('home:streak_hero_subtitle_best', { defaultValue: "That's your best run yet!" })}
                </Text>
              </View>
              <CircularProgress
                progress={streakRingPct}
                size={50}
                strokeWidth={6}
                trackColor="rgba(255,255,255,0.25)"
                color="#fff">
                <Text category="h10" bold style={{ color: '#fff' }}>
                  {Math.round(streakRingPct)}%
                </Text>
              </CircularProgress>
            </Flex>

            <Flex justify="space-between" itemsCenter mt={10}>
              <View style={styles.streakChip}>
                <Icon pack="eva" name="star" style={[globalStyle.icon16, { tintColor: '#fff' }]} />
                <Text category="h9" bold mt={4} style={{ color: '#fff' }}>{streak.xp}</Text>
                <Text category="h10" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {t('home:streak_chip_xp', { defaultValue: 'Total XP' })}
                </Text>
              </View>
              <View style={styles.streakChip}>
                <Icon pack="eva" name="award-outline" style={[globalStyle.icon16, { tintColor: '#fff' }]} />
                <Text category="h9" bold mt={4} style={{ color: '#fff' }}>{streak.longestStreak ?? streak.streakDays}</Text>
                <Text category="h10" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {t('home:streak_chip_best', { defaultValue: 'Best streak' })}
                </Text>
              </View>
              <View style={styles.streakChip}>
                <Icon
                  pack="eva"
                  name={streak.checkedInToday ? 'checkmark-circle-2' : 'checkmark-circle-2-outline'}
                  style={[globalStyle.icon16, { tintColor: '#fff' }]}
                />
                <Text category="h9" bold mt={4} style={{ color: '#fff' }}>
                  {streak.checkedInToday
                    ? t('home:streak_chip_checked_in', { defaultValue: 'Done' })
                    : t('home:streak_chip_not_checked_in', { defaultValue: 'Not yet' })}
                </Text>
                <Text category="h10" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {t('home:streak_chip_checkin', { defaultValue: "Today's check-in" })}
                </Text>
              </View>
            </Flex>
          </View>
          </TouchableOpacity>
        ) : null}

        {/* Product request: "remove the continue learning card in the My
            Progress screen and then place it at the top in the homescreen
            but let the background be white and the height be very small
            like an info card" + "the upcoming session already scheduled
            should be placed side by side with the continue learning card
            at the top in the homescreen." Both cards are self-contained
            and render null when they have nothing to show (see their own
            files) — a null child contributes no space in this row, so a
            single card naturally takes the full row width when only one
            of the two has content. Labeled "Today's plan"
            (reference-redesign follow-up) to match the new hero/
            section-label structure above/below it.
            BUG FIX (product report: "the Today's Plan section in the
            homescreen, nothing is there its empty") — the row itself
            already correctly disappeared when both cards were empty, but
            this label above it didn't know that and always rendered
            regardless, leaving a bare heading over nothing on any account
            with no in-progress lesson and no scheduled session. Both cards
            now report their own visibility (see their own
            onVisibilityChange prop) so the label can hide along with the
            row instead of floating above an empty gap. Defaults to `true`
            (assume visible) until each card's own fetch resolves, so this
            doesn't flash-hide then reappear during the loading window. */}
        {continuePlanVisible || upcomingPlanVisible ? (
          <Text category="h8" bold mt={18} mb={8}>
            {t('home:todays_plan_label', { defaultValue: "Today's plan" })}
          </Text>
        ) : null}
        <View style={styles.topCardsRow}>
          <ContinueLearningCard style={styles.topCardHalf} onVisibilityChange={setContinuePlanVisible} />
          <UpcomingSessionHomeCard style={styles.topCardHalf} onVisibilityChange={setUpcomingPlanVisible} />
        </View>

        {/* BUG FIX (pre-launch redundancy/flow audit): DailyChallengeCard
            was a fully built, self-contained component ("HomeSrc.tsx just
            renders <DailyChallengeCard />" per its own doc comment) that
            was never actually added to this render tree — the whole daily
            XP-challenge feature was invisible/unreachable. Restored here,
            right after Today's plan; it renders null on its own whenever
            there's nothing real to show or the feature is off. */}
        <DailyChallengeCard />

        {isSignedIn && !emailVerified ? (
          <Flex
            style={styles.verifyBanner}
            justify="flex-start"
            itemsCenter
            mb={16}>
            <Icon
              pack="eva"
              name="email-outline"
              style={[globalStyle.icon20, { tintColor: '#B45309' }]}
            />
            <View style={[globalStyle.flexOne, styles.verifyBannerText]}>
              <Text category="h9-s" bold>
                {t('home:verify_email_title', { defaultValue: 'Verify your email' })}
              </Text>
              <Text category="h10" status="placeholder" mt={2}>
                {t('home:verify_email_body', { defaultValue: "We sent you a link — tap it, then come back here." })}
              </Text>
            </View>
            <Button
              size="tiny"
              status="warning"
              disabled={resendingVerification}
              accessoryLeft={resendingVerification ? renderCheckInSpinner : undefined}
              onPress={onResendVerification}>
              {t('home:resend', { defaultValue: 'Resend' })}
            </Button>
          </Flex>
        ) : null}

        {/* "More for you" (reference-redesign follow-up: "use this UI and
            layout") — Career Coach / Dream Company Dashboard / Refer & Earn
            were three full-width dark-gradient hero cards (see git history);
            replaced with a stack of compact rows, each icon-tinted with its
            own soft pastel wash instead of one repeated dark gradient, so
            the three read as a grouped list of secondary actions rather
            than three competing focal points. Dream Company's icon/tint use
            this app's actual brand blue (#0063f8, product follow-up: "for
            the light blue in the design use the default blue color of the
            app"), not the softer reference blue. */}
        <Text category="h8" bold mt={22} mb={8}>
          {t('home:more_for_you_label', { defaultValue: 'More for you' })}
        </Text>
        {/* Product request: "I want this card background to be the default
            blue and the text white" — breaks from the other three rows'
            shared light-pastel-tint treatment on purpose (Career Coach is
            the one row here the product wants to stand out).
            BUG FIX ("the chat icon is not looking good in dark mode"): the
            icon wrap originally stayed on styles.actionRowIconWrap's shared
            background-basic-color-2 token (reasoning at the time: a plain
            white wrap would be invisible against the row's own white text).
            That token is theme-aware for the OTHER three rows' pastel-tint
            cards (light gray in light mode, works fine there) but this
            row's background is hardcoded solid blue in both themes — in
            dark mode background-basic-color-2 resolves to near-black
            (#1B1B2E), which read as a muddy dark blob on the blue card
            instead of a clean badge. Fixed wrap bg to a fixed translucent
            white (not a theme token) plus a white icon tint (was an
            unrelated purple, #8B5CF6, that didn't match the row's
            blue/white palette either) — looks the same and reads clearly
            in both themes since the card's own blue never changes. */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.actionRow, { backgroundColor: '#0063f8' }]}
          onPress={() => navigate('MainBottomTab', { screen: 'Coach' })}>
          <View style={[styles.actionRowIconWrap, { backgroundColor: 'rgba(255, 255, 255, 0.18)' }]}>
            <Icon pack="eva" name="message-circle-outline" style={[globalStyle.icon20, { tintColor: '#FFFFFF' }]} />
          </View>
          <View style={globalStyle.flexOne}>
            <Text category="h9" bold status="control">
              {t('home:career_coach_card_title', { defaultValue: 'Career Coach' })}
            </Text>
            <Text category="h10" status="control" mt={2} numberOfLines={1} style={{ opacity: 0.85 }}>
              {t('home:career_coach_card_subtitle_short', { defaultValue: 'Ask anything, get feedback' })}
            </Text>
          </View>
          <Icon pack="assets" name="chevronRight" style={[globalStyle.icon20, { tintColor: '#FFFFFF' }]} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.actionRow, { backgroundColor: 'rgba(0, 99, 248, 0.08)' }]}
          onPress={() => navigate('DreamCompanies')}>
          <View style={styles.actionRowIconWrap}>
            <Icon pack="eva" name="briefcase-outline" style={[globalStyle.icon20, { tintColor: '#0063f8' }]} />
          </View>
          <View style={globalStyle.flexOne}>
            <Text category="h9" bold>
              {t('home:dream_company_card_title', { defaultValue: 'Dream Company Dashboard' })}
            </Text>
            <Text category="h10" status="placeholder" mt={2} numberOfLines={1}>
              {t('home:dream_company_card_subtitle_short', { defaultValue: 'Track the employers you want' })}
            </Text>
          </View>
          <Icon pack="assets" name="chevronRight" style={[globalStyle.icon20, { tintColor: '#5C5C78' }]} />
        </TouchableOpacity>

        {configService.isFeatureEnabled('referral_program') ? (
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.actionRow, { backgroundColor: 'rgba(216, 90, 48, 0.08)' }]}
            onPress={() => navigate('ReferralProgram')}>
            <View style={styles.actionRowIconWrap}>
              <Icon pack="eva" name="gift-outline" style={[globalStyle.icon20, { tintColor: '#D85A30' }]} />
            </View>
            <View style={globalStyle.flexOne}>
              <Text category="h9" bold>
                {t('home:referral_card_title', { defaultValue: 'Refer & Earn' })}
              </Text>
              <Text category="h10" status="placeholder" mt={2} numberOfLines={1}>
                {t('home:referral_card_subtitle_short', { defaultValue: 'Invite a friend, get rewards' })}
              </Text>
            </View>
            <Icon pack="assets" name="chevronRight" style={[globalStyle.icon20, { tintColor: '#5C5C78' }]} />
          </TouchableOpacity>
        ) : null}

        {/* Product follow-up: "remove [the AI Career Coach hero card on the
            Coach tab] totally and then the Salary Negotiation Simulator
            should be a card in the homescreen that leads to the simulation
            screen" — same compact pastel-row treatment as the three rows
            above (teal, the one color in this row family not already used
            here), rather than reviving a full-width hero card. Gated the
            same way the Coach tab's own entry point was
            (configService.isFeatureEnabled('salary_negotiation')) — the
            destination screen itself (SalaryNegotiation.tsx) still shows
            its own ProLockGate for non-Pro users, same as always. */}
        {configService.isFeatureEnabled('salary_negotiation') ? (
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.actionRow, { backgroundColor: 'rgba(29, 158, 117, 0.08)' }]}
            onPress={() => navigate('SalaryNegotiation')}>
            <View style={styles.actionRowIconWrap}>
              <Icon pack="eva" name="credit-card-outline" style={[globalStyle.icon20, { tintColor: '#1D9E75' }]} />
            </View>
            <View style={globalStyle.flexOne}>
              <Text category="h9" bold>
                {t('home:salary_negotiation_card_title', { defaultValue: 'Salary Negotiation Simulator' })}
              </Text>
              <Text category="h10" status="placeholder" mt={2} numberOfLines={1}>
                {t('home:salary_negotiation_card_subtitle_short', { defaultValue: 'Practice countering a mock offer' })}
              </Text>
            </View>
            <Icon pack="assets" name="chevronRight" style={[globalStyle.icon20, { tintColor: '#5C5C78' }]} />
          </TouchableOpacity>
        ) : null}

        <RecentActivityList />
      </Content>
      {/* Admin-configured ad popup — only rendered visible when a real,
          still-eligible ad was found (see the effect above); tapping its
          single action opens AdDetails.tsx with that ad's full write-up.
          title/body intentionally not passed — AdPopupModal no longer
          renders any caption over the ad image (product report: "I said I
          dont want captions on any ads"). */}
      {/* Each of these four `visible` props is ALSO gated on
          `activeOverlay` (see that state's own comment further up this
          file) on top of each one's own "do I want to show" flag — so even
          if two or more of their conditions are true at the same moment,
          only the one that actually holds the shared overlay slot ever
          renders its Modal as visible. */}
      <AdPopupModal
        visible={adVisible && activeOverlay === 'ad'}
        imageUrl={pendingAd?.imageUrl}
        ctaLabel={t('common:view_details', { defaultValue: 'View Details' })}
        onCta={onOpenAd}
        onDismiss={onDismissAd}
      />
      <AppTour visible={showTour && activeOverlay === 'tour'} onClose={onCloseTour} />
      <AppRatingModal
        visible={showRatingPrompt && activeOverlay === 'rating'}
        onSubmit={onSubmitRating}
        onDismiss={onDismissRating}
      />
      <DailyCheckInSheet
        visible={checkinSheet !== null && activeOverlay === 'checkin'}
        mode={checkinSheet ?? 'goal'}
        onSubmit={onSubmitCheckin}
        onDismiss={onDismissCheckin}
      />
      <PeriodicCheckInSheet
        visible={studentCheckin !== null && activeOverlay === 'studentCheckin'}
        title={t('home:student_checkin_title', { defaultValue: "How's this term going?" })}
        subtitle={t('home:student_checkin_subtitle', {
          defaultValue: 'A quick check-in — tell us how things are going and get anything you need.',
        })}
        placeholder={t('home:student_checkin_placeholder', {
          defaultValue: 'e.g. Finals coming up, could use interview practice for internship applications...',
        })}
        onSubmit={onSubmitStudentCheckin}
        onDismiss={onDismissStudentCheckin}
      />
    </Container>
  );
});

export default HomeSrc;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  // Top-of-Home compact card row (see the JSX comment above where this
  // renders) — both children are self-contained and render null when
  // empty, so this row costs nothing (zero height, no visible gap) on a
  // user with neither an in-progress lesson nor a scheduled session.
  topCardsRow: {
    flexDirection: 'row',
    gap: 10,
    // DailyNewsBanner/DailyTipsBanner above already carry their own
    // marginTop:12 (each self-contained, same convention as every other
    // card here), so this row needs its own matching gap in case either or
    // both banners are hidden (non-Premium, or no goals set) and this row
    // ends up sitting directly under the header/Content padding instead.
    marginTop: 12,
  },
  topCardHalf: {
    flex: 1,
    marginTop: 0,
  },
  // Google-style pass: converted from a white card with a colored border
  // to a real Material 3 "error/warning container" -- a pale flat tonal
  // fill in the warning hue, no border at all -- the same tonal-surface
  // language now used throughout this screen (see QuickActionGrid.tsx's
  // own comment), rather than the outlined-card treatment other design
  // systems favor for alerts.
  verifyBanner: {
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    backgroundColor: 'rgba(180, 83, 9, 0.1)',
  },
  verifyBannerText: {
    marginHorizontal: 10,
  },
  // Streak/XP hero (reference-redesign follow-up — see this file's module
  // comment). A flat gradient background color (not LinearGradient) is
  // enough for a soft two-tone purple — the black->purple LinearGradient
  // the old cards used doesn't fit this softer "score card" look, so this
  // is a plain solid fill rather than reaching for that component again.
  // Product follow-up: "I want the purple background color of the
  // practice streak card in the homescreen to be blue but the same color
  // tone but blue" -- same softness/lightness as the original #8B7FE0
  // purple, hue rotated over to blue instead.
  // Product follow-up: "reduce the height of the practice streak card to
  // medium size" — padding/borderRadius trimmed and the internal spacing
  // (icon/ring sizes, row margins, up in the JSX) tightened to match, so
  // the whole card reads noticeably shorter without losing any of its
  // three stat chips.
  streakHero: {
    borderRadius: 20,
    padding: 14,
    marginTop: 14,
    // Product follow-up (revert): flat fill again, no more gradient — this
    // app's own brand blue.
    backgroundColor: '#0063f8',
  },
  // No longer clipping an absolute-fill gradient layer (see streakHero's
  // own comment) — kept as its own style purely so the JSX above doesn't
  // need to change shape if a decorative layer comes back later.
  streakHeroOuter: {
    overflow: 'hidden',
  },
  // Each of the 3 stat chips inside streakHero — no background of its own
  // (the hero's own blue fill is already the "card"), just centered
  // icon/value/label so the three sit evenly spaced in one row.
  streakChip: {
    flex: 1,
    alignItems: 'center',
  },
  // "More for you" rows (product follow-up: "use this UI and layout" --
  // the reference's compact icon/title/subtitle/chevron list rows, one
  // per secondary action, each tinted with its own soft pastel wash --
  // see the JSX above for the actual per-row backgroundColor/icon tint).
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  actionRowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'background-basic-color-2',
  },
});
