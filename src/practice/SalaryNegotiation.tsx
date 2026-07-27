import React, { memo } from 'react';
import { Alert, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Icon,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as salaryNegotiationService from 'services/salaryNegotiationService';
import {
  NegotiationApproach,
  NegotiationApproachId,
  NegotiationCritique,
  SalaryOffer,
} from 'services/salaryNegotiationService';
import { getApproachTitle, getApproachDescription } from 'utils/negotiationLabels';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';

interface LogEntry {
  round: number;
  approachTitle: string;
  ask: string;
  recruiterResponse: string;
}

// Scenario-based salary negotiation simulator — a mock job offer (scenario
// generation has no backend endpoint in this pass), the user picks a
// negotiation approach each round, and a real "recruiter pushback" response
// + updated offer comes back from POST /api/v1/coach/negotiation (see
// salaryNegotiationService.submitRound). Runs for
// salaryNegotiationService.TOTAL_ROUNDS rounds and ends with a
// locally-computed summary.
const SalaryNegotiation = memo(() => {
  const { goBack, navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);
  const { isPro } = React.useContext(AuthContext);

  const [isLoading, setIsLoading] = React.useState(true);
  const [initialOffer, setInitialOffer] = React.useState<SalaryOffer | null>(null);
  const [currentOffer, setCurrentOffer] = React.useState<SalaryOffer | null>(null);
  const [approaches, setApproaches] = React.useState<NegotiationApproach[]>([]);
  const [totalRounds, setTotalRounds] = React.useState(3);
  const [round, setRound] = React.useState(1);
  const [log, setLog] = React.useState<LogEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState<NegotiationApproachId | null>(null);
  const [isFinished, setIsFinished] = React.useState(false);
  const [critique, setCritique] = React.useState<NegotiationCritique | null>(null);

  const loadScenario = React.useCallback(async () => {
    setIsLoading(true);
    setIsFinished(false);
    setCritique(null);
    setLog([]);
    setRound(1);
    try {
      const { offer, approaches: nextApproaches, totalRounds: nextTotalRounds } =
        await salaryNegotiationService.getScenario();
      setInitialOffer(offer);
      setCurrentOffer(offer);
      setApproaches(nextApproaches);
      setTotalRounds(nextTotalRounds);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isPro) loadScenario();
    else setIsLoading(false);
  }, [isPro, loadScenario]);

  const onChooseApproach = async (approach: NegotiationApproach) => {
    if (!currentOffer || isSubmitting) return;
    setIsSubmitting(approach.id);
    try {
      const result = await salaryNegotiationService.submitRound(round, approach, currentOffer, totalRounds);
      const approachTitle = getApproachTitle(approach.id, approach.title, t);
      const nextLog = [...log, { round, approachTitle, ask: approach.description, recruiterResponse: result.recruiterResponse }];
      setLog(nextLog);
      setCurrentOffer(result.updatedOffer);
      if (result.isFinalRound) {
        const finalize = await salaryNegotiationService.finalizeNegotiation(
          initialOffer!, result.updatedOffer,
          nextLog.map(l => ({ round: l.round, approachTitle: l.approachTitle, ask: l.ask, recruiterResponse: l.recruiterResponse })),
        );
        setCritique(finalize);
        setIsFinished(true);
      } else {
        setRound(prev => prev + 1);
      }
    } catch (e: any) {
      // Real network call now — surface the failure instead of silently
      // stalling the round; the user stays on the current offer and can
      // retry the same or a different approach.
      Alert.alert(
        t('find:negotiation_round_failed_title', {defaultValue: 'Negotiation round failed'}),
        e?.message ?? t('find:negotiation_round_failed_body', {defaultValue: "Couldn't reach the negotiation coach. Please try again."}),
      );
    } finally {
      setIsSubmitting(null);
    }
  };

  // Was reachable by any signed-in user with no client-side gate at all,
  // even though the backend endpoints it calls (POST /coach/negotiation,
  // GET /negotiation/scenario, POST /negotiation/complete) already reject
  // non-Pro accounts with 402 — so a free user could get here, pick an
  // approach, and just see a silent request failure with no explanation.
  // Same ProLockGate pattern as every other Pro-gated screen.
  if (!isPro) {
    return (
      <ProLockGate
        title={t('find:salary_negotiation', { defaultValue: 'Salary Negotiation' })}
        description={t('find:salary_negotiation_pro_gate_description', {
          defaultValue: 'Practice real salary negotiations against an AI recruiter, with a coaching critique at the end — a Pro feature.',
        })}
      />
    );
  }

  if (isLoading || !currentOffer) {
    return (
      <Container style={styles.container}>
        <TopNavigation title={t('find:salary_negotiation', {defaultValue: 'Salary Negotiation'})} accessoryLeft={<NavigationAction onPress={goBack} />} />
        <Flex vertical itemsCenter justify="center" style={globalStyle.flexOne}>
          <Text category="h9-s" status="placeholder" center>{t('find:loading_scenario', {defaultValue: 'Loading a scenario…'})}</Text>
        </Flex>
      </Container>
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('find:salary_negotiation', {defaultValue: 'Salary Negotiation'})} accessoryLeft={<NavigationAction onPress={goBack} />} />
      <Content padder contentContainerStyle={styles.content}>
        <Layout level="2" style={styles.offerCard}>
          <Flex justify="space-between" itemsCenter mb={4}>
            <Text category="h7" bold>{currentOffer.title}</Text>
            <Text category="h9" status="link" bold>{currentOffer.company}</Text>
          </Flex>
          <Text category="h3" bold mt={8}>
            ${currentOffer.baseSalary.toLocaleString()}
            <Text category="h9-s" status="placeholder"> {t('find:per_year_base', {defaultValue: '/ year base'})}</Text>
          </Text>
          <View style={styles.offerDetailsRow}>
            <View style={styles.offerDetail}>
              <Text category="h10" status="placeholder">{t('find:bonus', {defaultValue: 'Bonus'})}</Text>
              <Text category="h8" bold>${currentOffer.bonus.toLocaleString()}</Text>
            </View>
            <View style={styles.offerDetail}>
              <Text category="h10" status="placeholder">{t('find:signing_bonus', {defaultValue: 'Signing Bonus'})}</Text>
              <Text category="h8" bold>${currentOffer.signingBonus.toLocaleString()}</Text>
            </View>
            <View style={styles.offerDetail}>
              <Text category="h10" status="placeholder">{t('find:equity', {defaultValue: 'Equity'})}</Text>
              <Text category="h8" bold numberOfLines={1}>{currentOffer.equity}</Text>
            </View>
          </View>
        </Layout>

        {log.length > 0 ? (
          <View style={{ marginTop: 24 }}>
            <Text category="h7" bold mb={12}>{t('find:negotiation_so_far', {defaultValue: 'Negotiation So Far'})}</Text>
            {/* Chat-bubble layout — the user's chosen approach right-aligned
                (their "message" to the recruiter), the recruiter's response
                left-aligned, so a multi-round negotiation actually reads
                like the back-and-forth conversation it represents instead
                of a flat, undifferentiated log list. */}
            {log.map((entry, i) => (
              <View key={i} style={{ marginBottom: 16 }}>
                <Text category="h10" status="placeholder" mb={6} right>
                  {t('find:negotiation_round_label', { defaultValue: 'Round {{round}}', round: entry.round })}
                </Text>
                <View style={styles.bubbleRowUser}>
                  <View style={[styles.bubble, styles.bubbleUser, { backgroundColor: theme['color-primary-500'] }]}>
                    <Text category="h9-s" status="control">{entry.approachTitle}</Text>
                  </View>
                </View>
                <View style={styles.bubbleRowRecruiter}>
                  <View style={[styles.recruiterIconWrap, { backgroundColor: theme['background-basic-color-3'] }]}>
                    <Icon pack="eva" name="person-outline" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
                  </View>
                  <View style={[styles.bubble, styles.bubbleRecruiter, { backgroundColor: theme['background-basic-color-2'] }]}>
                    <Text category="h9-s">{entry.recruiterResponse}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {isFinished ? (
          <View style={{ marginTop: 24 }}>
            <Layout level="2" style={[styles.offerCard, { borderColor: theme['color-primary-500'], borderWidth: 1 }]}>
              <Flex justify="flex-start" itemsCenter mb={8}>
                <Icon pack="assets" name="rateFull" style={[globalStyle.icon24, { tintColor: theme['color-primary-500'] }]} />
                <Text category="h7" bold ml={8}>{t('find:negotiation_summary', {defaultValue: 'Negotiation Summary'})}</Text>
              </Flex>
              <Text category="h9-s">{critique?.summary}</Text>

              {critique?.strengths.length ? (
                <View style={{ marginTop: 16 }}>
                  <Text category="h9" bold mb={6}>{t('find:negotiation_strengths', {defaultValue: 'What worked'})}</Text>
                  {critique.strengths.map((s, i) => (
                    <Flex key={i} justify="flex-start" itemsCenter mb={4}>
                      <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon16, { tintColor: theme['color-success-500'] }]} />
                      <Text category="h10" style={{ marginLeft: 8, flex: 1 }}>{s}</Text>
                    </Flex>
                  ))}
                </View>
              ) : null}

              {critique?.improvements.length ? (
                <View style={{ marginTop: 12 }}>
                  <Text category="h9" bold mb={6}>{t('find:negotiation_improvements', {defaultValue: 'Try next time'})}</Text>
                  {critique.improvements.map((s, i) => (
                    <Flex key={i} justify="flex-start" itemsCenter mb={4}>
                      <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, { tintColor: theme['color-warning-500'] }]} />
                      <Text category="h10" style={{ marginLeft: 8, flex: 1 }}>{s}</Text>
                    </Flex>
                  ))}
                </View>
              ) : null}
            </Layout>
            <Button
              children={t('find:try_another_scenario', {defaultValue: 'Try Another Scenario'})}
              onPress={loadScenario}
              style={[globalStyle.shadowBtn, { marginTop: 24 }]}
            />
            <Button
              children={t('common:done', {defaultValue: 'Done'})}
              status="outline"
              onPress={() => navigate('MainBottomTab')}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : (
          <View style={{ marginTop: 24 }}>
            <Text category="h7" bold mb={4}>
              {t('find:negotiation_round_of', {defaultValue: 'Round {{round}} of {{total}}', round, total: totalRounds})}
            </Text>
            <Text category="h9-s" status="placeholder" mb={16}>
              {t('find:negotiation_how_respond', {defaultValue: 'How do you want to respond?'})}
            </Text>
            {approaches.map(approach => (
              <Layout key={approach.id} level="2" style={styles.approachCard}>
                <View style={globalStyle.flexOne}>
                  <Text category="h8" bold>{getApproachTitle(approach.id, approach.title, t)}</Text>
                  <Text category="h9-s" status="placeholder" mt={4}>{getApproachDescription(approach.id, approach.description, t)}</Text>
                </View>
                <Button
                  size="small"
                  status="primary"
                  disabled={!!isSubmitting}
                  onPress={() => onChooseApproach(approach)}
                  style={{ marginTop: 12 }}
                >
                  {isSubmitting === approach.id ? t('find:sending', {defaultValue: 'Sending…'}) : t('find:choose', {defaultValue: 'Choose'})}
                </Button>
              </Layout>
            ))}
          </View>
        )}
      </Content>
    </Container>
  );
});

export default SalaryNegotiation;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  offerCard: {
    borderRadius: 20,
    padding: 20,
  },
  offerDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  offerDetail: {
    flex: 1,
  },
  logRow: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  bubbleRowUser: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  bubbleRowRecruiter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  recruiterIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleRecruiter: {
    borderBottomLeftRadius: 4,
  },
  approachCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
});
