import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import {EKeyAsyncStorage, JobAlertProps} from 'constants/Types';
import apiClient from './apiClient';

function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// jobAlertsService — real backend implementation of "Google-Alert-style" job
// matching against the user's profile.preferredCountries + profile.desiredRoles
// (see authService.ts / constants/Types.tsx's JobAlertProps).
//
//   GET  /api/v1/job-alerts          — list matched job postings, newest
//                                       first, paginated (see PAGE_SIZE
//                                       below). If the user has no alerts yet
//                                       today AND this is the first page
//                                       (no cursor), this call itself
//                                       triggers a background search/match/
//                                       persist — otherwise it's a DB-only
//                                       read (same "safe to poll" contract as
//                                       goalTipsService.getTodayTips).
//   POST /api/v1/job-alerts/read     — {ids: [...]} mark as read
//   POST /api/v1/job-alerts/refresh  — manual re-scan, for pull-to-refresh
//                                       (see src/more/JobAlerts.tsx)
//
// This app never crawls/searches for jobs itself — that's backend-owned. The
// client only reads whatever the backend has already matched, marks items
// read once viewed, and can nudge it to re-scan on demand. Same
// offline-read-fallback + snake_case-wire pattern as notificationService.ts,
// which this is deliberately modeled after (a job alert is conceptually a
// richer, job-specific notification — the backend also drops a
// kind:"job_alert" row into /api/v1/notifications for each new match, so the
// bell badge picks it up too, with no extra client work needed for that).
// ---------------------------------------------------------------------------

// Cursor-based, not offset-based: offset pagination breaks on a
// newest-first list that can have new items inserted at the top between
// page loads (a "page 2" fetched by offset would re-show/skip items once
// something new lands on page 1). The cursor is an opaque string the
// backend defines — see listJobAlerts's docstring.
export const JOB_ALERTS_PAGE_SIZE = 15;

interface JobAlertWire {
  id: string;
  title: string;
  company: string;
  location?: string;
  source?: string;
  matched_role?: string;
  apply_url: string;
  posted_at?: string | number;
  created_at: string | number;
  read: boolean;
  pinned?: boolean;
  company_logo_url?: string | null;
  applied?: boolean;
}

export interface JobAlertsPage {
  alerts: JobAlertProps[];
  nextCursor: string | null;
}

// See notificationService.ts's identical helper for the full explanation —
// same bug, same fix: a bare "YYYY-MM-DDTHH:mm:ss" string (this backend's
// naive-UTC datetime.utcnow() serialization) gets misread by Date.parse()
// as local time unless explicitly marked UTC first.
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

function fromWire(wire: JobAlertWire): JobAlertProps {
  return {
    id: wire.id,
    title: wire.title,
    company: wire.company,
    location: wire.location,
    source: wire.source,
    matchedRole: wire.matched_role,
    applyUrl: wire.apply_url,
    postedAt: toMillis(wire.posted_at),
    createdAt: toMillis(wire.created_at) ?? Date.now(),
    read: wire.read ?? false,
    pinned: wire.pinned ?? false,
    companyLogoUrl: wire.company_logo_url ?? undefined,
    applied: wire.applied ?? false,
  };
}

/**
 * GET /api/v1/job-alerts/<id> — a single job alert by id, regardless of
 * whether it's in the current user's own feed. Added for the "share a job"
 * deep-link landing flow (services/jobShareService.ts) — a shared link only
 * ever carries an id, and JobAlertDetails' route takes the full JobAlertProps
 * as a param rather than re-fetching by id itself, so this is the fetch that
 * turns "id from a deep link" into something that screen can actually show.
 * Throws on failure (including a 403 from @require_premium on the backend —
 * see that route's docstring) so the caller can distinguish "not found" /
 * "not entitled" from a successful fetch, unlike most read paths in this
 * service which fail soft to a cache.
 */
export async function getJobAlertById(id: string): Promise<JobAlertProps> {
  const {data} = await apiClient.get<JobAlertWire>(`/api/v1/job-alerts/${id}`, {
    params: {language: currentLanguage()},
  });
  return fromWire(data);
}

const readCache = async (): Promise<JobAlertProps[] | null> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.jobAlertsCache);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as JobAlertProps[];
  } catch {
    return null;
  }
};

const writeCache = async (alerts: JobAlertProps[]): Promise<void> => {
  await AsyncStorage.setItem(EKeyAsyncStorage.jobAlertsCache, JSON.stringify(alerts));
};

// The backend may not have shipped the new paginated envelope
// (`{data: [...], next_cursor}`) yet — this was only just specced out, and
// until it's deployed the endpoint could still be returning the old shape
// (a bare array, or `{alerts: [...]}`). Rather than crash the whole screen
// with a raw "X.map is not a function"-style error the moment that happens,
// normalize whatever comes back into a plain JobAlertWire[] so the UI stays
// usable (just without a next page) until the backend catches up.
function extractItems(raw: unknown): JobAlertWire[] {
  if (Array.isArray(raw)) return raw as JobAlertWire[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as JobAlertWire[];
    if (Array.isArray(obj.alerts)) return obj.alerts as JobAlertWire[];
  }
  return [];
}

