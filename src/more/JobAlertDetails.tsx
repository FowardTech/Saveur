import React, {memo} from 'react';
import {View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Layout, Button, Icon} from '@ui-kitten/components';
import {NavigationProp, RouteProp, useNavigation, useRoute} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import * as jobAlertsService from 'services/jobAlertsService';

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
    navigate('WebViewScreen', {url: job.applyUrl, title: job.title});
  };

  return (
    <Container style={styles.container}>
      <TopNavigation title="Job Details" accessoryLeft={<NavigationAction />} />
      <Content padder contentContainerStyle={styles.content}>
        <Layout level="2" style={styles.card}>
          <Text category="h5" bold mb={4}>
            {job.title}
          </Text>
          <Text category="h8" status="placeholder" mb={16}>
            {job.company}
            {job.location ? ` · ${job.location}` : ''}
          </Text>

          {job.matchedRole ? (
            <Flex justify="flex-start" itemsCenter mb={12}>
              <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon20, {tintColor: theme['color-primary-500']}]} />
              <Text category="h9-s" ml={8}>
                Matches your target role: <Text category="h9-s" bold>{job.matchedRole}</Text>
              </Text>
            </Flex>
          ) : null}

          <View style={styles.metaRow}>
            {job.source ? (
              <View style={styles.metaItem}>
                <Text category="h10" status="placeholder">Source</Text>
                <Text category="h9" bold>{job.source}</Text>
              </View>
            ) : null}
            {job.postedAt ? (
              <View style={styles.metaItem}>
                <Text category="h10" status="placeholder">Posted</Text>
                <Text category="h9" bold>{new Date(job.postedAt).toLocaleDateString()}</Text>
              </View>
            ) : null}
          </View>
        </Layout>

        <Text category="h9-s" status="placeholder" mb={20} center>
          Applying takes you to {job.source ?? 'the employer\'s site'} to finish your application.
        </Text>

        <Button style={[globalStyle.shadowBtn]} onPress={onApply}>
          {job.source ? `Apply on ${job.source}` : 'Apply for this job'}
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
});
