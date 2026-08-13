import React, {memo} from 'react';
import {View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Layout, Icon, Spinner} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import {Application_Stage_Enum, ApplicationAnalyticsProps} from 'constants/Types';
import * as applicationsService from 'services/applicationsService';
import {getApplicationStageLabel} from 'utils/interviewTypeLabels';
import {accentColorForKey, accentTintBg} from 'utils/accentPalette';

// Pipeline analytics (premium Job Tracker feature, product follow-up: "a
// pipeline analytics view... that's only possible because the data's
// aggregated, not something a spreadsheet gives you"). See
// Saveur-Backend's app/api/tracker.py's analytics() for how each figure is
// computed (and its own caveats — esp. avg-time-to-interview being a rough
// proxy without a per-transition history table).
const ApplicationAnalytics = memo(() => {
  const {goBack, navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {t} = useTranslation(['request', 'common']);

  const [data, setData] = React.useState<ApplicationAnalyticsProps | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    applicationsService
      .getAnalytics()
      .then(result => {
        if (!cancelled) setData(result);
      })
      .catch((e: any) => {
        if (!cancelled) {
          setError(e?.message ?? t('request:analytics_load_failed', {defaultValue: "Couldn't load your analytics."}));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stageRows: Array<{key: keyof ApplicationAnalyticsProps['byStage']; label: Application_Stage_Enum; color: string}> = [
    {key: 'applied', label: Application_Stage_Enum.Applied, color: '#0063f8'},
    {key: 'interviewing', label: Application_Stage_Enum.Interviewing, color: '#F59E0B'},
    {key: 'offer', label: Application_Stage_Enum.Offer, color: '#10B981'},
    {key: 'rejected', label: Application_Stage_Enum.Rejected, color: '#EC4899'},
  ];

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction icon={'back'} onPress={goBack} />}
        title={<Text center category="h6" bold>{t('request:analytics_title', {defaultValue: 'Pipeline analytics'})}</Text>}
      />
      <Content padder contentContainerStyle={styles.content}>
        {isLoading ? (
          <Flex vertical itemsCenter justify="center" style={{paddingVertical: 60}}>
            <Spinner size="medium" />
          </Flex>
        ) : error || !data ? (
          <Text category="h9-s" status="danger" center mt={24}>
            {error}
          </Text>
        ) : data.total === 0 ? (
          <EmptyState
            icon="bar-chart-2-outline"
            title={t('request:analytics_empty_title', {defaultValue: 'Nothing to analyze yet'})}
            body={t('request:analytics_empty_body', {defaultValue: 'Track a few applications and your pipeline stats will show up here.'})}
          />
        ) : (
          <>
            <Flex justify="space-between" mb={20}>
              <Layout level="2" style={[styles.statCard, {marginRight: 8}]}>
                <Text category="h3" bold>{data.total}</Text>
                <Text category="h10" status="placeholder" mt={2}>
                  {t('request:analytics_total_tracked', {defaultValue: 'Tracked'})}
                </Text>
              </Layout>
              <Layout level="2" style={[styles.statCard, {marginHorizontal: 8}]}>
                <Text category="h3" bold>
                  {data.responseRate !== null ? `${data.responseRate}%` : '—'}
                </Text>
                <Text category="h10" status="placeholder" mt={2}>
                  {t('request:analytics_response_rate', {defaultValue: 'Response rate'})}
                </Text>
              </Layout>
              <Layout level="2" style={[styles.statCard, {marginLeft: 8}]}>
                <Text category="h3" bold>
                  {data.avgDaysToInterview !== null ? data.avgDaysToInterview : '—'}
                </Text>
                <Text category="h10" status="placeholder" mt={2}>
                  {t('request:analytics_avg_days_to_interview', {defaultValue: 'Avg. days to interview'})}
                </Text>
              </Layout>
            </Flex>

            <Text category="h8" bold mb={12}>
              {t('request:analytics_by_stage', {defaultValue: 'By stage'})}
            </Text>
            <Layout level="2" style={styles.stageCard}>
              {stageRows.map(({key, label, color}, i) => (
                <View key={key} style={[styles.stageRow, i === stageRows.length - 1 ? {marginBottom: 0} : null]}>
                  <View style={[styles.stageDot, {backgroundColor: color}]} />
                  <Text category="h9" style={globalStyle.flexOne} ml={10}>
                    {getApplicationStageLabel(label, t)}
                  </Text>
                  <Text category="h9" bold>{data.byStage[key]}</Text>
                </View>
              ))}
            </Layout>

            {data.staleApplications.length > 0 ? (
              <>
                <Text category="h8" bold mt={28} mb={12}>
                  {t('request:analytics_stale_title', {defaultValue: 'Gone quiet'})}
                </Text>
                <Text category="h10" status="placeholder" mb={12}>
                  {t('request:analytics_stale_body', {
                    defaultValue: 'No status change in {{days}}+ days — tap one to draft a follow-up.',
                    days: data.staleAfterDays,
                  })}
                </Text>
                {data.staleApplications.map(app => {
                  const accent = accentColorForKey(app.company || app.role);
                  return (
                    <Layout
                      key={app.id}
                      level="2"
                      style={styles.staleRow}
                      // Layout doesn't take onPress directly in this app's
                      // usage elsewhere, so wrap the tap target with a
                      // plain touchable via Flex's own onPress support.
                    >
                      <Flex
                        justify="space-between"
                        itemsCenter
                        onPress={() => navigate('RequestStack', {screen: 'ApplicationDetails', params: {id: app.id}})}>
                        <View style={globalStyle.flexOne}>
                          <Text category="h9" bold numberOfLines={1}>{app.company}</Text>
                          <Text category="h10" status="placeholder" numberOfLines={1} mt={2}>{app.role}</Text>
                        </View>
                        <View style={[styles.staleBadge, {backgroundColor: accentTintBg(accent)}]}>
                          <Text category="h10" bold style={{color: accent}}>
                            {t('request:analytics_days_stale', {defaultValue: '{{days}}d', days: app.daysStale})}
                          </Text>
                        </View>
                        <Icon
                          pack="eva"
                          name="chevron-right-outline"
                          style={[globalStyle.icon20, {tintColor: theme['text-hint-color'], marginLeft: 8}]}
                        />
                      </Flex>
                    </Layout>
                  );
                })}
              </>
            ) : null}
          </>
        )}
      </Content>
    </Container>
  );
});

export default ApplicationAnalytics;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  statCard: {
    ...globalStyle.card,
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  stageCard: {
    ...globalStyle.card,
    padding: 16,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  staleRow: {
    ...globalStyle.card,
    padding: 14,
    marginBottom: 10,
  },
  staleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
});
