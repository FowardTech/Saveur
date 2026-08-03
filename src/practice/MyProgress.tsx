import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Layout,
  Button,
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
import { globalStyle } from 'styles/globalStyle';
import { tileColorAt } from 'styles/tileColors';
import dayjs from 'utils/dayjs';
import { RootStackParamList } from 'navigation/types';
import { MockInterviewSessionProps } from 'constants/Types';
import * as interviewService from 'services/interviewService';
import * as gamificationService from 'services/gamificationService';
import * as roadmapService from 'services/roadmapService';
import * as feedbackService from 'services/feedbackService';
import { HeatMapEntry } from 'services/feedbackService';
import * as configService from 'services/configService';
import { CareerRoadmap as CareerRoadmapPlan } from 'services/roadmapService';
import { GamificationStreakProps } from 'constants/Types';
import { AuthContext } from '../../AuthContext';
import { getInterviewTypeLabel } from 'utils/interviewTypeLabels';

// "My Progress" — real per-user progress toward the career goal(s) picked at
// signup (profile.goals, editable any time from here via ChangeCareType).
// Replaces the old "View My Progress" quick action in Chat.tsx, which used
// to just call navigate('MainBottomTab') — i.e. simply closed the sheet and
// dropped the user back where they already were, with no actual progress
// content anywhere. Everything here is real: practice history
// (GET /api/v1/interviews/sessions) and streak/XP
// (GET /api/v1/gamification/streak) — same services/functions HomeSrc.tsx
// uses, just presented as a dedicated goal-progress view instead of a
// dashboard.
const MyProgress = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { t } = useTranslation(['find', 'common']);
  const { profile } = React.useContext(AuthContext);

  const [history, setHistory] = React.useState<MockInterviewSessionProps[]>([]);
  const [streak, setStreak] = React.useState<GamificationStreakProps | null>(null);
  // Overall progress toward the user's career goal (product request item:
  // "There should be an overall progress of the user towards the goal in the
  // progress screen not just a repeated stats from the homescreen" — the
  // stat cards above were literally the same three numbers already shown on
  // Home's dashboard, with no actual "toward the goal" content anywhere).
  // The AI Career Roadmap (services/roadmapService.ts) is the one feature
  // that already tracks a linear, ordered sequence of real-world milestones
  // from today to the goal role — and per CareerRoadmap.tsx's own comment,
  // every user lands with one auto-generated from their signup goal/role
  // (see backend's career_roadmap_service.ensure_auto_roadmap), so this is
  // reliably populated rather than a Pro-only dead end.
  const [roadmap, setRoadmap] = React.useState<CareerRoadmapPlan | null>(null);
  // Interview Heat Map (product request item) — cross-session average per
  // skill dimension, distinct from InterviewFeedback.tsx's existing
  // single-session ring breakdown. Best-effort/fail-open (.catch(() =>
  // null)) like streak above — a user with zero scored sessions yet just
  // sees the section stay hidden rather than blocking this whole screen.
  const [heatMap, setHeatMap] = React.useState<HeatMapEntry[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

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
  // another completed interview (this screen stays mounted in the stack,
  // it doesn't remount) kept showing stale history/chart data, same root
  // cause as HomeSrc.tsx's weekly chart. useFocusEffect re-runs every time
  // this screen regains focus.
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
  // built Monday-first, same convention as WeekStrip.tsx on Home) — which
  // bar the weekly chart below renders solid instead of pastel.
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
        ) : (
          <>
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
                  {/* Redesign v2 (full reskin, "screenshot 3" reference —
                      circular progress rings instead of plain numbers/bars):
                      replaces the old header-row percent + separate linear
                      track with one ring showing the same roadmapPercent
                      value, gradient-filled in the app's own brand blue. */}
                  <Flex justify="flex-start" itemsCenter>
                    <CircularProgress
                      progress={roadmapPercent}
                      size={72}
                      strokeWidth={7}
                      trackColor={theme['background-basic-color-3']}
                      gradientFrom="#0063f8"
                      gradientTo="#1DA1F2"
                      style={{ marginRight: 16 }}>
                      <Text category="h8" bold status="primary">
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

            {/* Pastel stat tiles (product request item, layout reference: a
                light/clean fitness-app screenshot's "Calories" (peach) /
                "Sleep" (blue) side-by-side tinted tiles) — same 3 rings/
                numbers as before, just each on its own tinted background
                instead of a neutral white card, so the row reads as a
                distinct "stat" visually the way the reference does rather
                than three identical white boxes. Colors pulled from the
                shared styles/tileColors.ts palette (index 0/2/1) so this
                matches every other screen's tiles exactly, keeping the SAME
                color family each ring already used (blue=sessions,
                orange=streak, mint=score) so nothing about what a color
                "means" here changed, only that it now tints the card too. */}
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
                  progress={Math.min(100, ((streak?.streakDays ?? 0) / 7) * 100)}
                  size={56}
                  strokeWidth={5}
                  trackColor="rgba(255,255,255,0.6)"
                  color={theme[tileColorAt(2).text]}>
                  <Text category="h7" bold style={{ color: theme[tileColorAt(2).text] }}>
                    {streak?.streakDays ?? 0}
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
            {/* Colorful per-bar chart (product request item, explicit
                layout reference: a light/clean fitness-app screenshot's
                "Activity this week" chart) — replaces the old single-flat-
                color react-native-chart-kit bar chart, which couldn't
                produce a different color per bar no matter how it was
                configured (see components/WeeklyBarChart.tsx's own
                comment). Today's bar renders solid instead of pastel, same
                "one bar stands out" treatment the reference uses. */}
            <Layout level="2" style={styles.chartCard}>
              <WeeklyBarChart
                data={weeklyPractice.map(d => ({ day: d.day, value: d.sessions }))}
                highlightIndex={todayWeekIndex}
              />
            </Layout>

            {heatMap && heatMap.length > 0 ? (
              <>
                <Text category="h6" bold mt={32} mb={4}>
                  {t('find:skill_heat_map_title', { defaultValue: 'Skill Heat Map' })}
                </Text>
                <Text category="h9-s" status="placeholder" mb={16}>
                  {t('find:skill_heat_map_description', {
                    defaultValue: 'Your average across every scored interview — see what to work on next.',
                  })}
                </Text>
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
              </>
            ) : null}

            <Text category="h6" bold mt={16} mb={16}>
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
                  // Tapping a past session opens Interview Replay — see
                  // src/practice/InterviewReplay.tsx. This row previously
                  // wasn't tappable at all.
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
    </Container>
  );
});

export default MyProgress;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  // Redesign v2 (full reskin): `card` carries a real shadow again, which
  // needs an opaque fill on Android — dropped the 'transparent' overrides
  // below so each Layout's own `level="2"` background shows through
  // instead.
  goalCard: {
    ...globalStyle.card,
    padding: 16,
  },
  goalChip: {
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  // Radius comes from globalStyle.card (24, app-wide "big rounded card"
  // token) — no local override, unlike before the wellness-app-inspired
  // reskin pass (was pinned to 16 here specifically).
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
  },
  heatMapCard: {
    ...globalStyle.card,
    padding: 16,
    // Same as goalCard/statCard above — this Layout's own `level="2"`
    // background needs to be opaque for `card`'s Android elevation shadow
    // to compute a correctly-rounded silhouette.
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
  // Redesign v2 (full reskin): the linear progressTrack/progressFill pair
  // that used to render "progress toward your goal" was replaced by a
  // CircularProgress ring (see the JSX above) — no longer used.
  sessionRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'border-basic-color-3',
  },
});
