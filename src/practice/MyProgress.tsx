import React, { memo } from 'react';
import { Alert, Image, TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Layout,
  Button,
  Spinner,
} from '@ui-kitten/components';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import CircularProgress from 'components/CircularProgress';
import WeeklyBarChart from 'components/WeeklyBarChart';
import SegmentedTabBar from 'components/SegmentedTabBar';
import UserAvatar from 'components/UserAvatar';
import BadgesModal from 'components/BadgesModal';
import DayActivityModal from 'components/DayActivityModal';
import WeekStrip from 'src/home/WeekStrip';
import ContinueLearningCard from 'src/home/ContinueLearningCard';
import DailyChallengeCard from 'src/home/DailyChallengeCard';
import { globalStyle } from 'styles/globalStyle';
import { tileColorAt } from 'styles/tileColors';
import { Images } from 'assets/images';
import dayjs from 'utils/dayjs';
import { RootStackParamList } from 'navigation/types';
import {
  GamificationStreakProps,
  Interview_Type_Enum,
  LeaderboardEntryProps,
  MockInterviewSessionProps,
  ScheduledInterviewProps,
} from 'constants/Types';
import * as interviewService from 'services/interviewService';
import * as gamificationService from 'services/gamificationService';
import * as roadmapService from 'services/roadmapService';
import * as feedbackService from 'services/feedbackService';
import { HeatMapEntry } from 'services/feedbackService';
import * as configService from 'services/configService';
import * as resumeService from 'services/resumeService';
import * as networkingService from 'services/networkingService';
import * as scheduledInterviewService from 'services/scheduledInterviewService';
import { CareerRoadmap as CareerRoadmapPlan } from 'services/roadmapService';
import { AuthContext } from '../../AuthContext';
import { getInterviewTypeLabel, getPracticeModeLabel, getDifficultyLabel } from 'utils/interviewTypeLabels';

// Defined at module scope (not inline in JSX) so it's a stable component
// reference across renders — see Subscription.tsx's renderCheckoutSpinner
// for the same reasoning.
const renderCheckInSpinner = () => <Spinner size="tiny" status="control" />;

// Leaderboard preview's per-rank medal badge colors (module scope, same
// reasoning as renderCheckInSpinner above). Ranks 1/2 use existing theme
// tokens (warning=gold, the app's own neutral basic-color-3/6 pair for
// silver); rank 3 has no dedicated "bronze" token anywhere in constants/
// theme/{light,dark}.json, so it's a literal copper hex — a reasonable
// one-off for a purely decorative 3rd-place medal.
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

