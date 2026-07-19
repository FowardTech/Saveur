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
  SalaryOffer,
} from 'services/salaryNegotiationService';

interface LogEntry {
  round: number;
  approachTitle: string;
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

  const [isLoading, setIsLoading] = React.useState(true);
  const [initialOffer, setInitialOffer] = React.useState<SalaryOffer | null>(null);
  const [currentOffer, setCurrentOffer] = React.useState<SalaryOffer | null>(null);
  const [approaches, setApproaches] = React.useState<NegotiationApproach[]>([]);
  const [totalRounds, setTotalRounds] = React.useState(3);
  const [round, setRound] = React.useState(1);
  const [log, setLog] = React.useState<LogEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState<NegotiationApproachId | null>(null);
  const [isFinished, setIsFinished] = React.useState(false);
  const [summary, setSummary] = React.useState<string | null>(null);

  const loadScenario = React.useCallback(async () => {
    setIsLoading(true);
    setIsFinished(false);
    setSummary(null);
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
    loadScenario();
  }, [loadScenario]);

  const onChooseApproach = async (approach: NegotiationApproach) => {
    if (!currentOffer || isSubmitting) return;
    setIsSubmitting(approach.id);
    try {
      const result = await salaryNegotiationService.submitRound(round, approach, currentOffer, totalRounds);
      setLog(prev => [...prev, { round, approachTitle: approach.title, recruiterResponse: result.recruiterResponse }]);
      setCurrentOffer(result.updatedOffer);
      if (result.isFinalRound) {
        const finalize = await salaryNegotiationService.finalizeNegotiation(initialOffer!, result.updatedOffer);
        setSummary(finalize.summary);
        setIsFinished(true);
      } else {
        setRound(prev => prev + 1);
      }
    } catch (e: any) {
      // Real network call now — surface the failure instead of silently
      // stalling the round; the user stays on the current offer and can
      // retry the same or a different approach.
      Alert.alert(
        'Negotiation round failed',
        e?.message ?? "Couldn't reach the negotiation coach. Please try again."
      );
    } finally {
      setIsSubmitting(null);
    }
  };

  if (isLoading || !currentOffer) {
    return (
      <Container style={styles.container}>
        <TopNavigation title="Salary Negotiation" accessoryLeft={<NavigationAction onPress={goBack} />} />
        <Flex vertical center style={globalStyle.flexOne}>
          <Text category="h9-s" status="placeholder">Loading a scenario…</Text>
        </Flex>
      </Container>
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation title="Salary Negotiation" accessoryLeft={<NavigationAction onPress={goBack} />} />
      <Content padder contentContainerStyle={styles.content}>
        <Layout level="2" style={styles.offerCard}>
          <Flex justify="space-between" itemsCenter mb={4}>
            <Text category="h7" bold>{currentOffer.title}</Text>
            <Text category="h9" status="link" bold>{currentOffer.company}</Text>
          </Flex>
          <Text category="h3" bold mt={8}>
            ${currentOffer.baseSalary.toLocaleString()}
            <Text category="h9-s" status="placeholder"> / year base</Text>
          </Text>
          <View style={styles.offerDetailsRow}>
            <View style={styles.offerDetail}>
              <Text category="h10" status="placeholder">Bonus</Text>
              <Text category="h8" bold>${currentOffer.bonus.toLocaleString()}</Text>
            </View>
            <View style={styles.offerDetail}>
              <Text category="h10" status="placeholder">Signing Bonus</Text>
              <Text category="h8" bold>${currentOffer.signingBonus.toLocaleString()}</Text>
            </View>
            <View style={styles.offerDetail}>
              <Text category="h10" status="placeholder">Equity</Text>
              <Text category="h8" bold numberOfLines={1}>{currentOffer.equity}</Text>
            </View>
          </View>
        </Layout>

        {log.length > 0 ? (
          <View style={{ marginTop: 24 }}>
            <Text category="h7" bold mb={12}>Negotiation So Far</Text>
            {log.map((entry, i) => (
              <Layout key={i} level="2" style={styles.logRow}>
                <Text category="h10" status="placeholder" mb={4}>
                  Round {entry.round} · You chose: {entry.approachTitle}
                </Text>
                <Text category="h9-s">“{entry.recruiterResponse}”</Text>
              </Layout>
            ))}
          </View>
        ) : null}

        {isFinished ? (
          <View style={{ marginTop: 24 }}>
            <Layout level="2" style={[styles.offerCard, { borderColor: theme['color-primary-500'], borderWidth: 1 }]}>
              <Flex justify="flex-start" itemsCenter mb={8}>
                <Icon pack="assets" name="rateFull" style={[globalStyle.icon24, { tintColor: theme['color-primary-500'] }]} />
                <Text category="h7" bold ml={8}>Negotiation Summary</Text>
              </Flex>
              <Text category="h9-s">{summary}</Text>
            </Layout>
            <Button
              children="Try Another Scenario"
              onPress={loadScenario}
              style={[globalStyle.shadowBtn, { marginTop: 24 }]}
            />
            <Button
              children="Done"
              status="outline"
              onPress={() => navigate('MainBottomTab')}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : (
          <View style={{ marginTop: 24 }}>
            <Text category="h7" bold mb={4}>
              Round {round} of {totalRounds}
            </Text>
            <Text category="h9-s" status="placeholder" mb={16}>
              How do you want to respond?
            </Text>
            {approaches.map(approach => (
              <Layout key={approach.id} level="2" style={styles.approachCard}>
                <View style={globalStyle.flexOne}>
                  <Text category="h8" bold>{approach.title}</Text>
                  <Text category="h9-s" status="placeholder" mt={4}>{approach.description}</Text>
                </View>
                <Button
                  size="small"
                  status="primary"
                  disabled={!!isSubmitting}
                  onPress={() => onChooseApproach(approach)}
                  style={{ marginTop: 12 }}
                >
                  {isSubmitting === approach.id ? 'Sending…' : 'Choose'}
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
  approachCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
});
