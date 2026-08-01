import React, { memo } from 'react';
import { Alert, AppState, Image, ScrollView, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleService, useStyleSheet, useTheme, Icon, Layout, Button, Spinner } from '@ui-kitten/components';
// Redesign (product request item, ZipRecruiter reference) — primary CTA
// buttons (the daily XP check-in, the Pro upgrade prompt) get the new
// mint-green/black-text look; secondary/contextual actions (Resend, Try
// again above) stay as plain UI Kitten <Button> — see CtaButton.tsx's own
// comment for why it's reserved for "the" primary action, not every button.
import CtaButton from 'components/CtaButton';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';

import Content from 'components/Content';
import Container from 'components/Container';
import HeaderHome from './Components/HeaderHome';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from 'navigation/types';
import Text from 'components/Text';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { getInterviewTypeLabel } from 'utils/interviewTypeLabels';
import useLayout from 'hooks/useLayout';
import { AdvertisementProps, EKeyAsyncStorage, GamificationStreakProps, Interview_Type_Enum, LeaderboardEntryProps, MockInterviewSessionProps, ScheduledInterviewProps } from 'constants/Types';
import UserAvatar from 'components/UserAvatar';
import * as interviewService from 'services/interviewService';
import * as resumeService from 'services/resumeService';
import * as networkingService from 'services/networkingService';
import * as gamificationService from 'services/gamificationService';
import * as notificationService from 'services/notificationService';
import * as careerOsService from 'services/careerOsService';
import * as roadmapService from 'services/roadmapService';
import * as scheduledInterviewService from 'services/scheduledInterviewService';
import * as adsService from 'services/adsService';
import * as jobShareService from 'services/jobShareService';
import {navigateToJobAlertDetails} from 'navigation/navigationRef';
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
      return { bg: '#2574ff', text: '#FFFFFF' };
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
  const bannerHeight = Math.round(bannerWidth * (799 / 1922));
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home', 'common']);
  const { isSignedIn, emailVerified, resendVerificationEmail, refreshEmailVerified, profile, isPro } =
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
    AsyncStorage.setItem(EKeyAsyncStorage.appTourSeen, '1').catch(() => {});
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
    appRatingService.dismissRatingPrompt().catch(() => {});
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

  // AI Career Operating System briefing — product request item, the user's
  // stated "dream feature": one cohesive AI-written summary of what matters
  // today, synthesizing streak/applications/scheduled interviews/goal tip
  // into a single narrative instead of the user piecing it together from
  // five different screens. See services/careerOsService.ts. Fetched for
  // every signed-in user (not gated to a paid tier) — it's a synthesis of
  // data the user already has access to elsewhere, not new AI content.
  const [briefing, setBriefing] = React.useState<{ narrative: string | null; priorities: { label: string; action: string }[]; isTeaser: boolean } | null>(null);
  React.useEffect(() => {
    careerOsService.getTodayBriefing().then(setBriefing).catch(() => {});
  }, []);

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
    roadmapService.getSavedRoadmap().then(setDashboardRoadmap).catch(() => {});
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

  // Real practice history (GET /api/v1/interviews/sessions) — was fetched
  // below already (for badge-unlock logic) but its result was discarded
  // everywhere else on this screen, leaving the weekly chart and these two
  // stat cards reading DATA_WEEKLY_PRACTICE/DATA_PAST_SESSIONS, two static
  // arrays that never reflected what any real account had actually done.
  // Now stored so all three can derive from the same real fetch.
  const [practiceHistory, setPracticeHistory] = React.useState<MockInterviewSessionProps[]>([]);
  const completedSessions = React.useMemo(
    () => practiceHistory.filter(s => s.status === 'Completed'),
    [practiceHistory],
  );
  const weeklyPractice = React.useMemo(
    () => interviewService.computeWeeklyPractice(completedSessions),
    [completedSessions],
  );
  const sessionsThisWeek = weeklyPractice.reduce((sum, d) => sum + d.sessions, 0);
  const scoredSessions = completedSessions.filter(s => typeof s.overallScore === 'number');
  const avgScore = scoredSessions.length
    ? Math.round(scoredSessions.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) / scoredSessions.length)
    : 0;

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

  // Was a plain useEffect keyed only on [streakDays] — practice history (and
  // therefore the Weekly Practice chart, Sessions This Week / Average Score
  // stat cards, all derived from it via the useMemos above) only ever
  // refetched on mount or when the streak day-count happened to change.
  // Completing another interview and coming back to Home doesn't bump
  // streakDays if the user already checked in today, so the chart looked
  // permanently frozen no matter how many sessions were completed —
  // reported as "the chart just remained static." useFocusEffect (already
  // used below for upcomingSessions) re-runs this every time the Home tab
  // regains focus, which is exactly when a just-finished interview would
  // land back here.
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
        setPracticeHistory(history);
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
  const {visible: adVisible, show: showAd, hide: hideAd} = useModal();
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
        adsService.recordImpression(ad.id).catch(() => {});
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
      navigate('AdDetails', {ad: adRef.current});
    }
  }, [hideAd, navigate]);

  // Admin-configured Home banner — GET /api/v1/ads/banner (see
  // services/adsService.ts's getHomeBanner, backend's app/api/ads.py).
  // Separate surface from the popup ad above: rendered as a persistent
  // card (see styles.homeBannerCard below), not a modal, and never
  // impression-capped — it just shows for as long as the admin leaves it
  // active. Fetched once per mount, same as the popup ad fetch.
  const [homeBanner, setHomeBanner] = React.useState<AdvertisementProps | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    adsService.getHomeBanner().then(banner => {
      if (!cancelled) setHomeBanner(banner);
    }).catch(() => {
      // Offline or the request failed — no banner this session, same
      // fail-quiet behavior as the popup ad fetch above.
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const onOpenHomeBanner = React.useCallback(() => {
    if (homeBanner) {
      navigate('AdDetails', {ad: homeBanner});
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
        {briefing?.narrative ? (
          // Visual redesign (task #42): was a plain, unbordered card
          // indistinguishable from every other card on the dashboard, for
          // what the user described as their "dream feature" — now has a
          // colored icon badge (matching the icon-in-circle treatment used
          // elsewhere in the app) and a subtle primary-tinted border so it
          // reads as the standout card it's meant to be. The teaser variant
          // (briefing.isTeaser — a user with nothing real to synthesize yet,
          // see careerOsService.ts) swaps the icon/title to a "Get Started"
          // framing and, for free users specifically, adds an upgrade CTA —
          // previously this state didn't render at all.
          <Layout
            level="1"
            style={[
              styles.briefingCard,
              { borderColor: theme['color-primary-transparent-300'], display:'none' },
            ]}
          >
            <Flex justify="flex-start" itemsCenter mb={8}>
              <View style={[styles.briefingIconBadge, { backgroundColor: theme['background-basic-color-2'] }]}>
                {briefing.isTeaser ? (
                  // No "rocket"/launch icon exists in the custom "assets"
                  // pack (see assets/icons/index.ts — it's a fixed template
                  // icon list). bulb-outline is a real eva-pack icon already
                  // used elsewhere in this app for the same "here's a tip to
                  // get going" meaning (see StudentVerification.tsx's perks
                  // list) rather than risking a silently-missing custom icon.
                  <Icon pack="eva" name="bulb-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                ) : (
                  <Icon pack="assets" name="rateFull" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                )}
              </View>
              <Text category="h8" bold ml={10}>
                {briefing.isTeaser
                  ? t('home:career_os_get_started_title', { defaultValue: 'Get Started' })
                  : t('home:career_os_briefing_title', { defaultValue: "Today's Briefing" })}
              </Text>
            </Flex>
            {/* Was the full narrative inline — often several sentences long,
               which made this card dominate the dashboard. Truncated to a
               3-line preview with a "Read more" arrow into
               CareerBriefingDetail.tsx, which shows the complete narrative
               plus all priorities. */}
            <Text category="h9-s" numberOfLines={3} style={{ lineHeight: 19 }}>{briefing.narrative}</Text>
            {/* status="primary" resolves to near-white in this theme (meant
               for text sitting on a solid color-primary button, not a light
               card) -- that's why "Read more" was invisible and only the
               arrow showed. status="link" is what the rest of the app
               already uses for this exact kind of inline text link (see
               DailyIndustryNews.tsx's "Try again"). Right-aligned
               (justify="flex-end") so it reads as a compact link tucked
               under the truncated paragraph instead of a wide, oddly
               spaced row. */}
            <Flex
              justify="flex-end"
              itemsCenter
              mt={2}
              onPress={() => navigate('CareerBriefingDetail', { narrative: briefing.narrative!, priorities: briefing.priorities, isTeaser: briefing.isTeaser })}
            >
              <Text category="h10" status="link" bold>
                {t('home:read_more', { defaultValue: 'Read more' })}
              </Text>
              <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, { marginLeft: 4, tintColor: theme['color-primary-500'] }]} />
            </Flex>
            {/* Priorities used to render here too — moved entirely into
               CareerBriefingDetail.tsx (behind "Read more") so this card
               stays a short, scannable preview rather than duplicating the
               full breakdown on the dashboard itself. */}
            {briefing.isTeaser && !isPro ? (
              <CtaButton
                size="small"
                style={{ marginTop: 12 }}
                onPress={() => navigate('Subscription')}
              >
                {t('home:career_os_upgrade_cta', { defaultValue: 'See Pro plans' })}
              </CtaButton>
            ) : null}
          </Layout>
        ) : null}
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
          {/* Badges pill added here (product follow-up, decluttering pass —
              "remove too much things and place them in a different page if
              necessary") — opens the existing full-grid modal
              (components/BadgesModal.tsx) instead of a stacked preview row
              on the dashboard. Leaderboard's own pill was added in that
              same pass but has since been removed again: per a later
              follow-up ("bring back the leaderboard to the homescreen and
              make it look more nice"), the live leaderboard preview card is
              back further down this screen with its own "View all" link
              into src/home/Leaderboard.tsx — keeping the pill too would
              have meant two entry points to the same screen on one
              dashboard. */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.navPillOutline, { borderColor: theme['background-basic-color-6'] }]}
            onPress={() => setIsBadgesModalVisible(true)}>
            <Text category="h9-s" bold numberOfLines={1} style={{ color: theme['background-basic-color-6'] }}>
              {t('home:badges', { defaultValue: 'Badges' })}
            </Text>
          </TouchableOpacity>
        </ScrollView>
        {homeBanner ? (
          // Was a shadow on an outer wrapper View (a view can't both clip
          // content to rounded corners via overflow:'hidden' AND cast a
          // visible shadow itself, since overflow:hidden clips the shadow
          // too — hence the old two-View split). Redesign sweep: this is a
          // content card exactly like every job/tip/goal card elsewhere on
          // this screen, so it gets the same border treatment, not a
          // shadow — and a border has no such conflict with overflow:
          // hidden, so the extra wrapper View isn't needed anymore either.
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.homeBannerCard, {width: bannerWidth, height: bannerHeight}]}
            onPress={onOpenHomeBanner}>
            <Image
              source={
                homeBanner.imageUrl
                  ? {uri: homeBanner.imageUrl}
                  : Images.homeBannerAiCoach
              }
              style={{width: bannerWidth, height: bannerHeight}}
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
        {/* Redesign (product follow-up, exact "New on ZipRecruiter" promo-
            card screenshot reference this time — a small colored icon pill
            at the top, a bold headline below it, then a supporting
            description line underneath that) — was 3 side-by-side cards
            with just an icon + number + label each; now each stat is its
            own full-width card with that same pill/headline/description
            structure, stacked vertically per explicit follow-up ("make
            them stack on each other") instead of a row. One deliberate
            departure from the reference: no dismiss "X" in the corner —
            these are live stats, not a one-time promo a user can permanently
            close, so a close button would be a dead/misleading affordance
            here. Card itself goes back to the app's own established
            border-only/transparent surface (globalStyle.card, same as every
            other card on this screen) rather than the reference's solid
            fill, so it still matches the rest of the now-consistent app —
            the color accent lives on the pill instead, same role the
            reference's purple "Be Seen First" pill plays against its own
            plain white card. */}
        <View style={styles.statsColumn}>
          <Layout level="2" style={styles.statCard}>
            <View style={styles.statPill}>
              <Icon pack="assets" name="stats" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
              <Text category="h10" bold style={[styles.statPillText, { color: theme['background-basic-color-6'] }]}>
                {t('home:day_streak', { defaultValue: 'Day Streak' })}
              </Text>
            </View>
            {streakLoading && !streak ? (
              <Spinner size="small" style={styles.streakSpinner} />
            ) : (
              <Text category="h3" bold mt={12}>
                {t('home:day_streak_headline', { defaultValue: '{{count}}-day streak', count: streakDays })}
              </Text>
            )}
            <Text category="h9-s" status="placeholder" mt={4}>
              {t('home:day_streak_caption', { defaultValue: 'Keep practicing daily to build your streak.' })}
            </Text>
          </Layout>
          {/* <Layout level="2" style={styles.statCard}>
            <View style={styles.statPill}>
              <Icon pack="assets" name="interview" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
              <Text category="h10" bold style={[styles.statPillText, { color: theme['background-basic-color-6'] }]}>
                {t('home:sessions_this_week', { defaultValue: 'Sessions This Week' })}
              </Text>
            </View>
            <Text category="h3" bold mt={12}>
              {t('home:sessions_this_week_headline', { defaultValue: '{{count}} sessions this week', count: sessionsThisWeek })}
            </Text>
            <Text category="h9-s" status="placeholder" mt={4}>
              {t('home:sessions_this_week_caption', { defaultValue: 'Mock interviews completed in the last 7 days.' })}
            </Text>
          </Layout> */}
          {/* <Layout level="2" style={styles.statCard}>
            <View style={styles.statPill}>
              <Icon pack="assets" name="rateFull" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
              <Text category="h10" bold style={[styles.statPillText, { color: theme['background-basic-color-6'] }]}>
                {t('home:average_score', { defaultValue: 'Average Score' })}
              </Text>
            </View>
            <Text category="h3" bold mt={12}>
              {t('home:average_score_headline', { defaultValue: '{{score}}% average score', score: avgScore })}
            </Text>
            <Text category="h9-s" status="placeholder" mt={4}>
              {t('home:average_score_caption', { defaultValue: 'Your average across recent practice sessions.' })}
            </Text>
          </Layout> */}
        </View>

        {/* Two layers, not one (product bug: "extra white card behind" on
            Android, fine on iOS) -- Android's elevation shadow needs an
            OPAQUE background to compute a rounded shadow silhouette from;
            with the translucent amber tint directly on the same elevated
            view, Android falls back to a plain rectangular surface behind
            the rounded card. Outer view is opaque + carries the shadow;
            inner view carries the actual translucent tint/border, clipped
            to the same radius via overflow:hidden, sized identically so
            none of the outer's opaque fill peeks out -- only its shadow
            does. See styles.checkInCardOuter/checkInCardInner below. */}
        <View style={styles.checkInCardOuter}>
          <Layout level="2" style={styles.checkInCardInner}>
            <View style={globalStyle.flexOne}>
              <Text category="h9-s" status="placeholder">
                {t('home:xp_label', { defaultValue: 'XP' })}
              </Text>
              <Text category="h7" bold mt={2}>
                {streakLoading && !streak ? '—' : `${streak?.xp ?? 0} XP`}
              </Text>
              {streakError ? (
                <Flex justify="flex-start" itemsCenter mt={6}>
                  <Text category="h10" status="danger" mr={12}>
                    {streakError}
                  </Text>
                  <Text category="h10" status="link" onPress={loadStreak}>
                    {t('common:try_again', { defaultValue: 'Try again' }).toString()}
                  </Text>
                </Flex>
              ) : null}
            </View>
            {streak?.checkedInToday ? (
              // Already done today — a plain disabled/basic button reads as
              // "completed", not as another action to take. CtaButton is
              // reserved for an actual actionable primary CTA (see its own
              // comment), which this no longer is once checked in.
              <Button size="small" status="basic" disabled>
                {t('home:checked_in_today', { defaultValue: 'Checked in' })}
              </Button>
            ) : (
              <CtaButton
                size="small"
                disabled={checkingIn || streakLoading || !!streakError}
                onPress={onCheckIn}
                accessoryLeft={checkingIn ? renderCheckInSpinner : undefined}>
                {t('home:check_in', { defaultValue: 'Check In' })}
              </CtaButton>
            )}
          </Layout>
        </View>

        {/* Weekly Practice chart removed from here (decluttering pass) — it
            was a plain duplicate of MyProgress.tsx's own "This week" chart
            (same computeWeeklyPractice data), reachable one tap away via
            the "Your Progress" pill above, so keeping it here too was pure
            repetition rather than something Home uniquely needed. */}
        <Flex justify="space-between" itemsCenter mt={32} mb={16}>
          <Text category="h6" bold>
            {t('home:upcoming_session', { defaultValue: 'Upcoming Session' })}
          </Text>
          <Text category="h9" status="link" bold onPress={() => navigate('ScheduleInterview')}>
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
                {nextSession.mode} · {nextSession.difficulty} · {nextSession.durationMin} min
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
            {t('home:leaderboard', { defaultValue: 'Leaderboard' })} 🏆
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
                  <View style={[styles.leaderboardRank, { backgroundColor: medal.bg }]}>
                    <Text category="h9-s" bold style={{ color: medal.text }}>
                      {entry.rank}
                    </Text>
                  </View>
                  <UserAvatar uri={entry.avatarUrl} name={entry.name} size="tiny" style={styles.leaderboardAvatar} />
                  <Text category="h9-s" bold numberOfLines={1} style={globalStyle.flexOne}>
                    {entry.name}
                    {entry.isCurrentUser ? ` (${t('home:you', { defaultValue: 'You' })})` : ''}
                  </Text>
                  <Text category="h10" status="placeholder">
                    {entry.xp} XP
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
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    // No fill — border-only (app-wide "cards are transparent" pass); the
    // warning-colored border below stays as the deliberate "needs
    // attention" signal, it just no longer also has a gray fill behind it.
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'color-warning-500',
  },
  homeBannerCard: {
    ...globalStyle.card,
    // width/height are computed per-render from actual screen width (see
    // bannerWidth/bannerHeight above the component's return statement) and
    // applied inline, not here — a plain aspectRatio here previously
    // rendered at the source image's raw pixel size instead of scaling to
    // the card, see bannerWidth's own comment for the full explanation.
    marginTop: 16,
    overflow: 'hidden',
    borderWidth:0,
    backgroundColor: 'transparent',
  },
  briefingCard: {
    ...globalStyle.card,
    // Trimmed from 16 (product follow-up: "reduce the height of the
    // Today's Briefing card a little bit") — the icon badge/title row and
    // "Read more" row below also had their own margins tightened to match
    // (see the JSX), so the card reads slightly more compact overall
    // without dropping any content.
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
   
  },
  briefingIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
  // Vertical stack (product follow-up: "make them stack on each other") —
  // was a horizontal row of 3 equal-width cards; now a single column, full-
  // width cards one after another, each with its own bottom margin (see
  // statCard's marginBottom) instead of this container's justify-content
  // doing the spacing.
  statsColumn: {
    marginTop: 16,
  },
  statCard: {
    // Back to the app's own established border-only/transparent card (see
    // globalStyle.card's own comment) — the reference screenshot's card is
    // a solid flat fill, but that was a deliberate one-off departure from
    // this app's now-consistent "cards are transparent" look (see the JSX
    // comment above where these render); the accent color here lives on
    // the pill instead, same role the reference's colored pill plays
    // against its own plain white card.
    ...globalStyle.card,
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  // Small pill at the top of each stat card (product follow-up,
  // ZipRecruiter "Be Seen First" pill reference) — self-sized (alignSelf:
  // 'flex-start'), not full-width, same as the reference's own pill. Was
  // solid brand blue with white icon/text — per explicit follow-up this is
  // now a neutral gray fill instead, with the icon/text switched to dark
  // ink (color-primary-500/background-basic-color-6) for contrast against
  // the lighter gray rather than white-on-white.
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'background-basic-color-3',
  },
  statPillText: {
    marginLeft: 6,
  },
  streakSpinner: {
    marginTop: 8,
  },
  upcomingCard: {
    ...globalStyle.card,
    padding: 16,
    backgroundColor: 'transparent',
  },
  // Split in two (product bug: "extra white card behind" on Android) — see
  // the JSX comment above where these are used. Outer casts the shadow
  // against an OPAQUE background; inner carries the translucent amber tint.
  checkInCardOuter: {
    ...globalStyle.card,
    marginTop: 16,
    // Was an opaque fill (background-basic-color-1) — needed back when
    // `card` still carried Android `elevation` (see this style's own
    // original comment about the "extra white card behind" bug: elevation
    // needs an opaque background to compute a correctly-rounded shadow).
    // `card` is border-only now with no elevation at all, so that
    // requirement is gone — transparent brings this in line with every
    // other card in the app-wide "cards are transparent" pass. The inner
    // checkInCardInner's own translucent tint (see below) still renders
    // correctly on top either way, clipped to the same radius via its own
    // overflow:hidden.
    backgroundColor: 'transparent',
  },
  checkInCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    overflow: 'hidden',
    // Subtle warning tint to make the daily XP check-in stand out from the
    // neutral stat cards above it — was a plain themed Layout level="2".
    // backgroundColor: 'color-warning-transparent-200',
    borderWidth: 1,
    borderColor: 'color-warning-500',
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
    backgroundColor: 'transparent',
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
