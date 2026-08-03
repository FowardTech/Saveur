import React, { memo } from 'react';
import { Alert, AppState, Image, ScrollView, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleService, useStyleSheet, useTheme, Icon, Layout, Button, Spinner } from '@ui-kitten/components';
// The daily XP check-in card below has its own inverted white-pill button
// (see the JSX comment there for why it's not CtaButton) — CtaButton itself
// has no remaining call site on this screen, so it's not imported here
// anymore. Secondary/contextual actions (Resend verification, etc.) still
// use plain UI Kitten <Button>.
import CircularProgress from 'components/CircularProgress';
import LinearGradient from 'react-native-linear-gradient';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';

import Content from 'components/Content';
import Container from 'components/Container';
import HeaderHome from './Components/HeaderHome';
import DailyChallengeCard from './DailyChallengeCard';
import PersonalizationCard from './PersonalizationCard';
import WeekStrip from './WeekStrip';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from 'navigation/types';
import Text from 'components/Text';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { getInterviewTypeLabel, getPracticeModeLabel, getDifficultyLabel } from 'utils/interviewTypeLabels';
import useLayout from 'hooks/useLayout';
import { AdvertisementProps, EKeyAsyncStorage, GamificationStreakProps, Interview_Type_Enum, LeaderboardEntryProps, ScheduledInterviewProps } from 'constants/Types';
import UserAvatar from 'components/UserAvatar';
import * as interviewService from 'services/interviewService';
import * as resumeService from 'services/resumeService';
import * as networkingService from 'services/networkingService';
import * as gamificationService from 'services/gamificationService';
import * as notificationService from 'services/notificationService';
import * as roadmapService from 'services/roadmapService';
import * as scheduledInterviewService from 'services/scheduledInterviewService';
import * as adsService from 'services/adsService';
import * as jobShareService from 'services/jobShareService';
import { navigateToJobAlertDetails } from 'navigation/navigationRef';
import ModalRequest from 'components/ModalRequest';
import AppTour from 'components/AppTour';
import AppRatingModal from 'components/AppRatingModal';
import BadgesModal from 'components/BadgesModal';
import * as appRatingService from 'services/appRatingService';
import useModal from 'hooks/useModal';
import { Images } from 'assets/images';
import { AuthContext } from '../../AuthContext';

// Defined at module scope (not inline in JSX) so it's a stable component
// reference across renders — see Subscription.tsx's renderCheckoutSpinner
// for the same reasoning.
const renderCheckInSpinner = () => <Spinner size="tiny" status="control" />;

// Leaderboard preview's per-rank medal badge colors (module scope, not
// inline in JSX, for the same "don't recompute a literal object every
// render" reason as renderCheckInSpinner above). Ranks 1/2 use existing
// theme tokens (warning=gold, the app's own neutral basic-color-3/6 pair
// for silver); rank 3 has no dedicated "bronze" token anywhere in
// constants/theme/{light,dark}.json (only primary/success/info/warning/
// danger/basic exist), so it's a literal copper hex — a reasonable one-off
// for a purely decorative 3rd-place medal, same call already made for other
// one-off accent colors elsewhere in this app. Every rank past 3 falls back
// to the same neutral pill the rest of this screen's placeholder text uses.
const rankMedalStyle = (rank: number, theme: Record<string, string>): { bg: string; text: string } => {
  switch (rank) {
    case 1:
      return { bg: '#0063f8', text: '#FFFFFF' };
    case 2:
      return { bg: theme['background-basic-color-3'], text: theme['background-basic-color-6'] };
    case 3:
      return { bg: 'rgba(205, 127, 50, 0.18)', text: '#CD7F32' };
    default:
      return { bg: theme['background-basic-color-3'], text: theme['text-placeholder-color'] };
  }
};

