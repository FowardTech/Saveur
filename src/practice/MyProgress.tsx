import React, { memo } from 'react';
import { TouchableOpacity } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Layout,
  Spinner,
  Button,
} from '@ui-kitten/components';
import { BarChart } from 'react-native-chart-kit';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { chartConfig } from 'utils/chartConfig';
import useLayout from 'hooks/useLayout';
import dayjs from 'utils/dayjs';
import { RootStackParamList } from 'navigation/types';
import { MockInterviewSessionProps } from 'constants/Types';
import * as interviewService from 'services/interviewService';
import * as gamificationService from 'services/gamificationService';
import { GamificationStreakProps } from 'constants/Types';
import { AuthContext } from '../../AuthContext';

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
  const { profile } = React.useContext(AuthContext);

  const [history, setHistory] = React.useState<MockInterviewSessionProps[]>([]);
  const [streak, setStreak] = React.useState<GamificationStreakProps | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [historyResult, streakResult] = await Promise.all([
        interviewService.getPracticeHistory(),
        gamificationService.getStreak().catch(() => null),
      ]);
      setHistory(historyResult);
      setStreak(streakResult);
    } catch (error: any) {
      setLoadError(error?.message ?? 'Could not load your progress.');
    } finally {
      setIsLoading(false);
    }
  }, []);

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
        title="My Progress"
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
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 60 }}>
            <Spinner size="large" />
          </Flex>
        ) : loadError ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 60 }}>
            <Text category="h9-s" status="danger" center mb={12}>
              {loadError}
            </Text>
            <Button size="small" onPress={load}>
              Try again
            </Button>
          </Flex>
        ) : (
          <>
            <Layout level="2" style={styles.goalCard}>
              <Text category="h8" bold mb={8}>
                Your career goal
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
                  You haven't set a career goal yet.
                </Text>
              )}
              <Button
                size="small"
                appearance="ghost"
                style={{ marginTop: 12, alignSelf: 'flex-start' }}
                onPress={() => navigate('ChangeCareType')}>
                {goals.length > 0 ? 'Change goal' : 'Set a goal'}
              </Button>
            </Layout>

            <Flex justify="space-between" style={{ marginTop: 20 }}>
              <Layout level="2" style={styles.statCard}>
                <Text category="h4" bold>
                  {completed.length}
                </Text>
                <Text category="h10" status="placeholder">
                  Sessions completed
                </Text>
              </Layout>
              <Layout level="2" style={styles.statCard}>
                <Text category="h4" bold>
                  {streak?.streakDays ?? 0}
                </Text>
                <Text category="h10" status="placeholder">
                  Day streak
                </Text>
              </Layout>
              <Layout level="2" style={[styles.statCard, { marginRight: 0 }]}>
                <Text category="h4" bold>
                  {avgScore ?? '—'}
                </Text>
                <Text category="h10" status="placeholder">
                  Average score
                </Text>
              </Layout>
            </Flex>

            <Text category="h6" bold mt={32} mb={16}>
              This week
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
              Recent sessions
            </Text>
            {recent.length === 0 ? (
              <Text category="h9-s" status="placeholder">
                Complete your first mock interview to start tracking progress here.
              </Text>
            ) : (
              recent.map(session => (
                <Flex
                  key={String(session.id)}
                  justify="space-between"
                  itemsCenter
                  style={styles.sessionRow}>
                  <Flex vertical style={{ flex: 1 }}>
                    <Text category="h9" bold numberOfLines={1}>
                      {session.interviewType}
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
    borderRadius: 16,
    padding: 16,
  },
  goalChip: {
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
  },
  chart: {
    borderRadius: 16,
  },
  sessionRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'border-basic-color-3',
  },
});
