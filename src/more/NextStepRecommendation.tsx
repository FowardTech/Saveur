import React, { memo } from 'react';
import { View } from 'react-native';
import { TopNavigation, StyleService, useStyleSheet, Spinner } from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import { ArtWorkplaceCompass } from 'src/home/HomeHeroArt';
import * as nextStepService from 'services/nextStepService';
import { NextStepPlan } from 'services/nextStepService';

// Post-graduation "what's next" recommendation (product request: "after
// that [graduation] redirect them to the next step and build up a next
// step career plan recommendation or suggestion for them"). Reached only
// via the "next_step_plan" push notification tap (see
// pushNotificationService.ts) -- the recommendation itself is generated
// once, automatically, server-side the moment graduation is processed (see
// Saveur-Backend's app/services/next_step_service.py /
// student_service.process_graduations), so this screen is read-only: it
// just fetches and shows what was already built, plus a CTA into AI Career
// Roadmap (src/more/CareerRoadmap.tsx) for the real step-by-step plan --
// deliberately not a second roadmap-generation system of its own, see
// next_step_service.py's module docstring for the full reasoning.
const NextStepRecommendation = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();

  const [plan, setPlan] = React.useState<NextStepPlan | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    nextStepService.getPlan()
      .then(result => {
        setPlan(result);
        if (result) nextStepService.markViewed();
      })
      .catch(() => {
        setError(t('common:something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' }).toString());
      })
      .finally(() => setLoading(false));
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  const onBuildRoadmap = () => {
    navigate('CareerRoadmap', plan?.suggestedRole ? { targetRole: plan.suggestedRole } : undefined);
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        // BUG FIX (pre-launch redundancy/flow audit): this screen's title
        // used to default to the exact same string as the unrelated
        // src/more/WhatsNext.tsx (offer-negotiation help) — a user tapping
        // a "What's Next" push notification after graduating, then later
        // opening Menu -> "What's Next", would land on two completely
        // different features with the same name and no cross-link.
        // Renamed to keep "What's Next" for the offer-negotiation feature.
        title={t('more:next_step_title', { defaultValue: 'Your Next Step' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        {loading && !plan ? (
          <Flex vertical center style={{ paddingVertical: 60 }}>
            <Spinner size="large" />
          </Flex>
        ) : error && !plan ? (
          <Flex vertical center style={{ paddingVertical: 40 }}>
            <Text category="h9-s" status="danger" center mb={16}>
              {error}
            </Text>
            <Text category="h9-s" status="link" bold onPress={load}>
              {t('common:try_again', { defaultValue: 'Try again' })}
            </Text>
          </Flex>
        ) : plan ? (
          <View>
            <Flex center mb={20}>
              <ArtWorkplaceCompass size={104} />
            </Flex>
            <Text category="h6" bold center mb={4}>
              {t('more:next_step_congrats_title', { defaultValue: 'Congratulations on graduating!' })}
            </Text>
            <View style={[globalStyle.card, styles.summaryCard]}>
              <Text category="para-m" style={styles.summaryText}>
                {plan.summary}
              </Text>
            </View>
            {plan.suggestedRole ? (
              <View style={[globalStyle.card, styles.roleCard]}>
                <Text category="h10" status="placeholder" mb={4}>
                  {t('more:next_step_suggested_role_label', { defaultValue: 'A role to consider targeting' })}
                </Text>
                <Text category="h7" bold>
                  {plan.suggestedRole}
                </Text>
              </View>
            ) : null}
            <CtaButton style={[globalStyle.shadowBtn, { marginTop: 24 }]} onPress={onBuildRoadmap}>
              {t('more:next_step_build_roadmap_cta', { defaultValue: 'Build my AI Career Roadmap' })}
            </CtaButton>
          </View>
        ) : (
          <Flex vertical center style={{ paddingVertical: 40 }}>
            <Text category="h9-s" status="placeholder" center>
              {t('more:next_step_empty', { defaultValue: "There's nothing here yet — check back soon." })}
            </Text>
          </Flex>
        )}
      </Content>
    </Container>
  );
});

export default NextStepRecommendation;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  summaryCard: {
    padding: 16,
    marginBottom: 16,
  },
  summaryText: {
    lineHeight: 22,
  },
  roleCard: {
    padding: 16,
  },
});
