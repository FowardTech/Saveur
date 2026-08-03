import React, {memo} from 'react';
import {View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Layout, Icon} from '@ui-kitten/components';
import {NavigationProp, RouteProp, useNavigation, useRoute} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CompanyLogoAvatar from 'components/CompanyLogoAvatar';
import StatusBadge from 'components/StatusBadge';
import CtaButton from 'components/CtaButton';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import * as jobAlertsService from 'services/jobAlertsService';
import * as jobShareService from 'services/jobShareService';
import ShareToUserModal from 'components/ShareToUserModal';
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

  // "Share a job" (product request item) — see services/jobShareService.ts
  // for the full deferred-deep-link flow. isSharing guards against a
  // double-tap kicking off two concurrent OneLink generation calls.
  const [isSharing, setIsSharing] = React.useState(false);
  const onShare = React.useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      await jobShareService.shareJob(job);
    } finally {
      setIsSharing(false);
    }
  }, [job, isSharing]);

  // "Share to a Saveur user" (product request item) — additive to, not a
  // replacement for, the external OS-share-sheet button above.
  const [isShareUserModalVisible, setIsShareUserModalVisible] = React.useState(false);

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
        id: job.id,
        company: job.company,
        role: job.title,
        applyUrl: job.applyUrl,
        companyLogoUrl: job.companyLogoUrl,
        // Bug report ("the job is not showing location") — this was
        // dropped here even though `job.location` (JobAlertProps) is
        // right there, so WebViewScreen's trackApplication() never had a
        // real value to send and always tracked the application with an
        // empty location.
        location: job.location,
      },
    });
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:job_details_title', {defaultValue: 'Job Details'})}
        accessoryLeft={<NavigationAction />}
        accessoryRight={() => (
          <Flex justify="flex-start" itemsCenter>
            <Icon
              pack="eva"
              name="people-outline"
              style={[globalStyle.icon24, {marginRight: 16, tintColor: theme['text-basic-color']}]}
              onPress={() => setIsShareUserModalVisible(true)}
            />
            <Icon
              pack="eva"
              name="share-outline"
              style={[globalStyle.icon24, {tintColor: isSharing ? theme['text-hint-color'] : theme['text-basic-color']}]}
              onPress={onShare}
            />
          </Flex>
        )}
      />
      <ShareToUserModal
        visible={isShareUserModalVisible}
        onClose={() => setIsShareUserModalVisible(false)}
        contentType="job"
        contentId={job.id}
      />
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
                <Text category="h3" bold style={globalStyle.flexOne} numberOfLines={2}>
                  {job.title}
                </Text>
                {job.applied ? (
                  <StatusBadge
                    variant="info"
                    label={t('more:applied_badge', {defaultValue: 'Applied'}).toString()}
                    style={{marginLeft: 8}}
                  />
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
              <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon20, {tintColor: theme['text-basic-color']}]} />
              <Text category="h9-s" ml={8} style={{flex: 1}}>
                {t('more:matches_target_role', {defaultValue: 'Matches your target role:'})} <Text category="h9-s" bold>{job.matchedRole}</Text>
              </Text>
            </Flex>
          ) : null}

          {/* Icon + label metadata rows (product request item, ZipRecruiter
              reference — the $ salary / briefcase / clock rows on its job
              details screen). Saveur's JobAlertProps has no salary or
              employment-type field to show (this app doesn't scrape/store
              that data, so nothing fabricated here) — Source and Posted
              date are the two real fields available, now in the same
              icon-per-row rhythm as the reference instead of the previous
              label-above-value mini-columns. */}
          <View style={styles.metaRows}>
            {job.source ? (
              <Flex justify="flex-start" itemsCenter style={styles.metaRow}>
                <Icon pack="eva" name="briefcase-outline" style={[globalStyle.icon20, {tintColor: theme['text-placeholder-color']}]} />
                <Text category="h9" ml={10} numberOfLines={1}>
                  {t('more:job_source_via', {defaultValue: 'Via {{source}}', source: job.source})}
                </Text>
              </Flex>
            ) : null}
            {job.postedAt ? (
              <Flex justify="flex-start" itemsCenter style={styles.metaRow}>
                <Icon pack="eva" name="clock-outline" style={[globalStyle.icon20, {tintColor: theme['text-placeholder-color']}]} />
                <Text category="h9" ml={10} numberOfLines={1}>
                  {t('more:job_posted_on', {defaultValue: 'Posted {{date}}', date: new Date(job.postedAt).toLocaleDateString()})}
                </Text>
              </Flex>
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
                source: job.source ?? t('more:the_employers_site', { defaultValue: "the employer's site" }),
              })}
        </Text>

        <CtaButton onPress={onApply} style={{display:job.applied ? 'none':'flex'}}>
          {job.source
            ? t('more:apply_on_source', {defaultValue: `Apply on ${job.source}`, source: job.source})
            : t('more:apply_for_this_job', {defaultValue: 'Apply for this job'})}
        </CtaButton>
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
    ...globalStyle.card,
    padding: 20,
    marginBottom: 24,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
  },
  metaRows: {
    marginTop: 8,
  },
  metaRow: {
    marginBottom: 8,
  },
});