// Dashboard — streak/XP/leaderboard, weekly practice stats, and upcoming
// session all come from the real backend now (see the fetches below:
// interviewService.getPracticeHistory, scheduledInterviewService.listUpcoming,
// gamificationService.getStreak/getLeaderboard). Badge unlock state is the
// one remaining piece computed client-side — from real signals (actual
// completed-session count, real streak days, real resume-import count, real
// contact count), just evaluated here instead of server-side. See the
// "Gamification: badge unlock state" comment further down for the current
// scope decision on that.
const HomeSrc = memo(() => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const { width } = useLayout();
  // Explicit pixel size for the Home banner card (see the JSX below) rather
  // than relying on style-only `width: '100%'` + `aspectRatio` on the
  // <Image> — that combination rendered at the SOURCE image's raw pixel
  // dimensions (1920x1080 points, several times taller than the screen)
  // instead of being scaled down to the card's actual width, because a
  // percentage width on an Image can't resolve until its parent's own
  // width is known, and an aspectRatio-only height has nothing to scale
  // against until the width resolves first — a known RN/Yoga gotcha for
  // Image specifically (View doesn't have this problem, since it has no
  // intrinsic size of its own to fall back to). Computing real numbers
  // here up front sidesteps that resolution order entirely. `- 48` matches
  // <Content padder>'s own `paddingHorizontal: 24` (see components/
  // Content.tsx), so this is the actual rendered card width, not the full
  // screen width.
  const bannerWidth = width - 48;
  // Moderately shorter than a full 16:9 banner, per explicit product
  // direction — matches the bundled default image's own baked-in crop
  // (assets/images/img_home_banner_ai_coach.jpg is 1920x900, not the
  // original 1920x1080; see that asset's own history for why) so this
  // still renders full-bleed with zero letterboxing for the default image.
  const bannerHeight = Math.round(bannerWidth * (900 / 1600));
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home', 'common']);
  const { isSignedIn, emailVerified, resendVerificationEmail, refreshEmailVerified, profile } =
    React.useContext(AuthContext);

  // Bell badge — GET /api/v1/notifications (see services/notificationService.ts).
  // Replaces a hardcoded `notification={3}` that never changed no matter how
  // many notifications existed or had been read.
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

  // One-time "how this app works" walkthrough (components/AppTour.tsx) —
  // checked on every Home focus (not just mount) rather than once, so
  // MoreSrc.tsx's "Show app tour" replay entry (which clears this same
  // flag and navigates back to Home) actually reopens it without needing
  // Home to remount.
  const [showTour, setShowTour] = React.useState(false);
  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem(EKeyAsyncStorage.appTourSeen).then(seen => {
        if (!seen) setShowTour(true);
      });
    }, []),
  );
  const onCloseTour = React.useCallback(() => {
    setShowTour(false);
    AsyncStorage.setItem(EKeyAsyncStorage.appTourSeen, '1').catch(() => { });
  }, []);

  // Regular QA rating prompt (product request item: "a regular if not
  // weekly or monthly app rating that will pop up as modal... for quality
  // assurance purposes") — due-ness is decided server-side (see
  // services/appRatingService.ts's isRatingPromptDue, backed by
  // Saveur-Backend's admin-configurable interval, default 30 days), so
  // this only needs to ask once. Checked once on mount, not
  // useFocusEffect like the AppTour check above — re-checking on every tab
  // switch back to Home within the same session would be wasted calls (the
  // due-check itself won't flip from true to false without a submit/
  // dismiss in between) and risks the modal popping back up mid-session if
  // some other flow re-focuses Home.
  const [showRatingPrompt, setShowRatingPrompt] = React.useState(false);
  React.useEffect(() => {
    appRatingService.isRatingPromptDue().then(due => {
      if (due) setShowRatingPrompt(true);
    });
  }, []);
  const onSubmitRating = React.useCallback(async (score: number, comment?: string) => {
    try {
      await appRatingService.submitRating(score, comment);
      // Only close on success -- a failed submit keeps the modal open
      // (with whatever the user already picked still showing) so they can
      // just retry, rather than silently losing the rating they were
      // trying to send.
      setShowRatingPrompt(false);
    } catch (e: any) {
      Alert.alert(
        t('common:rating_submit_failed_title', { defaultValue: "Couldn't send your rating" }),
        e?.message ?? t('common:try_again_later', { defaultValue: 'Please try again in a moment.' }),
      );
    }
  }, [t]);
  const onDismissRating = React.useCallback(() => {
    setShowRatingPrompt(false);
    appRatingService.dismissRatingPrompt().catch(() => { });
  }, []);

  // "Share a job" deep-link landing (product request item) — a pending job
  // id captured by App.tsx's AppsFlyer listeners / saveur://job fallback
  // link (see services/jobShareService.ts) sits in AsyncStorage until the
  // user actually reaches Home, which by definition only happens once
  // they're authenticated (Home is behind AuthContext's signed-in gate) —
  // so this is naturally the right moment to resolve it, no separate
  // "is the user ready yet" check needed. consumePendingJob() clears the
  // stored id itself (success or failure) so this only ever fires once per
  // shared link, not on every future Home visit. Runs once on mount, not
  // useFocusEffect like the AppTour check above — a shared-job landing
  // should happen once, not re-trigger every time the user tabs back to
  // Home.
  React.useEffect(() => {
    jobShareService.consumePendingJob().then(job => {
      // Reverted per explicit follow-up request — back to landing on the
      // in-app job details screen (matches every other job-alert tap path).
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

  // "Today's Briefing" (AI Career Operating System summary) card was
  // removed from the dashboard (manual product edit) — no longer fetched
  // or rendered here. See services/careerOsService.ts /
  // CareerBriefingDetail.tsx if this comes back later.

  // "Today's Goal Tips" dashboard card was removed (product request item:
  // "remove the today's daily tip card and let user see the push
  // notification and when they click it it takes them to more details
  // about today's goal tip") — that content now lives only on
  // src/home/GoalTipDetail.tsx, reached via the daily "goal_tip" push
  // notification tap (see navigation/navigationRef.ts's
  // navigateToGoalTipDetail). No fetch/state needed here anymore.

  // Orientation card into the AI Career Roadmap -- "someone walking into a
  // school for the first time needs a roadmap to orientation" -- everyone
  // should see an entry point here regardless of Pro status, since a
  // roadmap is now auto-built from the goal/role given at signup (see
  // backend's career_roadmap_service.ensure_auto_roadmap, wired into
  // users.py's update_me). getSavedRoadmap() resolves to null both while
  // signed out and for the rare account with no signup goal on file (e.g. a
  // social-login signup that skipped it) -- CareerRoadmap.tsx itself handles
  // that empty state (Pro manual-build form, or the Pro lock gate for free
  // users), so this card can unconditionally deep-link there.
  const [dashboardRoadmap, setDashboardRoadmap] = React.useState<roadmapService.CareerRoadmap | null>(null);
  React.useEffect(() => {
    if (!isSignedIn) return;
    roadmapService.getSavedRoadmap().then(setDashboardRoadmap).catch(() => { });
  }, [isSignedIn]);

  // Non-blocking "verify your email" banner — see AuthContext.emailVerified's
  // doc comment. Deliberately NOT a hard gate on the rest of the app: an
  // interview-prep tool has no action that strictly requires a verified
  // email today, and a hard gate risks locking someone out entirely if a
  // verification email gets lost/delayed. Only ever true for an
  // email/password account — Google/Apple sign-ins are pre-verified.
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

  // The Day Streak / Sessions This Week / Average Score stat cards that
  // used to derive from a stored `practiceHistory` here were removed
  // (manual product edit) — that state and its derived weeklyPractice/
  // sessionsThisWeek/avgScore values had no other reader left, so they're
  // gone too rather than left computing values nothing renders. Practice
  // history is still fetched below (in the badge-unlock effect) for badge
  // computation, just no longer stored in component state.

  // Upcoming Session — GET /api/v1/interviews/scheduled (see
  // services/scheduledInterviewService.ts). Was a single hardcoded
  // DATA_UPCOMING_SESSIONS entry that never changed and couldn't be
  // created/canceled — now shows the user's actual soonest scheduled
  // interview (or an empty-state prompting them to set one), and refreshes
  // whenever this screen regains focus so a reminder just created on
  // ScheduleInterview shows up immediately on the way back.
  const [upcomingSessions, setUpcomingSessions] = React.useState<ScheduledInterviewProps[]>([]);
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      scheduledInterviewService.listUpcoming().then(list => {
        if (!cancelled) setUpcomingSessions(list);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );
  const nextSession = upcomingSessions[0];

  // Gamification streak/XP — GET /api/v1/gamification/streak (see
  // services/gamificationService.ts). Replaces the old hardcoded
  // `streakDays = 5`. streakDays feeds two badge unlock conditions below.
  const [streak, setStreak] = React.useState<GamificationStreakProps | null>(null);
  const [streakLoading, setStreakLoading] = React.useState(true);
  const [streakError, setStreakError] = React.useState<string | null>(null);
  const [checkingIn, setCheckingIn] = React.useState(false);
  const streakDays = streak?.streakDays ?? 0;

  const loadStreak = React.useCallback(async () => {
    setStreakLoading(true);
    setStreakError(null);
    try {
      const data = await gamificationService.getStreak();
      setStreak(data);
    } catch (error: any) {
      setStreakError(error?.message ?? t('home:streak_load_failed', { defaultValue: 'Could not load your streak.' }));
    } finally {
      setStreakLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  // POST /api/v1/gamification/checkin — daily check-in. Action-triggered
  // failure surfaces via Alert (same pattern as src/auth/Login/Login.tsx's
  // onLogin catch block), since this is a user-initiated tap, not a
  // background load.
  const onCheckIn = React.useCallback(async () => {
    if (checkingIn || streakLoading || streak?.checkedInToday) return;
    setCheckingIn(true);
    try {
      const updated = await gamificationService.checkin();
      setStreak(updated);
    } catch (error: any) {
      Alert.alert(
        t('home:check_in_failed_title', { defaultValue: "Couldn't check in" }),
        error?.message ?? t('home:check_in_failed_body', { defaultValue: 'Please try again in a moment.' }),
      );
    } finally {
      setCheckingIn(false);
    }
  }, [checkingIn, streakLoading, streak, t]);

  // Leaderboard preview (GET /api/v1/gamification/leaderboard) — top 4,
  // same fetch src/home/Leaderboard.tsx's own full-list screen uses (see
  // that file's comment on why it's the same call unsliced). Brought back
  // to the dashboard per explicit follow-up ("bring back the leaderboard
  // to the homescreen") after a brief decluttering pass had replaced it
  // with a nav pill only — the pill is now removed again in favor of this
  // live preview card (with its own "View all" link into the same screen),
  // so there's a single entry point, not two.
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntryProps[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = React.useState(true);
  const [leaderboardError, setLeaderboardError] = React.useState<string | null>(null);

  const loadLeaderboard = React.useCallback(async () => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const data = await gamificationService.getLeaderboard();
      setLeaderboard(data);
    } catch (error: any) {
      setLeaderboardError(
        error?.message ?? t('home:leaderboard_load_failed', { defaultValue: 'Could not load the leaderboard.' }),
      );
    } finally {
      setLeaderboardLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Gamification: badge unlock state is computed client-side from whatever's
  // cheaply derivable out of existing mock data — practice history length,
  // the real streak day-count above, resume-import count (used as a
  // stand-in for "ATS optimized" too, since analyzeResume's mock score is
  // itself derived from import count — see resumeService.ts), and tracked
  // networking contacts.
  // TODO (BACKEND): once badge unlocks move server-side (see
  // docs/BACKEND_API_SPEC.md §15), this client-side computation goes away —
  // out of scope for this pass, which only wires streak/XP/leaderboard.
  const [unlockedBadgeIds, setUnlockedBadgeIds] = React.useState<Set<string>>(new Set());
  // Full-grid modal (components/BadgesModal.tsx) -- see that file's comment
  // for why this moved out of an always-expanded inline grid on Home.
  const [isBadgesModalVisible, setIsBadgesModalVisible] = React.useState(false);

  // Was a plain useEffect keyed only on [streakDays] — practice history only
  // ever refetched on mount or when the streak day-count happened to
  // change. Completing another interview and coming back to Home doesn't
  // bump streakDays if the user already checked in today, so badge unlocks
  // looked permanently frozen no matter how many sessions were completed.
  // useFocusEffect (already used below for upcomingSessions) re-runs this
  // every time the Home tab regains focus, which is exactly when a
  // just-finished interview would land back here.
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        const [history, importedSources, contacts] = await Promise.all([
          interviewService.getPracticeHistory(),
          resumeService.getImportedSources(),
          networkingService.listContacts(),
        ]);
        if (cancelled) return;
        const completed = history.filter(s => s.status === 'Completed');
        const importedCount = Object.keys(importedSources).length;

        const unlocked = new Set<string>();
        if (completed.length >= 1) unlocked.add('first_interview');
        if (completed.length >= 5) unlocked.add('five_sessions');
        if (completed.length >= 10) unlocked.add('ten_sessions');
        if (streakDays >= 3) unlocked.add('three_day_streak');
        if (streakDays >= 5) unlocked.add('five_day_streak');
        if (completed.some(s => (s.overallScore ?? 0) >= 90)) unlocked.add('perfect_score');
        if (importedCount > 0) unlocked.add('resume_uploaded');
        if (importedCount >= 3) unlocked.add('ats_optimized');
        if (completed.some(s => s.interviewType === Interview_Type_Enum.Coding)) unlocked.add('coding_complete');
        if (contacts.length >= 3) unlocked.add('networker');

        setUnlockedBadgeIds(unlocked);
      })();
      return () => {
        cancelled = true;
      };
    }, [streakDays]),
  );

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
    adsService.getNextAd().then(ad => {
      if (cancelled || !ad) return;
      adRef.current = ad;
      setPendingAd(ad);
      setTimeout(() => {
        if (cancelled) return;
        showAd();
        // Recorded once the popup actually renders, not on fetch — a
        // fetched-but-never-shown ad (e.g. the user left the screen before
        // the delay above fired) shouldn't burn one of its limited views.
        adsService.recordImpression(ad.id).catch(() => { });
      }, 1500);
    }).catch(() => {
      // Offline or the request failed — no ad this session, same
      // fail-quiet behavior as checkFeedbackNotification's catch in
      // MainBottomTab.tsx.
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onDismissAd = React.useCallback(() => {
    hideAd();
  }, [hideAd]);
  const onOpenAd = React.useCallback(() => {
    hideAd();
    if (adRef.current) {
      navigate('AdDetails', { ad: adRef.current });
    }
  }, [hideAd, navigate]);

  // Admin-configured Home banner — GET /api/v1/ads/banner (see
  // services/adsService.ts's getHomeBanner, backend's app/api/ads.py).
  // Separate surface from the popup ad above: rendered as a persistent
  // card (see styles.homeBannerCard below), not a modal, and never
  // impression-capped — it just shows for as long as the admin leaves it
  // active.
  //
  // BUG FIX (product report: "the homebanner is not displaying at all
  // sometimes... when I minimize the app and open it again the homebanner
  // will not display"): this used to fetch exactly once per mount with no
  // way to recover — getHomeBanner() already retries transient failures a
  // few times internally now (see adsService.ts), but that's no help if the
  // ORIGINAL mount-time fetch happened before the network/auth token was
  // fully ready (a real possibility on the very first render) or if backgrounding/
  // foregrounding the OS app causes this screen to remount (Android in
  // particular can recreate the Activity under memory pressure) racing this
  // effect's own fetch against its cleanup's `cancelled` flag — either way,
  // once that one attempt was lost, nothing ever tried again for the rest
  // of the session. Now also re-fetches every time the app returns to the
  // foreground, the same AppState 'active' pattern already used elsewhere
  // in this file (see the unread-count and email-verification effects
  // above) — purely additive: a failed refetch here still just leaves
  // whatever banner (or lack of one) was already showing, same as before.
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

  return (
    <Container style={styles.container}>
      <HeaderHome
        name={profile?.name || t('home:default_user_name', { defaultValue: 'there' })}
        username={profile?.username}
        avatarUrl={profile?.avatarUrl}
        email={profile?.email ?? ''}
        notification={unreadCount}
      />
      <Content contentContainerStyle={styles.content} padder>
        {/* Day-of-week calendar strip (product request item, layout
            reference: a light/clean fitness-app screenshot's "Mon..Sun"
            week strip with today highlighted) — own self-contained
            component (src/home/WeekStrip.tsx) rather than inline here,
            same reasoning as DailyChallengeCard/PersonalizationCard. Only
            marks TODAY specially (highlighted circle + a checked-in dot) —
            this app has no per-date practice log to honestly mark other
            days with, see that component's own comment. */}
        <WeekStrip checkedInToday={!!streak?.checkedInToday} />
        {isSignedIn && !emailVerified ? (
          <Flex
            style={styles.verifyBanner}
            justify="flex-start"
            itemsCenter
            mb={16}>
            <Icon
              pack="eva"
              name="email-outline"
              style={[globalStyle.icon20, { tintColor: theme['text-basic-color'] }]}
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
        {/* "Today's Briefing" (AI Career OS summary) card removed from here
            (manual product edit) — was previously rendered right above the
            promo banner when a real briefing narrative existed. See
            services/careerOsService.ts / CareerBriefingDetail.tsx if this
            comes back later. */}
        {/* Admin-configured promo banner (see the effect above) —
           deliberately rendered above the Goal Tips block regardless of
           its loading/empty state, per explicit product placement:
           "above the daily tip card". Only shows once a real, active
           placement="home_banner" ad exists (see onOpenHomeBanner) so a
           tap always has real content to navigate AdDetails to — no
           banner is shown at all until the admin creates one. */}

        {/* Pill-button row (product request item, screenshot reference —
            dark rounded filter-chip style) replacing what used to be a
            row of icon tiles, which itself had replaced three stacked
            full-width cards. Same three destinations, no icon box.
            Deliberately NOT all identical: Career Roadmap is the one filled
            pill — the "primary/active" slot, same visual role as the
            reference screenshot's dark "For you" chip — while Your
            Progress/Weekly Report are outline pills (transparent fill, dark
            border + dark text) per explicit follow-up ("I only want the
            career roadmap to have the dark color background the rest
            should have not background just a black color border and a
            black text"). Career Roadmap's fill was later changed again
            (separate follow-up: "change the background of the career
            roadmap pill button to the default blue color") from that dark
            chip color to the app's own established brand blue
            (color-primary-100, same token CtaButton.tsx uses) + white
            text, so it no longer shares a color with the other two pills'
            border/text ink. Horizontally scrollable so it degrades
            gracefully on narrow screens instead of ever wrapping or
            truncating a label. Your Progress/Weekly Report still use
            background-basic-color-6 for their border/text, not a literal
            black — that token is literally defined as the app's own
            text-basic-color (and vice versa for background-basic-color-1)
            — see constants/theme/light.json vs dark.json — so it's near-
            black in light mode and correctly flips to near-white in dark
            mode instead of rendering true black-on-black. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.navPillsRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            // Was background-basic-color-6 (the dark/near-black fill the
            // other two pills' outline still keys off) — per explicit
            // follow-up, this pill now uses the app's own established brand
            // blue instead (same color-primary-100 token CtaButton.tsx
            // uses), so it reads as "the" primary action of the row rather
            // than a neutral dark chip.
            style={[styles.navPill, { backgroundColor: theme['color-primary-100'] }]}
            onPress={() => navigate('CareerRoadmap')}>
            <Text category="h9-s" bold numberOfLines={1} style={{ color: theme['text-primary-color'] }}>
              {t('home:career_roadmap_card_title_short', { defaultValue: 'Career Roadmap' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.navPillOutline, { borderColor: theme['background-basic-color-6'] }]}
            onPress={() => navigate('MyProgress')}>
            <Text category="h9-s" bold numberOfLines={1} style={{ color: theme['background-basic-color-6'] }}>
              {t('home:your_progress', { defaultValue: 'Your Progress' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.navPillOutline, { borderColor: theme['background-basic-color-6'] }]}
            onPress={() => navigate('WeeklyCareerReport')}>
            <Text category="h9-s" bold numberOfLines={1} style={{ color: theme['background-basic-color-6'] }}>
              {t('home:weekly_career_report_short', { defaultValue: 'Weekly Report' })}
            </Text>
          </TouchableOpacity>
          {/* Badges pill REMOVED from here (product correction — "the badge
              button... place it before the medal icon in the XP card so
              that its more visible to users") — moved into the checkInCard
              below, immediately before the medal icon, instead of living in
              this scrollable nav row (see that JSX's own comment). Opens the
              same existing full-grid modal (components/BadgesModal.tsx). */}
        </ScrollView>
        {homeBanner ? (
          // Redesign v2 follow-up (product bug report — "remove the white
          // background from the homebanner card"): back to one plain view
          // (see homeBannerCard's own comment for why the shadow-driven
          // two-layer split is gone) — just the rounded clip + Image.
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.homeBannerCard, { width: bannerWidth, height: bannerHeight }]}
            onPress={onOpenHomeBanner}>
            <Image
              source={
                homeBanner.imageUrl
                  ? { uri: homeBanner.imageUrl }
                  : Images.homeBannerAiCoach
              }
              style={{ width: bannerWidth, height: bannerHeight }}
              // "contain" (not "cover") per explicit product direction: the
              // full banner image should always be visible, never cropped —
              // cover would zoom/crop whenever an admin-uploaded image_url's
              // aspect ratio doesn't exactly match 16:9. Since bannerHeight
              // above is computed to exactly match the bundled default
              // image's own 16:9 ratio, this produces identical (letterbox-
              // free) results for that image, and degrades gracefully
              // (letterboxed, not cropped) for a future admin image with a
              // different ratio.
              resizeMode="contain"
            />
          </TouchableOpacity>
        ) : null}
        {/* Day Streak / Sessions This Week / Average Score stat cards
            removed from here (manual product edit) — this dashboard no
            longer shows them at all; the same numbers are still available
            one tap away via the "Your Progress" pill above
            (src/practice/MyProgress.tsx). */}

        {/* Flat solid-blue card — was a GradientCard (react-native-linear-
            gradient) filling the WHOLE card. Removed after repeated,
            persistent clipping of whatever content sits at the bottom of
            this card (the check-in pill/button), even after three separate
            rounds of reshaping the JSX/styles inside it. Root cause: a
            full-size LinearGradient carries `overflow:'hidden'` with no
            explicit height, and (unlike a plain View) doesn't reliably grow
            to wrap its own children's intrinsic height in every layout pass
            — so anything past whatever height it settles on gets silently
            clipped, no matter how the content itself is laid out.
            Follow-up (product request — "add the other blue color gradient
            back, concentrated at the top-right corner"): a small, FIXED-SIZE
            (170x170, not auto-measured) LinearGradient accent, absolutely
            positioned in the corner — since position:absolute takes it out
            of flow entirely, it can never influence this card's real
            height/layout no matter what happens to its own size, so it
            can't reintroduce the original bug. Outer/inner split (shadow on
            the outer plain View, `overflow:'hidden'` + the accent + real
            content on the inner plain View) purely so the accent clips to
            the card's rounded corners without clipping the outer shadow
            too (a View can't cast a shadow and clip its own content at the
            same time) — both are still plain Views, not LinearGradients, so
            neither has the intrinsic-sizing problem the old GradientCard
            did. The ring shows streak progress toward a 7-day week (purely
            a visual framing — streakDays itself is uncapped elsewhere, e.g.
            the badge-unlock thresholds below) with the raw day count
            centered inside it. The award icon (top-right, gold) is a purely
            decorative gamification cue — same color convention
            components/StarRating.tsx already uses for a "you earned this"
            visual. Check-in action is a plain TouchableOpacity, not
            CtaButton/<Button>, specifically so it can be an inverted
            white-pill/blue-text control that reads against the solid blue
            fill — CtaButton always renders white text on a colored fill by
            design (see its own comment), which would be invisible here. */}
        <View style={styles.checkInCard}>
          <View style={styles.checkInCardInner}>
            {/* Product follow-up ("still looking bare compared to the 3
                screenshots" — wellness-app-inspired reskin): this accent
                had been quietly neutered to a transparent-to-transparent
                gradient at some point (probably testing/an intermediate
                edit), so the card rendered as a plain white/gray box with
                only a thin blue ring — nowhere near the bold, saturated
                color-blocking every one of the 3 reference screenshots
                actually uses. Real blue gradient wash again, and bigger
                (280 vs the old 170) so it reads as genuine color, not a
                whisper in the corner — still fixed-size + absolutely
                positioned, so it still can't reintroduce the old clipping
                bug this component's own history warns about. */}
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(0, 99, 248, 0.30)', 'rgba(29, 161, 242, 0.05)']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0.15, y: 0.9 }}
              style={styles.checkInCardAccent}
            />
          {/* Redesign v7 (product follow-up — "leave the XP progress bar at
              the top there and now move the badge button to the top too so
              that both the progress bar and the badge will be at the top"):
              back to one merged row (ring, XP value/error, Badges button,
              medal icon), same shape as the earlier v4 attempt -- but this
              time the ring is the SMALLER v6 size (68, not 100), which is
              what actually makes the Badges button/medal icon read as
              sitting "at the top" alongside the ring instead of sunk
              against a much taller element next to them. */}
          <View style={styles.checkInTopRow}>
            <CircularProgress
              progress={Math.min(100, (streakDays / 7) * 100)}
              size={72}
              strokeWidth={8}
              trackColor="#0063f81f"
              gradientFrom="#1DA1F2"
              gradientTo="#0063f8"
              style={styles.checkInRing}>
              <Text category="h6" bold style={styles.checkInRingText}>
                {streakDays}
              </Text>
            </CircularProgress>
            <View style={globalStyle.flexOne}>
              <Text category="h7" bold style={styles.checkInValue} numberOfLines={1}>
                {streakLoading && !streak ? '—' : `${streak?.xp ?? 0} ${t('home:xp_label', {defaultValue: 'XP'})}`}
              </Text>
              {streakError ? (
                <Flex justify="flex-start" itemsCenter mt={6}>
                  <Text category="h10" mr={12} style={styles.checkInError}>
                    {streakError}
                  </Text>
                  <Text category="h10" bold style={styles.checkInRetry} onPress={loadStreak}>
                    {t('common:try_again', { defaultValue: 'Try again' }).toString()}
                  </Text>
                </Flex>
              ) : null}
            </View>
            <Image source={Images.xpMedal} style={styles.checkInMedalIcon} resizeMode="cover" />
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.checkInBadgesButton}
              onPress={() => setIsBadgesModalVisible(true)}>
              <Text category="h10" bold style={styles.checkInButtonText} numberOfLines={1}>
                {t('home:badges', { defaultValue: 'Badges' })}
              </Text>
            </TouchableOpacity>
          </View>
          {streak?.checkedInToday ? (
            // Solid white pill + blue checkmark — was a translucent
            // white-on-white-ish fill (too low contrast to read clearly
            // against the gradient), now matches checkInButton's own solid
            // white pill exactly (just a checkmark + label instead of an
            // actionable label — this is a completed state, not a live
            // action).
            <View style={[styles.checkInButton, styles.checkedInPill]}>
              <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon16, styles.checkedInIcon]} />
              <Text category="h9-s" bold style={[styles.checkInButtonText, { marginLeft: 4 }]} numberOfLines={1}>
                {t('home:checked_in_today', { defaultValue: 'Checked in' })}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={checkingIn || streakLoading || !!streakError}
              onPress={onCheckIn}
              style={[
                styles.checkInButton,
                (checkingIn || streakLoading || !!streakError) && styles.checkInButtonDisabled,
              ]}>
              {checkingIn ? (
                <Spinner size="tiny" status="primary" />
              ) : (
                <Text category="h9-s" bold style={styles.checkInButtonText} numberOfLines={1}>
                  {t('home:check_in', { defaultValue: 'Check In' })}
                </Text>
              )}
            </TouchableOpacity>
          )}
        {/* Weekly Practice chart removed from here (decluttering pass) — it
            was a plain duplicate of MyProgress.tsx's own "This week" chart
            (same computeWeeklyPractice data), reachable one tap away via
            the "Your Progress" pill above, so keeping it here too was pure
            repetition rather than something Home uniquely needed. */}
        <Flex justify="space-between" itemsCenter mt={32} mb={16}>
          <Text category="h7" bold style={{color: '#0063f8'}}>
            {t('home:upcoming_session', { defaultValue: 'Upcoming Session' })}
          </Text>
          <Text category="h9" status="link" bold onPress={() => navigate('ScheduleInterview')} style={{color: '#0063f8'}}>
            {t('home:schedule_new', { defaultValue: '+ Schedule' })}
          </Text>
        </Flex>
        {nextSession ? (
          <Flex
            level="2"
            style={styles.upcomingCard}
            justify="flex-start"
            itemsCenter
            onPress={() =>
              navigate('MockInterviewSetup', {
                interviewType: nextSession.interviewType,
                mode: nextSession.mode,
                difficulty: nextSession.difficulty,
                role: nextSession.role,
                company: nextSession.company,
                durationMin: nextSession.durationMin,
              })
            }>
            <View style={globalStyle.flexOne}>
              <Text category="h7" bold>
                {getInterviewTypeLabel(nextSession.interviewType, t)}
              </Text>
              <Text category="h9-s" status="placeholder" mt={4}>
                {new Date(nextSession.scheduledAt).toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
              <Text category="h9-s" status="placeholder" mt={2}>
                {getPracticeModeLabel(nextSession.mode, t)} · {getDifficultyLabel(nextSession.difficulty, t)} ·{' '}
                {nextSession.durationMin} {t('find:minutes_unit', {defaultValue: 'min'})}
              </Text>
            </View>
            <Icon pack="assets" name="arrowRight" style={globalStyle.icon16} />
          </Flex>
        ) : (
          <Flex
            level="2"
            style={styles.upcomingCard}
            justify="flex-start"
            itemsCenter
            onPress={() => navigate('ScheduleInterview')}>
            <View style={globalStyle.flexOne}>
              <Text category="h9-s" status="placeholder">
                {t('home:no_upcoming_session', {
                  defaultValue: 'Nothing scheduled yet — set a reminder for your next mock interview.',
                })}
              </Text>
            </View>
            <Icon pack="eva" name="plus-circle-outline" style={[globalStyle.icon20, { tintColor: theme['text-basic-color'] }]} />
          </Flex>
        )}
          </View>
        </View>

        {/* Surprise Daily Challenge (product request item) — one
            unpredictable practice challenge a day, own self-contained
            component (src/home/DailyChallengeCard.tsx) rather than inline
            here, since it owns its own fetch/submit/skip state and this
            file is already large. Renders nothing (returns null) if the
            feature flag is off or there's no challenge to show, so it's
            safe to always mount here unconditionally. */}
        <DailyChallengeCard />

        {/* Career DNA + Dream Company Dashboard (product request item) —
            one combined card (src/home/PersonalizationCard.tsx) rather than
            two separate nav-row pills, per explicit follow-up. Renders
            nothing if both underlying features are flagged off. */}
        <PersonalizationCard />

        {/* Dropped the standalone "Ready to practice?" CTA banner (UI
            cleanup pass) — it pushed the same "go start an interview"
            action as both the Upcoming Session card right above it and the
            dedicated Practice tab in the bottom nav (navigation/
            MainBottomTab.tsx's "Find" tab, repurposed as the practice hub).
            Three entry points to the same action on one screen was noise,
            not helpfulness. */}

        {/* Leaderboard preview — brought back per explicit follow-up
            ("bring back the leaderboard to the homescreen and make it look
            more nice") after a brief decluttering pass had swapped it out
            for a nav pill only. Redesigned rather than just restored:
            wrapped in the same bordered/transparent-fill card every other
            section on this screen now uses (was bare unstyled rows before),
            top-3 ranks get a colored medal badge instead of plain "#N" text,
            and the current user's row gets its own tinted pill instead of a
            flat background swap on an otherwise plain row. Still just the
            top 4 with a "View all" into src/home/Leaderboard.tsx for the
            same reason that screen's own comment gives — one fetch, one
            source of truth for "top N". */}
        <Flex justify="space-between" itemsCenter mt={24} mb={12}>
          <Text category="h7" bold>
            {t('home:leaderboard', { defaultValue: 'Leaderboard' })} 
          </Text>
          {/* Was category="h10" (12px, not bold) — the thinnest text style
              in the app, mismatched against every other "link" affordance
              on this screen. Matched to the same category="h9" bold used by
              the Upcoming Session card's "+ Schedule" link right above this
              section, so both read as the same weight of tappable link. */}
          <Text category="h9" status="link" bold onPress={() => navigate('Leaderboard')}>
            {t('common:view_all', { defaultValue: 'View all' })}
          </Text>
        </Flex>
        <Layout level="1" style={styles.leaderboardCard}>
          {leaderboardLoading ? (
            <Flex itemsCenter justify="center" style={styles.leaderboardStatus}>
              <Spinner size="small" />
            </Flex>
          ) : leaderboardError ? (
            <Flex vertical itemsCenter justify="center" style={styles.leaderboardStatus}>
              <Text category="h10" status="danger" center mb={8}>
                {leaderboardError}
              </Text>
              <Text category="h10" status="link" onPress={loadLeaderboard}>
                {t('common:try_again', { defaultValue: 'Try again' }).toString()}
              </Text>
            </Flex>
          ) : leaderboard.length === 0 ? (
            <Text category="h9-s" status="placeholder" center style={styles.leaderboardStatus}>
              {t('home:leaderboard_empty', { defaultValue: 'No leaderboard data yet.' })}
            </Text>
          ) : (
            leaderboard.slice(0, 4).map((entry, index) => {
              const medal = rankMedalStyle(entry.rank, theme);
              return (
                <View
                  key={entry.id}
                  style={[
                    styles.leaderboardRow,
                    index > 0 && globalStyle.divider,
                    entry.isCurrentUser && { backgroundColor: theme['color-primary-transparent-100'] },
                  ]}>
                  <View style={[styles.leaderboardRank]}>
                    {/* Trophy icon instead of the "1" for whoever's leading,
                        per explicit follow-up — every other rank keeps its
                        plain number badge. */}
                    {entry.rank === 1 ? (
                      
                      <Text>🏆</Text>
                    ) : (
                      <Text category="h9-s" bold style={{ color: medal.text }}>
                        {entry.rank}
                      </Text>
                    )}
                  </View>
                  {/* Bumped tiny (24px) -> small (32px) -> medium (40px)
                      across two follow-ups ("too small", then "increase it
                      more again"), and shape switched to fully circular
                      ("round") instead of the component's default rounded-
                      square per explicit request — see UserAvatar.tsx's
                      `shape` prop, scoped to this one call site so every
                      other UserAvatar usage in the app (Edit Profile,
                      Profile tab, More/Home headers, etc.) keeps its
                      original look. */}
                  <UserAvatar
                    uri={entry.avatarUrl}
                    name={entry.name}
                    size="medium"
                    shape="round"
                    style={styles.leaderboardAvatar}
                  />
                  <Text category="h9-s" bold numberOfLines={1} style={globalStyle.flexOne}>
                    {entry.name}
                    {entry.isCurrentUser ? ` (${t('home:you', { defaultValue: 'You' })})` : ''}
                  </Text>
                  <Text category="h10" status="placeholder">
                    {entry.xp} {t('home:xp_label', {defaultValue: 'XP'})}
                  </Text>
                </View>
              );
            })
          )}
        </Layout>
      </Content>
      {/* Admin-configured ad popup — only rendered visible when a real,
          still-eligible ad was found (see the effect above); tapping its
          single action opens AdDetails.tsx with that ad's full write-up,
          matching "when users click on the advert it takes them to the
          screen that gives them more detail." */}
      <ModalRequest
        visible={adVisible}
        show={showAd}
        hide={onDismissAd}
        name={pendingAd?.title ?? ''}
        avatar={Images.logoBadge}
        isOnl={false}
        message={pendingAd?.body}
        onDetails={onOpenAd}
        detailsLabel={t('common:view_details', { defaultValue: 'View Details' })}
        showCancel
      />
      <AppTour visible={showTour} onClose={onCloseTour} />
      <AppRatingModal visible={showRatingPrompt} onSubmit={onSubmitRating} onDismiss={onDismissRating} />
      <BadgesModal
        visible={isBadgesModalVisible}
        unlockedBadgeIds={unlockedBadgeIds}
        onClose={() => setIsBadgesModalVisible(false)}
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
  verifyBanner: {
    ...globalStyle.card,
    // Was 14/14 -- every other card on this screen (briefingCard,
    // progressCard, statCard, etc.) uses borderRadius 16 /
    // padding 16; this was the one outlier. Task #66 visual polish pass.
    padding: 16,
    marginTop: 16,
    // Redesign v2 (full reskin): `card` carries a real soft shadow again
    // (see globalStyle.ts), which needs an opaque fill to render correctly
    // (was 'transparent' for the border-only ZipRecruiter direction — a
    // shadow behind a transparent view looks broken/invisible, especially
    // on Android). The warning-colored border stays as the "needs
    // attention" accent on top of that opaque fill.
    backgroundColor: 'background-basic-color-2',
    borderWidth: 1,
    borderColor: 'color-warning-500',
  },
  // Redesign v2 follow-up (product bug report — "remove the white
  // background from the homebanner card"): dropped globalStyle.card
  // entirely here (no shadow, no opaque backing fill) instead of just
  // swapping the fill to a different color. The two-layer shadow/clip
  // split (see checkInCardOuter/Inner elsewhere on this screen) only
  // exists to give Android's elevation shadow an opaque silhouette to
  // render against — with no shadow at all on this card, that requirement
  // goes away too, so this collapsed back to one view: just the rounded
  // clip + the Image, genuinely transparent (no fill color standing in
  // behind it, e.g. if an admin-uploaded image's aspect ratio doesn't
  // exactly fill the card and lets a sliver of background show through).
  homeBannerCard: {
    // width/height are computed per-render from actual screen width (see
    // bannerWidth/bannerHeight above the component's return statement) and
    // applied inline, not here — a plain aspectRatio here previously
    // rendered at the source image's raw pixel size instead of scaling to
    // the card, see bannerWidth's own comment for the full explanation.
    marginTop: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  verifyBannerText: {
    marginHorizontal: 10,
  },
  // Pill-button row replacing the old icon-tile row (see the JSX comment
  // above this style's usage). contentContainerStyle on a horizontal
  // ScrollView (this row's own, nested inside <Content padder>'s existing
  // 24pt horizontal inset) rather than a plain View style, since this now
  // scrolls independently of the rest of the vertically-scrolling screen.
  navPillsRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  navPill: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 10,
  },
  // Outline variant (Your Progress/Weekly Report) — same shape/padding as
  // the filled navPill, transparent fill instead, border color/text color
  // applied inline per-usage (see JSX) since it's the same
  // background-basic-color-6 token as the filled pill's fill, just used as
  // ink here instead.
  navPillOutline: {
    borderRadius: 999,
    paddingVertical: 11,
    borderWidth: 1,
    paddingHorizontal: 19,
    marginRight: 10,
    backgroundColor: 'transparent',
  },
  upcomingCard: {
    ...globalStyle.card,
    padding: 16,
    // BUG FIX (product report, screenshot of dark mode: "the upcoming
    // session is making the UI look terrible in dark mode") — the previous
    // fill was a LITERAL hex (#EAF3FF), a good soft-blue tint in LIGHT mode
    // only; with no light/dark switch of its own, dark mode rendered the
    // exact same bright near-white card, a jarring pale block against the
    // rest of the dark screen. 'color-badge-info-bg' is a real theme token
    // (constants/theme/appTheme.json for light, dark.json for dark) with a
    // proper value for each mode, so this now reads as a subtle blue TINT
    // in both themes instead of a flat white block in one of them. Same
    // root cause fixed for every other pastel stat-tile background this
    // reskin introduced (MyProgress.tsx, WeeklyCareerReport.tsx,
    // CareerDna.tsx) — all of them were reading appTheme.json's flat,
    // theme-blind hex values with no dark.json override until this pass.
    // Still fully opaque either way, so `card`'s Android shadow still
    // renders correctly.
    backgroundColor: 'color-badge-info-bg',
  },
  // Flat solid-blue card (gradient removed — see the JSX comment above for
  // why) — outer layer just casts the shadow (no overflow:'hidden' here;
  // that would clip the shadow itself on iOS, same reason GradientCard's
  // own outer/inner split existed).
  checkInCard: {
    ...globalStyle.card,
    marginTop: 16,
    borderRadius: 24,
    // BUG FIX (product report: "make the XP card and its content look nice
    // in dark mode its looking so bad") — 'color-primary-000' is a fixed
    // "#FFFFFF" in constants/theme/appTheme.json with no dark-mode override
    // anywhere (dark.json never redefines it), so this card stayed pure
    // white even in dark mode, clashing hard against the dark surrounding
    // screen. 'background-basic-color-2' IS defined per-theme (light.json:
    // "$color-basic-100" -> the same "#FFFFFF", so light mode is visually
    // unchanged; dark.json: "#1B1B2E", a dark navy that actually matches
    // the rest of a dark-mode screen) — the ring/text/button colors below
    // are all either already blue-on-light-surface (readable against a
    // dark navy card too) or a solid white pill, so no other change is
    // needed for this card to read correctly in both themes.
    backgroundColor: 'background-basic-color-2',
  },
  // Inner layer: `overflow:'hidden'` so the corner accent (see JSX comment)
  // clips to the card's rounded corners, `position:'relative'` so that
  // accent's `position:'absolute'` is measured against THIS box. One row:
  // ring, XP text (flexOne — absorbs/shrinks to whatever's left), action
  // pill/button flexed to the right. An earlier pass split this into two
  // stacked rows to fix a clipping bug caused by the button's own
  // hardcoded `minWidth` — reverted per explicit follow-up ("flex it to
  // the right the way it used to be"); the actual fix this time is on the
  // button/pill itself (no more minWidth, numberOfLines=1 labels — see
  // checkInButton below) rather than changing the row shape.
  checkInCardInner: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    padding: 16,
  },
  // Decorative accent (product request — "add the other blue color
  // gradient back, concentrated at the top-right corner"). Fixed size, not
  // auto-measured — position:'absolute' takes it out of flow entirely, so
  // it can never affect this card's real height (see the JSX comment for
  // why that matters). Deliberately bigger than it needs to be and
  // positioned past the top-right corner (negative offsets) so the visible
  // wedge reads as a soft directional wash rather than a hard-edged circle.
  checkInCardAccent: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  // Gamification cue (product request — "use this medal in the XP card
  // instead of the one there", the uploaded 3D gold medal/ribbon graphic —
  // see assets/images/index.ts's `xpMedal` for the asset itself). Redesign
  // v7: sits in normal flow inside checkInTopRow, right after the Badges
  // button, at the end of the same row as the ring/XP text — explicit
  // width/height still needed since this is a real image with its own
  // aspect ratio (~36:46, taller than wide because of the ribbon tails),
  // not a square glyph.
  checkInMedalIcon: {
    width: 28,
    height: 36,
  },
  // Small outlined pill, sized down from checkInButton (h10 label, tighter
  // padding). Redesign v7 (product follow-up — "leave the XP progress bar
  // at the top there and now move the badge button to the top too so that
  // both... will be at the top"): shares checkInTopRow with the ring/XP
  // text now (not its own row below/above it) — the smaller v6 ring size
  // is what makes this read as sitting at the same top level as the ring,
  // rather than sunk against a much taller element.
  checkInBadgesButton: {
    marginLeft: 8,
    marginRight: 8,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // Product follow-up ("remove the gray background... they both should
    // be transparent") — 'background-basic-color-3' (the previous dark-mode
    // fix) read as an unwanted gray fill; just the blue outline/text reads
    // as a pill on its own against the card, no fill needed in either theme.
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#0063f8',
  },
  checkInTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Redesign v6: 100 -> 68 (see checkInTopRow's own comment) — marginRight
  // trimmed to match the smaller ring so it doesn't look overly spaced
  // from the XP text next to it.
  checkInRing: {
    marginRight: 12,
  },
  checkInRingText: {
    color: '#0063f8',
  },
  // checkInLabel (the standalone "XP" caption above the "39 XP" value) was
  // removed as part of the row-width fix above — no reader left.
  checkInValue: {
    color: '#0063f8',
  },
  checkInError: {
    color: '#FFE3E3',
  },
  checkInRetry: {
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
  // Layered on top of checkInButton's own white-pill shape/spacing/padding
  // (see the JSX above, [styles.checkInButton, styles.checkedInPill]) —
  // this just adds the icon+label row direction, everything else (bg,
  // radius, padding, margin) is shared/inherited from checkInButton.
  checkedInPill: {
    flexDirection: 'row',
  },
  checkedInIcon: {
    tintColor: '#0063f8',
  },
  // alignSelf: 'flex-end' — its own row, hugging only its own content and
  // right-aligned (below the merged ring/XP/Badges/medal row above it). No
  // minWidth, so it's exactly as wide as its icon/spinner +
  // numberOfLines=1 label need, never more.
  checkInButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    // Product follow-up ("remove the gray background... they both should
    // be transparent") — same fix as checkInBadgesButton just above.
    // Covers both the live "Check In" button and (via [checkInButton,
    // checkedInPill]) the "Checked in" completed-state pill.
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#0063f8'
  },
  checkInButtonDisabled: {
    opacity: 0.6,
  },
  checkInButtonText: {
    color: '#0063f8',
  },
  // Leaderboard preview card (see the JSX comment above where this is
  // used) — same bordered/transparent-fill treatment as every other card
  // on this screen; padding is smaller than the others (8, not 16) since
  // each row already carries its own vertical padding, and a second full
  // 16px on top of that made the rows feel oddly far from the card edge.
  leaderboardCard: {
    ...globalStyle.card,
    marginTop: 8,
    padding: 12,
    // Redesign v2 (full reskin): opaque fill again so `card`'s shadow
    // renders correctly (was 'transparent', overriding this Layout's own
    // `level="1"` background — see the JSX usage below).
    backgroundColor: 'background-basic-color-2',
  },
  leaderboardStatus: {
    paddingVertical: 24,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  leaderboardRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  leaderboardAvatar: {
    marginRight: 10,
  },
});
