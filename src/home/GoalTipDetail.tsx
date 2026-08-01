import React, { memo } from 'react';
import { View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Spinner,
} from '@ui-kitten/components';
import dayjs from 'utils/dayjs';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { GoalTipProps } from 'constants/Types';
import * as goalTipsService from 'services/goalTipsService';

// Full-page "Today's Goal Tips" — HomeSrc.tsx used to render this same
// content directly on the dashboard as a standalone card; that card was
// removed (product request item: "remove the today's daily tip card and let
// user see the push notification and when they click it it takes them to
// more details about today's goal tip") in favor of this dedicated screen,
// reached only via the daily "goal_tip" push notification tap (see
// navigation/navigationRef.ts's navigateToGoalTipDetail, wired from
// services/pushNotificationService.ts's handleDataTap). No route params —
// fetches GET /api/v1/goals/tips/today itself, the exact same source the
// old home card used, so it always shows today's full, current content
// regardless of which specific tip the push happened to mention.
const GoalTipDetail = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home', 'common']);

  const [tips, setTips] = React.useState<GoalTipProps[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    goalTipsService
      .getTodayTips()
      .then(setTips)
      .catch(() => {
        setError(t('common:something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' }).toString());
      })
      .finally(() => setLoading(false));
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('home:goal_tips_title', { defaultValue: "Today's Goal Tips" })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h10" status="placeholder" mb={16}>
          {dayjs().format('dddd, MMMM D')}
        </Text>
        {loading && !tips ? (
          <Flex vertical center style={{ paddingVertical: 60 }}>
            <Spinner size="large" />
          </Flex>
        ) : error && !tips ? (
          <Flex vertical center style={{ paddingVertical: 40 }}>
            <Text category="h9-s" status="danger" center mb={16}>
              {error}
            </Text>
            <Text category="h9-s" status="link" bold onPress={load}>
              {t('common:try_again', { defaultValue: 'Try again' })}
            </Text>
          </Flex>
        ) : tips && tips.length > 0 ? (
          tips.map(tip => (
            <View key={tip.id} style={[globalStyle.card, styles.tipCard]}>
              <View style={[styles.tipPill, { backgroundColor: theme['color-primary-transparent-200'] }]}>
                <Text category="h10" bold style={{ color: theme['color-primary-500'] }}>
                  {tip.goal}
                </Text>
              </View>
              <Text category="para-m" mt={10} style={styles.tipBody}>
                {tip.tip}
              </Text>
            </View>
          ))
        ) : (
          <Flex vertical center style={{ paddingVertical: 40 }}>
            <Text category="h9-s" status="placeholder" center>
              {t('home:goal_tips_empty', { defaultValue: 'No tips for today yet — check back later.' })}
            </Text>
          </Flex>
        )}
      </Content>
    </Container>
  );
});

export default GoalTipDetail;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  tipCard: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(195, 165, 248, 0.08)',
    borderColor: '#7e4fcbff',
  },
  tipPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tipBody: {
    lineHeight: 22,
  },
});
