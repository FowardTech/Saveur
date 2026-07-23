import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage, NotificationProps} from 'constants/Types';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// notificationService — real backend implementation.
//
//   GET  /api/v1/notifications              — list
//   POST /api/v1/notifications/read          — {ids: [...]}
//   POST /api/v1/notifications/device-token  — register FCM token
//
// Backs src/home/Notification/* (the in-app notification list reached from
// the bell icon in src/home/Components/HeaderHome.tsx). Follows the same
// pattern as authService.ts: fromWire translates the backend's wire format,
// AsyncStorage is an offline-read fallback cache (not the source of truth).
//
// Wire format note: assumed snake_case (`created_at`) like every other
// converted service in this app. `created_at` is assumed to be either an
// ISO-8601 string or a unix timestamp (seconds or milliseconds — toMillis
// below normalizes either) since the exact serialization wasn't pinned down
// anywhere in the source comments.
//
// Push notifications (device tokens): registerDeviceToken is called from
// AuthContext.tsx right after sign-in (see services/pushNotificationService.ts,
// which owns permission-requesting, getToken()/onTokenRefresh, and routing a
// tapped job-alert push to src/more/JobAlertDetails.tsx via
// navigation/navigationRef.ts). This file just owns the wire call.
// ---------------------------------------------------------------------------

// Embedded job payload on a type: "job_alert" notification — the backend
// puts the full matched job directly on the notification (not just an id),
// so tapping it can open src/more/JobAlertDetails.tsx immediately with no
// extra fetch/correlation against the separate GET /api/v1/job-alerts list.
// Field names mirror services/jobAlertsService.ts's JobAlertWire.
interface NotificationJobAlertWire {
  id: string;
  title: string;
  company: string;
  location?: string;
  source?: string;
  matched_role?: string;
  apply_url: string;
  posted_at?: string | number;
}

interface NotificationWire {
  id: string;
  title: string;
  message: string;
  type?: string;
  read: boolean;
  created_at: string | number;
  job_alert?: NotificationJobAlertWire;
}

function toMillis(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') {
    // Heuristic: treat values below 10^12 as unix seconds, otherwise already ms.
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function fromWire(wire: NotificationWire): NotificationProps {
  const createdAt = toMillis(wire.created_at) ?? Date.now();
  return {
    id: wire.id,
    title: wire.title,
    message: wire.message,
    type: wire.type,
    read: wire.read ?? false,
    createdAt,
    jobAlert: wire.job_alert
      ? {
          id: wire.job_alert.id,
          title: wire.job_alert.title,
          company: wire.job_alert.company,
          location: wire.job_alert.location,
          source: wire.job_alert.source,
          matchedRole: wire.job_alert.matched_role,
          applyUrl: wire.job_alert.apply_url,
          postedAt: toMillis(wire.job_alert.posted_at),
          createdAt,
          read: wire.read ?? false,
        }
      : undefined,
  };
}

const readCache = async (): Promise<NotificationProps[] | null> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.notificationsCache);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NotificationProps[];
  } catch {
    return null;
  }
};

const writeCache = async (notifications: NotificationProps[]): Promise<void> => {
  await AsyncStorage.setItem(EKeyAsyncStorage.notificationsCache, JSON.stringify(notifications));
};

/**
 * GET /api/v1/notifications. Falls back to the last-known cached list on a
 * network failure so the screen isn't just a blank error on a flaky
 * connection; a hard failure with nothing cached yet still propagates so the
 * caller can show a real error state.
 */
export async function listNotifications(): Promise<NotificationProps[]> {
  try {
    const {data} = await apiClient.get<NotificationWire[]>('/api/v1/notifications');
    const notifications = data.map(fromWire);
    await writeCache(notifications);
    return notifications;
  } catch (error) {
    const cached = await readCache();
    if (cached) return cached;
    throw error;
  }
}

/**
 * POST /api/v1/notifications/read — marks the given notification ids as
 * read server-side. Also patches the local cache so a subsequent offline
 * read (listNotifications() while the network is down) doesn't show these
 * as unread again. No-ops on an empty array rather than firing a pointless
 * request.
 */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await apiClient.post('/api/v1/notifications/read', {ids});
  const cached = await readCache();
  if (cached) {
    const idSet = new Set(ids);
    await writeCache(cached.map(n => (idSet.has(n.id) ? {...n, read: true} : n)));
  }
}

/**
 * POST /api/v1/notifications/device-token — registers this device's push
 * token so the backend can send it push notifications. Called from
 * services/pushNotificationService.ts's registerForPushNotifications() with
 * the token from `messaging().getToken()`, and again from its
 * `onTokenRefresh` listener whenever Firebase rotates the token.
 */
export async function registerDeviceToken(token: string): Promise<void> {
  // `platform` was never sent — the backend's PushToken row always ended up
  // with a null platform column, harmless for delivery (FCM v1 routes to
  // APNs/FCM automatically off the token itself) but makes the admin side
  // unable to tell ios vs android devices apart, or target a push by
  // platform later.
  await apiClient.post('/api/v1/notifications/device-token', {token, platform: Platform.OS});
}