// "My Progress" — real per-user progress toward the career goal(s) picked at
// signup (profile.goals, editable any time from here via ChangeCareType).
// Reachable from the More menu's "My Progress" row (see src/more/MoreSrc.tsx)
// now that Home was redesigned down to two big entry-point cards (product
// request, reference screenshot: a clean "what do you want to do" landing
// screen) — everything that dashboard used to show lives here instead:
// the day-of-week calendar strip, "continue learning" card, the streak/XP/
// check-in card (with its Badges button and "upcoming session" sub-block),
// the surprise daily challenge, and the leaderboard preview, on top of this
// screen's own pre-existing goal/roadmap/stats/chart/skills/history content.
// Nothing was deleted or reduced in scope — the same services, same state
// shapes, same badge-unlock logic, just consolidated into this one existing
// "your real progress" screen instead of also duplicating a dashboard on
// Home.
const MyProgress = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { t } = useTranslation(['find', 'common', 'home']);
  const { profile } = React.useContext(AuthContext);

  const [history, setHistory] = React.useState<MockInterviewSessionProps[]>([]);
  const [streak, setStreak] = React.useState<GamificationStreakProps | null>(null);
  // Overall progress toward the user's career goal (product request item:
  // "There should be an overall progress of the user towards the goal in the
  // progress screen not just a repeated stats from the homescreen"). The AI
  // Career Roadmap (services/roadmapService.ts) is the one feature that
  // already tracks a linear, ordered sequence of real-world milestones from
  // today to the goal role — and every user lands with one auto-generated
  // from their signup goal/role, so this is reliably populated rather than a
  // Pro-only dead end.
  const [roadmap, setRoadmap] = React.useState<CareerRoadmapPlan | null>(null);
  // Interview Heat Map (product request item) — cross-session average per
  // skill dimension. Best-effort/fail-open (.catch(() => null)) like streak
  // above — a user with zero scored sessions yet just sees the section stay
  // hidden rather than blocking this whole screen.
  const [heatMap, setHeatMap] = React.useState<HeatMapEntry[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Segmented top-tab bar (task #64, product reference — a fitness app's
  // "Overview | Calories | Nutrients | Macros | Weight" tab row).
  const TABS = [
    t('find:progress_tab_overview', { defaultValue: 'Overview' }),
    t('find:progress_tab_skills', { defaultValue: 'Skills' }),
    t('find:progress_tab_history', { defaultValue: 'History' }),
  ];
  const [activeTab, setActiveTab] = React.useState(0);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [historyResult, streakResult, roadmapResult, heatMapResult] = await Promise.all([
        interviewService.getPracticeHistory(),
        gamificationService.getStreak().catch(() => null),
        roadmapService.getSavedRoadmap(),
        configService.isFeatureEnabled('interview_heat_map')
          ? feedbackService.getHeatMap().then(r => (r.sessionCount > 0 ? r.dimensions : null)).catch(() => null)
          : Promise.resolve(null),
      ]);
      setHistory(historyResult);
      setStreak(streakResult);
      setRoadmap(roadmapResult);
      setHeatMap(heatMapResult);
    } catch (error: any) {
      setLoadError(error?.message ?? t('find:could_not_load_progress', { defaultValue: 'Could not load your progress.' }));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Was a plain useEffect — only ran once on mount, so returning here after
  // another completed interview (this screen stays mounted in the stack, it
  // doesn't remount) kept showing stale history/chart data. useFocusEffect
  // re-runs every time this screen regains focus.
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  const completed = React.useMemo(() => history.filter(s => s.status === 'Completed'), [history]);
  const scored = React.useMemo(() => completed.filter(s => typeof s.overallScore === 'number'), [completed]);
  const avgScore = scored.length
    ? Math.round(scored.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) / scored.length)
    : null;
  const weeklyPractice = React.useMemo(() => interviewService.computeWeeklyPractice(completed), [completed]);
  // Mon-first index of today (computeWeeklyPractice's own days array is
  // built Monday-first, same convention as WeekStrip.tsx) — which bar the
  // weekly chart below renders solid instead of pastel.
  const todayWeekIndex = (new Date().getDay() + 6) % 7;
  const roadmapPercent = roadmap && roadmap.totalCount > 0
    ? Math.round((roadmap.completedCount / roadmap.totalCount) * 100)
    : 0;
  const currentRoadmapStep = React.useMemo(
    () => roadmap?.steps.find(s => s.status === 'current') ?? null,
    [roadmap],
  );
  const recent = React.useMemo(
    () =>
      [...completed]
        .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
        .slice(0, 6),
    [completed],
  );

  const goals = profile?.goals ?? [];
  const streakDays = streak?.streakDays ?? 0;

  // Tap-a-calendar-day activity feed (product request item): WeekStrip's
  // onDayPress hands back the real Date the user tapped; DayActivityModal
  // fetches+renders that day's activity on open. (Relocated from Home along
  // with WeekStrip itself — see this file's module comment.)
  const [selectedActivityDay, setSelectedActivityDay] = React.useState<Date | null>(null);
  const onPressCalendarDay = React.useCallback((date: Date) => {
    setSelectedActivityDay(date);
  }, []);

  // Gamification: badge unlock state, computed client-side from real signals
  // — practice history length, the real streak day-count above, resume-
  // import count (used as a stand-in for "ATS optimized" too — see
  // resumeService.ts), and tracked networking contacts. Recomputes whenever
  // `completed`/`streakDays` change, which itself happens on every focus via
  // `load()` above — so completing another interview and coming back here
  // always reflects the latest unlock state, not a frozen snapshot from
  // first mount.
  const [unlockedBadgeIds, setUnlockedBadgeIds] = React.useState<Set<string>>(new Set());
  // Full-grid modal (components/BadgesModal.tsx).
  const [isBadgesModalVisible, setIsBadgesModalVisible] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [importedSources, contacts] = await Promise.all([
          resumeService.getImportedSources(),
          networkingService.listContacts(),
        ]);
        if (cancelled) return;
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
      } catch {
        // Non-critical — badge state just doesn't refresh this pass.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [completed, streakDays]);

  // POST /api/v1/gamification/checkin — daily check-in.
  const [checkingIn, setCheckingIn] = React.useState(false);
  const onCheckIn = React.useCallback(async () => {
    if (checkingIn || isLoading || streak?.checkedInToday) return;
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
  }, [checkingIn, isLoading, streak, t]);

  // Upcoming Session — GET /api/v1/interviews/scheduled. Refreshes whenever
  // this screen regains focus so a reminder just created on ScheduleInterview
  // shows up immediately on the way back.
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

  // Leaderboard preview (GET /api/v1/gamification/leaderboard) — top 3, same
  // fetch src/home/Leaderboard.tsx's own full-list screen uses, with its own
  // "View all" link into that screen.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:my_progress_title', { defaultValue: 'My Progress' })}
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          <TouchableOpacity onPress={() => navigate('ChangeCareType')}>
            <Icon
              pack="eva"
              name="settings-2-outline"
              style={[globalStyle.icon24, { tintColor: theme['text-basic-color'] }]}
            />
          </TouchableOpacity>
        }
      />
      {!isLoading && !loadError ? (
        <SegmentedTabBar tabs={TABS} activeIndex={activeTab} onChange={setActiveTab} />
      ) : null}
      <Content padder contentContainerStyle={styles.content}>
        {isLoading ? (
          <EmptyState variant="loading" />
        ) : loadError ? (
          <EmptyState
            variant="error"
            title={t('common:something_went_wrong', { defaultValue: 'Something went wrong' })}
            body={loadError}
            actionLabel={t('common:try_again', { defaultValue: 'Try again' })}
            onAction={load}
          />
        ) : activeTab === 0 ? (
          <>
            {/* Day-of-week calendar strip + "continue learning" + daily
                challenge — relocated from Home (see this file's module
                comment). Own self-contained components; ContinueLearningCard/
                DailyChallengeCard render nothing when there's nothing to
                show, so they're safe to always mount here. */}
            <WeekStrip checkedInToday={!!streak?.checkedInToday} onDayPress={onPressCalendarDay} />
            <ContinueLearningCard />

            {/* Streak / XP / check-in card, with the Badges button and
                "Upcoming Session" sub-block — relocated from Home unchanged. */}
            <View style={styles.checkInCard}>
              <View style={styles.checkInCardInner}>
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
                      {isLoading && !streak ? '—' : `${streak?.xp ?? 0} ${t('home:xp_label', { defaultValue: 'XP' })}`}
                    </Text>
                  </View>
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
                  <View style={[styles.checkInButton, styles.checkedInPill]}>
                    <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon16, styles.checkedInIcon]} />
                    <Text category="h9-s" bold style={[styles.checkInButtonText, { marginLeft: 4 }]} numberOfLines={1}>
                      {t('home:checked_in_today', { defaultValue: 'Checked in' })}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={checkingIn || isLoading}
                    onPress={onCheckIn}
                    style={[styles.checkInButton, (checkingIn || isLoading) && styles.checkInButtonDisabled]}>
                    {checkingIn ? (
                      <Spinner size="tiny" status="primary" />
                    ) : (
                      <Text category="h9-s" bold style={styles.checkInButtonText} numberOfLines={1}>
                        {t('home:check_in', { defaultValue: 'Check In' })}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                <Flex justify="space-between" itemsCenter mt={32} mb={16}>
                  <Text category="h8" bold style={{ color: theme['text-basic-color'] }}>
                    {t('home:upcoming_session', { defaultValue: 'Upcoming Session' })}
                  </Text>
                  <Text category="h9" status="link" bold onPress={() => navigate('ScheduleInterview')} style={{ color: '#0063f8' }}>
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
                        {nextSession.durationMin} {t('find:minutes_unit', { defaultValue: 'min' })}
                      </Text>
                    </View>
                    <Icon pack="assets" name="arrowRight" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
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

            <DailyChallengeCard />

            <Layout level="2" style={styles.goalCard}>
              <Text category="h8" bold mb={8}>
                {t('find:your_career_goal', { defaultValue: 'Your career goal' })}
              </Text>
              {goals.length > 0 ? (
                <Flex wrap>
                  {goals.map(goal => (
                    <Layout key={goal} level="3" style={styles.goalChip}>
                      <Text category="h10" bold>
                        {goal}
                      </Text>
                    </Layout>
                  ))}
                </Flex>
              ) : (
                <Text category="h9-s" status="placeholder" mb={12}>
                  {t('find:no_career_goal_set', { defaultValue: "You haven't set a career goal yet." })}
                </Text>
              )}
              <Button
                size="small"
                appearance="ghost"
                style={{ marginTop: 12, alignSelf: 'flex-start' }}
                onPress={() => navigate('ChangeCareType')}>
                {goals.length > 0
                  ? t('find:change_goal', { defaultValue: 'Change goal' })
                  : t('find:set_a_goal', { defaultValue: 'Set a goal' })}
              </Button>
            </Layout>

            <Layout level="2" style={[styles.goalCard, { marginTop: 16 }]}>
              <Text category="h8" bold mb={roadmap ? 14 : 0}>
                {t('find:goal_progress_title', { defaultValue: 'Progress toward your goal' })}
              </Text>
              {roadmap ? (
                <>
                  <Flex justify="flex-start" itemsCenter>
                    <CircularProgress
                      progress={roadmapPercent}
                      size={72}
                      strokeWidth={7}
                      trackColor={theme['background-basic-color-3']}
                      gradientFrom="#0063f8"
                      gradientTo="#1DA1F2"
                      style={{ marginRight: 16 }}>
                      <Text category="h8" bold style={{ color: theme['text-basic-color'] }}>
                        {t('find:goal_progress_percent', { defaultValue: '{{percent}}%', percent: roadmapPercent })}
                      </Text>
                    </CircularProgress>
                    <View style={globalStyle.flexOne}>
                      <Text category="h9" bold numberOfLines={1}>
                        {roadmap.targetRole}
                      </Text>
                      <Text category="h10" status="placeholder" mt={4}>
                        {t('find:goal_progress_steps_of', {
                          defaultValue: '{{completed}} of {{total}} steps complete',
                          completed: roadmap.completedCount,
                          total: roadmap.totalCount,
                        })}
                      </Text>
                    </View>
                  </Flex>
                  {roadmap.isComplete ? (
                    <Text category="h9" bold status="success" mt={12}>
                      {t('find:goal_progress_complete', { defaultValue: "You've completed every step — congratulations!" })}
                    </Text>
                  ) : currentRoadmapStep ? (
                    <Text category="h9" mt={12}>
                      {t('find:goal_progress_current_step', {
                        defaultValue: 'Current step: {{step}}',
                        step: currentRoadmapStep.title,
                      })}
                    </Text>
                  ) : null}
                  <Button
                    size="small"
                    appearance="ghost"
                    style={{ marginTop: 12, alignSelf: 'flex-start' }}
                    onPress={() => navigate('CareerRoadmap')}>
                    {t('find:goal_progress_view_roadmap', { defaultValue: 'View full roadmap' })}
                  </Button>
                </>
              ) : (
                <>
                  <Text category="h9-s" status="placeholder" mt={8} mb={4}>
                    {t('find:goal_progress_no_roadmap', {
                      defaultValue: 'Build a step-by-step roadmap to see your progress toward this goal.',
                    })}
                  </Text>
                  <Button
                    size="small"
                    appearance="ghost"
                    style={{ marginTop: 8, alignSelf: 'flex-start' }}
                    onPress={() => navigate('CareerRoadmap')}>
                    {t('find:goal_progress_build_roadmap', { defaultValue: 'Build my roadmap' })}
                  </Button>
                </>
              )}
            </Layout>

            <Flex justify="space-between" style={{ marginTop: 20 }}>
              <View style={[styles.statCard, { backgroundColor: theme[tileColorAt(0).bg] }]}>
                <CircularProgress
                  progress={Math.min(100, (completed.length / 10) * 100)}
                  size={56}
                  strokeWidth={5}
                  trackColor="rgba(255,255,255,0.6)"
                  color={theme[tileColorAt(0).text]}>
                  <Text category="h7" bold style={{ color: theme[tileColorAt(0).text] }}>
                    {completed.length}
                  </Text>
                </CircularProgress>
                <Text category="h10" bold center mt={8} style={{ color: theme[tileColorAt(0).text] }}>
                  {t('find:sessions_completed', { defaultValue: 'Sessions completed' })}
                </Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme[tileColorAt(2).bg] }]}>
                <CircularProgress
                  progress={Math.min(100, (streakDays / 7) * 100)}
                  size={56}
                  strokeWidth={5}
                  trackColor="rgba(255,255,255,0.6)"
                  color={theme[tileColorAt(2).text]}>
                  <Text category="h7" bold style={{ color: theme[tileColorAt(2).text] }}>
                    {streakDays}
                  </Text>
                </CircularProgress>
                <Text category="h10" bold center mt={8} style={{ color: theme[tileColorAt(2).text] }}>
                  {t('find:day_streak', { defaultValue: 'Day streak' })}
                </Text>
              </View>
              <View style={[styles.statCard, { marginRight: 0, backgroundColor: theme[tileColorAt(1).bg] }]}>
                <CircularProgress
                  progress={avgScore ?? 0}
                  size={56}
                  strokeWidth={5}
                  trackColor="rgba(255,255,255,0.6)"
                  color={theme[tileColorAt(1).text]}>
                  <Text category="h7" bold style={{ color: theme[tileColorAt(1).text] }}>
                    {avgScore ?? '—'}
                  </Text>
                </CircularProgress>
                <Text category="h10" bold center mt={8} style={{ color: theme[tileColorAt(1).text] }}>
                  {t('find:average_score', { defaultValue: 'Average score' })}
                </Text>
              </View>
            </Flex>

            <Text category="h6" bold mt={32} mb={16}>
              {t('find:this_week', { defaultValue: 'This week' })}
            </Text>
            <Layout level="2" style={styles.chartCard}>
              <WeeklyBarChart
                data={weeklyPractice.map(d => ({ day: d.day, value: d.sessions }))}
                highlightIndex={todayWeekIndex}
              />
            </Layout>

            {/* Leaderboard preview — relocated from Home unchanged (top 3,
                "View all" into src/home/Leaderboard.tsx). */}
            <Flex justify="space-between" itemsCenter mt={32} mb={12}>
              <Text category="h7" bold>
                {t('home:leaderboard', { defaultValue: 'Leaderboard' })}
              </Text>
              <Text category="h9" status="link" bold onPress={() => navigate('Leaderboard')}>
                {t('common:view_all', { defaultValue: 'View all' })}
              </Text>
            </Flex>
            {leaderboardLoading ? (
              <Layout level="1" style={styles.leaderboardCard}>
                <Flex itemsCenter justify="center" style={styles.leaderboardStatus}>
                  <Spinner size="small" />
                </Flex>
              </Layout>
            ) : leaderboardError ? (
              <Layout level="1" style={styles.leaderboardCard}>
                <Flex vertical itemsCenter justify="center" style={styles.leaderboardStatus}>
                  <Text category="h10" status="danger" center mb={8}>
                    {leaderboardError}
                  </Text>
                  <Text category="h10" status="link" onPress={loadLeaderboard}>
                    {t('common:try_again', { defaultValue: 'Try again' }).toString()}
                  </Text>
                </Flex>
              </Layout>
            ) : leaderboard.length === 0 ? (
              <Layout level="1" style={styles.leaderboardCard}>
                <Text category="h9-s" status="placeholder" center style={styles.leaderboardStatus}>
                  {t('home:leaderboard_empty', { defaultValue: 'No leaderboard data yet.' })}
                </Text>
              </Layout>
            ) : (
              leaderboard.slice(0, 3).map((entry, index) => {
                const medal = rankMedalStyle(entry.rank, theme);
                return (
                  <View
                    key={entry.id}
                    style={[
                      styles.leaderboardCard,
                      styles.leaderboardRow,
                      index < 2 && styles.leaderboardCardSpacing,
                      entry.isCurrentUser && { backgroundColor: theme['color-primary-transparent-100'] },
                    ]}>
                    <View style={styles.leaderboardRank}>
                      {entry.rank === 1 ? (
                        <Image source={Images.trophy} style={styles.leaderboardTrophyImage} resizeMode="contain" />
                      ) : (
                        <Text category="h9-s" bold style={{ color: medal.text }}>
                          {entry.rank}
                        </Text>
                      )}
                    </View>
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
                      {entry.xp} {t('home:xp_label', { defaultValue: 'XP' })}
                    </Text>
                  </View>
                );
              })
            )}
          </>
        ) : activeTab === 1 ? (
          <>
            <Text category="h6" bold mb={4}>
              {t('find:skill_heat_map_title', { defaultValue: 'Skill Heat Map' })}
            </Text>
            <Text category="h9-s" status="placeholder" mb={16}>
              {t('find:skill_heat_map_description', {
                defaultValue: 'Your average across every scored interview — see what to work on next.',
              })}
            </Text>
            {heatMap && heatMap.length > 0 ? (
              <Layout level="2" style={styles.heatMapCard}>
                {heatMap.map(entry => (
                  <View key={entry.key} style={styles.heatMapRow}>
                    <Flex justify="space-between" mb={6}>
                      <Text category="h9" bold>{entry.label}</Text>
                      <Text category="h9" bold status="link">{entry.score}%</Text>
                    </Flex>
                    <View style={styles.heatMapTrack}>
                      <View
                        style={[
                          styles.heatMapFill,
                          {
                            width: `${Math.max(0, Math.min(100, entry.score))}%`,
                            backgroundColor:
                              entry.score >= 80 ? theme['color-success-500']
                              : entry.score >= 60 ? theme['color-warning-500']
                              : theme['color-danger-500'],
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </Layout>
            ) : (
              <EmptyState
                icon="bar-chart-2-outline"
                body={t('find:skill_heat_map_empty', {
                  defaultValue: 'Complete a scored interview to see your skill breakdown here.',
                })}
                style={{ paddingVertical: 24 }}
              />
            )}
          </>
        ) : (
          <>
            <Text category="h6" bold mb={16}>
              {t('find:recent_sessions', { defaultValue: 'Recent sessions' })}
            </Text>
            {recent.length === 0 ? (
              <EmptyState
                icon="bar-chart-2-outline"
                body={t('find:complete_first_interview', {
                  defaultValue: 'Complete your first mock interview to start tracking progress here.',
                })}
                style={{ paddingVertical: 24 }}
              />
            ) : (
              recent.map(session => (
                <Flex
                  key={String(session.id)}
                  justify="space-between"
                  itemsCenter
                  style={styles.sessionRow}
                  onPress={() => navigate('InterviewReplay', { sessionId: String(session.id) })}>
                  <Flex vertical style={{ flex: 1 }}>
                    <Text category="h9" bold numberOfLines={1}>
                      {getInterviewTypeLabel(session.interviewType, t)}
                      {session.company ? ` · ${session.company}` : ''}
                    </Text>
                    <Text category="h10" status="placeholder">
                      {dayjs(session.date).format('MMM D, YYYY')}
                    </Text>
                  </Flex>
                  <Text category="h8" bold status={typeof session.overallScore === 'number' ? 'link' : 'placeholder'}>
                    {typeof session.overallScore === 'number' ? `${session.overallScore}%` : '—'}
                  </Text>
                </Flex>
              ))
            )}
          </>
        )}
      </Content>
      <DayActivityModal
        visible={selectedActivityDay !== null}
        date={selectedActivityDay}
        onClose={() => setSelectedActivityDay(null)}
      />
      <BadgesModal
        visible={isBadgesModalVisible}
        unlockedBadgeIds={unlockedBadgeIds}
        onClose={() => setIsBadgesModalVisible(false)}
      />
    </Container>
  );
});

export default MyProgress;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 60,
  },
  goalCard: {
    ...globalStyle.card,
    padding: 16,
    marginTop: 16,
  },
  goalChip: {
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  statCard: {
    ...globalStyle.card,
    flex: 1,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
  },
  chartCard: {
    ...globalStyle.card,
    padding: 16,
    paddingTop: 24,
  },
  heatMapCard: {
    ...globalStyle.card,
    padding: 16,
  },
  heatMapRow: {
    marginBottom: 14,
  },
  heatMapTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'background-basic-color-3',
    overflow: 'hidden',
  },
  heatMapFill: {
    height: 10,
    borderRadius: 5,
  },
  sessionRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'border-basic-color-3',
  },
  // Streak/XP/check-in card — relocated from src/home/HomeSrc.tsx unchanged
  // (see that file's git history for this styling's own iteration history).
  upcomingCard: {
    ...globalStyle.card,
    padding: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'color-primary-transparent-200',
  },
  checkInCard: {
    ...globalStyle.card,
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: 'background-basic-color-2',
  },
  checkInCardInner: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    padding: 16,
  },
  checkInBadgesButton: {
    marginLeft: 8,
    marginRight: 8,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'background-basic-color-3',
    borderWidth: 1,
    borderColor: 'border-basic-color-3',
  },
  checkInTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkInRing: {
    marginRight: 12,
  },
  checkInRingText: {
    color: 'text-basic-color',
  },
  checkInValue: {
    color: 'text-basic-color',
  },
  checkedInPill: {
    flexDirection: 'row',
  },
  checkedInIcon: {
    tintColor: 'text-basic-color',
  },
  checkInButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'background-basic-color-3',
    borderWidth: 1,
    borderColor: 'border-basic-color-3',
  },
  checkInButtonDisabled: {
    opacity: 0.6,
  },
  checkInButtonText: {
    color: 'text-basic-color',
  },
  // Leaderboard preview — relocated from src/home/HomeSrc.tsx unchanged.
  leaderboardCard: {
    ...globalStyle.card,
    marginTop: 8,
    padding: 12,
    backgroundColor: 'background-basic-color-2',
  },
  leaderboardCardSpacing: {
    marginBottom: 12,
  },
  leaderboardStatus: {
    paddingVertical: 24,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaderboardRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  leaderboardTrophyImage: {
    width: 22,
    height: 22,
  },
  leaderboardAvatar: {
    marginRight: 10,
  },
});
