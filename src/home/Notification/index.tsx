import React, {memo} from 'react';
import {Alert} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Button,
} from '@ui-kitten/components';
import notifee from '@notifee/react-native';
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
import {handleDataTap} from 'services/pushNotificationService';
import Applications from './Applications';
import CtaButton from 'components/CtaButton';
import { SkeletonList } from 'components/Skeleton';

// Sets the app-icon badge to the given list's actual local unread count.
// Best-effort/fire-and-forget, same as every other notifee call in this
// codebase (services/pushNotificationService.ts) — a failed badge update
// shouldn't surface an error or block the read-marking UI it's attached to.
function syncBadgeCount(notifications: NotificationProps[]): void {
  const unread = notifications.filter(n => !n.read).length;
  notifee.setBadgeCount(unread).catch(err => {
    console.warn('[push] setBadgeCount (mark-read sync) failed', err);
  });
}

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
      // Baseline re-sync against the server's own truth whenever this
      // screen is opened/refreshed — covers cases the push-driven and
      // mark-read-driven updates elsewhere can't (a fresh install/reinstall,
      // a notification read on another device, a push that silently failed
      // to update the badge for any reason) so the icon can't drift
      // permanently out of sync with reality.
      syncBadgeCount(data);
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
      // Reverted per explicit follow-up request — job alerts route back to
      // the in-app job details screen first (see src/more/JobAlertDetails.tsx),
      // reached the same way whether tapped here, from the Job Alerts list,
      // or an OS push notification tap. That screen marks the alert read
      // itself, so it's handled before the generic mark-this-notification-
      // read path below.
      if (item.type === 'job_alert' && item.jobAlert) {
        navigate('JobAlertDetails', {job: item.jobAlert});
      } else if (item.type) {
        // BUG FIX (product report: "the notifications are not navigating to
        // the individual screens concerned") — every OTHER notification
        // type (feedback_ready, roadmap_ready, payment, goal_tip, etc.)
        // used to do nothing but mark itself read here, even though an OS
        // push for the exact same event already routed to the right screen
        // via services/pushNotificationService.ts's handleDataTap. Reusing
        // that same function (now exported) instead of a second, drifting
        // copy of the type->screen table — {type, ...item.data} is the
        // same shape a push's `data` payload already has (see
        // services/notificationService.ts's fromWire and Saveur-Backend's
        // app/models/tracker.py Notification.data).
        handleDataTap({type: item.type, ...(item.data ?? {})});
      }

      if (item.read) return;
      // Optimistic — flip it locally right away, roll back if the server
      // call fails so the unread dot doesn't lie about server state.
      setNotifications(prev => {
        const next = prev.map(n => (n.id === item.id ? {...n, read: true} : n));
        // App-icon badge (product report: "Saveur's app icon doesn't show a
        // notification badge count like other apps do"). The backend only
        // re-stamps the badge on the NEXT push it sends — reading a
        // notification in-app, with no push involved, would otherwise leave
        // the icon stuck showing a now-stale (too high) count until
        // whenever that next push happens to arrive. Recomputed from local
        // state right after every read here rather than waiting on that.
        syncBadgeCount(next);
        return next;
      });
      try {
        await notificationService.markNotificationsRead([item.id]);
      } catch (error: any) {
        setNotifications(prev => {
          const next = prev.map(n => (n.id === item.id ? {...n, read: false} : n));
          syncBadgeCount(next);
          return next;
        });
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
    setNotifications(prev => {
      const next = prev.map(n => ({...n, read: true}));
      syncBadgeCount(next); // see onPressItem's comment on why this runs locally too
      return next;
    });
    try {
      await notificationService.markNotificationsRead(unreadIds);
    } catch (error: any) {
      setNotifications(previous);
      syncBadgeCount(previous);
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
        title={
          // Plain-string titles here previously ran into the back button
          // (user report, explicitly named this screen) — the "Mark all
          // read" accessoryRight only shows up when there are unread items,
          // so an unbalanced left-icon-only header made a translated title
          // (this string is much longer in several locales than the English
          // "Notifications") drift into the icon. numberOfLines={1} +
          // ellipsizeMode keeps it to one truncated line no matter the
          // locale or accessory state (see components/NavigationAction.tsx
          // for the back button this sits next to).
          <Text category="h6" bold numberOfLines={1} ellipsizeMode="tail">
            {t('notification:title').toString()}
          </Text>
        }
      />
      {loading ? (
        <SkeletonList count={3} style={{ paddingHorizontal: 16 }} />
      ) : loadError ? (
        <Content padder contentContainerStyle={styles.errorContent}>
          <Text category="h9-s" status="danger" mb={20} center>
            {loadError}
          </Text>
          <CtaButton onPress={load}>{t('common:try_again', {defaultValue: 'Try again'}).toString()}</CtaButton>
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
    paddingTop: 10,
    paddingBottom: 40,
   
  },
});