// Was only checking an exact `next_cursor: string` key — if the backend
// ships any other reasonable spelling/casing (nextCursor, next_page_token,
// a numeric cursor, etc.) or nests the pagination info one level down (e.g.
// {meta: {next_cursor}} / {pagination: {...}}), this silently returned null
// forever and the "Load more" button (see src/more/JobAlerts.tsx, which only
// renders when nextCursor is truthy) never appeared — reported as "I did not
// see the load more button." Widened to the same defensive multi-key-spelling
// pattern used elsewhere in this codebase (e.g. coachService.ts).
function extractNextCursor(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const candidates = [
    obj.next_cursor,
    obj.nextCursor,
    obj.cursor,
    obj.next_page_token,
    obj.nextPageToken,
    obj.next,
  ];
  const nested = [obj.meta, obj.pagination, obj.page_info, obj.pageInfo].find(
    v => v && typeof v === 'object',
  ) as Record<string, unknown> | undefined;
  if (nested) {
    candidates.push(
      nested.next_cursor,
      nested.nextCursor,
      nested.cursor,
      nested.next_page_token,
      nested.nextPageToken,
    );
  }
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
  }
  return null;
}

/**
 * GET /api/v1/job-alerts?limit=15[&cursor=...]. Pass no `cursor` for the
 * first page — the backend's "auto-scan if nothing found yet today" behavior
 * only applies to that first-page request, not to "load more" pages further
 * down the list. Offline fallback (network failure with nothing better to
 * show) only ever returns the cached *first* page — a stale "load more"
 * continuation isn't something an offline cache can meaningfully serve, so
 * this returns `nextCursor: null` in that case rather than pretending there's
 * more to load.
 */
export async function listJobAlerts(cursor?: string): Promise<JobAlertsPage> {
  try {
    // Product decision: real external job listings (title/company/location,
    // pulled from job boards) should be translated into the user's language
    // too, not left in the listing's original language. Backend doesn't
    // implement this yet -- sent proactively (see docs/BACKEND_SPEC_ADDENDUM_
    // 2026-07.md's new §16d for the full contract this needs, including the
    // caching/accuracy caveats specific to translating unbounded external
    // content, unlike this app's own AI-generated copy).
    const {data} = await apiClient.get<unknown>('/api/v1/job-alerts', {
      params: {limit: JOB_ALERTS_PAGE_SIZE, ...(cursor ? {cursor} : {}), language: currentLanguage()},
    });
    const alerts = extractItems(data).map(fromWire);
    if (!cursor) {
      await writeCache(alerts);
    }
    return {alerts, nextCursor: extractNextCursor(data)};
  } catch (error) {
    if (!cursor) {
      const cached = await readCache();
      if (cached) return {alerts: cached, nextCursor: null};
    }
    throw error;
  }
}

/**
 * POST /api/v1/job-alerts/read — marks the given alert ids as read
 * server-side, and patches the local cache so an offline re-read doesn't
 * show them as unread again. No-ops on an empty array.
 */
export async function markJobAlertsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await apiClient.post('/api/v1/job-alerts/read', {ids});
  const cached = await readCache();
  if (cached) {
    const idSet = new Set(ids);
    await writeCache(cached.map(a => (idSet.has(a.id) ? {...a, read: true} : a)));
  }
}

/**
 * POST /api/v1/job-alerts/refresh — manual re-scan. Runs in a background
 * thread server-side and returns immediately ({ok, status: "refreshing"})
 * rather than waiting for the scan to finish — a full pass over every
 * desired role x preferred country can legitimately take anywhere from a
 * few seconds to over a minute (each combo may hit an external
 * crawl/search API plus a live-page fetch per candidate posting), which is
 * comfortably past what's reasonable for a pull-to-refresh spinner to
 * block on. This resolving successfully just means the scan was queued —
 * it does NOT mean new alerts already exist yet. `listJobAlerts()` right
 * after this will very likely still show the same list; new matches show
 * up a little later (next pull-to-refresh, next natural GET, or via the
 * push notification the backend sends per new alert).
 */
export async function refreshJobAlerts(): Promise<void> {
  await apiClient.post('/api/v1/job-alerts/refresh', {});
}

/**
 * POST /api/v1/job-alerts/{id}/pin — toggles (or explicitly sets) whether
 * an alert is pinned. Pinned alerts get a longer auto-delete window (30
 * days vs. the standard 7 — see job_search_service.cleanup_old_alerts on
 * the backend) rather than being exempt from deletion entirely.
 */
export async function toggleJobAlertPin(id: string, pinned?: boolean): Promise<JobAlertProps> {
  const {data} = await apiClient.post<JobAlertWire>(
    `/api/v1/job-alerts/${id}/pin`,
    pinned === undefined ? {} : {pinned},
  );
  return fromWire(data);
}

/**
 * POST /api/v1/job-alerts/{id}/report-dead — called by src/more/
 * WebViewScreen.tsx the moment it detects the apply page it just loaded is
 * actually a dead/expired posting (e.g. Workday's "the page you are looking
 * for does not exist"), rather than letting the user sit on that broken
 * page with no way for the backend to ever learn about it. The backend
 * removes this apply_url for every user who has it, not just the reporter
 * (see that endpoint's own docstring) — best-effort, deliberately swallows
 * its own errors so a failed report never blocks/interrupts the user
 * dismissing the broken page in front of them.
 */
export async function reportDeadJobAlert(id: string): Promise<void> {
  try {
    await apiClient.post(`/api/v1/job-alerts/${id}/report-dead`, {});
  } catch {
    // Best-effort — see docstring above.
  }
}
