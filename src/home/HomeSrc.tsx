import React, { memo } from 'react';
import { Alert, AppState, Image, ImageStyle, InteractionManager, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleService, useStyleSheet, useTheme, Icon, Button, Spinner } from '@ui-kitten/components';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';

import Content, { CONTENT_PADDER } from 'components/Content';
import Container from 'components/Container';
import HeaderHome from './Components/HeaderHome';
import AnnouncementBanner from './AnnouncementBanner';
import ActionCard from 'components/ActionCard';
import * as dailyChallengeService from 'services/dailyChallengeService';
import { DailyChallenge } from 'services/dailyChallengeService';
import * as gamificationService from 'services/gamificationService';
import { GamificationStreakProps } from 'constants/Types';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from 'navigation/types';
import Text from 'components/Text';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { AdvertisementProps, EKeyAsyncStorage, accountScopedKey } from 'constants/Types';
import * as notificationService from 'services/notificationService';
import * as adsService from 'services/adsService';
import * as jobShareService from 'services/jobShareService';
import * as roadmapService from 'services/roadmapService';
import { CareerRoadmap as CareerRoadmapPlan } from 'services/roadmapService';
// Task: "The scheduled interview card is not displaying in the homescreen"
// -- turned out to be an intentional removal, not a bug (see the SYMPHONY
// REDESIGN comment at this file's 4-card render block for the full story).
// Per explicit product follow-up ("Add as a 5th card... Same ActionCard
// style as the current 4... appearing only when a real session is
// scheduled -- invisible otherwise"), re-added as a 5th ActionCard here
// rather than remounting UpcomingSessionHomeCard.tsx's own bespoke solid-
// blue row component (that component stays on disk unused, same
// rollback-point convention the redesign comment describes) -- its
// data-fetch/gating logic (isSessionReady, the not-ready alert, the
// delete-with-confirm flow) is duplicated here in ActionCard's shape
// instead, so this card visually matches the other 4 exactly.
import * as scheduledInterviewService from 'services/scheduledInterviewService';
import { getInterviewTypeLabel } from 'utils/interviewTypeLabels';
import { navigateToJobAlertDetails } from 'navigation/navigationRef';
import AdPopupModal from 'components/AdPopupModal';
import AppTour from 'components/AppTour';
import AppRatingModal from 'components/AppRatingModal';
import DailyCheckInSheet, { DailyCheckInMode } from 'components/DailyCheckInSheet';
import PeriodicCheckInSheet from 'components/PeriodicCheckInSheet';
import * as appRatingService from 'services/appRatingService';
import * as dailyCheckinService from 'services/dailyCheckinService';
import * as shareIntentService from 'services/shareIntentService';
import * as studentCheckinService from 'services/studentCheckinService';
import { StudentCheckIn } from 'services/studentCheckinService';
import useModal from 'hooks/useModal';
import { Images } from 'assets/images';
import ThemeContext from '../../ThemeContext';
import { AuthContext } from '../../AuthContext';
import * as configService from 'services/configService';
import { localizeDigits } from 'utils/formatNumber';

// Defined at module scope (not inline in JSX) so it's a stable component
// reference across renders — see Subscription.tsx's renderCheckoutSpinner
// for the same reasoning.
const renderCheckInSpinner = () => <Spinner size="tiny" status="control" />;

