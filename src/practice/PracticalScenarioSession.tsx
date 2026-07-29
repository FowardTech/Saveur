import React, { memo } from 'react';
import { Alert, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Spinner,
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
import { PracticalStep } from 'services/practicalService';

// The scenario itself — one decision point at a time. Each choice the
// learner taps genuinely changes what comes next (the backend regenerates
// the next situation live from the whole decision history, see
// services/practicalService.ts's chooseOption), so this screen just needs
// to render the current step and hand the choice off, then swap in
// whatever comes back. Reaching the final step routes to
// PracticalScenarioFeedback, where the AI's judgment scoring across the
// whole path shows up once it's ready.
const TOTAL_STEPS_ESTIMATE = 6; // mirrors Saveur-Backend/app/api/practical.py's MAX_STEPS

const PracticalScenarioSession = memo(() => {
  const { navigate, goBack } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PracticalScenarioSession'>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);

  const { sessionId, initialStep } = route.params;
  const [step, setStep] = React.useState<PracticalStep>(initialStep);
  const [isChoosing, setIsChoosing] = React.useState(false);

  const onChoose = async (choiceId: string) => {
    if (isChoosing) return;
    setIsChoosing(true);
    try {
      const result = await practicalService.chooseOption(sessionId, choiceId);
      if (result.status === 'completed') {
        navigate('PracticalScenarioFeedback', { sessionId });
      } else {
        setStep(result.step);
      }
    } catch (e: any) {
      Alert.alert(
        t('find:practical_choice_failed_title', { defaultValue: "Couldn't continue the scenario" }),
        e?.message ?? t('common:something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' }),
      );
    } finally {
      setIsChoosing(false);
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:practical_scenarios', { defaultValue: 'Practical Scenarios' })}
        accessoryLeft={<NavigationAction onPress={() => goBack()} />}
      />
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h10" status="placeholder" mb={16}>
          {t('find:practical_step_progress', {
            defaultValue: 'Step {{step}} of ~{{total}}',
            step: step.order,
            total: TOTAL_STEPS_ESTIMATE,
          })}
        </Text>

        <Layout level="2" style={styles.situationCard}>
          <Text category="h9-s" style={{ lineHeight: 22 }}>{step.situation}</Text>
        </Layout>

        <Text category="h8" bold mt={24} mb={12}>
          {t('find:practical_what_do_you_do', { defaultValue: 'What do you do?' })}
        </Text>

        {isChoosing ? (
          <Flex center style={{ paddingVertical: 32 }}>
            <Spinner size="large" />
          </Flex>
        ) : (
          step.choices.map(choice => (
            <Flex
              key={choice.id}
              level="2"
              style={styles.choiceCard}
              justify="flex-start"
              itemsCenter
              onPress={() => onChoose(choice.id)}
            >
              <View style={[styles.choiceBadge, { backgroundColor: theme['color-primary-transparent-200'] }]}>
                <Text category="h9" bold status="primary">{choice.id.toUpperCase()}</Text>
              </View>
              <Text category="h9-s" style={globalStyle.flexOne}>{choice.text}</Text>
            </Flex>
          ))
        )}
      </Content>
    </Container>
  );
});

export default PracticalScenarioSession;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  situationCard: {
    borderRadius: 20,
    padding: 20,
  },
  choiceCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  choiceBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
});
