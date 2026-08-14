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
import AnnouncementBanner from './AnnouncementBanner';
import { ArtPractice } from './HomeHeroArt';
import CircularProgress from 'components/CircularProgress';
import ProgressBar from 'components/ProgressBar';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from 'navigation/types';
import Text from 'components/Text';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { AdvertisementProps, EKeyAsyncStorage, GamificationStreakProps, MockInterviewSessionProps, accountScopedKey } from 'constants/Types';
import * as notificationService from 'services/notificationService';
import * as adsService from 'services/adsService';
import * as jobShareService from 'services/jobShareService';
import * as gamificationService from 'services/gamificationService';
import * as interviewService from 'services/interviewService';
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

// This screen has been through several redesigns (v1: "two-big-card 'what
// do you want to do' landing screen"; v2: greeting header + QuickActionGrid
// bento tiles + RecentActivityList, modeled on a reference "Sundae"
// AI-voice-assistant mockup's structure — see git history for both). The
// CURRENT layout (v3) is a deliberately simplified 5-section structure from
// a product-supplied wireframe: Today's Focus / Quick Actions / Your
// Progress / Recommended for You, plus the verify-email banner — see the
// JSX's own comment right where the Content body starts for the actual
// section-by-section breakdown and what got removed/kept from v2. The four
// auto-triggered overlays (App Tour, daily check-in sheet, rating prompt, ad
// popup) and their shared one-at-a-time arbitration queue below are
// UNCHANGED across all three versions — app-wide engagement mechanisms
// triggered independently of what's laid out on screen.
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

  // Home redesign v3 (product request: simplified wireframe -- "Today's
  // Focus" hero, a 4-icon "Quick Actions" row, a "Your Progress" Job
  // Readiness ring, and a "Recommended for You" list, replacing the
  // previous streak-stats-grid/action-rows/RecentActivityList layout;
  // "structure first, colors later"). Job Readiness is a real composite,
  // not a fabricated number -- same "compute a derived score client-side
  // from real fetched data" pattern src/practice/MyProgress.tsx's own
  // avgScore already uses, just combining two existing real signals
  // instead of one: 60% the average score across real scored practice
  // sessions (interviewService.getPracticeHistory, same field/filter
  // MyProgress.tsx's skill-breakdown section uses) + 40% streak
  // consistency (streakRingPct above) -- consistent practice is itself a
  // real readiness signal, and covers a user with zero scored sessions yet
  // (a pure-score metric would floor them at 0% despite showing up daily).
  // Falls back to whichever ONE signal is actually available if the other
  // isn't yet (no scored sessions yet, or streak still loading/failed) so
  // this doesn't understate an otherwise-real number.
  const [interviewHistory, setInterviewHistory] = React.useState<MockInterviewSessionProps[] | null>(null);
  React.useEffect(() => {
    if (!isSignedIn) return;
    interviewService.getPracticeHistory().then(setInterviewHistory).catch(() => {
      // Non-critical -- Job Readiness just falls back to streak-only below.
    });
  }, [isSignedIn]);
  const avgInterviewScore = React.useMemo(() => {
    const scored = (interviewHistory ?? []).filter(s => typeof s.overallScore === 'number');
    if (!scored.length) return null;
    return Math.round(scored.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) / scored.length);
  }, [interviewHistory]);
  const jobReadinessPct = React.useMemo(() => {
    if (avgInterviewScore != null && streak) {
      return Math.round(avgInterviewScore * 0.6 + streakRingPct * 0.4);
    }
    if (avgInterviewScore != null) return avgInterviewScore;
    if (streak) return Math.round(streakRingPct);
    return 0;
  }, [avgInterviewScore, streak, streakRingPct]);

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
          scrollable Content below, so it's the very first thing visible
          with no scrolling. Self-contained: renders null on its own
          whenever the admin hasn't published anything, or the current
          user already dismissed this exact content — see that
          component's own doc comment. */}
      <AnnouncementBanner />
      <HeaderHome
        name={profile?.name || t('home:default_user_name', { defaultValue: 'there' })}
        username={profile?.username}
        avatarUrl={profile?.avatarUrl}
        email={profile?.email ?? ''}
        notification={unreadCount}
      />
      <Content contentContainerStyle={styles.content} padder>
        {/* Home redesign v3 (see this file's module comment + the effects
            above for the full "why"), section titles renamed in a later
            follow-up to read as this app's own career-coaching vocabulary
            rather than generic dashboard labels. Top to bottom: a verify-
            email banner (unchanged, time-sensitive account action, not a
            content card), "Today's Career Focus" (practice streak, always
            visible -- the wireframe's anchor card, not a self-hiding one
            like the sections it replaces), "Career Toolkit" (4
            shortcuts), "Career Progress" (Job Readiness ring),
            DailyChallengeCard (self-contained, own doc comment), "Next
            Steps" (reusing ContinueLearningCard/UpcomingSessionHomeCard's
            own data/logic, just re-laid-out as a vertical stack instead
            of a side-by-side row).
            REMOVED from Home in the original v3 pass (still reachable
            elsewhere, not deleted from the app): DailyNewsBanner/
            DailyTipsBanner, the old streak-stats grid, the Career Coach/
            Dream Company Dashboard/Refer & Earn/Salary Negotiation action
            rows (now back as "Career Toolkit"'s 4 shortcuts instead, see
            below), and RecentActivityList. DailyChallengeCard was ALSO
            removed in that pass with no other entry point left anywhere
            in the app -- restored here (product follow-up: "add more
            content after the your progress card") rather than staying
            orphaned. */}
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

        {/* "Today's Focus" -- wireframe's top card: a square image, a bold
            title, two lines of real streak copy (same fields/keys the old
            hero card used), and a horizontal progress bar toward a 7-day
            week (same streakRingPct the old ring used, just a bar instead
            of a ring here -- the ring moves down to "Your Progress"
            below). Always rendered (not gated on `streak` loaded) since
            this is the wireframe's anchor card, not a self-hiding one --
            falls back to a real, honest 0%/0-days zero state rather than
            leaving a gap at the very top of the screen while the fetch is
            in flight or if it fails. */}
        <Text category="h8" bold mt={4} mb={12}>
          {t('home:todays_focus_label', { defaultValue: "Today's Career Focus" })}
        </Text>
        <TouchableOpacity activeOpacity={0.85} style={[globalStyle.card, styles.focusCard]} onPress={() => navigate('Leaderboard')}>
          <Flex justify="flex-start" itemsCenter>
            {/* Product follow-up, round 3: "I dont like it, I want you to
                use the illustration style you used in the referral screen
                i.e the gift box kind of illustration style" -- IconMic3D
                (round 2's pick, a glossy 3D-style SVG badge) still wasn't
                the right register. ArtGiftBox (ReferralProgram.tsx) and
                ArtPractice both live in src/home/HomeHeroArt.tsx and share
                one construction: a soft brand-tint backdrop circle, solid
                (not gradient/glossy) flat-colored shapes, and a small
                ground-shadow ellipse for a touch of depth -- that's the
                actual "illustration style" being asked for here.
                ArtPractice is the practice/mic scene in that exact family
                (see HomeHeroArt.tsx's own history -- it's the same
                illustration this app's OLD quick-action tiles used for
                their Practice card), so it's both the right style AND the
                right subject for this streak/practice card. */}
            <View style={styles.focusIconWrap}>
              <ArtPractice size={64} />
            </View>
            <View style={[globalStyle.flexOne, styles.focusTextWrap]}>
              <Text category="h9" bold numberOfLines={1}>
                {t('home:streak_hero_days', { defaultValue: '{{days}} days', days: streak?.streakDays ?? 0 })}
              </Text>
              <Text category="h10" status="placeholder" mt={2} numberOfLines={1}>
                {streak && streak.longestStreak && streak.longestStreak > streak.streakDays
                  ? t('home:streak_hero_subtitle_chasing', {
                      defaultValue: 'Best is {{best}} days — keep going!',
                      best: streak.longestStreak,
                    })
                  : streak
                  ? t('home:streak_hero_subtitle_best', { defaultValue: "That's your best run yet!" })
                  : t('home:todays_focus_zero_state', { defaultValue: 'Start a practice session today' })}
              </Text>
              <Flex justify="flex-start" itemsCenter mt={8}>
                <ProgressBar
                  style={styles.focusProgressBar}
                  didDone={streak?.streakDays ?? 0}
                  total={7}
                  minimumTrackTintColor="#0063f8"
                />
                <Text category="h10" bold ml={8}>
                  {Math.round(streakRingPct)}%
                </Text>
              </Flex>
            </View>
          </Flex>
        </TouchableOpacity>

        {/* "Quick Actions" (product follow-up: "replace the 4 quick actions
            you put there with: Career Coach, Dream Company Dashboard,
            Refer & Earn, and Salary Negotiation") -- same 4 destinations/
            icon colors the old "More for you" action rows used before this
            redesign, just laid out as plain icon-in-a-circle + label
            (wireframe shows these directly on the page, not inside tiles)
            instead of full-width rows -- see src/home/QuickActionGrid.tsx
            for the heavier bento-tile version this deliberately does NOT
            reuse here. Refer & Earn / Salary Negotiation stay behind the
            same admin feature flags the old rows checked. */}
        <Text category="h8" bold mt={24} mb={12}>
          {t('home:quick_actions_label', { defaultValue: 'Career Toolkit' })}
        </Text>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity activeOpacity={0.7} style={styles.quickActionItem} onPress={() => navigate('MainBottomTab', { screen: 'Coach' })}>
            <View style={[styles.quickActionIconWrap, { backgroundColor: 'rgba(0, 99, 248, 0.1)' }]}>
              <Icon pack="eva" name="message-circle-outline" style={[globalStyle.icon20, { tintColor: '#0063f8' }]} />
            </View>
            <Text category="h10" center mt={6} numberOfLines={1}>
              {t('home:quick_action_coach', { defaultValue: 'Coach' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={styles.quickActionItem} onPress={() => navigate('DreamCompanies')}>
            <View style={[styles.quickActionIconWrap, { backgroundColor: 'rgba(0, 99, 248, 0.1)' }]}>
              <Icon pack="eva" name="briefcase-outline" style={[globalStyle.icon20, { tintColor: '#0063f8' }]} />
            </View>
            <Text category="h10" center mt={6} numberOfLines={1}>
              {t('home:quick_action_dream_company', { defaultValue: 'Companies' })}
            </Text>
          </TouchableOpacity>
          {configService.isFeatureEnabled('referral_program') ? (
            <TouchableOpacity activeOpacity={0.7} style={styles.quickActionItem} onPress={() => navigate('ReferralProgram')}>
              <View style={[styles.quickActionIconWrap, { backgroundColor: 'rgba(216, 90, 48, 0.1)' }]}>
                <Icon pack="eva" name="gift-outline" style={[globalStyle.icon20, { tintColor: '#D85A30' }]} />
              </View>
              <Text category="h10" center mt={6} numberOfLines={1}>
                {t('home:quick_action_refer', { defaultValue: 'Refer' })}
              </Text>
            </TouchableOpacity>
          ) : null}
          {configService.isFeatureEnabled('salary_negotiation') ? (
            <TouchableOpacity activeOpacity={0.7} style={styles.quickActionItem} onPress={() => navigate('SalaryNegotiation')}>
              <View style={[styles.quickActionIconWrap, { backgroundColor: 'rgba(29, 158, 117, 0.1)' }]}>
                <Icon pack="eva" name="credit-card-outline" style={[globalStyle.icon20, { tintColor: '#1D9E75' }]} />
              </View>
              <Text category="h10" center mt={6} numberOfLines={1}>
                {t('home:quick_action_salary', { defaultValue: 'Salary' })}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* "Your Progress" -- Job Readiness ring (see the effects above for
            the exact composite formula + the real data it's built from).
            Always rendered, same "honest zero state instead of a gap"
            reasoning as Today's Focus above. */}
        <Text category="h8" bold mt={24} mb={12}>
          {t('home:your_progress_label', { defaultValue: 'Career Progress' })}
        </Text>
        <View style={[globalStyle.card, styles.progressCard]}>
          <CircularProgress progress={jobReadinessPct} size={64} strokeWidth={7}>
            <Text category="h9" bold>{jobReadinessPct}%</Text>
          </CircularProgress>
          <View style={[globalStyle.flexOne, styles.progressTextWrap]}>
            <Text category="h9" bold>
              {t('home:job_readiness_title', { defaultValue: 'Job Readiness' })}
            </Text>
            <Text category="h10" status="placeholder" mt={4}>
              {t('home:job_readiness_hint', {
                defaultValue: 'Based on your practice sessions and consistency',
              })}
            </Text>
            <Text category="h10" status="placeholder" mt={2}>
              {avgInterviewScore != null
                ? t('home:job_readiness_avg_score', {
                    defaultValue: 'Average interview score: {{score}}%',
                    score: avgInterviewScore,
                  })
                : t('home:job_readiness_no_sessions', {
                    defaultValue: 'Complete a practice session to see your score',
                  })}
            </Text>
          </View>
        </View>

        {/* Product follow-up: "add more content after the your progress
            card" -- DailyChallengeCard specifically (product's own choice
            among a few options offered): it was removed from Home in the
            v3 redesign and, unlike the other removed rows, had ended up
            with NO other entry point anywhere in the app (flagged in that
            redesign's own commit) -- restoring it here both adds real
            content and closes that gap. Self-contained, renders null on
            its own when there's nothing real to show or the feature is
            off -- same convention as everything else on this screen. */}
        <DailyChallengeCard />

        {/* "Recommended for You" -- reuses ContinueLearningCard/
            UpcomingSessionHomeCard exactly as before (same data, same
            self-hide-when-empty behavior, same onVisibilityChange
            reporting), just stacked vertically under this section's own
            label instead of side by side under "Today's plan". */}
        {continuePlanVisible || upcomingPlanVisible ? (
          <Text category="h8" bold mt={24} mb={12}>
            {t('home:recommended_for_you_label', { defaultValue: 'Next Steps' })}
          </Text>
        ) : null}
        <View style={styles.recommendedStack}>
          <ContinueLearningCard onVisibilityChange={setContinuePlanVisible} />
          <UpcomingSessionHomeCard style={styles.recommendedItemSpacing} onVisibilityChange={setUpcomingPlanVisible} />
        </View>
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
  // Home redesign v3 -- "Today's Focus" card (see the JSX comment above
  // where this renders). `globalStyle.card` supplies the shape/shadow;
  // this just adds the padding/fill on top, same "spread card + add
  // padding/background locally" pattern every other card on this screen
  // already follows.
  focusCard: {
    padding: 14,
    marginBottom: 4,
    backgroundColor: 'background-basic-color-2',
  },
  // IconMic3D (see the JSX comment above) is a self-sized SVG component,
  // not an Image needing explicit width/height/borderRadius -- this wrap
  // just centers it in the same footprint the old image occupied.
  focusIconWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusTextWrap: {
    marginLeft: 12,
  },
  // `flex: 1` so the bar fills the remaining row width next to its %
  // label (matches ProgressBar's own "measure my own width via onLayout"
  // design -- it needs a bounded parent, which flex:1 in a row provides).
  focusProgressBar: {
    flex: 1,
  },
  // "Quick Actions" row -- 4 plain icon-in-a-circle + label items, no card
  // background (see the JSX comment above for why this deliberately
  // doesn't reuse QuickActionGrid.tsx's heavier bento tiles).
  // `justifyContent: 'space-between'` rather than `gap` -- same
  // cross-RN-version caution QuickActionGrid.tsx's own `grid` style
  // documents (gap inside a flex row isn't guaranteed on every Yoga
  // version this app has shipped with).
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionItem: {
    alignItems: 'center',
    width: '22%',
  },
  quickActionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // "Your Progress" Job Readiness card -- ring on the left, title + two
  // lines of real supporting copy on the right (see the effects above for
  // where jobReadinessPct/avgInterviewScore actually come from).
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'background-basic-color-2',
  },
  progressTextWrap: {
    marginLeft: 14,
  },
  // "Recommended for You" -- ContinueLearningCard/UpcomingSessionHomeCard
  // stacked vertically (see the JSX comment above) instead of the old
  // side-by-side topCardsRow. Each card supplies its own marginTop:0 by
  // default (see their own files) -- recommendedItemSpacing adds the gap
  // between them here, only applied to the second card so a single-card
  // state (the other one empty/hidden) doesn't carry a stray top gap.
  recommendedStack: {},
  recommendedItemSpacing: {
    marginTop: 10,
  },
});
