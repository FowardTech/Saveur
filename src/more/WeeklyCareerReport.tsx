import React, { memo } from 'react';
import { View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { tileColorAt } from 'styles/tileColors';
import * as careerReportService from 'services/careerReportService';
import { WeeklyReport } from 'services/careerReportService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';

// AI Weekly Career Report — product request item. Lazy-generated server-side
// (GET /api/v1/career-report) the first time it's opened in a given ISO
// week; re-opening the same week just returns the cached report.
const WeeklyCareerReport = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'home', 'common']);
  const { isPro } = React.useContext(AuthContext);

  const [report, setReport] = React.useState<WeeklyReport | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setIsLoading(true);
    setError(null);
    careerReportService.getWeeklyReport()
      .then(setReport)
      .catch(() => {
        setError(t('more:weekly_report_load_failed', { defaultValue: "Couldn't load your weekly report right now." }));
      })
      .finally(() => setIsLoading(false));
  }, [t]);

  React.useEffect(() => {
    if (isPro) load();
    else setIsLoading(false);
  }, [isPro, load]);

  if (!isPro) {
    return (
      <ProLockGate
        title={t('more:weekly_career_report_title', { defaultValue: 'Weekly Career Report' })}
        description={t('more:weekly_report_pro_gate_description', {
          defaultValue: 'A weekly AI-written recap of your interview practice, applications, and progress, with tips for the week ahead — a Basic feature.',
        })}
      />
    );
  }

  const stats = report?.stats;

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:weekly_career_report_title', { defaultValue: 'Weekly Career Report' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        {isLoading ? (
          <Flex center style={{ paddingVertical: 60 }}>
            <Spinner size="large" />
          </Flex>
        ) : error ? (
          <Flex vertical center style={{ paddingVertical: 60 }}>
            <Text category="h9-s" status="danger" center mb={12}>{error}</Text>
            <Text category="h9" status="link" onPress={load}>
              {t('common:try_again', { defaultValue: 'Try again' })}
            </Text>
          </Flex>
        ) : report?.noActivity ? (
          <Flex vertical center style={{ paddingVertical: 60 }}>
            <Icon pack="eva" name="bar-chart-outline" style={[globalStyle.icon24, { tintColor: theme['text-hint-color'] }]} />
            <Text category="h8" bold mt={16} center>
              {t('more:weekly_report_no_activity_title', { defaultValue: 'Nothing to report yet this week' })}
            </Text>
            <Text category="h9-s" status="placeholder" mt={6} center>
              {t('more:weekly_report_no_activity_description', {
                defaultValue: 'Complete a practice session or track an application, then check back here.',
              })}
            </Text>
          </Flex>
        ) : (
          <>
            {report?.summary ? (
              // Plain card, same as every other section on this screen —
              // gradient fill is reserved for the homescreen XP check-in
              // card only (explicit product direction), not used elsewhere.
              <Layout level="2" style={[styles.summaryCard, styles.summaryCardInner]}>
                <Text category="h9" style={styles.summaryCardText}>{report.summary}</Text>
              </Layout>
            ) : null}

            {stats ? (
              // Pastel tile backgrounds (product request item, layout
              // reference: a light/clean fitness-app screenshot's tinted
              // stat tiles), same treatment/color family as MyProgress.tsx's
              // 3 stat cards for consistency — both pull from the shared
              // styles/tileColors.ts palette (index 0/1/2) so they're
              // guaranteed to match. NOT a gradient fill (that's
              // still reserved for the homescreen XP card only, per the
              // explicit direction on summaryCard above) — flat solid
              // pastel tokens, a different thing.
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: theme[tileColorAt(0).bg] }]}>
                  <Text category="h3" bold center style={{ color: theme[tileColorAt(0).text] }}>{stats.sessionsCompleted}</Text>
                  <Text category="h10" bold center mt={4} style={{ color: theme[tileColorAt(0).text] }}>
                    {t('home:sessions_this_week', { defaultValue: 'Sessions This Week' })}
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme[tileColorAt(1).bg] }]}>
                  <Text category="h3" bold center style={{ color: theme[tileColorAt(1).text] }}>{stats.avgInterviewScore ?? '—'}{stats.avgInterviewScore != null ? '%' : ''}</Text>
                  <Text category="h10" bold center mt={4} style={{ color: theme[tileColorAt(1).text] }}>
                    {t('home:average_score', { defaultValue: 'Average Score' })}
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme[tileColorAt(2).bg] }]}>
                  <Text category="h3" bold center style={{ color: theme[tileColorAt(2).text] }}>{stats.currentStreak}</Text>
                  <Text category="h10" bold center mt={4} style={{ color: theme[tileColorAt(2).text] }}>
                    {t('home:day_streak', { defaultValue: 'Day Streak' })}
                  </Text>
                </View>
              </View>
            ) : null}

            {stats ? (
              <View style={styles.secondaryStatsRow}>
                <Text category="h9-s" status="placeholder">
                  {t('more:weekly_report_secondary_stats', {
                    defaultValue: '{{minutes}} practice minutes · {{apps}} applications submitted',
                    minutes: stats.practiceMinutes,
                    apps: stats.applicationsSubmitted,
                  })}
                </Text>
              </View>
            ) : null}

            {report?.highlights?.length ? (
              <Layout level="2" style={styles.sectionCard}>
                <Text category="h7" bold mb={12}>
                  {t('more:weekly_report_highlights', { defaultValue: 'Highlights' })}
                </Text>
                {report.highlights.map((h, i) => (
                  <Flex key={i} justify="flex-start" itemsCenter mb={8}>
                    <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon20, { tintColor: theme['text-basic-color'] }]} />
                    <Text category="h9" style={{ marginLeft: 10, flex: 1 }}>{h}</Text>
                  </Flex>
                ))}
              </Layout>
            ) : null}

            {report?.recommendations?.length ? (
              <Layout level="2" style={styles.sectionCard}>
                <Text category="h7" bold mb={12}>
                  {t('more:weekly_report_recommendations', { defaultValue: 'For Next Week' })}
                </Text>
                {report.recommendations.map((r, i) => (
                  <Flex key={i} justify="flex-start" itemsCenter mb={8}>
                    <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon20, { tintColor: theme['text-basic-color'] }]} />
                    <Text category="h9" style={{ marginLeft: 10, flex: 1 }}>{r}</Text>
                  </Flex>
                ))}
              </Layout>
            ) : null}
          </>
        )}
      </Content>
    </Container>
  );
});

export default WeeklyCareerReport;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  // Redesign v2 (full reskin): `card` carries a real shadow again, which
  // needs an opaque fill on Android — dropped the 'transparent' overrides
  // below so each Layout's own `level="2"` background shows through
  // instead.
  // Plain card (gradient fill removed — reserved for the homescreen XP
  // card only), same shape as sectionCard below.
  summaryCard: {
    ...globalStyle.card,
    marginBottom: 20,
  },
  summaryCardInner: {
    padding: 16,
  },
  summaryCardText: {
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  // Product report: "colored cards like this are not supposed to have box
  // shadows" -- same fix as MyProgress.tsx's own statCard (see that file's
  // comment): these three tiles fill with a pastel tileColorAt() color, and
  // globalStyle.card's dark neutral shadow reads as a muddy halo on a
  // pastel fill instead of a crisp colored tile.
  statCard: {
    ...globalStyle.card,
    flex: 1,
    paddingVertical: 16,
    marginHorizontal: 4,
    shadowOpacity: 0,
    elevation: 0,
  },
  secondaryStatsRow: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  sectionCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 16,
  },
});
