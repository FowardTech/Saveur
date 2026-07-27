import React, {memo} from 'react';
import {View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Layout, Button, Icon} from '@ui-kitten/components';
import {NavigationProp, RouteProp, useNavigation, useRoute} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CompanyLogoAvatar from 'components/CompanyLogoAvatar';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import * as jobAlertsService from 'services/jobAlertsService';
import {useTranslation} from 'react-i18next';

// The in-app landing spot for a matched job — reached from three places that
// all hand it the same JobAlertProps shape: tapping a card on
// src/more/JobAlerts.tsx, tapping a "job_alert" notification from the bell
// (src/home/Notification/index.tsx — the backend embeds the full job on the
// notification itself, see services/notificationService.ts), and, once push
// notifications are wired, tapping the OS push notification too (same
// payload, same navigation call). Shows the real posting details first;
// "Apply on [source]" is the one action that leaves the app, opening the
// real application page in-app via src/more/WebViewScreen.tsx rather than
// the system browser.
const JobAlertDetails = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'common']);
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'JobAlertDetails'>>();
  const {job} = route.params;

  // Reached from the bell/a push tap, this alert may not have been marked
  // read yet (Notification screen only marks read on the general list tap,
  // and a push notification tap wouldn't go through that screen at all) —
  // best-effort, not blocking on the result.
  React.useEffect(() => {
    if (!job.read) {
      jobAlertsService.markJobAlertsRead([job.id]).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  const onApply = () => {
    navigate('WebViewScreen', {
      url: job.applyUrl,
      title: job.title,
      // Enables WebViewScreen's application-submitted detection, which
      // auto-adds this to the user's Application Tracker (src/practice/
      // Applications or wherever ApplicationsTab lives) once it sees a
      // real confirmation signal, with a "did you apply?" fallback prompt
      // if it can't confirm automatically. See that screen's own comments
      // for how detection works.
      job: {
        company: job.company,
        role: job.title,
        applyUrl: job.applyUrl,
        companyLogoUrl: job.companyLogoUrl,
      },
    });
  };

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('more:job_details_title', {defaultValue: 'Job Details'})} accessoryLeft={<NavigationAction />} />
      <Content padder contentContainerStyle={styles.content}>
        <Layout level="2" style={styles.card}>
          <Flex justify="flex-start" mb={12}>
            <CompanyLogoAvatar
              logoUrl={job.companyLogoUrl}
              companyName={job.company}
              size="large"
              style={{marginRight: 12}}
            />
            <View style={globalStyle.flexOne}>
              <Flex justify="space-between" itemsCenter>
                <Text category="h5" bold style={globalStyle.flexOne} numberOfLines={2}>
                  {job.title}
                </Text>
                {job.applied ? (
                  <View style={[styles.appliedBadge, {backgroundColor: theme['color-info-100']}]}>
                    <Text category="h10" bold status="info">
                      {t('more:applied_badge', {defaultValue: 'Applied'})}
                    </Text>
                  </View>
                ) : null}
              </Flex>
              <Text category="h8" status="placeholder" mt={4}>
                {job.company}
                {job.location ? ` · ${job.location}` : ''}
              </Text>
            </View>
          </Flex>

          {job.matchedRole ? (
            <Flex justify="flex-start" itemsCenter mb={12}>
              <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon20, {tintColor: theme['color-primary-500']}]} />
              <Text category="h9-s" ml={8}>
                {t('more:matches_target_role', {defaultValue: 'Matches your target role:'})} <Text category="h9-s" bold>{job.matchedRole}</Text>
              </Text>
            </Flex>
          ) : null}

          <View style={styles.metaRow}>
            {job.source ? (
              <View style={styles.metaItem}>
                <Text category="h10" status="placeholder">{t('more:job_source', {defaultValue: 'Source'})}</Text>
                <Text category="h9" bold>{job.source}</Text>
              </View>
            ) : null}
            {job.postedAt ? (
              <View style={styles.metaItem}>
                <Text category="h10" status="placeholder">{t('more:job_posted', {defaultValue: 'Posted'})}</Text>
                <Text category="h9" bold>{new Date(job.postedAt).toLocaleDateString()}</Text>
              </View>
            ) : null}
          </View>
        </Layout>

        <Text category="h9-s" status="placeholder" mb={20} center>
          {job.applied
            ? t('more:already_applied_note', {
                defaultValue: "You've already applied to this job — you can still reopen it if you need to.",
              })
            : t('more:apply_takes_you_to', {
                defaultValue: "Applying takes you to {{source}} to finish your application.",
                source: job.source ?? "the employer's site",
              })}
        </Text>

        <Button style={[globalStyle.shadowBtn]} onPress={onApply}>
          {job.source
            ? t('more:apply_on_source', {defaultValue: `Apply on ${job.source}`, source: job.source})
            : t('more:apply_for_this_job', {defaultValue: 'Apply for this job'})}
        </Button>
      </Content>
    </Container>
  );
});

export default JobAlertDetails;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  metaItem: {
    marginRight: 32,
  },
  appliedBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
});
