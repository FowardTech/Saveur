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
import CareerFairEventCard from './CareerFairEventCard';
import { SkeletonHomeCardRow } from 'components/Skeleton';
import NextLessonHomeCard from './NextLessonHomeCard';
import AnnouncementBanner from './AnnouncementBanner';
import { ArtGiftBox, ArtWorkplaceCompass } from './HomeHeroArt';
import StatStrip from 'components/StatStrip';
import ActionCard from 'components/ActionCard';
import CoachPromptCard from 'components/CoachPromptCard';
import * as dailyChallengeService from 'services/dailyChallengeService';
import { DailyChallenge } from 'services/dailyChallengeService';
import * as gamificationService from 'services/gamificationService';
import { GamificationStreakProps } from 'constants/Types';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from 'navigation/types';
import Text from 'components/Text';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { AdvertisementProps, CareerEventProps, EKeyAsyncStorage, accountScopedKey } from 'constants/Types';
import * as notificationService from 'services/notificationService';
import * as adsService from 'services/adsService';
import * as jobShareService from 'services/jobShareService';
import * as roadmapService from 'services/roadmapService';
import { CareerRoadmap as CareerRoadmapPlan } from 'services/roadmapService';
import * as careerEventsService from 'services/careerEventsService';
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

  // Product request: "targeted career fairs and events card to display
  // under the continue & Upcoming cards... maximum of 4 recently posted
  // event/career fair cards." listCareerEvents() already returns
  // soonest-event-first (see careerEventsService.ts's own docstring), which
  // isn't the same ordering as "recently posted" — re-sorted by createdAt
  // (when THIS APP discovered it, not when the event itself happens)
  // descending, then capped at 4, so this preview genuinely shows the
  // newest finds rather than whichever happens to be soonest. Self-fetched
  // here (not a separate self-contained card component like
  // ContinueLearningCard/UpcomingSessionHomeCard above) since HomeSrc
  // already owns list-fetching for its other sections (e.g. roadmap right
  // above) — CareerFairEventCard itself stays a plain presentational card.
  const [careerEvents, setCareerEvents] = React.useState<CareerEventProps[]>([]);
  // Product request: "I want skeleton loader in app" — without this, the
  // whole "Career Fairs & Events" section (title included, see its
  // `careerEvents.length > 0` gate below) just doesn't exist at all until
  // the very first fetch resolves, so a user who genuinely has events
  // waiting for them saw nothing for that whole window instead of a
  // placeholder. Only shown while a first real answer is still pending —
  // once loaded, an empty result still means "nothing to show" (same as
  // today), not a stuck skeleton.
  const [careerEventsLoading, setCareerEventsLoading] = React.useState(true);
  const loadCareerEvents = React.useCallback(() => {
    if (!isSignedIn) {
      setCareerEventsLoading(false);
      return;
    }
    careerEventsService.listCareerEvents()
      .then(list => {
        const recent = [...list].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
        setCareerEvents(recent);
      })
      .catch(() => {
        // Non-critical -- same "section just doesn't render" fallback as
        // every other best-effort Home fetch (e.g. roadmap above).
      })
      .finally(() => setCareerEventsLoading(false));
  }, [isSignedIn]);
  React.useEffect(() => { loadCareerEvents(); }, [loadCareerEvents]);
  useFocusEffect(
    React.useCallback(() => {
      loadCareerEvents();
    }, [loadCareerEvents]),
  );
  const onOpenCareerEvent = React.useCallback((event: CareerEventProps) => {
    if (!event.read) {
      careerEventsService.markCareerEventsRead([event.id]).catch(() => undefined);
      setCareerEvents(prev => prev.map(e => (e.id === event.id ? { ...e, read: true } : e)));
    }
    navigate('WebViewScreen', { url: event.url, title: event.title });
  }, [navigate]);

  // HOME RESTRUCTURE (product ask: the screen was "too cluttered,
  // generic, wrong hierarchy" for launch — this file used to have a
  // "grid of 2/3" horizontal row for Continue & Upcoming PLUS five more
  // separately-titled sections below it (Career Toolkit, Career Fairs &
  // Events, Career Progress, Daily Challenge, Refer & Earn, Next Steps —
  // see git history for the full prior v3 layout this replaces). Chose the
  // "AI-first hero" direction: one prominent Ask Your Coach hero (new,
  // right below the verify-email banner), ONE collapsed "continue where
  // you left off" card instead of three side by side, and everything else
  // folded into a single "For You" horizontal row below it — matching how
  // top AI apps (ChatGPT/Perplexity home screens) lead with one clear
  // focal action instead of a stack of equally-weighted dashboard cards.
  //
  // Continue-card priority: was three cards side by side, each already
  // self-hiding on its own (UpcomingSessionHomeCard/ContinueLearningCard/
  // NextLessonHomeCard all support onVisibilityChange — this exact prop
  // existed here once before, see the BUG FIX history these three files'
  // own comments still carry, then got removed when nothing read it
  // anymore). Reintroduced here for real this time: only the single
  // highest-priority card that actually has content renders visibly
  // (upcoming session > continue learning > next lesson, same order the
  // old row displayed them in left to right) — the other two stay
  // mounted (so they keep fetching/self-updating) but collapsed to zero
  // height via forYouHiddenCard below, rather than unmounted, so
  // whichever one becomes relevant later doesn't need a fresh fetch.
  const [upcomingSessionHasContent, setUpcomingSessionHasContent] = React.useState(false);
  const [continueLearningHasContent, setContinueLearningHasContent] = React.useState(false);
  const [nextLessonHasContent, setNextLessonHasContent] = React.useState(false);
  const activeContinueCard = upcomingSessionHasContent
    ? 'upcoming'
    : continueLearningHasContent
    ? 'continue'
    : nextLessonHasContent
    ? 'next'
    : null;

  // Shared sizing for the new "For You" row (Career Progress/Daily
  // Challenge/Career Fairs & Events/shortcut tiles/Refer & Earn/Next
  // Steps all now live here as same-width tiles instead of each being
  // its own full-width titled section) — fixed rather than derived from
  // screen width (unlike the old topCardWidth this replaces) since this
  // row is meant to peek the next tile at the screen edge, not fit an
  // exact number per screen.
  const forYouGap = 12;
  const forYouCardWidth = 150;

  // Evergreen shortcut tiles in the "For You" row — replaces both the old
  // Uber-Eats-style pill row (Today's Tips/Roadmap/Career DNA) and the
  // Career Toolkit section (Companies/Courses/Salary; Coach dropped from
  // this list since it's now the page's own hero above, not a shortcut
  // among others). Recomputed each render (cheap — a handful of object
  // literals) rather than memoized, same as the isFeatureEnabled checks
  // this replaces, which were previously inlined directly in JSX.
  const forYouShortcuts = [
    { key: 'tips', icon: Images.iconLightbulbHead, label: t('home:pill_todays_tips', { defaultValue: "Today's Tips" }), onPress: () => navigate('GoalTipDetail') },
    { key: 'roadmap', icon: Images.iconLocation, label: t('home:pill_roadmap', { defaultValue: 'Roadmap' }), onPress: () => navigate('CareerRoadmap') },
    { key: 'dna', icon: Images.iconAiStars, label: t('home:pill_career_dna', { defaultValue: 'Career DNA' }), onPress: () => navigate('CareerDna') },
    { key: 'companies', icon: Images.iconHandshake, label: t('home:quick_action_dream_company', { defaultValue: 'Companies' }), onPress: () => navigate('DreamCompanies') },
    ...(configService.isFeatureEnabled('learning_courses')
      ? [{ key: 'courses', icon: Images.iconGraduationCap, label: t('home:quick_action_courses', { defaultValue: 'Courses' }), onPress: () => navigate('LearningCourses') }]
      : []),
    ...(configService.isFeatureEnabled('salary_negotiation')
      ? [{ key: 'salary', icon: Images.iconCoins, label: t('home:quick_action_salary', { defaultValue: 'Salary' }), onPress: () => navigate('SalaryNegotiation') }]
      : []),
  ];

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
      const typeLabel = dailyChallenge.challengeType
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return {
        badgeIcon: 'flag-outline',
        badgeLabel: t('home:mission_badge', { defaultValue: "Today's Mission" }),
        title: typeLabel,
        subtitle: dailyChallenge.promptText,
        metaLeft: { icon: 'bulb-outline', label: t('home:mission_type_label', { defaultValue: 'Focus' }), value: typeLabel },
        metaRight: { icon: 'award-outline', label: t('home:mission_reward_label', { defaultValue: 'Reward' }), value: t('home:mission_xp_value', { defaultValue: '+{{xp}} XP', xp: dailyChallenge.xpAwarded }) },
        progressPercent: dailyChallenge.completed ? 100 : 0,
        progressLabel: t('home:mission_progress_label', { defaultValue: 'Progress' }),
        ctaLabel: dailyChallenge.completed
          ? t('home:mission_cta_completed', { defaultValue: 'View Challenge' })
          : t('home:mission_cta_start', { defaultValue: 'Start Task' }),
        ctaIcon: dailyChallenge.completed ? 'checkmark-circle-2-outline' : 'play-circle-outline',
        onPress: () => navigate('DailyChallenge'),
      };
    }
    if (roadmap && currentRoadmapStep) {
      return {
        badgeIcon: 'flag-outline',
        badgeLabel: t('home:mission_badge_roadmap', { defaultValue: 'Your Next Step' }),
        title: currentRoadmapStep.title,
        subtitle: currentRoadmapStep.description,
        metaLeft: { icon: ROADMAP_STEP_ICONS[currentRoadmapStep.type] ?? 'flag-outline', label: t('home:mission_step_label', { defaultValue: 'Step' }), value: t('home:mission_step_value', { defaultValue: '{{order}} of {{total}}', order: currentRoadmapStep.order, total: roadmap.totalCount }) },
        metaRight: { icon: 'flag-outline', label: t('home:mission_goal_label', { defaultValue: 'Goal' }), value: roadmap.targetRole },
        progressPercent: roadmapPercent,
        progressLabel: t('home:mission_progress_label', { defaultValue: 'Progress' }),
        ctaLabel: t('home:mission_cta_roadmap', { defaultValue: 'Continue Roadmap' }),
        ctaIcon: 'play-circle-outline',
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
      onPress: () => navigate('MainBottomTab', { screen: 'Coach' }),
    };
  }, [dailyChallenge, roadmap, currentRoadmapStep, roadmapPercent, t, navigate]);

  // Coach card suggested prompts -- generic, always-relevant conversation
  // starters (not personalized/fetched — Saveur has no "suggested
  // prompts" endpoint), each one deep-links into Chat.tsx with itself as
  // `initialPrompt` (see CoachPromptCard.tsx's own comment).
  const coachPrompts = [
    t('home:coach_prompt_resume', { defaultValue: 'How can I improve my resume?' }),
    t('home:coach_prompt_interview', { defaultValue: 'Help me prepare for an interview' }),
    t('home:coach_prompt_skills', { defaultValue: 'What skills should I learn next?' }),
  ];
  const onPressCoachPrompt = React.useCallback((prompt: string) => {
    navigate('MainBottomTab', { screen: 'Coach', params: { screen: 'Chat', params: { initialPrompt: prompt } } });
  }, [navigate]);
  const onPressCoachSend = React.useCallback(() => {
    navigate('MainBottomTab', { screen: 'Coach' });
  }, [navigate]);

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
            rather than generic dashboard labels.
            CURRENT top-to-bottom order (RESTRUCTURE pass, product follow-up
            "Remove the career tool kit from the whole card and place it
            immediately after homebanner. And then remove the todays focus
            content totally" -- see the toolkitCard/toolkitCardDark styles'
            own comment for what got removed entirely rather than moved):
            verify-email banner (time-sensitive account action, not a
            content card) -> admin Home banner (conditional) -> "Career
            Toolkit" (4 shortcuts, now its own standalone section right
            after the banner) -> "Continue & Upcoming" (3-card horizontal
            row) -> "Career Progress" (Progress Toward Goal ring) ->
            DailyChallengeCard (self-contained, own doc comment) -> Refer &
            Earn promo -> "Next Steps" (a standing link into WhatsNext.tsx).
            "Today's Career Focus" (the old streak/mic-icon hero this
            screen used to open with) is GONE, not relocated -- see git
            history if a future pass wants it back.
            REMOVED from Home in the original v3 pass (still reachable
            elsewhere, not deleted from the app): DailyNewsBanner/
            DailyTipsBanner, the old streak-stats grid, and
            RecentActivityList. DailyChallengeCard was ALSO removed in that
            pass with no other entry point left anywhere in the app --
            restored here (product follow-up: "add more content after the
            your progress card") rather than staying orphaned. */}
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

{/* HOME RESTRUCTURE: Career Fairs & Events, Career Progress, Daily
            Challenge, Refer & Earn, and Next Steps used to each be their
            own separately-titled section stacked all the way down the
            page — folded into one "For You" horizontal row instead, same
            "one clear focal point per screen, not a stack of equally-
            weighted cards" principle as the collapsed Continue card
            below. Career Progress and Daily Challenge are gone from this
            row entirely (v2 redesign) — both now live in the mission
            hero/stat-card pair above instead of a duplicate smaller tile
            down here. Ordered by how timely/personal what's left is: the
            newest Career Fairs & Events first, then the evergreen
            shortcuts (Today's Tips/Roadmap/Career DNA/Companies/Courses/
            Salary — see forYouShortcuts above, replaces the old pill row
            + Career Toolkit section), then Refer & Earn and Next Steps
            last as the least time-sensitive items. The shortcuts are
            always present for a signed-in user, so this row is never
            empty in practice — no top-level "is there anything at all"
            gate needed, unlike the old Career Fairs & Events section it
            now sits inside.

            MOVED (product request: "take the For You section and place
            above the AI Career Coach card") -- used to sit at the very
            bottom of the page, after the admin banner and Continue
            section; now right after the actions-zone ActionCard and
            before CoachPromptCard. Nothing about the row itself changed,
            only its position in the page. */}
        {/* <Text category="h8" bold mt={24} mb={12}>
          {t('home:for_you_label', { defaultValue: 'For You' })}
        </Text> */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 6, paddingHorizontal: 10 }}
          contentContainerStyle={{ paddingVertical: 10 }}>
          {/* Career Fairs & Events -- up to 4 cards, same skeleton-while-
              loading convention as before, just sized to this row's
              shared tile width now instead of the old topCardWidth. */}
          {careerEventsLoading ? (
            <>
              <SkeletonHomeCardRow style={{ width: forYouCardWidth, marginRight: forYouGap }} />
              <SkeletonHomeCardRow style={{ width: forYouCardWidth, marginRight: forYouGap }} />
            </>
          ) : (
            careerEvents.map(event => (
              <CareerFairEventCard
                key={event.id}
                event={event}
                onPress={onOpenCareerEvent}
                style={{ width: forYouCardWidth, marginRight: forYouGap }}
              />
            ))
          )}

          {/* Evergreen shortcuts -- Today's Tips/Roadmap/Career DNA/
              Companies/Courses/Salary (see forYouShortcuts above). */}
          {forYouShortcuts.map(item => (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.7}
              style={[styles.forYouTile, { marginRight: forYouGap }]}
              onPress={item.onPress}>
              <Image source={item.icon} style={styles.forYouTileIcon as ImageStyle} resizeMode="contain" />
              <Text category="h10" bold center numberOfLines={1} mt={8}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Refer & Earn -- same purple-to-black gradient/copy/
              destination as before, condensed to this row's tile shape
              (see forYouTile/referralTile/referralTileText below). */}
          {configService.isFeatureEnabled('referral_program') ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.forYouTile, styles.referralTile, { marginRight: forYouGap }]}
              onPress={() => navigate('ReferralProgram')}>
              <LinearGradient
                colors={['#8B5CF6', '#5e40a2ff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <ArtGiftBox size={32} />
              <Text category="h10" bold center numberOfLines={2} mt={8} style={styles.referralTileText}>
                {t('home:referral_card_title', { defaultValue: 'Refer & Earn' })}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Next Steps -- same destination (src/more/WhatsNext.tsx) as
              before, last in the row as the least time-sensitive item. */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.forYouTile}
            onPress={() => navigate('WhatsNext')}>
            <ArtWorkplaceCompass size={30} />
            <Text category="h10" bold center numberOfLines={1} mt={8}>
              {t('more:whats_next_title', { defaultValue: "What's Next" })}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* HOME REDESIGN v3 (product ask: "search dribbble/behance, structure
            the app like top-rated 2026 apps" -- research landed on a
            structured-dashboard direction: a clearly separated "data zone"
            you read (StatStrip below) above an "actions zone" you act on
            (ActionCard + CoachPromptCard), instead of v2's one big
            illustrated hero mixing both. See StatStrip.tsx/ActionCard.tsx's
            own comments for the full reasoning. MissionHeroCard/
            StatMiniCard (v2's components) are unused now, not deleted --
            same rollback-point convention as every prior redesign pass. */}

        {/* Data zone -- real numbers only, same honest-zero-state
            convention as before. "Day X of Y" from the original reference
            screenshot isn't available (RoadmapStep has no day field, only
            `order`), so this shows "Step X of Y" instead of a fabricated
            day count; XP is gamificationService's own real streak.xp. */}
        <StatStrip
          items={[
            {
              label: t('home:stat_strip_step_label', { defaultValue: 'Step' }),
              value: roadmap && currentRoadmapStep
                ? t('home:stat_strip_step_value', { defaultValue: '{{order}} of {{total}}', order: currentRoadmapStep.order, total: roadmap.totalCount })
                : t('home:stat_strip_step_value_none', { defaultValue: '—' }),
            },
            {
              label: t('home:stat_strip_streak_label', { defaultValue: 'Streak' }),
              value: t('home:stat_strip_streak_value', { defaultValue: '{{count}} days', count: streak?.streakDays ?? 0 }),
            },
            {
              label: t('home:stat_strip_xp_label', { defaultValue: 'XP' }),
              value: `${streak?.xp ?? 0}`,
            },
          ]}
        />

        {/* Actions zone -- one clear "next action" card (real priority
            chain: today's Daily Challenge, falling back to the current AI
            Career Roadmap step, falling back to a generic coach prompt --
            see missionHero's own computation above), then the AI Coach
            card with suggested prompts right below it. */}
        {missionHeroLoading ? (
          <View style={styles.missionHeroLoading}>
            <Spinner status="primary" />
          </View>
        ) : (
          <ActionCard
            icon={missionHero.badgeIcon}
            title={missionHero.title}
            subtitle={missionHero.subtitle}
            onPress={missionHero.onPress}
          />
        )}

        {/* AI Coach card -- see coachPrompts above for the exact starter
            list and CoachPromptCard.tsx's own comment for how a tap
            deep-links straight into a real conversation instead of just
            opening a blank thread. */}
        <CoachPromptCard
          title={t('home:coach_card_title', { defaultValue: 'AI Career Coach' })}
          subtitle={t('home:coach_card_subtitle', { defaultValue: 'Ask anything about your job search' })}
          prompts={coachPrompts}
          onPressPrompt={onPressCoachPrompt}
          onPressSend={onPressCoachSend}
        />

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

        {/* HOME RESTRUCTURE: the Uber-Eats-style pill row (Today's Tips /
            Roadmap / Career DNA) and the standalone "Career Toolkit"
            section (Coach / Companies / Courses / Salary) that used to sit
            here are both gone as their own titled sections — Coach is now
            the hero above, and the rest (Tips/Roadmap/Career DNA/
            Companies/Courses/Salary) are shortcut tiles inside the unified
            "For You" row below (see forYouShortcuts and its render call).
            See git history for either section's prior full implementation
            if a future pass wants a standalone version back. */}

        {/* HOME RESTRUCTURE: was a 3-card horizontal row (Upcoming Session /
            Continue Learning / Next Lesson) — collapsed to ONE full-width
            card, whichever is actually the most relevant right now
            (activeContinueCard above), matching the "AI-first hero"
            direction's "one resume card" principle instead of three
            equal-weight cards competing side by side. All three children
            stay mounted unconditionally (each already self-fetches/self-
            hides on its own) so their onVisibilityChange keeps firing —
            only the winning one is visually shown; the other two collapse
            to zero height via forYouHiddenCard rather than unmounting, so
            switching priority later (e.g. a session gets cancelled) doesn't
            need a fresh fetch. Title only shows when there's something to
            show at all. */}
        {activeContinueCard ? (
          <Text category="h8" bold mt={24} mb={12}>
            {t('home:continue_and_upcoming_label', { defaultValue: 'Continue' })}
          </Text>
        ) : null}
        <View style={activeContinueCard !== 'upcoming' ? styles.forYouHiddenCard : undefined}>
          <UpcomingSessionHomeCard
            style={styles.continueCardFull}
            onVisibilityChange={setUpcomingSessionHasContent}
          />
        </View>
        <View style={activeContinueCard !== 'continue' ? styles.forYouHiddenCard : undefined}>
          <ContinueLearningCard
            style={styles.continueCardFull}
            onVisibilityChange={setContinueLearningHasContent}
          />
        </View>
        <View style={activeContinueCard !== 'next' ? styles.forYouHiddenCard : undefined}>
          <NextLessonHomeCard
            style={styles.continueCardFull}
            onVisibilityChange={setNextLessonHasContent}
          />
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
  // a plain View, NOT a LinearGradient: the gradient is a decorative
  // absoluteFillObject layer behind this box's normal-flow content
  // instead, so this sizes correctly to wrap its real content height.
  homeBannerFallback: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
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
  // HOME RESTRUCTURE ("AI-first hero" direction) — the styles below
  // replace referralCard/referralTextWrap/referralText, toolkitCard/
  // toolkitCardDark/quickActionsRow/quickActionItem/quickActionIcon,
  // pillRow/pillButton/pillButtonLast/pillIcon, progressCard/
  // progressHero/progressHeroLoading, and whatsNextCard/whatsNextIconWrap
  // — all now dead and removed (folded into the new AI Coach hero, the
  // collapsed Continue card, and the unified For You row — see this
  // file's own module comment and the JSX at each render call site). See
  // git history for any of those styles' own prior comment history if a
  // future pass wants the old section-per-item layout back.
  //
  // HOME REDESIGN v3 — loading placeholder for the new ActionCard (see
  // components/ActionCard.tsx), sized/styled to match its own flat,
  // hairline-bordered row-card shape instead of v2's big colored block —
  // only shown for the brief window before missionHeroLoading resolves.
  missionHeroLoading: {
    height: 68,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
    marginTop: 12,
    backgroundColor: 'background-basic-color-2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Collapsed Continue card — full row width now (was topCardWidth's
  // fixed half-width, back when three of these sat side by side).
  continueCardFull: {
    width: '100%',
  },
  // The two non-winning Continue candidates stay mounted (so they keep
  // fetching/self-updating — see activeContinueCard's own comment above)
  // but collapse to zero visual footprint instead of unmounting.
  forYouHiddenCard: {
    height: 0,
    overflow: 'hidden',
  },
  // Shared tile shape for every item in the "For You" row (Career
  // Progress/shortcuts/Next Steps use this directly; Daily Challenge/
  // Career Fairs & Events cards bring their own internal card style and
  // just take forYouCardWidth via an inline width override instead).
  forYouTile: {
    ...globalStyle.card,
    width: 150,
    minHeight: 96,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'background-basic-color-2',
  },
  forYouTileIcon: {
    width: 32,
    height: 32,
  },
  // Refer & Earn tile — same purple-to-black gradient as before (see this
  // style's own prior comment history in git for the full "why this
  // gradient" story), just fit to forYouTile's shape now. No
  // globalStyle.card shadow needed (product precedent: "remove the box
  // shadow from the referral card") — overridden back off here since
  // forYouTile's own spread turns it back on by default.
  referralTile: {
    overflow: 'hidden',
    shadowOpacity: 0,
    elevation: 0,
  },
  referralTileText: {
    color: '#fff',
  },
});
