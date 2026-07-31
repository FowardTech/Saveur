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
  Button,
} from '@ui-kitten/components';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as practicalService from 'services/practicalService';
import { PracticalSessionDetail } from 'services/practicalService';

// Judgment scoring across the whole decision path — generated in the
// background right after the scenario's final choice (see
// Saveur-Backend/app/tasks/practical_feedback_job.py), so this screen polls
// GET /api/v1/practical/sessions/:id (same "poll while pending" idea as
// InterviewFeedback.tsx) until PracticalFeedback actually exists.
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20; // ~1 minute

const RUBRIC_KEYS: { key: 'judgment' | 'domainKnowledge' | 'communication' | 'criticalThinking'; labelKey: string; fallback: string }[] = [
  { key: 'judgment', labelKey: 'practical_score_judgment', fallback: 'Judgment' },
  { key: 'domainKnowledge', labelKey: 'practical_score_domain_knowledge', fallback: 'Field Knowledge' },
  { key: 'communication', labelKey: 'practical_score_communication', fallback: 'Communication' },
  { key: 'criticalThinking', labelKey: 'practical_score_critical_thinking', fallback: 'Critical Thinking' },
];

const PracticalScenarioFeedback = memo(() => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PracticalScenarioFeedback'>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);
  const { sessionId } = route.params;

  const [session, setSession] = React.useState<PracticalSessionDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const pollAttemptsRef = React.useRef(0);
  const pollTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollFeedback = React.useCallback(async () => {
    pollAttemptsRef.current += 1;
    try {
      const result = await practicalService.getSession(sessionId);
      setSession(result);
      if (!result.feedback && pollAttemptsRef.current < MAX_POLL_ATTEMPTS) {
        pollTimeoutRef.current = setTimeout(pollFeedback, POLL_INTERVAL_MS);
      }
    } catch {
      setError(t('find:practical_feedback_load_failed', { defaultValue: "Couldn't load your results." }));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, t]);

  React.useEffect(() => {
    pollFeedback();
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [pollFeedback]);

  const feedback = session?.feedback ?? null;
  const stillGenerating = !isLoading && !feedback && !error;

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:practical_results', { defaultValue: 'Scenario Results' })}
        accessoryLeft={<NavigationAction />}
      />
      {isLoading && !session ? (
        <Flex center style={globalStyle.flexOne}><Spinner size="large" /></Flex>
      ) : error ? (
        <Flex vertical center style={globalStyle.flexOne}>
          <Text category="h9-s" status="danger" center>{error}</Text>
        </Flex>
      ) : stillGenerating ? (
        <Flex vertical center style={globalStyle.flexOne}>
          <Spinner size="large" />
          <Text category="h9-s" status="placeholder" center mt={16}>
            {t('find:practical_scoring_in_progress', { defaultValue: 'Evaluating your decisions…' })}
          </Text>
        </Flex>
      ) : (
        <Content padder contentContainerStyle={styles.content}>
          {feedback?.overall != null ? (
            <Layout level="2" style={styles.overallCard}>
              {/* Was status="primary" -- resolves to text-primary-color,
                  a near-white token meant for text on a solid primary-color
                  button, not this plain Layout card. Made the score
                  invisible in light mode. Using the actual brand blue
                  directly instead, same fix as JobAlerts.tsx's daily-limit
                  digit. */}
              <Text category="h2" bold center style={{color: theme['color-primary-500']}}>{feedback.overall}</Text>
              <Text category="h9-s" status="placeholder" center mt={4}>
                {t('find:practical_overall_score', { defaultValue: 'Overall judgment score' })}
              </Text>
            </Layout>
          ) : null}

          <View style={styles.statsGrid}>
            {RUBRIC_KEYS.map(rk => (
              <Layout level="2" key={rk.key} style={styles.statCard}>
                <Text category="h5" bold center>{feedback?.[rk.key] ?? '—'}</Text>
                <Text category="h10" status="placeholder" center mt={4}>
                  {t(`find:${rk.labelKey}`, { defaultValue: rk.fallback })}
                </Text>
              </Layout>
            ))}
          </View>

          {feedback?.summary ? (
            <Text category="h9-s" mt={20} style={{ lineHeight: 22 }}>{feedback.summary}</Text>
          ) : null}

          {feedback?.strengths?.length ? (
            <View style={{ marginTop: 24 }}>
              <Text category="h7" bold mb={12}>{t('find:practical_strengths', { defaultValue: 'What went well' })}</Text>
              {feedback.strengths.map((s, i) => (
                <Flex key={i} justify="flex-start" itemsCenter mb={8}>
                  <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                  <Text category="h9-s" ml={8} style={globalStyle.flexOne}>{s}</Text>
                </Flex>
              ))}
            </View>
          ) : null}

          {feedback?.improvements?.length ? (
            <View style={{ marginTop: 20 }}>
              <Text category="h7" bold mb={12}>{t('find:practical_improvements', { defaultValue: 'Where to grow' })}</Text>
              {feedback.improvements.map((s, i) => (
                <Flex key={i} justify="flex-start" itemsCenter mb={8}>
                  <Icon pack="eva" name="alert-circle-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                  <Text category="h9-s" ml={8} style={globalStyle.flexOne}>{s}</Text>
                </Flex>
              ))}
            </View>
          ) : null}

          {feedback?.stepNotes?.length ? (
            <View style={{ marginTop: 24 }}>
              <Text category="h7" bold mb={12}>{t('find:practical_decision_review', { defaultValue: 'Decision by decision' })}</Text>
              {feedback.stepNotes.map((note, i) => (
                <Flex key={i} justify="flex-start" style={styles.noteRow}>
                  <Icon
                    pack="eva"
                    name={note.isStrongMoment ? 'checkmark-circle-2-outline' : 'alert-circle-outline'}
                    style={[globalStyle.icon16, { marginTop: 2, tintColor: note.isStrongMoment ? theme['color-success-500'] : theme['color-warning-500'] }]}
                  />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text category="h10" status="placeholder">
                      {t('find:practical_step_label', { defaultValue: 'Step {{order}}', order: note.order })}
                    </Text>
                    <Text category="h9-s" mt={2}>{note.note}</Text>
                  </View>
                </Flex>
              ))}
            </View>
          ) : null}

          <Button
            style={[globalStyle.shadowBtn, { marginTop: 32 }]}
            onPress={() => navigate('PracticalScenarioSetup')}
          >
            {t('find:practical_try_another', { defaultValue: 'Try another scenario' })}
          </Button>
        </Content>
      )}
    </Container>
  );
});

export default PracticalScenarioFeedback;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  overallCard: {
    ...globalStyle.card,
    borderRadius: 20,
    paddingVertical: 24,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  statCard: {
    ...globalStyle.card,
    flexBasis: '46%',
    flexGrow: 1,
    borderRadius: 16,
    paddingVertical: 16,
    margin: 4,
  },
  noteRow: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'background-basic-color-2',
  },
});
