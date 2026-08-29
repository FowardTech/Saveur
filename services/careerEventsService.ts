import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage, CareerEventProps} from 'constants/Types';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// careerEventsService — career fairs/networking events matched against the
// user's profile.preferredCountries + profile.desiredRoles, surfaced on the
// Networking Assistant screen (product request: "add the fetching of career
// events using eventbrite api... determined by the target roles and
// countries"). Same shape as jobAlertsService.ts, which this is deliberately
// modeled after — this app never queries Eventbrite itself; that's
// backend-owned (see Saveur-Backend's app/services/career_events_service.py
// for why: Eventbrite's public event-search API was retired in 2020, so the
// backend discovers candidates via Perplexity/Firecrawl and only uses
// Eventbrite's own API to confirm/enrich a specific event id). The client
// only reads whatever the backend has already matched, marks items read
// once viewed, can toggle "interested", and can nudge a manual refresh.
//
//   GET  /api/v1/career-events         — list matched events, soonest first.
//                                         Auto-refreshes server-side if this
//                                         user is due (same "safe to poll"
//                                         contract as job alerts).
//   POST /api/v1/career-events/read    — {ids: [...]} mark as read
//   POST /api/v1/career-events/refresh — manual re-scan, pull-to-refresh
//   POST /api/v1/career-events/{id}/save — toggle "interested" bookmark
// ---------------------------------------------------------------------------

interface CareerEventWire {
  id: string;
  title: string;
  organizer?: string;
  location?: string;
  matched_country?: string;
  matched_role?: string;
  url: string;
  source?: string;
  logo_url?: string;
  event_date?: string | number;
  created_at: string | number;
  read: boolean;
  saved?: boolean;
}

// See notificationService.ts / jobAlertsService.ts's identical helper: a
// bare "YYYY-MM-DDTHH:mm:ss" string (this backend's naive-UTC
// datetime.utcnow() serialization) gets misread by Date.parse() as local
// time unless explicitly marked UTC first.
const NAIVE_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;

function toMillis(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') {
    return value < 1e12 ? value * 1000 : value;
  }
  const normalized = NAIVE_DATETIME_RE.test(value) ? `${value}Z` : value;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function fromWire(wire: CareerEventWire): CareerEventProps {
  return {
    id: wire.id,
    title: wire.title,
    organizer: wire.organizer,
    location: wire.location,
    matchedCountry: wire.matched_country,
    matchedRole: wire.matched_role,
    url: wire.url,
    source: wire.source,
    logoUrl: wire.logo_url,
    eventDate: toMillis(wire.event_date),
    createdAt: toMillis(wire.created_at) ?? Date.now(),
    read: wire.read ?? false,
    saved: wire.saved ?? false,
  };
}

const readCache = async (): Promise<CareerEventProps[] | null> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.careerEventsCache);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CareerEventProps[];
  } catch {
    return null;
  }
};

const writeCache = async (events: CareerEventProps[]): Promise<void> => {
  await AsyncStorage.setItem(EKeyAsyncStorage.careerEventsCache, JSON.stringify(events));
};

// Same defensive "the backend might not have shipped the newest response
// shape yet" normalization jobAlertsService.ts's extractItems uses.
function extractItems(raw: unknown): CareerEventWire[] {
  if (Array.isArray(raw)) return raw as CareerEventWire[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as CareerEventWire[];
    if (Array.isArray(obj.events)) return obj.events as CareerEventWire[];
  }
  return [];
}

