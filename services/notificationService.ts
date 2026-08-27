import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import {EKeyAsyncStorage, NotificationProps} from 'constants/Types';
import apiClient from './apiClient';

function currentLanguage(): string {
  return i18n.language || 'en';
}

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
  company_logo_url?: string | null;
  applied?: boolean;
}

interface NotificationWire {
  id: string;
  title: string;
  message: string;
  type?: string;
  read: boolean;
  created_at: string | number;
  job_alert?: NotificationJobAlertWire;
  // See constants/Types.tsx's NotificationProps.data comment.
  data?: Record<string, unknown> | null;
}

// Was the root cause of every notification showing the same wrong relative
// time ("in 4 hours", regardless of when it actually happened): a
// timezone-less ISO string like "2026-07-26T18:32:10" IS a UTC instant
// (every backend timestamp is generated via datetime.utcnow()), but
// Date.parse() treats a date-TIME string with no "Z"/offset suffix as LOCAL
// time per the JS spec (only bare date strings like "2026-07-26" default to
// UTC) — silently shifting every parsed timestamp by the device's own UTC
// offset, a fixed amount, which is exactly why the error was identical on
// every notification. The backend now appends "Z" itself (see
// Saveur-Backend's app/api/notifications.py), but this normalizes it
// defensively here too, in case any other endpoint/field ever has the same
// gap — appending "Z" to a bare "YYYY-MM-DDTHH:mm:ss[.ffffff]" string with
// no existing timezone marker before parsing.
const NAIVE_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;

function toMillis(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') {
    // Heuristic: treat values below 10^12 as unix seconds, otherwise already ms.
    return value < 1e12 ? value * 1000 : value;
  }
  const normalized = NAIVE_DATETIME_RE.test(value) ? `${value}Z` : value;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
}

// The backend's Notification.data is a plain JSON column, so its values
// could in principle be any JSON type — normalized to strings here since
// every consumer (handleDataTap's Number()/String() calls) already expects
// the flat string->string shape a push's `data` payload always has.
function stringifyNotificationData(data: Record<string, unknown> | null | undefined): Record<string, string> | undefined {
  if (!data) return undefined;
  const out: Record<string, string> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) out[key] = String(value);
  });
  return Object.keys(out).length ? out : undefined;
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
    data: stringifyNotificationData(wire.data),
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
          companyLogoUrl: wire.job_alert.company_logo_url ?? undefined,
          applied: wire.job_alert.applied ?? false,
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
    // Sent proactively -- notification title/message are 100% backend-
    // authored (see docs/BACKEND_SPEC_ADDENDUM_2026-07.md's new §21).
    // This only helps if the backend also translates on GET; notifications
    // that were already generated in English at creation time likely need
    // a separate backend fix at generation time, not just this fetch.
    const {data} = await apiClient.get<NotificationWire[]>('/api/v1/notifications', {
      params: {language: currentLanguage()},
    });
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
