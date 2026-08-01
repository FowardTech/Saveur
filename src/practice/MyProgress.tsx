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
import { BarChart } from 'react-native-chart-kit';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import { globalStyle } from 'styles/globalStyle';
import { chartConfig } from 'utils/chartConfig';
import useLayout from 'hooks/useLayout';
import dayjs from 'utils/dayjs';
import { RootStackParamList } from 'navigation/types';
import { MockInterviewSessionProps } from 'constants/Types';
import * as interviewService from 'services/interviewService';
import * as gamificationService from 'services/gamificationService';
import * as roadmapService from 'services/roadmapService';
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
  const { width } = useLayout();
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
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [historyResult, streakResult, roadmapResult] = await Promise.all([
        interviewService.getPracticeHistory(),
        gamificationService.getStreak().catch(() => null),
        roadmapService.getSavedRoadmap(),
      ]);
      setHistory(historyResult);
      setStreak(streakResult);
      setRoadmap(roadmapResult);
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
              <Flex justify="space-between" itemsCenter>
                <Text category="h8" bold>
                  {t('find:goal_progress_title', { defaultValue: 'Progress toward your goal' })}
                </Text>
                {roadmap ? (
                  <Text category="h8" bold status="primary">
                    {t('find:goal_progress_percent', { defaultValue: '{{percent}}%', percent: roadmapPercent })}
                  </Text>
                ) : null}
              </Flex>
              {roadmap ? (
                <>
                  <Text category="h9" status="placeholder" mt={4}>
                    {roadmap.targetRole}
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${roadmapPercent}%`, backgroundColor: theme['color-primary-500'] }]} />
                  </View>
                  <Text category="h10" status="placeholder" mt={8}>
                    {t('find:goal_progress_steps_of', {
                      defaultValue: '{{completed}} of {{total}} steps complete',
                      completed: roadmap.completedCount,
                      total: roadmap.totalCount,
                    })}
                  </Text>
                  {roadmap.isComplete ? (
                    <Text category="h9" bold status="success" mt={8}>
                      {t('find:goal_progress_complete', { defaultValue: "You've completed every step — congratulations!" })}
                    </Text>
                  ) : currentRoadmapStep ? (
                    <Text category="h9" mt={8}>
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
              <Layout level="2" style={styles.statCard}>
                <Text category="h3" bold>
                  {completed.length}
                </Text>
                <Text category="h10" status="placeholder">
                  {t('find:sessions_completed', { defaultValue: 'Sessions completed' })}
                </Text>
              </Layout>
              <Layout level="2" style={styles.statCard}>
                <Text category="h3" bold>
                  {streak?.streakDays ?? 0}
                </Text>
                <Text category="h10" status="placeholder">
                  {t('find:day_streak', { defaultValue: 'Day streak' })}
                </Text>
              </Layout>
              <Layout level="2" style={[styles.statCard, { marginRight: 0 }]}>
                <Text category="h3" bold>
                  {avgScore ?? '—'}
                </Text>
                <Text category="h10" status="placeholder">
                  {t('find:average_score', { defaultValue: 'Average score' })}
                </Text>
              </Layout>
            </Flex>

            <Text category="h6" bold mt={32} mb={16}>
              {t('find:this_week', { defaultValue: 'This week' })}
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
  goalCard: {
    ...globalStyle.card,
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'transparent',
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
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  chart: {
    borderRadius: 16,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'background-basic-color-3',
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  sessionRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'border-basic-color-3',
  },
});
