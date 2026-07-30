import React, { memo } from 'react';
import { Alert, AppState, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleService, useStyleSheet, useTheme, Icon, Layout, Button, Spinner } from '@ui-kitten/components';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';

import Content from 'components/Content';
import Container from 'components/Container';
import HeaderHome from './Components/HeaderHome';
import UserAvatar from 'components/UserAvatar';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from 'navigation/types';
import Text from 'components/Text';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { chartConfig } from 'utils/chartConfig';
import { getInterviewTypeLabel } from 'utils/interviewTypeLabels';
import useLayout from 'hooks/useLayout';
import {
  DATA_BADGES,
} from 'constants/Data';
import { AdvertisementProps, EKeyAsyncStorage, GamificationStreakProps, GoalTipProps, Interview_Type_Enum, LeaderboardEntryProps, MockInterviewSessionProps, ScheduledInterviewProps } from 'constants/Types';
import * as interviewService from 'services/interviewService';
import * as resumeService from 'services/resumeService';
import * as networkingService from 'services/networkingService';
import * as gamificationService from 'services/gamificationService';
import * as notificationService from 'services/notificationService';
import * as goalTipsService from 'services/goalTipsService';
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

// Dashboard — streak/XP/leaderboard now come from the real backend (see
// services/gamificationService.ts). Weekly practice stats, upcoming session
// and badge unlock state are still mock/client-computed — TODO: wire those
// up to real session history once that domain's backend work lands here too.
const HomeSrc = memo(() => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const { width } = useLayout();
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

  // "Today's Goal Tips" card — GET /api/v1/goals/tips/today (see
  // services/goalTipsService.ts), one AI-generated tip per goal the user set
  // at signup (profile.goals). Only fetched when there's at least one goal
  // to have tips about.
  const [goalTips, setGoalTips] = React.useState<GoalTipProps[] | null>(null);
  const [goalTipsLoading, setGoalTipsLoading] = React.useState(false);
  const hasGoals = (profile?.goals?.length ?? 0) > 0;
  React.useEffect(() => {
    if (!hasGoals) return;
    let cancelled = false;
    setGoalTipsLoading(true);
    goalTipsService
      .getTodayTips()
      .then(tips => {
        if (!cancelled) setGoalTips(tips);
      })
      .catch(() => {
        // Non-critical — the card just doesn't render if this fails, same
        // treatment as the notification badge count above.
      })
      .finally(() => {
        if (!cancelled) setGoalTipsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasGoals]);

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

  // Leaderboard — GET /api/v1/gamification/leaderboard.
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
              style={[globalStyle.icon20, { tintColor: theme['color-warning-500'] }]}
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
            level="2"
            style={[
              styles.briefingCard,
              { borderColor: theme['color-primary-transparent-300'] },
            ]}
          >
            <Flex justify="flex-start" itemsCenter mb={10}>
              <View style={[styles.briefingIconBadge, { backgroundColor: theme['color-primary-transparent-200'] }]}>
                {briefing.isTeaser ? (
                  // No "rocket"/launch icon exists in the custom "assets"
                  // pack (see assets/icons/index.ts — it's a fixed template
                  // icon list). bulb-outline is a real eva-pack icon already
                  // used elsewhere in this app for the same "here's a tip to
                  // get going" meaning (see StudentVerification.tsx's perks
                  // list) rather than risking a silently-missing custom icon.
                  <Icon pack="eva" name="bulb-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
                ) : (
                  <Icon pack="assets" name="rateFull" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
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
            <Text category="h9-s" numberOfLines={3} style={{ lineHeight: 21 }}>{briefing.narrative}</Text>
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
              mt={4}
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
              <Button
                size="small"
                style={[globalStyle.shadowBtn, { marginTop: 12 }]}
                onPress={() => navigate('Subscription')}
              >
                {t('home:career_os_upgrade_cta', { defaultValue: 'See Pro plans' })}
              </Button>
            ) : null}
          </Layout>
        ) : null}
        {goalTipsLoading && !goalTips ? (
          <Flex vertical center style={[styles.goalTipsCard, {paddingVertical: 24}]}>
            <Spinner size="small" />
          </Flex>
        ) : goalTips && goalTips.length > 0 ? (
          <View style={styles.goalTipsCard}>
            <Text category="h7" bold mb={12}>
              {t('home:goal_tips_title', { defaultValue: "Today's Goal Tips" })}
            </Text>
            {goalTips.map(tip => (
              <View key={tip.id} style={styles.goalTipRow}>
                <Text category="h10" status="link" bold mb={4}>
                  {tip.goal}
                </Text>
                <Text category="h9-s">{tip.tip}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {/* Consolidated (UI cleanup pass): these three used to be full-width
            cards stacked one after another — same tap-through-to-a-screen
            shape repeated three times, taking up most of a first screenful
            on their own. One compact row of tiles gets to all three
            destinations in the same space one of the old cards used to
            take. Subtitles (roadmap target role, sessions/score, "AI
            recap") dropped from the tile itself — each destination screen
            already shows that detail immediately on open. */}
        <View style={styles.navTilesRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.navTile}
            onPress={() => navigate('CareerRoadmap')}>
            <View style={[styles.navTileIconWrap, { backgroundColor: theme['color-warning-transparent-200'] ?? theme['background-basic-color-2'] }]}>
              <Icon pack="assets" name="map" style={[globalStyle.icon20, { tintColor: theme['color-warning-500'] }]} />
            </View>
            <Text category="h10" bold center mt={8} numberOfLines={2}>
              {t('home:career_roadmap_card_title_short', { defaultValue: 'Career Roadmap' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.navTile}
            onPress={() => navigate('MyProgress')}>
            <View style={[styles.navTileIconWrap, { backgroundColor: theme['color-primary-transparent-200'] ?? theme['background-basic-color-2'] }]}>
              <Icon pack="assets" name="rateFull" style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]} />
            </View>
            <Text category="h10" bold center mt={8} numberOfLines={2}>
              {t('home:your_progress', { defaultValue: 'Your Progress' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.navTile}
            onPress={() => navigate('WeeklyCareerReport')}>
            <View style={[styles.navTileIconWrap, { backgroundColor: theme['color-success-transparent-200'] ?? theme['background-basic-color-2'] }]}>
              <Icon pack="assets" name="stats" style={[globalStyle.icon20, { tintColor: theme['color-success-500'] }]} />
            </View>
            <Text category="h10" bold center mt={8} numberOfLines={2}>
              {t('home:weekly_career_report_short', { defaultValue: 'Weekly Report' })}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <Layout level="2" style={styles.statCard}>
            <Icon pack="assets" name="stats" style={[globalStyle.icon24, { tintColor: theme['color-primary-500'] }]} />
            {streakLoading && !streak ? (
              <Spinner size="small" style={styles.streakSpinner} />
            ) : (
              <Text category="h3" bold center mt={8}>
                {streakDays}
              </Text>
            )}
            <Text category="h9-s" status="placeholder" center>
              {t('home:day_streak', { defaultValue: 'Day Streak' })}
            </Text>
          </Layout>
          <Layout level="2" style={styles.statCard}>
            <Icon pack="assets" name="interview" style={[globalStyle.icon24, { tintColor: theme['color-primary-500'] }]} />
            <Text category="h3" bold center mt={8}>
              {sessionsThisWeek}
            </Text>
            <Text category="h9-s" status="placeholder" center>
              {t('home:sessions_this_week', { defaultValue: 'Sessions This Week' })}
            </Text>
          </Layout>
          <Layout level="2" style={styles.statCard}>
            <Icon pack="assets" name="rateFull" style={[globalStyle.icon24, { tintColor: theme['color-primary-500'] }]} />
            <Text category="h3" bold center mt={8}>
              {avgScore}%
            </Text>
            <Text category="h9-s" status="placeholder" center>
              {t('home:average_score', { defaultValue: 'Average Score' })}
            </Text>
          </Layout>
        </View>

        <Layout level="2" style={styles.checkInCard}>
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
          <Button
            size="small"
            // Was 'primary' (bright blue) — clashed against the card's new
            // warning/amber tint. 'warning' keeps the button in the same
            // color family as the card it sits in.
            status={streak?.checkedInToday ? 'basic' : 'warning'}
            disabled={checkingIn || streakLoading || !!streakError || !!streak?.checkedInToday}
            onPress={onCheckIn}
            accessoryLeft={checkingIn ? renderCheckInSpinner : undefined}>
            {streak?.checkedInToday
              ? t('home:checked_in_today', { defaultValue: 'Checked in' })
              : t('home:check_in', { defaultValue: 'Check In' })}
          </Button>
        </Layout>

        <Text category="h6" bold mt={32} mb={16}>
          {t('home:weekly_practice', { defaultValue: 'Weekly Practice' })}
        </Text>
        <BarChart
          data={{
            labels: weeklyPractice.map(d => d.day),
            datasets: [{ data: weeklyPractice.map(d => d.sessions) }],
          }}
          width={width - 48}
          height={180}
          fromZero
          showValuesOnTopOfBars
          withInnerLines={false}
          chartConfig={chartConfig}
          yAxisLabel=""
          yAxisSuffix=""
          style={styles.chart}
        />

        <Flex justify="space-between" itemsCenter mt={16} mb={16}>
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
            <Icon pack="eva" name="plus-circle-outline" style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]} />
          </Flex>
        )}

        {/* Dropped the standalone "Ready to practice?" CTA banner (UI
            cleanup pass) — it pushed the same "go start an interview"
            action as both the Upcoming Session card right above it and the
            dedicated Practice tab in the bottom nav (navigation/
            MainBottomTab.tsx's "Find" tab, repurposed as the practice hub).
            Three entry points to the same action on one screen was noise,
            not helpfulness. */}

        {/* Compact preview (UI cleanup pass) — was an always-expanded grid
            of every single badge (10 of them, locked and unlocked alike),
            roughly 3-4 full rows on every Home visit whether or not the
            user cared to look. Now a single tappable row showing just the
            unlocked ones (or, if none yet, the first few to work toward) —
            "See all" opens the full grid in BadgesModal. */}
        <Flex justify="space-between" itemsCenter mt={32} mb={16}>
          <Text category="h6" bold>
            {t('home:badges', { defaultValue: 'Badges' })}
          </Text>
          <Text category="h9" status="link" bold onPress={() => setIsBadgesModalVisible(true)}>
            {t('home:badges_count_see_all', {
              defaultValue: '{{unlocked}}/{{total}} · See all',
              unlocked: unlockedBadgeIds.size,
              total: DATA_BADGES.length,
            })}
          </Text>
        </Flex>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.badgesPreviewRow}
          onPress={() => setIsBadgesModalVisible(true)}>
          {(DATA_BADGES.filter(b => unlockedBadgeIds.has(b.id)).length > 0
            ? DATA_BADGES.filter(b => unlockedBadgeIds.has(b.id))
            : DATA_BADGES
          )
            .slice(0, 6)
            .map(badge => {
              const unlocked = unlockedBadgeIds.has(badge.id);
              return (
                <View
                  key={badge.id}
                  style={[
                    styles.badgePreviewIconWrap,
                    { backgroundColor: unlocked ? theme['color-primary-500'] : theme['background-basic-color-3'] },
                  ]}>
                  <Icon
                    pack={badge.iconPack ?? 'assets'}
                    name={badge.icon}
                    style={[globalStyle.icon16, { tintColor: unlocked ? theme['text-primary-color'] : theme['text-hint-color'] }]}
                  />
                </View>
              );
            })}
        </TouchableOpacity>

        <Flex justify="space-between" itemsCenter mt={32} mb={16}>
          <Text category="h6" bold>
            {t('home:leaderboard', { defaultValue: 'Leaderboard' })}
          </Text>
          {!leaderboardLoading && !leaderboardError && leaderboard.length > 4 ? (
            <Text category="h9" status="link" bold onPress={() => navigate('Leaderboard')}>
              {t('home:view_all', { defaultValue: 'View all' })}
            </Text>
          ) : null}
        </Flex>
        {leaderboardLoading ? (
          <Flex itemsCenter justify="center" style={styles.leaderboardStatus}>
            <Spinner size="small" />
          </Flex>
        ) : leaderboardError ? (
          <Flex vertical itemsCenter style={styles.leaderboardStatus}>
            <Text category="h9-s" status="danger" center mb={12}>
              {leaderboardError}
            </Text>
            <Button size="small" onPress={loadLeaderboard}>
              {t('common:try_again', { defaultValue: 'Try again' }).toString()}
            </Button>
          </Flex>
        ) : leaderboard.length === 0 ? (
          <Text category="h9-s" status="placeholder" center mv={16}>
            {t('home:leaderboard_empty', { defaultValue: 'No leaderboard data yet.' })}
          </Text>
        ) : (
          <View>
            {/* Top 4 only here — see the "View all" link above, which opens
                src/home/Leaderboard.tsx for the full ranked list (same fetch,
                unsliced). Keeps the Home dashboard card compact instead of
                showing up to 10 rows inline. */}
            {leaderboard.slice(0, 4).map(entry => (
              <Flex
                key={entry.id}
                justify="flex-start"
                itemsCenter
                mb={12}
                style={[styles.leaderboardRow, entry.isCurrentUser && { backgroundColor: theme['background-basic-color-2'] }]}>
                <Text category="h8" bold status="placeholder" style={styles.leaderboardRank}>
                  #{entry.rank}
                </Text>
                <UserAvatar
                  uri={entry.avatarUrl}
                  name={entry.name}
                  size="tiny"
                  style={styles.leaderboardAvatar}
                />
                <Text category="h8" bold style={globalStyle.flexOne} numberOfLines={1}>
                  {entry.name}
                  {entry.isCurrentUser ? ` (${t('home:you', { defaultValue: 'You' })})` : ''}
                </Text>
                <Text category="h8-s" status="placeholder">
                  {entry.xp} XP
                </Text>
              </Flex>
            ))}
          </View>
        )}
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
    // Was 14/14 -- every other card on this screen (goalTipsCard,
    // briefingCard, progressCard, statCard, etc.) uses borderRadius 16 /
    // padding 16; this was the one outlier. Task #66 visual polish pass.
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    backgroundColor: 'background-basic-color-2',
    borderWidth: 1,
    borderColor: 'color-warning-500',
  },
  goalTipsCard: {
    borderRadius: 16,
    marginTop: 16,
  },
  briefingCard: {
    ...globalStyle.card,
    padding: 16,
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
  goalTipRow: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    // Subtle purple to make the AI-generated tip visually distinct from the
    // neutral cards around it — was a plain themed Layout level="2" (same
    // gray as every other card on the screen).
    backgroundColor: 'rgba(195, 165, 248, 0.08)',
    borderWidth: 1,
    borderColor: '#7e4fcbff',
  },
  verifyBannerText: {
    marginHorizontal: 10,
  },
  navTilesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  navTile: {
    width: '31%',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 6,
    backgroundColor: 'background-basic-color-2',
  },
  navTileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  statCard: {
    width: '31%',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
  },
  streakSpinner: {
    marginTop: 8,
  },
  chart: {
    borderRadius: 16,
    marginLeft: -8,
  },
  upcomingCard: {
    borderRadius: 16,
    padding: 16,
  },
  badgesPreviewRow: {
    flexDirection: 'row',
    borderRadius: 16,
    backgroundColor: 'background-basic-color-2',
    padding: 16,
    gap: 10,
  },
  badgePreviewIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    // Subtle warning tint to make the daily XP check-in stand out from the
    // neutral stat cards above it — was a plain themed Layout level="2".
    backgroundColor: 'color-warning-transparent-200',
    borderWidth: 1,
    borderColor: 'color-warning-500',
  },
  leaderboardStatus: {
    paddingVertical: 16,
  },
  leaderboardRow: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  leaderboardRank: {
    width: 32,
  },
  leaderboardAvatar: {
    marginRight: 12,
  },
});
