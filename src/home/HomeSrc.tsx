import React, { memo } from 'react';
import { Alert, AppState, Image, ImageStyle, InteractionManager, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleService, useStyleSheet, useTheme, Icon, Button, Spinner } from '@ui-kitten/components';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';

import Content, { CONTENT_PADDER } from 'components/Content';
import Container from 'components/Container';
import HeaderHome from './Components/HeaderHome';
import ContinueLearningCard from './ContinueLearningCard';
import UpcomingSessionHomeCard from './UpcomingSessionHomeCard';
import NextLessonHomeCard from './NextLessonHomeCard';
import DailyChallengeCard from './DailyChallengeCard';
import AnnouncementBanner from './AnnouncementBanner';
import { ArtGiftBox, ArtPractice, ArtWorkplaceCompass } from './HomeHeroArt';
import CircularProgress from 'components/CircularProgress';
import ProgressBar from 'components/ProgressBar';
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
import * as roadmapService from 'services/roadmapService';
import { CareerRoadmap as CareerRoadmapPlan } from 'services/roadmapService';
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
import { Images } from 'assets/images';
import ThemeContext from '../../ThemeContext';
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
// 'more' added for whats_next_title -- the "What's Next" link card in the
// "Next Steps" section reuses that screen's own translated title rather
// than duplicating a fresh Home-specific string for the exact same name.
const HOME_I18N_NAMESPACES = ['home', 'common', 'more'] as const;

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
  const theme = useTheme();
  const { theme: appTheme } = React.useContext(ThemeContext);
  const isDarkMode = appTheme === 'dark';
  const { width } = useWindowDimensions();
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

  // Product report: "the Today's Career Focus card progress bar is
  // displaying the same value as the Job Readiness [ring below] ... Users
  // need to know the difference" -- and on discussion, the fix isn't just
  // making the two numbers different, it's putting the RIGHT metric in
  // each spot given what this app is actually for (helping someone reach
  // their target role, not just log a streak):
  //   - Today's Career Focus (top hero, mic icon, "X days" headline) stays
  //     100% about the daily practice habit -- streakRingPct below is the
  //     only number that belongs in a card framed entirely around "what
  //     should I do today."
  //   - Career Progress (this section) is the north-star, longer-horizon
  //     metric: concrete milestone progress toward the user's actual
  //     target role, not an abstract skill/consistency score -- see
  //     roadmapPercent below.
  //   - The old Job Readiness composite (60% avg interview score + 40%
  //     streak) is dropped from Home entirely rather than becoming a third
  //     competing headline number -- it still lives on Practice/My
  //     Progress, the screen someone actually goes to for a performance
  //     diagnostic, which is the right depth level for it.
  const [roadmap, setRoadmap] = React.useState<CareerRoadmapPlan | null>(null);
  React.useEffect(() => {
    if (!isSignedIn) return;
    roadmapService.getSavedRoadmap().then(setRoadmap).catch(() => {
      // Non-critical -- "Progress Toward Goal" just falls back to an
      // honest 0% / "build your roadmap" nudge below, same fail-open
      // convention as streak above.
    });
  }, [isSignedIn]);
  const roadmapPercent = roadmap && roadmap.totalCount > 0
    ? Math.round((roadmap.completedCount / roadmap.totalCount) * 100)
    : 0;

  // Product follow-up: "Why did you place the upcoming interview session at
  // the bottom of the homescreen. Place it at the top beside the continue
  // learning. So both cards will be a grid of 2." ContinueLearningCard and
  // UpcomingSessionHomeCard now sit side by side in one horizontal row near
  // the top of Home (see the JSX right under the verify-email banner
  // below) instead of ContinueLearningCard alone at the top and
  // UpcomingSessionHomeCard buried at the bottom in the old "Next Steps"
  // stack.
  //
  // BUG FIX cleanup: this used to also track each card's own visibility
  // (continuePlanVisible/upcomingPlanVisible state, fed by an
  // onVisibilityChange prop on each) to stretch whichever one was alone to
  // fill the row. Now that all three cards share one fixed width (see
  // topCardWidth's own comment below) instead of stretching, nothing reads
  // that visibility anymore — removed rather than left as dead state an
  // onVisibilityChange prop nobody uses the result of.
  const topCardsGap = 12;
  // Product follow-up: "add another card in the scroll item of upcoming...
  // the next lesson to be taken [or, once finished,] a card that navigates
  // to a screen that display upcoming features" -- NextLessonHomeCard
  // joined as a permanent THIRD item in this row.
  // BUG FIX (product report: "the upcoming feature should have the same
  // width... the three should be of the same width the upcoming session
  // should not be longer than any of the other two"): this used to
  // stretch UpcomingSessionHomeCard/ContinueLearningCard to the FULL row
  // width whenever the other one had nothing to show (product follow-up
  // #3, from before the third card existed: "when the learning course
  // card disappears then the upcoming session card can then automatically
  // stretch to cover the full space"). With NextLessonHomeCard now always
  // present in the same row, that stretch made the remaining card visibly
  // longer than the third one instead of matching it. All three cards now
  // share one fixed "grid of 2" half-width — same value the row already
  // used when both of the first two were visible — regardless of how many
  // of the three actually have content, so they always match. A row with
  // only one real card just shows one half-width card instead of a full-
  // width one; the layout no longer needs to know the individual
  // visibility flags to size anything.
  const topCardWidth = (width - CONTENT_PADDER * 2 - topCardsGap) / 2;

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

  // Admin-configured Home banner — GET /api/v1/ads/banner (see
  // services/adsService.ts's getHomeBanner, backend's app/api/ads.py). This
  // is the OTHER "home banner" in this codebase, distinct from
  // AnnouncementBanner above: an admin uploads a real marketing image per
  // language (the backend's image_urls_i18n column, edited from Admin >
  // Advertisements) rather than typing plain text. Rendered as a
  // persistent card inside Content (see styles.homeBannerCard below), not
  // a modal, and never impression-capped — it just shows for as long as
  // the admin leaves an active placement="home_banner" ad. Dropped
  // entirely during the v3 wireframe rewrite (2d8e4b2) along with most of
  // the old cards; restored here per explicit product follow-up ("I was
  // talking about the homebanner that we implemented the different
  // language upload version of it in the admin"), placed directly above
  // Today's Career Focus per that same request.
  //
  // Refetches on mount AND every foreground return (AppState 'active'),
  // same pattern as the unread-count/email-verification effects above —
  // history here (see old commits) showed a mount-only fetch could go
  // stale or lose a race on cold start and never recover for the rest of
  // the session.
  const [homeBanner, setHomeBanner] = React.useState<AdvertisementProps | null>(null);
  const loadHomeBanner = React.useCallback(() => {
    adsService.getHomeBanner().then(banner => {
      setHomeBanner(banner);
    }).catch(() => {
      // Offline or the request failed — leave whatever's currently shown
      // (or not shown) alone; the next foreground/retry will try again.
    });
  }, []);
  React.useEffect(() => {
    loadHomeBanner();
  }, [loadHomeBanner]);
  React.useEffect(() => {
    const listener = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') loadHomeBanner();
    });
    return () => listener.remove();
  }, [loadHomeBanner]);
  const onOpenHomeBanner = React.useCallback(() => {
    if (homeBanner) {
      navigate('AdDetails', { ad: homeBanner });
    }
  }, [homeBanner, navigate]);
  // A bad/unreachable admin-uploaded image URL degrades to the code-drawn
  // fallback card below (same imageFailed pattern AdPopupModal.tsx already
  // uses) instead of the whole card going blank.
  const [homeBannerImageFailed, setHomeBannerImageFailed] = React.useState(false);
  React.useEffect(() => {
    setHomeBannerImageFailed(false);
  }, [homeBanner?.imageUrl]);
  // Bug fix: this used to be a hardcoded `width - 48`, a stand-in for
  // "Content's old 24px padder x 2 sides" that never actually read from
  // Content — so when Content's padder was changed to 16px, this card fell
  // out of sync with every sibling card (which just flows to fill Content's
  // padded container and tracks the real value automatically). Deriving it
  // from the same padder constant keeps this card's width identical to the
  // others no matter what that constant is set to.
  const homeBannerWidth = width - CONTENT_PADDER * 2;

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
            Steps" (a standing link into WhatsNext.tsx). NOTE: this list is
            top-to-bottom as of the ORIGINAL v3 pass -- see the "Continue &
            Upcoming" section's own comment further down for where
            ContinueLearningCard/UpcomingSessionHomeCard actually live now
            (a horizontal row right below the Home banner, own section
            title, not inside "Next Steps" anymore).
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

        {/* Admin-configured Home banner (see the effect above for the full
            "why" + how this differs from AnnouncementBanner). Deliberately
            rendered above "Today's Career Focus" per explicit product
            placement. Only shows once a real, active placement="home_banner"
            ad exists — no banner at all until the admin creates one, and a
            tap always has real content to navigate AdDetails to. */}
        {homeBanner ? (
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.homeBannerCard, { width: homeBannerWidth }]}
            onPress={onOpenHomeBanner}>
            {homeBanner.imageUrl && !homeBannerImageFailed ? (
              // The real admin-uploaded (and, per-locale, admin-translated)
              // image, shown as-is with no caption overlay drawn over it —
              // tapping the card (already wired on the outer
              // TouchableOpacity above) is the only affordance, matching a
              // real native ad banner.
              <View style={styles.homeBannerImageWrap}>
                <Image
                  source={{ uri: homeBanner.imageUrl }}
                  style={styles.homeBannerImage as ImageStyle}
                  resizeMode="cover"
                  onError={() => setHomeBannerImageFailed(true)}
                />
              </View>
            ) : (
              // No admin image (or it failed to load) — a code-drawn
              // fallback card, still using the ad's real title/body text.
              <View style={styles.homeBannerFallback}>
                <LinearGradient
                  colors={isDarkMode ? [theme['background-basic-color-2'], theme['background-basic-color-2']] : [theme['color-primary-500'], theme['color-primary-500']]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.homeBannerIconWrap}>
                  <Image
                    source={Images.logoMark}
                    style={styles.homeBannerIcon as ImageStyle}
                    resizeMode="contain"
                    tintColor={isDarkMode ? theme['color-badge-info-text'] : '#fff'}
                  />
                </View>
                <View style={globalStyle.flexOne}>
                  {homeBanner.title ? (
                    <Text
                      category="h9"
                      bold
                      numberOfLines={1}
                      style={{ color: isDarkMode ? theme['color-badge-info-text'] : '#fff' }}>
                      {homeBanner.title}
                    </Text>
                  ) : null}
                  {homeBanner.body ? (
                    <Text
                      category="h10"
                      numberOfLines={2}
                      mt={homeBanner.title ? 2 : 0}
                      style={{ color: isDarkMode ? theme['color-badge-info-text'] : 'rgba(255,255,255,0.9)' }}>
                      {homeBanner.body}
                    </Text>
                  ) : null}
                </View>
                <Icon
                  pack="assets"
                  name="arrowRight"
                  style={[globalStyle.icon16, { tintColor: isDarkMode ? theme['color-badge-info-text'] : '#fff' }]}
                />
              </View>
            )}
          </TouchableOpacity>
        ) : null}

        {/* Product follow-up: "I want you to place the 2 cards below the
            homebanner and give them a section name just like the other
            sections in the homescreen" -- ContinueLearningCard +
            UpcomingSessionHomeCard's horizontal row moved from right above
            the home banner to right below it, now with its own section
            title (same `<Text category="h8" bold>` treatment as "Career
            Toolkit"/"Career Progress" below), instead of being the one
            section-less block on this screen.
            Product follow-up: "the upcoming session should be on the left
            while the continue learning be on the right" -- swapped order
            (UpcomingSessionHomeCard first, ContinueLearningCard second).
            Product follow-up: "add another card in the scroll item of
            upcoming and thats the next lesson to be taken and if the user
            have finished all the curriculums then the next card... is a
            card that navigates to a screen that display upcoming
            features" -- NextLessonHomeCard joined as a permanent third
            item (see topCardWidth's own comment above for its sizing). */}
        <Text category="h8" bold mt={4} mb={12}>
          {t('home:continue_and_upcoming_label', { defaultValue: 'Continue & Upcoming' })}
        </Text>
        {/* Always mounted (all three cards already self-hide/self-fallback
            internally when they have nothing to show — no need to
            conditionally swap the wrapper itself). All three share one
            fixed width now (see topCardWidth's own comment above) so they
            always match regardless of which ones actually render
            content. */}
        {/* marginBottom here (same reasoning as homeBannerCard's own —
            see that style's comment) gives this row its own breathing
            room before "Today's Career Focus" regardless of what's above
            it, rather than bumping that title's mt and disturbing its
            no-banner-shown spacing. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, paddingHorizontal:10 }}>
          {/* NextLessonHomeCard is a permanent third item, so something
              always follows both of these now — marginRight is
              unconditional on both rather than only when both were
              visible, which used to matter for avoiding a dangling margin
              on whichever card became the sole, full-width one (that
              stretch-to-full-width behavior is gone now — see
              topCardWidth's comment). An invisible (null-rendering)
              card's own marginRight is harmless either way. */}
          <UpcomingSessionHomeCard
            style={{ width: topCardWidth, marginRight: topCardsGap }}
          />
          <ContinueLearningCard
            style={{ width: topCardWidth, marginRight: topCardsGap }}
          />
          <NextLessonHomeCard style={{ width: topCardWidth }} />
        </ScrollView>

        {/* "Today's Focus" -- wireframe's top card: a square image, a bold
            title, two lines of real streak copy (same fields/keys the old
            hero card used), and a horizontal progress bar toward a 7-day
            week (same streakRingPct the old ring used, just a bar instead
            of a ring here -- the ring moves down to "Your Progress"
            below). Always rendered (not gated on `streak` loaded) since
            this is the wireframe's anchor card, not a self-hiding one --
            falls back to a real, honest 0%/0-days zero state rather than
            leaving a gap at the very top of the screen while the fetch is
            in flight or if it fails.
            MERGE (product ask: "place the career toolkit card and the
            today's career focus card to be in one container. So just one
            container should house them") -- these used to be two separate
            globalStyle.card boxes, each with its own top-level section
            title. Now one outer card (focusToolkitCard) houses both;
            "Career Toolkit" becomes a smaller inner subheading instead of
            its own section, and "Today's Career Focus" is the one title
            that still sits above the whole merged container. */}
        <Text category="h8" bold mt={4} mb={12}>
          {t('home:todays_focus_label', { defaultValue: "Today's Career Focus" })}
        </Text>
        {/* Product ask: "In dark mode remove the border and background from
            the career toolkit and the today's Surprise challenge. Only in
            dark mode" — focusToolkitCardDark zeroes out backgroundColor
            (transparent, letting the page's own dark background show
            through) for the WHOLE merged container now, same treatment
            both halves already had separately before the merge. */}
        <View style={[globalStyle.card, styles.focusToolkitCard, isDarkMode && styles.focusToolkitCardDark]}>
          {/* Product report: "the Today's Career Focus card should not
              navigate to the leaderboard when clicked since the trophy cup
              icon [already] navigates there" (see HeaderHome.tsx's own
              trophy button) -- this was a duplicate entry point to the same
              screen, originally fixed by routing the whole card into the
              Coach tab's Chat screen with the Suggested Topics bottom sheet
              already popped open instead (openTopicsSheet -- see Chat.tsx's
              own effect for this).
              REDESIGN (product follow-up: "there should be a button in that
              card that will now trigger the suggested topic in the AI
              career coach screen instead of the whole card to now be the
              one to trigger it") -- that TouchableOpacity used to wrap this
              entire streak block; it's a plain View now, and the dedicated
              "Ask Your Career Coach" button below (askCoachButton) is the
              only thing in this container that navigates into Coach/Chat
              with the Suggested Topics sheet open. Those topics are still
              the same live, personalized GET /api/v1/coach/suggested-topics
              call built from the user's real recent activity (interview
              scores/weak spots, streak, learning progress -- see
              Saveur-Backend's coach.py _activity_snippet), just reached via
              an explicit tap target now instead of the whole card. */}
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
            {/* Product report: "reduce the size of the mic icon in the
                Today's Career Focus card" — was 64 (the same footprint
                as the old image it replaced), sized down to read more like
                an accent icon next to the streak text than a co-equal
                visual block.
                REDESIGN, then REVERTED (product follow-up: "The icons
                background color are still looking awful to me... remove
                the backgrounds from the icons... and give the icons
                themselves... the platform blue") — this cycled through a
                GradientIconBadge wrapper (orange, at one point) and back;
                no badge behind it now, plain ArtPractice again with no
                `light` prop, so it reverts to its own default construction
                (brand-blue stroke + its own faint built-in backdrop
                wash) -- the exact "platform blue" this ask wants, with no
                separate colored square needed behind it. */}
            <ArtPractice size={44} />
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
              {/* Kept as the plain streak-toward-7-days bar (see the
                  "which metric belongs where" comment above where
                  streakRingPct/roadmapPercent are computed) -- this card's
                  whole narrative (headline, subtitle) is the daily practice
                  habit, so the bar underneath stays that same story instead
                  of switching metrics mid-card.
                  Product report: "the height of the progress bar... is too
                  tiny" — was the component's bare 4px default on both the
                  outer track (`style`) and the inner fill (previously
                  unset, so it fell back to that same hardcoded 4 inside
                  ProgressBar.tsx); focusProgressBar/focusProgressBarFill
                  now both explicitly set height: 8 so the fill actually
                  grows along with its own track. */}
              <Flex justify="flex-start" itemsCenter mt={8}>
                <ProgressBar
                  style={styles.focusProgressBar}
                  styleBar={styles.focusProgressBarFill}
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

          {/* New dedicated tap target (see the REDESIGN comment above) --
              a compact pill/row rather than a big CTA button, since this
              sits inside an already-busy card alongside the streak block
              and the Career Toolkit icons below it. */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.askCoachButton}
            onPress={() => navigate('MainBottomTab', { screen: 'Coach', params: { screen: 'Chat', params: { openTopicsSheet: true } } })}>
            <Icon pack="eva" name="message-circle-outline" style={[globalStyle.icon16, { tintColor: '#0063f8' }]} />
            <Text category="h10" bold ml={6} style={styles.askCoachButtonText}>
              {t('home:ask_coach_button', { defaultValue: 'Ask Your Career Coach' })}
            </Text>
            <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, styles.askCoachButtonArrow]} />
          </TouchableOpacity>

          {/* Separates the streak block above from the Career Toolkit
              icons below now that both live inside one container -- an
              internal section divider distinct from the outer card's own
              border (see globalStyle.card's own border comment). */}
          <View style={styles.toolkitDivider} />

          {/* "Quick Actions" (product follow-up: "replace the 4 quick
              actions you put there with: Career Coach, Dream Company
              Dashboard, Refer & Earn, and Salary Negotiation") -- same 4
              destinations/icon colors the old "More for you" action rows
              used before this redesign, just laid out as plain
              icon-in-a-badge + label (wireframe shows these directly on
              the page, not inside tiles) instead of full-width rows -- see
              src/home/QuickActionGrid.tsx for the heavier bento-tile
              version this deliberately does NOT reuse here. Learning
              Courses / Salary Negotiation stay behind the same admin
              feature flags the old rows checked.
              Refer & Earn REMOVED from here (product follow-up: "Remove
              refer from the career toolkit and replace it with Courses")
              -- it now has its own full promo card below DailyChallengeCard
              instead (more room for the actual pitch than a small icon
              label ever had).
              REDESIGN, then REVERTED (product follow-up: "The icons
              background color are still looking awful to me... remove the
              backgrounds from the icons... and give the icons themselves
              the platform blue") -- this row cycled through a colored
              badge behind every icon (a distinct hue each -- teal,
              orange, purple, green) and back; no badge/background now,
              every icon glyph tinted the same flat platform blue
              (#0063f8) directly instead. */}
          <Text category="h9" bold mb={12}>
            {t('home:quick_actions_label', { defaultValue: 'Career Toolkit' })}
          </Text>
          <View style={styles.quickActionsRow}>
          {/* REDESIGN (product-supplied icon pack, "use them in the
              appropriate places in the app most especially the career
              toolkit icons") -- the flat platform-blue Eva glyphs above are
              swapped for the matching real illustrated icons from that pack
              (see assets/images/index.ts's own comment): a chat bubble for
              Coach, a handshake for Companies (Dream Companies is about
              building real relationships with target employers, not just
              browsing a briefcase icon), a graduation cap for Courses, and
              a coin for Salary. Plain <Image>, no tintColor -- these are
              full-color source art, not tintable glyphs. */}
          <TouchableOpacity activeOpacity={0.7} style={styles.quickActionItem} onPress={() => navigate('MainBottomTab', { screen: 'Coach' })}>
            <Image source={Images.iconCoachChat} style={styles.quickActionIcon as ImageStyle} resizeMode="contain" />
            <Text category="h10" center mt={6} numberOfLines={1}>
              {t('home:quick_action_coach', { defaultValue: 'Coach' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} style={styles.quickActionItem} onPress={() => navigate('DreamCompanies')}>
            <Image source={Images.iconHandshake} style={styles.quickActionIcon as ImageStyle} resizeMode="contain" />
            <Text category="h10" center mt={6} numberOfLines={1}>
              {t('home:quick_action_dream_company', { defaultValue: 'Companies' })}
            </Text>
          </TouchableOpacity>
          {configService.isFeatureEnabled('learning_courses') ? (
            <TouchableOpacity activeOpacity={0.7} style={styles.quickActionItem} onPress={() => navigate('LearningCourses')}>
              <Image source={Images.iconGraduationCap} style={styles.quickActionIcon as ImageStyle} resizeMode="contain" />
              <Text category="h10" center mt={6} numberOfLines={1}>
                {t('home:quick_action_courses', { defaultValue: 'Courses' })}
              </Text>
            </TouchableOpacity>
          ) : null}
          {configService.isFeatureEnabled('salary_negotiation') ? (
            <TouchableOpacity activeOpacity={0.7} style={styles.quickActionItem} onPress={() => navigate('SalaryNegotiation')}>
              <Image source={Images.iconCoins} style={styles.quickActionIcon as ImageStyle} resizeMode="contain" />
              <Text category="h10" center mt={6} numberOfLines={1}>
                {t('home:quick_action_salary', { defaultValue: 'Salary' })}
              </Text>
            </TouchableOpacity>
          ) : null}
          </View>
        </View>

        {/* "Your Progress" -- Progress Toward Goal ring (see the "which
            metric belongs where" comment above where streakRingPct/
            roadmapPercent are computed for the full reasoning). A
            genuinely distinct metric from Today's Focus: concrete
            milestone progress through
            the user's real AI Career Roadmap (completedCount/totalCount),
            the same source src/practice/MyProgress.tsx's own "Progress
            toward your goal" card already reads from. Always rendered,
            same "honest zero state instead of a gap" reasoning as Today's
            Focus above -- a user with no roadmap yet just sees 0% and a
            nudge to build one, not a hidden section. */}
        <Text category="h8" bold mt={24} mb={12}>
          {t('home:your_progress_label', { defaultValue: 'Career Progress' })}
        </Text>
        <View style={[globalStyle.card, styles.progressCard]}>
          <CircularProgress progress={roadmapPercent} size={64} strokeWidth={7}>
            <Text category="h9" bold>{roadmapPercent}%</Text>
          </CircularProgress>
          <View style={[globalStyle.flexOne, styles.progressTextWrap]}>
            <Text category="h9" bold>
              {t('home:goal_progress_title', { defaultValue: 'Progress Toward Goal' })}
            </Text>
            <Text category="h10" status="placeholder" mt={4}>
              {roadmap
                ? t('home:goal_progress_hint_role', {
                    defaultValue: 'Your roadmap to {{role}}',
                    role: roadmap.targetRole,
                  })
                : t('home:goal_progress_hint_no_roadmap', {
                    defaultValue: 'Based on your AI Career Roadmap milestones',
                  })}
            </Text>
            <Text category="h10" status="placeholder" mt={2}>
              {roadmap
                ? t('home:goal_progress_steps_of', {
                    defaultValue: '{{completed}} of {{total}} steps complete',
                    completed: roadmap.completedCount,
                    total: roadmap.totalCount,
                  })
                : t('home:goal_progress_no_roadmap', {
                    defaultValue: 'Build a roadmap to track progress toward your goal',
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


        {/* Refer & Earn promo card (product follow-up: "Remove refer from
            the career toolkit and replace it with Courses... the referral
            card should be placed after the today's challenge card. Let
            the referral card have a subtle light pink color and the text
            on it be black") -- ArtGiftBox is the same illustration
            ReferralProgram.tsx's own header uses, so this card previews
            the destination it links to.
            BUG FIX (product follow-up: "work on the dark mode for the
            referral card") -- the original fixed light-pink/black-text
            combo went low-contrast in dark mode; briefly fixed with an
            isDarkMode-picked plum/rose pair.
            REDESIGN (product follow-up: "The referral card background
            should be purple and black linear gradient instead of pink and
            the text should be white") -- the flat pink (or dark-mode
            plum) fill is gone; a purple-to-black diagonal LinearGradient
            now covers both themes with the exact same fixed look (product
            asked for one specific gradient look, not a per-theme pair),
            same "gradient as an absoluteFill decorative layer behind a
            plain-View content sibling" construction homeBannerFallback
            above already uses (a full-size LinearGradient sized only by
            flex doesn't reliably grow to wrap its own children's real
            height on every layout pass -- see that card's own comment for
            the full story). Purple end (#8B5CF6) is this app's existing
            accent-purple token (see ArtGiftBox's own box-body color, so
            the gradient and the illustration sitting on top of it share a
            family), fading to black. Text is unconditionally white now
            (no more isDarkMode branching) since it needs to read against
            the same gradient in both themes.
            Reuses referral_card_title/subtitle/cta -- already fully
            translated across all 12 languages from an earlier, now-
            orphaned Home layout, so no new i18n work needed here. */}
        {configService.isFeatureEnabled('referral_program') ? (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.referralCard}
            onPress={() => navigate('ReferralProgram')}>
            <LinearGradient
              colors={['#8B5CF6', '#000000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={[globalStyle.flexOne, styles.referralTextWrap]}>
              <Text category="h9" bold style={styles.referralText}>
                {t('home:referral_card_title', { defaultValue: 'Refer & Earn' })}
              </Text>
              <Text category="h10" mt={2} style={styles.referralText}>
                {t('home:referral_card_subtitle_short', { defaultValue: 'Invite a friend, get rewards' })}
              </Text>
              <Text category="h10" bold mt={8} style={styles.referralText}>
                {t('home:referral_card_cta', { defaultValue: 'Share your link' })}
              </Text>
            </View>
            <ArtGiftBox size={56} />
          </TouchableOpacity>
        ) : null}

        {/* "Next Steps" -- product follow-up: "the next step section at
            the bottom should still be there but it should lead to the
            what's next screen." ContinueLearningCard moved out of this
            stack (now at the top of Home, see above); its old slot here is
            now a permanent link into src/more/WhatsNext.tsx -- the app's
            actual "What's Next" feature (post-offer negotiation talking
            points, a pre-start checklist, and a 90-day settling-in plan).
            UpcomingSessionHomeCard ALSO moved out of this stack (product
            follow-up: "place [it] at the top beside the continue
            learning" -- see the horizontal row near the top of Home) --
            this is now just the single standing "What's Next" link, so it
            no longer needs recommendedStack's wrapping View or the
            visibility-gating the old pairing needed -- always renders now. */}
        <Text category="h8" bold mt={24} mb={12}>
          {t('home:recommended_for_you_label', { defaultValue: 'Next Steps' })}
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.whatsNextCard}
          onPress={() => navigate('WhatsNext')}>
          <View style={styles.whatsNextIconWrap}>
            <ArtWorkplaceCompass size={30} />
          </View>
          <View style={globalStyle.flexOne}>
            <Text category="h10" bold numberOfLines={1}>
              {t('more:whats_next_title', { defaultValue: "What's Next" })}
            </Text>
            <Text category="h10" status="placeholder" numberOfLines={1} mt={1}>
              {t('home:whats_next_home_card_subtitle', {
                defaultValue: 'Negotiation, pre-start checklist, and your first 90 days',
              })}
            </Text>
          </View>
          <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
        </TouchableOpacity>
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
  // Admin-configured Home banner (see the JSX comment above where this
  // renders). No `globalStyle.card` spread here -- no shadow, no opaque
  // backing fill -- since the real fill is either the admin's own image or
  // the code-drawn gradient inside homeBannerFallback below.
  homeBannerCard: {
    // width is computed per-render from actual screen width (see
    // homeBannerWidth above the component's return statement) and applied
    // inline, not here. No height here either -- either sub-variant
    // (homeBannerImageWrap or homeBannerFallback) sizes itself.
    // marginBottom (product report: "too close to the homebanner" --
    // the "Today's Career Focus" label right below only had its own
    // mt={4}, which is fine as top-of-screen spacing after the
    // verify-email banner but too tight once a real image/card sits
    // directly above it) gives this card its own breathing room
    // regardless of what follows, rather than bumping that label's mt
    // and disturbing the no-banner-shown spacing too.
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  // Real admin-uploaded image variant. Fixed aspect ratio rather than an
  // intrinsic-size Image so this card's height doesn't jump around between
  // an admin's differently-shaped uploads.
  homeBannerImageWrap: {
    width: '100%',
    aspectRatio: 2.4,
  },
  homeBannerImage: {
    width: '100%',
    height: '100%',
  },
  // Code-drawn fallback banner (see the JSX comment where this renders) --
  // a plain View, NOT a LinearGradient: the gradient is a decorative
  // absoluteFillObject layer behind this box's normal-flow content
  // instead, so this sizes correctly to wrap its real content height.
  homeBannerFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    padding: 16,
  },
  homeBannerIconWrap: {
    marginRight: 12,
  },
  homeBannerIcon: {
    width: 40,
    height: 40,
  },
  // Refer & Earn promo card (see the JSX comment above where this
  // renders). Fixed colors, not theme tokens -- product asked for one
  // specific gradient look regardless of app theme, same reasoning as
  // homeBannerFallback's own fixed white-on-color text above. No
  // `globalStyle.card` spread (product follow-up: "remove the box shadow
  // from the referral card") -- the fill is already opaque and visually
  // distinct from the screen background on its own, so the shadow was
  // pure extra weight, not something covering an invisible-card gap like
  // JobFitAnalysis.tsx's earlier fix.
  // `overflow: 'hidden'` added for the purple-to-black LinearGradient
  // redesign (see the JSX comment) -- clips the gradient's own square
  // corners to this card's borderRadius instead of the gradient's fill
  // poking past the rounded corners underneath them.
  referralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 16,
    marginTop: 16,
    overflow: 'hidden',
  },
  referralTextWrap: {
    marginRight: 14,
  },
  // Unconditionally white now (was an isDarkMode-branched pink/plum pair)
  // -- the purple-to-black gradient behind it is the same fixed look in
  // both themes, so the text no longer needs to vary either.
  referralText: {
    color: '#fff',
  },
  // MERGE (see the "place the career toolkit card and the today's career
  // focus card... in one container" comment at the call site) -- one
  // outer card now houses both the streak block and the Career Toolkit
  // icon row that each used to have their own separate `focusCard`/
  // `toolkitCard`. `globalStyle.card` supplies the shape (border is gone
  // app-wide now -- see that style's own "remove the border from all the
  // white cards" comment); this just adds the padding/fill on top.
  focusToolkitCard: {
    padding: 16,
    backgroundColor: 'background-basic-color-2',
  },
  // Dark-mode-only override (see the "remove the border and background...
  // Only in dark mode" comment at the call site) — light mode keeps the
  // tinted look above untouched.
  focusToolkitCardDark: {
    backgroundColor: 'transparent',
  },
  focusTextWrap: {
    marginLeft: 12,
  },
  // `flex: 1` so the bar fills the remaining row width next to its %
  // label (matches ProgressBar's own "measure my own width via onLayout"
  // design -- it needs a bounded parent, which flex:1 in a row provides).
  // height: 8 (up from the component's bare 4px default) -- product
  // report: "the height of the progress bar... is too tiny."
  focusProgressBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  // Matches focusProgressBar's own new height -- ProgressBar.tsx's inner
  // fill only picks this up via the separate `styleBar` prop, its own
  // `style` prop only reaches the outer track.
  focusProgressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  // Dedicated tap target (product ask: "there should be a button in that
  // card that will now trigger the suggested topic in the AI career coach
  // screen instead of the whole card") -- a light brand-blue-tinted pill,
  // same `color-primary-transparent-100` tint the old icon badges used to
  // use before the gradient redesign, now repurposed here as a button
  // background instead of an icon backdrop.
  askCoachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'color-primary-transparent-100',
  },
  askCoachButtonText: {
    color: '#0063f8',
  },
  askCoachButtonArrow: {
    tintColor: '#0063f8',
    marginLeft: 'auto',
  },
  // Internal section break between the streak block and the Career
  // Toolkit icons now that both live inside one merged container -- a
  // plain hairline, not a card border (see globalStyle.card's own border
  // removal comment for why the outer card itself doesn't use one).
  toolkitDivider: {
    height: 1,
    backgroundColor: 'rgba(128,128,128,0.15)',
    marginTop: 16,
    marginBottom: 16,
  },
  // "Quick Actions" row -- 4 plain icon-in-a-badge + label items (see the
  // JSX comment above for why this deliberately doesn't reuse
  // QuickActionGrid.tsx's heavier bento tiles).
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
  // Product follow-up: "they are looking ok but you need to increase their
  // sizes" -- was 26x26 (a touch under globalStyle.icon20's 28x28, on the
  // theory a full-color illustrated icon reads visually heavier than a
  // thin Eva glyph at the same size). That theory undershot -- bumped up
  // past icon20 instead of just back to it.
  quickActionIcon: {
    width: 38,
    height: 38,
  },
  // "Your Progress" Progress Toward Goal card -- ring on the left, title +
  // two lines of real supporting copy on the right (see the effects above
  // for where roadmapPercent actually comes from).
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'background-basic-color-2',
  },
  progressTextWrap: {
    marginLeft: 14,
  },
  // Same compact single-row white card shape as ContinueLearningCard.tsx/
  // UpcomingSessionHomeCard.tsx's own `card` style (see those files'
  // comments for the full "why white/why this radius" history) -- kept as
  // a plain inline style here rather than a shared import since this is
  // the only place on Home that needs this exact look for a static (never
  // self-hiding) link card.
  whatsNextCard: {
    ...globalStyle.card,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'background-basic-color-2',
  },
  whatsNextIconWrap: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