// Same type -> icon mapping src/more/CareerRoadmap.tsx's own ICONS_BY_TYPE
// uses (kept as a separate module-level constant here rather than a
// shared import — this is a 4-entry decorative lookup, not worth adding a
// cross-file dependency for) — used by missionHero's roadmap-step tier
// below to pick a real, type-appropriate icon instead of one generic
// glyph for every step.
const ROADMAP_STEP_ICONS: Record<string, string> = {
  skill: 'book-outline',
  project: 'briefcase-outline',
  interview: 'mic-outline',
  milestone: 'flag-outline',
};

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
  const theme = useTheme();
  const { theme: appTheme } = React.useContext(ThemeContext);
  const isDarkMode = appTheme === 'dark';
  const { width } = useWindowDimensions();
  // `i18n` needed for the scheduled-interview card's locale-aware date/time
  // formatting below (same i18n.language-not-undefined fix
  // UpcomingSessionHomeCard.tsx's own comment explains -- passing
  // `undefined` to toLocaleString falls back to the device's OS locale
  // rather than the language the user actually picked inside the app).
  const { t, i18n } = useTranslation(HOME_I18N_NAMESPACES);
  const { isSignedIn, emailVerified, resendVerificationEmail, refreshEmailVerified, profile, isPremium } =
    React.useContext(AuthContext);

  // Home redesign (product follow-up: shown a wellness-app reference —
  // soft gradient "score" hero card with a progress ring + stat chips,
  // a "Today's plan" row, and quiet pastel-tinted action rows grouped
  // under "More for you" — "I love this UI, use this UI and layout, let's
  // see"). This replaces the previous stack of full-width dark-gradient
  // hero cards (Career Coach / Dream Company Dashboard / Refer & Earn, see
  // git history) with that structure, built from real data instead of the
  // reference's placeholder numbers. The Fortune-500 logo stack the old
  // Dream Company Dashboard card had doesn't fit this row-based "More for
  // you" format and is dropped here (constants/Data.ts's
  // dreamCompanyLogoNames is still there if a future pass wants it back).
  //
  // RESTRUCTURE (product follow-up, home-screen layout review: "Remove the
  // career tool kit from the whole card and place it immediately after
  // homebanner. And then remove the todays focus content totally") — the
  // "Today's Career Focus" streak hero (mic icon, "X days" headline,
  // streak-toward-7-days progress bar, "Ask Your Career Coach" button) is
  // gone from Home entirely, not moved elsewhere — see git history for its
  // full prior implementation if a future pass wants it back. That also
  // retires the streak fetch/state that only ever fed this block (GET
  // /api/v1/gamification/streak, services/gamificationService.ts) —
  // Leaderboard.tsx's own streak card is untouched, it has its own
  // independent fetch of the same endpoint. Career Toolkit is still here,
  // just as its own standalone section now (see the JSX below) instead of
  // living inside this same card.
  const [roadmap, setRoadmap] = React.useState<CareerRoadmapPlan | null>(null);
  // Product request: "I want skeleton loader in app" — "Career Progress"
  // below used to just show 0% momentarily on every load (indistinguishable
  // from a real "no roadmap yet" state) until this fetch resolved. Starts
  // true so the real ring only ever appears once there's a real answer,
  // never a misleading 0% flash.
  const [roadmapLoading, setRoadmapLoading] = React.useState(true);
  React.useEffect(() => {
    // BUG FIX (product report: "The AI roadmap is a premium plan but users
    // are accessing it when they click on it from the notification center
    // or trail... Features that are pro and pro premium should not be
    // accessible") -- Roadmap is now Premium end to end (see
    // src/more/CareerRoadmap.tsx and Saveur-Backend's career_roadmap.py),
    // so this card should never call the now-require_premium-gated GET
    // /api/v1/roadmap for a non-Premium user in the first place. Skipping
    // the fetch entirely (rather than letting it 402 and silently fall
    // back, which happened to work but wasn't the intent) means a free
    // user's "Progress Toward Goal" ring always shows the honest 0% /
    // "build a roadmap" nudge, never a flash of real milestone data.
    if (!isSignedIn || !isPremium) {
      setRoadmapLoading(false);
      return;
    }
    roadmapService.getSavedRoadmap().then(setRoadmap).catch(() => {
      // Non-critical -- "Progress Toward Goal" just falls back to an
      // honest 0% / "build your roadmap" nudge below rather than a broken
      // state on a failed fetch.
    }).finally(() => setRoadmapLoading(false));
  }, [isSignedIn, isPremium]);
  const roadmapPercent = roadmap && roadmap.totalCount > 0
    ? Math.round((roadmap.completedCount / roadmap.totalCount) * 100)
    : 0;
  // Real current step, if any -- the mission hero's own fallback chain
  // (see missionHero below) reads this when there's no daily challenge to
  // show today.
  const currentRoadmapStep = React.useMemo(
    () => roadmap?.steps.find(s => s.status === 'current') ?? null,
    [roadmap],
  );

  // HOME REDESIGN (product reference — a rich "Today's Mission" hero card
  // at the very top of Home). Priority chain, each one a real, honest
  // source (see MissionHeroCard.tsx's own comment on why there's no
  // fabricated time/difficulty field): (1) today's Daily Challenge, if the
  // feature's on and one exists — this is the only genuinely "today"-
  // scoped content Home has; (2) the current AI Career Roadmap step, if
  // the user has an active roadmap; (3) a generic "ask your coach"
  // fallback when neither exists (e.g. a brand-new account). Same
  // best-effort/fail-open convention as every other Home fetch on this
  // screen (roadmap above, career events below).
  const [dailyChallenge, setDailyChallenge] = React.useState<DailyChallenge | null>(null);
  const [dailyChallengeLoading, setDailyChallengeLoading] = React.useState(true);
  const fetchDailyChallenge = React.useCallback(() => {
    if (!isSignedIn || !configService.isFeatureEnabled('daily_challenge')) {
      setDailyChallengeLoading(false);
      return;
    }
    dailyChallengeService.getTodayChallenge().then(setDailyChallenge).catch(() => {
      // Non-critical -- missionHero below just falls through to the next
      // item in the priority chain.
    }).finally(() => setDailyChallengeLoading(false));
  }, [isSignedIn]);
  React.useEffect(() => { fetchDailyChallenge(); }, [fetchDailyChallenge]);

  // Streak -- feeds the "Current Streak" stat mini-card below the hero.
  // Independent fetch from Leaderboard.tsx's own (same endpoint, GET
  // /api/v1/gamification/streak) -- this screen and that one don't share
  // state, same as every other duplicated-fetch pair already in this app.
  const [streak, setStreak] = React.useState<GamificationStreakProps | null>(null);
  React.useEffect(() => {
    if (!isSignedIn) return;
    gamificationService.getStreak().then(setStreak).catch(() => {
      // Non-critical -- the streak stat card below just falls back to 0.
    });
  }, [isSignedIn]);

  // Scheduled-interview 5th card (see the import comment above for the
  // full "why"). Fetched on every focus, same convention
  // UpcomingSessionHomeCard.tsx's own load() uses, so returning to Home
  // after scheduling (or deleting) a session from elsewhere always shows
  // the current state rather than a stale one from mount time. No loading
  // flag here (unlike that component's skeleton row) -- this card is net-
  // new content, not a layout slot that was already reserving space, so
  // simply popping in once the fetch resolves reads fine; a blank gap
  // beforehand isn't a regression the way it would be for a card users
  // already expect to see immediately.
  const [nextSession, setNextSession] = React.useState<
    Awaited<ReturnType<typeof scheduledInterviewService.listUpcoming>>[number] | undefined
  >(undefined);
  const loadNextSession = React.useCallback(() => {
    return scheduledInterviewService.listUpcoming().then(list => setNextSession(list[0]));
  }, []);
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      scheduledInterviewService.listUpcoming().then(list => {
        if (!cancelled) setNextSession(list[0]);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

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

  // OS Share Sheet integration (product request: "Ability to share files
  // to Saveur from the device and it will go directly to the document
  // section of the app") — App.tsx's own effects only ever CAPTURE a share
  // (see shareIntentService.setPendingSharedFiles, called from both the
  // Android live-event path and the iOS saveur://shared-import relaunch
  // path) since the navigator/auth state may not exist yet on a cold
  // start, same reasoning as the shared-job deep link and the daily
  // check-in reflection prompt above. Checked on every focus, not just
  // mount — a share tapped while the app is already sitting on Home
  // wouldn't remount this component at all.
  useFocusEffect(
    React.useCallback(() => {
      shareIntentService.getAndClearPendingSharedFiles().then(files => {
        if (files.length) {
          navigate('MyDocuments', {pendingImport: files});
        }
      });
    }, [navigate]),
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

  // Mission hero content -- priority chain described above
  // (dailyChallenge -> currentRoadmapStep -> generic coach fallback).
  // Gated on both loading flags together so this never flashes one tier's
  // content and then swaps to another once the slower of the two fetches
  // resolves (same "no misleading flash" convention as roadmapLoading's
  // own comment above).
  const missionHeroLoading = roadmapLoading || dailyChallengeLoading;
  const missionHero = React.useMemo(() => {
    if (dailyChallenge && !dailyChallenge.skipped) {
      // BUG FIX (product report, with screenshot: "why are we having code
      // challenge twice and why is it have an underscore") -- title and
      // the Focus meta stat below it were both rendering the exact same
      // raw "Coding_problem" text. Two separate bugs stacked: (1)
      // `.split(' ')` doesn't touch a snake_case backend slug like
      // "coding_problem" -- there's no space to split on, so only the
      // very first character of the whole string got capitalized; (2)
      // showing that value as both the card's bold title AND the "Focus"
      // stat right below it was a plain duplicate regardless of
      // formatting. Fixed by (1) reusing the same config-driven id ->
      // translated `name` lookup DailyChallengeScreen.tsx already uses
      // (daily_challenge.types, admin-configured and pre-translated
      // server-side for the current locale -- configService.ts sends the
      // active i18n language on every config fetch), falling back to a
      // real snake_case-aware formatter only if the id isn't in the
      // current config; and (2) giving the card its own generic title so
      // it no longer repeats the Focus stat -- matching the roadmap/coach
      // branches below, where title and metaLeft are always two distinct
      // pieces of information, never the same string twice.
      const typeLabel =
        configService.getCachedConfig().daily_challenge.types.find(tt => tt.id === dailyChallenge.challengeType)?.name ??
        dailyChallenge.challengeType
          .split('_')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      return {
        badgeIcon: 'flag-outline',
        badgeLabel: t('home:mission_badge', { defaultValue: "Today's Mission" }),
        title: t('home:mission_challenge_title', { defaultValue: 'Daily Challenge' }),
        subtitle: dailyChallenge.promptText,
        metaLeft: { icon: 'bulb-outline', label: t('home:mission_type_label', { defaultValue: 'Focus' }), value: typeLabel },
        metaRight: { icon: 'award-outline', label: t('home:mission_reward_label', { defaultValue: 'Reward' }), value: localizeDigits(t('home:mission_xp_value', { defaultValue: '+{{xp}} XP', xp: dailyChallenge.xpAwarded })) },
        progressPercent: dailyChallenge.completed ? 100 : 0,
        progressLabel: t('home:mission_progress_label', { defaultValue: 'Progress' }),
        ctaLabel: dailyChallenge.completed
          ? t('home:mission_cta_completed', { defaultValue: 'View Challenge' })
          : t('home:mission_cta_start', { defaultValue: 'Start Here' }),
        ctaIcon: dailyChallenge.completed ? 'checkmark-circle-2-outline' : 'play-circle-outline',
        // SYMPHONY REDESIGN follow-up (product request, with reference
        // image: "replace the icons used for the daily challenge... with
        // these icons") -- only this branch gets the new full-color
        // gradient icon; the roadmap-step and generic-coach-nudge
        // branches below keep their existing tinted eva icon, since the
        // product ask specifically named "Daily Challenge."
        // BUG FIX (product report: "the explore is the one thats supposed
        // to have the list icon and the daily challenge supposed to have
        // the lightning icon you need to correct that") -- was
        // iconListStack; swapped with Explore's own icon below.
        heroIconImage: Images.iconLightning,
        onPress: () => navigate('DailyChallenge'),
      };
    }
    if (roadmap && currentRoadmapStep) {
      return {
        badgeIcon: 'flag-outline',
        badgeLabel: t('home:mission_badge_roadmap', { defaultValue: 'Your Next Step' }),
        title: currentRoadmapStep.title,
        subtitle: currentRoadmapStep.description,
        metaLeft: { icon: ROADMAP_STEP_ICONS[currentRoadmapStep.type] ?? 'flag-outline', label: t('home:mission_step_label', { defaultValue: 'Step' }), value: localizeDigits(t('home:mission_step_value', { defaultValue: '{{order}} of {{total}}', order: currentRoadmapStep.order, total: roadmap.totalCount })) },
        metaRight: { icon: 'flag-outline', label: t('home:mission_goal_label', { defaultValue: 'Goal' }), value: roadmap.targetRole },
        progressPercent: roadmapPercent,
        progressLabel: t('home:mission_progress_label', { defaultValue: 'Progress' }),
        ctaLabel: t('home:mission_cta_roadmap', { defaultValue: 'Continue Roadmap' }),
        ctaIcon: 'play-circle-outline',
        heroIconImage: undefined,
        onPress: () => navigate('CareerRoadmap'),
      };
    }
    return {
      badgeIcon: 'message-circle-outline',
      badgeLabel: t('home:mission_badge_coach', { defaultValue: 'AI Career Coach' }),
      title: t('home:coach_hero_title', { defaultValue: 'Ask your AI Career Coach' }),
      subtitle: t('home:coach_hero_subtitle', { defaultValue: 'Resume feedback, interview prep, salary advice — anytime' }),
      metaLeft: { icon: 'clock-outline', label: t('home:mission_available_label', { defaultValue: 'Available' }), value: t('home:mission_available_value', { defaultValue: '24/7' }) },
      metaRight: { icon: 'flash-outline', label: t('home:mission_response_label', { defaultValue: 'Response' }), value: t('home:mission_response_value', { defaultValue: 'Instant' }) },
      progressPercent: undefined,
      progressLabel: undefined,
      ctaLabel: t('home:mission_cta_coach', { defaultValue: 'Ask Now' }),
      ctaIcon: 'message-circle-outline',
      heroIconImage: undefined,
      onPress: () => navigate('MainBottomTab', { screen: 'Coach' }),
    };
  }, [dailyChallenge, roadmap, currentRoadmapStep, roadmapPercent, t, navigate]);

  const onPressCoachSend = React.useCallback(() => {
    navigate('MainBottomTab', { screen: 'Coach' });
  }, [navigate]);
  const onPressPractice = React.useCallback(() => {
    navigate('MainBottomTab', { screen: 'Practice' });
  }, [navigate]);
  const onPressExploreMore = React.useCallback(() => {
    navigate('MainBottomTab', { screen: 'Profile', params: { screen: 'MoreSrc' } });
  }, [navigate]);

  // Scheduled-interview 5th card handlers -- same gating/confirm logic as
  // UpcomingSessionHomeCard.tsx's own onPress/onDelete (see that file for
  // the original product reports each behavior traces back to: "should not
  // navigate anywhere until the date of the session reaches" for the
  // isSessionReady gate, "User should be able to delete an upcoming
  // interview session" for onDelete's confirm-then-optimistically-remove
  // flow), just re-pointed at this screen's own nextSession/setNextSession
  // state instead of that component's.
  const isNextSessionReady = !!nextSession && Date.now() >= nextSession.scheduledAt;
  const onPressScheduledSession = React.useCallback(() => {
    if (!nextSession) return;
    if (!isNextSessionReady) {
      Alert.alert(
        t('home:upcoming_session_not_ready_title', { defaultValue: 'Not quite time yet' }),
        t('home:upcoming_session_not_ready_body', {
          defaultValue: 'This session unlocks at {{time}}.',
          time: new Date(nextSession.scheduledAt).toLocaleString(i18n.language, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }),
        }).toString(),
      );
      return;
    }
    navigate('MockInterviewSetup', {
      interviewType: nextSession.interviewType,
      mode: nextSession.mode,
      difficulty: nextSession.difficulty,
      role: nextSession.role,
      company: nextSession.company,
      durationMin: nextSession.durationMin,
    });
  }, [nextSession, isNextSessionReady, navigate, t, i18n.language]);
  const onDeleteScheduledSession = React.useCallback(() => {
    if (!nextSession) return;
    const id = nextSession.id;
    Alert.alert(
      t('home:upcoming_session_delete_confirm_title', { defaultValue: 'Cancel this session?' }),
      t('home:upcoming_session_delete_confirm_body', { defaultValue: 'You can always schedule a new one later.' }).toString(),
      [
        { text: t('common:cancel', { defaultValue: 'Cancel' }).toString(), style: 'cancel' },
        {
          text: t('common:delete', { defaultValue: 'Delete' }).toString(),
          style: 'destructive',
          onPress: async () => {
            setNextSession(undefined);
            try {
              await scheduledInterviewService.removeScheduled(id);
              loadNextSession();
            } catch {
              loadNextSession(); // resync if the delete actually failed server-side
            }
          },
        },
      ],
    );
  }, [nextSession, t, loadNextSession]);

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
        {/* SYMPHONY REDESIGN (explicit product request, with reference
            screenshots: "that homescreen has too much content... make it
            simple... just have 3 or 4 horizontal cards, that's enough...
            you don't have to retain the contents there, recreate and
            determine the contents in each card"). This replaces the entire
            prior multi-section body — a "For You" shortcut-pill row, a
            separate Career Fairs & Events row, StatStrip, CoachPromptCard,
            and a collapsed 3-card "Continue/Upcoming" row (see git history
            for that full v3-v6 layout and every one of its own past
            product-driven iterations) — with exactly 4 plain launcher
            cards (components/ActionCard.tsx), matching the reference app's
            own simple full-width row-card home screen:
              1. Today's Focus — the existing real priority chain (today's
                 Daily Challenge -> current AI Career Roadmap step -> a
                 generic coach nudge), unchanged (see missionHero above),
                 just rendered in the new plain card shape instead of
                 MissionHeroCard's richer badge/meta/progress-ring layout.
              2. AI Career Coach — always-visible entry point into Chat
                 (previously only ever showed via CoachPromptCard/the
                 mission-hero's own fallback tier).
              3. Practice Interviews — into the Practice tab, subtitle shows
                 the real streak (gamificationService.getStreak(), fetched
                 above) when there is one.
              4. Explore More — into the More/Profile tab, now the home for
                 everything else (Job Alerts, Resume Builder, Career
                 Roadmap, etc. — see MoreSrc.tsx).
            Career Fairs & Events (still real, still fetched elsewhere) and
            the Continue/Upcoming-session cards are no longer surfaced on
            Home at all — the former stays reachable from Networking
            Assistant (More menu), the latter's own screens
            (UpcomingSessionHomeCard/ContinueLearningCard/NextLessonHomeCard)
            stay on disk unused, same rollback-point convention every prior
            Home redesign in this file's history has followed.
            The admin-configured marketing banner (homeBanner below) and
            the time-sensitive verify-email banner are UNCHANGED — neither
            is "content clutter" in the sense being simplified here, they're
            a conditional admin feature and an account-status prompt. */}
        {/* Admin-configured Home banner (see the effect above for the full
            "why" + how this differs from AnnouncementBanner, which sits
            above HeaderHome and is a separate plain-text feature). Was
            commented out and sitting lower, right above the 4 launcher
            cards; product follow-up (with a reference screenshot of a
            dark, icon-badge-style card) asked for it to actually "appear
            at the top" and be redesigned to look like that reference — so
            it's now the very first thing inside the scrollable Content
            (ahead of even the verify-email banner), and the code-drawn
            fallback below is a fixed dark card (icon chip + "Ad" pill on
            one row, bold title + subtitle below) instead of the old
            theme-following primary-color gradient strip, so it reads as a
            deliberately distinct, eye-catching placement the way the
            reference card does, in both light and dark app themes. Only
            shows once a real, active placement="home_banner" ad exists —
            no banner at all until the admin creates one, and a tap always
            has real content to navigate AdDetails to. */}
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
              // REVERTED (explicit product follow-up: "lets just leave the
              // homebanner the way it is before lets not make it image one
              // side and caption the otherside anymore") — back to the
              // icon+Ad-pill sharing a top row, with title/subtitle
              // stacked full-width below, same as before the icon-left/
              // caption-right redesign.
              <View style={styles.homeBannerFallback}>
                <View style={styles.homeBannerTopRow}>
                  <View style={styles.homeBannerIconWrap}>
                    <Image
                      source={Images.logoMark}
                      style={styles.homeBannerIcon as ImageStyle}
                      resizeMode="contain"
                      tintColor="#FFFFFF"
                    />
                  </View>
                  <View style={styles.homeBannerAdPill}>
                    <Text category="h10-s" bold style={styles.homeBannerAdPillText}>
                      {t('home:banner_ad_label', { defaultValue: 'Ad' })}
                    </Text>
                  </View>
                </View>
                {homeBanner.title ? (
                  <Text category="h8" bold numberOfLines={1} mt={12} style={styles.homeBannerTitle}>
                    {homeBanner.title}
                  </Text>
                ) : null}
                {homeBanner.body ? (
                  <Text category="h10" numberOfLines={2} mt={4} style={styles.homeBannerBody}>
                    {homeBanner.body}
                  </Text>
                ) : null}
              </View>
            )}
          </TouchableOpacity>
        ) : null}

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

        {/* The 4 cards (see this section's own module-level comment above
            for the full "why"). Card 1 is the only dynamic one — the same
            real priority chain (daily challenge -> roadmap step -> generic
            coach nudge) this screen has always computed, just rendered
            plainly now instead of through MissionHeroCard's richer layout. */}
        {missionHeroLoading ? (
          <View style={styles.cardLoading}>
            <Spinner status="primary" />
          </View>
        ) : (
          <ActionCard
            icon={missionHero.ctaIcon ?? missionHero.badgeIcon}
            iconImage={missionHero.heroIconImage}
            title={missionHero.title}
            subtitle={missionHero.subtitle}
            onPress={missionHero.onPress}
          />
        )}

        {/* SYMPHONY REDESIGN follow-up (product request, with 4 reference
            icon images: "replace the icons used for the daily challenge,
            AI Career Coach, Practice and Explore with these icons") --
            each of these 3 always-visible cards gets its own full-color
            gradient icon now instead of a tinted eva glyph (see
            components/ActionCard.tsx's `iconImage` prop). */}
        <ActionCard
          icon="message-circle-outline"
          iconImage={Images.iconCoachChatBlue}
          title={t('home:coach_card_title', { defaultValue: 'AI Career Coach' })}
          subtitle={t('home:coach_hero_subtitle', { defaultValue: 'Resume feedback, interview prep, salary advice — anytime' }).toString()}
          onPress={onPressCoachSend}
        />

        {/* Product request, exact CSS spec: "give the practice card... a
            linear gradient of these colors: linear-gradient(15deg, #45009d
            20%, #8c00e5)" — see ActionCard's own gradientColors comment for
            how the 15deg angle and the "20%" stop are honored, not just
            approximated. Only this card gets it; the other 3 keep their
            normal plain card background.
            FOLLOW-UP (product report: "make the practice linear gradient
            one color reduce the darker color") — was locations={[0.2, 1]},
            a flat 20%-long block of the dark #45009D before it ever starts
            blending toward the lighter #8C00E5. locations={[0, 1]} instead
            starts that blend from the very first pixel, so the dark color
            never holds as its own solid patch — the card reads as
            overwhelmingly the lighter purple with just a soft dark edge,
            not a hard two-tone split.
            FOLLOW-UP (same message: "change the icon to a white line
            icon") — was iconImage={Images.iconAiStars}, a full-color
            gradient illustration (can't be tinted, see that prop's own
            comment) — dropped so this falls through to the plain `icon`
            eva glyph below instead, which ActionCard already renders in
            solid white on the gradient variant.
            FOLLOW-UP (product request: "change the linear gradient for the
            practice card... to orange lineargradient instead of purple") —
            was ['#45009D', '#8C00E5'] (dark purple -> light purple). Same
            dark-to-light two-stop shape, same locations={[0,1]} blend and
            15deg angle (both still just props on ActionCard, unaffected by
            a color swap), just an orange pair instead: #C2410C (a deep
            burnt orange) -> #FB923C (a lighter warm orange). */}
        <ActionCard
          icon="mic-outline"
          title={t('home:practice_card_title', { defaultValue: 'Practice Interviews' })}
          subtitle={
            streak && streak.streakDays > 0
              ? localizeDigits(t('home:practice_card_subtitle_streak', { defaultValue: '{{count}}-day streak — keep it going', count: streak.streakDays }))
              : t('home:practice_card_subtitle_default', { defaultValue: 'Sharpen your skills with a mock interview' }).toString()
          }
          onPress={onPressPractice}
          gradientColors={['#FB923C', '#FB923C']}
          gradientLocations={[0, 1]}
        />

        {/* BUG FIX (product report: "the explore is the one thats supposed
            to have the list icon and the daily challenge supposed to have
            the lightning icon you need to correct that") -- was
            iconCoachChatBlue, swapped with the Daily Challenge card's
            heroIconImage above.
            FOLLOW-UP (product request: "give the Explore Card... the
            default blue background and the icons white just the way we
            did for Practice card") -- same treatment as the Practice card
            above: gradientColors set to the app's real primary blue
            (color-primary-500, #0063F8) repeated as both stops, a flat
            solid fill via ActionCard's gradient path rather than an actual
            two-tone blend, matching Practice's own flat single-color
            gradient. iconImage dropped -- it was Images.iconListStack, a
            full-color illustration that can't be tinted (see ActionCard's
            iconImage prop comment) -- so this now falls through to the
            plain `icon="grid-outline"` eva glyph, which ActionCard already
            renders solid white whenever gradientColors is set. */}
        <ActionCard
          icon="grid-outline"
          title={t('home:explore_card_title', { defaultValue: 'Explore More' })}
          subtitle={t('home:explore_card_subtitle', { defaultValue: 'Resume builder, job alerts, career tools & more' }).toString()}
          onPress={onPressExploreMore}
          gradientColors={['#0063F8', '#0063F8']}
          gradientLocations={[0, 1]}
        />

        {/* 5th card, conditional (see the import comment above this
            component for the full "why") -- renders nothing at all when
            there's no real scheduled session, so Home looks exactly like
            the current 4-card layout for every user who hasn't scheduled
            one, matching the explicit "invisible otherwise" product
            answer. trailing carries BOTH the not-ready lock/ready arrow
            indicator AND the delete "x" affordance side by side (rather
            than picking one, the way a single absolutely-positioned corner
            button on UpcomingSessionHomeCard.tsx's own bespoke layout
            had to) -- ActionCard's trailing slot is a plain inline node,
            so there's room for both without any of that component's own
            absolute-position clipping concerns. */}
        {nextSession ? (
          <ActionCard
            icon="calendar-outline"
            title={getInterviewTypeLabel(nextSession.interviewType, t)}
            subtitle={new Date(nextSession.scheduledAt).toLocaleString(i18n.language, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
            onPress={onPressScheduledSession}
            trailing={
              <Flex itemsCenter>
                <Icon
                  pack="eva"
                  name={isNextSessionReady ? 'chevron-right-outline' : 'lock-outline'}
                  style={[styles.chevron, { tintColor: theme['color-basic-400'] }]}
                />
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={onDeleteScheduledSession}
                  style={styles.scheduledDeleteButton}>
                  <Icon pack="eva" name="close-outline" style={[globalStyle.icon16, { tintColor: theme['color-basic-400'] }]} />
                </TouchableOpacity>
              </Flex>
            }
          />
        ) : null}
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
  // Scheduled-interview 5th card's trailing slot (see that card's own
  // comment) -- matches ActionCard's own `chevron` style exactly (same
  // 18x18/marginLeft: 6) so the lock/ready icon lines up identically to
  // the plain chevron the other 4 cards show, just with a delete button
  // stacked below it instead of nothing.
  chevron: {
    width: 18,
    height: 18,
    marginLeft: 6,
  },
  scheduledDeleteButton: {
    marginTop: 6,
  },
  // Google-style pass: converted from a white card with a colored border
  // to a real Material 3 "error/warning container" -- a pale flat tonal
  // fill in the warning hue, no border at all -- the same tonal-surface
  // language now used throughout this screen (see QuickActionGrid.tsx's
  // own comment), rather than the outlined-card treatment other design
  // systems favor for alerts.
  verifyBanner: {
    borderRadius: 16,
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
    borderRadius: 16,
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
  // a plain View, NOT a LinearGradient: a solid fixed color (not a real
  // gradient) here, so no absoluteFill-layer trick is needed the way
  // ActionCard's gradient variant needs one. Fixed near-black
  // (deliberately NOT theme-conditional — meant to stand out as its own
  // distinct placement in both light and dark app themes, same reasoning
  // as the Home Practice card's own fixed gradient).
  // REVERTED (explicit product follow-up: "lets just leave the homebanner
  // the way it is before lets not make it image one side and caption the
  // otherside anymore") — back to icon+Ad-pill sharing a row ABOVE a
  // full-width title/subtitle block, undoing the icon-left/text-right
  // redesign.
  homeBannerFallback: {
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    padding: 16,
    backgroundColor: '#14141C',
  },
  homeBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  homeBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  homeBannerIcon: {
    width: 20,
    height: 20,
  },
  homeBannerAdPill: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  homeBannerAdPillText: {
    color: 'rgba(255,255,255,0.8)',
  },
  homeBannerTitle: {
    color: '#FFFFFF',
  },
  homeBannerBody: {
    color: 'rgba(255,255,255,0.72)',
  },
  // SYMPHONY REDESIGN — placeholder shown only for the brief window before
  // missionHeroLoading resolves, sized/shaped to match the real ActionCard
  // it's standing in for (see components/ActionCard.tsx's own `card` style)
  // rather than the old richer MissionHeroCard footprint this used to
  // reserve space for.
  cardLoading: {
    ...globalStyle.card,
    height: 72,
    marginBottom: 12,
    backgroundColor: 'background-basic-color-2',
    borderWidth: 1,
    borderColor: 'border-card-default',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