// BUG FIX (product report: "for the events fetched you are still fetching
// events that the dates have passed. You have to fetch events that the
// dates are in the future. Fetching events that their dates have passed...
// on the day the event already starts does not make any sense") — the
// backend's GET /api/v1/career-events already filters past-dated events at
// read time (see Saveur-Backend's app/api/career_events.py list_events),
// but that only takes effect once this fix is actually deployed there, and
// this client had zero safety net of its own if a stale/past-dated event
// ever slipped through (a not-yet-redeployed backend, a clock-skew edge
// case, etc). A defensive client-side filter closes that gap regardless of
// backend deploy state: an unsaved event with a real eventDate in the past
// is dropped here before it ever reaches the screen. Mirrors the backend's
// own exceptions so the two layers never disagree — an event with no
// parsed date at all still shows (nothing to judge it against, same as the
// backend's `event_date IS NULL` bypass), and a user's own "saved"
// bookmark still shows past its date too (the backend's own
// SAVED_EVENT_RETENTION_DAYS grace window is the single source of truth
// for exactly how long, not duplicated here).
function isUpcomingOrUndated(event: CareerEventProps): boolean {
  if (!event.eventDate) return true;
  if (event.saved) return true;
  return event.eventDate >= Date.now();
}

/**
 * GET /api/v1/career-events. Offline fallback (network failure with nothing
 * better to show) returns the last cached list.
 */
export async function listCareerEvents(): Promise<CareerEventProps[]> {
  try {
    const {data} = await apiClient.get<unknown>('/api/v1/career-events');
    const events = extractItems(data).map(fromWire).filter(isUpcomingOrUndated);
    await writeCache(events);
    return events;
  } catch (error) {
    const cached = await readCache();
    if (cached) return cached.filter(isUpcomingOrUndated);
    throw error;
  }
}

/**
 * POST /api/v1/career-events/read — marks the given event ids as read
 * server-side, and patches the local cache so an offline re-read doesn't
 * show them as unread again. No-ops on an empty array.
 */
export async function markCareerEventsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await apiClient.post('/api/v1/career-events/read', {ids});
  const cached = await readCache();
  if (cached) {
    const idSet = new Set(ids);
    await writeCache(cached.map(e => (idSet.has(e.id) ? {...e, read: true} : e)));
  }
}

export interface RefreshCareerEventsResult {
  ok: boolean;
  status: 'refreshing' | 'paused' | 'cooldown';
  message?: string;
  retryAfterSeconds?: number;
}

/**
 * POST /api/v1/career-events/refresh — manual re-scan. Same "queued, not
 * instant" contract as jobAlertsService.refreshJobAlerts: runs in a
 * background thread server-side and returns immediately — a full pass over
 * every desired role x preferred country combo can take a while (each one
 * is its own Perplexity search plus an Eventbrite/Firecrawl lookup per
 * candidate found). `listCareerEvents()` right after this will very likely
 * still show the same list; new matches show up a little later.
 *
 * Unlike jobAlertsService.refreshJobAlerts, this returns the response body
 * rather than discarding it — the backend can come back with
 * status: "cooldown" (product follow-up: "I dont want too much load on
 * perplexity") if this was tapped again too soon after the last refresh,
 * and the caller needs that to show real feedback instead of the button
 * silently doing nothing.
 */
export async function refreshCareerEvents(): Promise<RefreshCareerEventsResult> {
  const {data} = await apiClient.post<{ok: boolean; status: string; message?: string; retry_after_seconds?: number}>(
    '/api/v1/career-events/refresh',
    {},
  );
  return {
    ok: data.ok,
    status: (data.status as RefreshCareerEventsResult['status']) ?? 'refreshing',
    message: data.message,
    retryAfterSeconds: data.retry_after_seconds,
  };
}

/**
 * POST /api/v1/career-events/{id}/save — toggles (or explicitly sets)
 * whether an event is bookmarked as "interested". Saved events are exempt
 * from the backend's oldest-first trimming once a user is over their
 * per-user event cap.
 */
export async function toggleCareerEventSaved(id: string, saved?: boolean): Promise<CareerEventProps> {
  const {data} = await apiClient.post<CareerEventWire>(
    `/api/v1/career-events/${id}/save`,
    saved === undefined ? {} : {saved},
  );
  return fromWire(data);
}
