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
// Push notifications (device tokens): registerDeviceToken is implemented
// below but deliberately NOT called from anywhere yet. See its docstring —
// this project has no push-notification native module installed
// (@react-native-firebase/messaging is not a dependency), and obtaining a
// real FCM/APNs token requires adding one. That's a meaningful native-linking
// risk (this project has a documented history of native-dependency/pod-install
// pain) and deserves its own dedicated follow-up pass rather than being
// bundled into this one.
// ---------------------------------------------------------------------------

interface NotificationWire {
  id: string;
  title: string;
  message: string;
  type?: string;
  read: boolean;
  created_at: string | number;
}

function toMillis(value: string | number): number {
  if (typeof value === 'number') {
    // Heuristic: treat values below 10^12 as unix seconds, otherwise already ms.
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function fromWire(wire: NotificationWire): NotificationProps {
  return {
    id: wire.id,
    title: wire.title,
    message: wire.message,
    type: wire.type,
    read: wire.read ?? false,
    createdAt: toMillis(wire.created_at),
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
 * token so the backend can send it push notifications.
 *
 * NOT CALLED ANYWHERE YET. Getting a real FCM/APNs token requires
 * @react-native-firebase/messaging (or an equivalent push library), which
 * is not installed in this project — there is currently no way to obtain a
 * real `token` to pass in here. Adding that dependency means new native
 * setup on both platforms (FCM config files, APNs entitlements/capabilities,
 * a pod install) — given this project's documented history of
 * native-dependency/pod-install pain, that's a distinct, meaningful risk
 * that deserves its own focused pass rather than being bundled into this
 * notifications-list wiring. Once messaging is added, call this on app boot
 * (after notification permission is granted) with the token from
 * `messaging().getToken()`, and again from the `onTokenRefresh` listener.
 */
export async function registerDeviceToken(token: string): Promise<void> {
  await apiClient.post('/api/v1/notifications/device-token', {token});
}
