import React, {memo} from 'react';
import {Alert} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Button,
  Spinner,
} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import Container from 'components/Container';
import Content from 'components/Content';
import NavigationAction from 'components/NavigationAction';
import Text from 'components/Text';
import Flex from 'components/Flex';
import {NotificationProps} from 'constants/Types';
import {RootStackParamList} from 'navigation/types';
import * as notificationService from 'services/notificationService';
import Applications from './Applications';

// Real in-app notification list — GET /api/v1/notifications /
// POST /api/v1/notifications/read (see services/notificationService.ts).
// Reached via the bell icon in src/home/Components/HeaderHome.tsx. The old
// UI here (three tabs: Applications/Interview/Bookings, leftover from the
// caregiver-marketplace template this app was reskinned from) didn't map
// onto the real backend contract, which returns a single flat list with no
// such categorization — replaced with one list + a "mark all as read"
// action.
const Notification = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['notification', 'common']);
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();

  const [notifications, setNotifications] = React.useState<NotificationProps[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [markingAll, setMarkingAll] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await notificationService.listNotifications();
      setNotifications(data);
    } catch (error: any) {
      setLoadError(
        error?.message ?? t('notification:load_failed', {defaultValue: 'Could not load your notifications.'}),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  const onPressItem = React.useCallback(
    async (item: NotificationProps) => {
      // Job alerts route straight to the in-app job details screen — see
      // src/more/JobAlertDetails.tsx, reached the same way whether tapped
      // here, from the Job Alerts list, or (once push notifications are
      // wired) an OS push notification tap. That screen marks the alert
      // read itself, so it's handled before the generic
      // mark-this-notification-read path below.
      if (item.type === 'job_alert' && item.jobAlert) {
        navigate('JobAlertDetails', {job: item.jobAlert});
      }

      if (item.read) return;
      // Optimistic — flip it locally right away, roll back if the server
      // call fails so the unread dot doesn't lie about server state.
      setNotifications(prev => prev.map(n => (n.id === item.id ? {...n, read: true} : n)));
      try {
        await notificationService.markNotificationsRead([item.id]);
      } catch (error: any) {
        setNotifications(prev => prev.map(n => (n.id === item.id ? {...n, read: false} : n)));
        Alert.alert(
          t('notification:mark_read_failed_title', {defaultValue: "Couldn't update notification"}),
          error?.message ?? t('notification:mark_read_failed_body', {defaultValue: 'Please try again in a moment.'}),
        );
      }
    },
    [t, navigate],
  );

  const unreadIds = React.useMemo(() => notifications.filter(n => !n.read).map(n => n.id), [notifications]);

  const onMarkAllRead = React.useCallback(async () => {
    if (unreadIds.length === 0 || markingAll) return;
    setMarkingAll(true);
    const previous = notifications;
    setNotifications(prev => prev.map(n => ({...n, read: true})));
    try {
      await notificationService.markNotificationsRead(unreadIds);
    } catch (error: any) {
      setNotifications(previous);
      Alert.alert(
        t('notification:mark_read_failed_title', {defaultValue: "Couldn't update notification"}),
        error?.message ?? t('notification:mark_read_failed_body', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setMarkingAll(false);
    }
  }, [unreadIds, markingAll, notifications, t]);

  const renderMarkAllRead = React.useCallback(
    () => (
      <Button appearance="ghost" size="small" disabled={markingAll} onPress={onMarkAllRead}>
        {t('notification:mark_all_read', {defaultValue: 'Mark all read'})}
      </Button>
    ),
    [markingAll, onMarkAllRead, t],
  );

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction />}
        accessoryRight={unreadIds.length > 0 ? renderMarkAllRead : undefined}
        title={t('notification:title').toString()}
      />
      {loading ? (
        <Flex style={styles.center} itemsCenter justify="center">
          <Spinner size="large" />
        </Flex>
      ) : loadError ? (
        <Content padder contentContainerStyle={styles.errorContent}>
          <Text category="h9-s" status="danger" mb={20} center>
            {loadError}
          </Text>
          <Button onPress={load}>{t('common:try_again', {defaultValue: 'Try again'}).toString()}</Button>
        </Content>
      ) : (
        <Content contentContainerStyle={styles.content} padder>
          <Applications data={notifications} onPressItem={onPressItem} />
        </Content>
      )}
    </Container>
  );
});

export default Notification;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexGrow: 1,
    paddingTop: 16,
    paddingBottom: 40,
  },
});
