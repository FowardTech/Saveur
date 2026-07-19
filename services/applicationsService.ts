import AsyncStorage from '@react-native-async-storage/async-storage';
import {Application_Stage_Enum, EKeyAsyncStorage, JobApplicationProps} from 'constants/Types';
import {Images} from 'assets/images';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// applicationsService — real backend implementation.
//
// Backs the job-application tracker (ApplicationsTab, RequestsInPast,
// ApplicationDetails). CRUD against /api/v1/tracker/applications. AsyncStorage
// is kept only as an offline-read fallback cache (see readCache/writeCache),
// never the source of truth — every read goes to the network first.
//
// Wire-shape / design-decision notes:
//  - `logo` on JobApplicationProps is a local `ImageRequireSource` (a
//    `require()`'d asset), which nothing coming over the wire can produce —
//    there's no way to turn a backend-hosted logo URL into a bundled asset
//    id at runtime. Every application built from a wire record gets a fixed
//    generic placeholder avatar (Images.avatar1) instead; if the backend
//    starts returning a `logo_url`, swap this for a screen that renders
//    remote images via `{uri}` instead of ApplicationItem's current
//    `Avatar source={item.logo}` (which is typed to expect a require()).
//  - The endpoint description says PATCH updates "stage/notes" — the app's
//    existing type only has a single free-text `nextStep` field (no separate
//    `notes`), so `nextStep` is what's sent/read as that "notes" field below.
// ---------------------------------------------------------------------------

interface JobApplicationWire {
  id: number | string;
  company: string;
  role: string;
  location: string;
  applied_date?: number | string;
  appliedDate?: number | string;
  stage: Application_Stage_Enum;
  next_step?: string;
  nextStep?: string;
}

function fromWire(wire: JobApplicationWire): JobApplicationProps {
  const appliedRaw = wire.applied_date ?? wire.appliedDate ?? Date.now();
  return {
    id: wire.id,
    company: wire.company,
    role: wire.role,
    location: wire.location,
    logo: Images.avatar1,
    appliedDate: typeof appliedRaw === 'string' ? new Date(appliedRaw).getTime() : appliedRaw,
    stage: wire.stage,
    nextStep: wire.next_step ?? wire.nextStep,
  };
}

function toWireCreate(app: Omit<JobApplicationProps, 'id'>): Record<string, unknown> {
  return {
    company: app.company,
    role: app.role,
    location: app.location,
    applied_date: Number(app.appliedDate),
    stage: app.stage,
    next_step: app.nextStep,
  };
}

function toWirePatch(partial: Partial<Omit<JobApplicationProps, 'id'>>): Record<string, unknown> {
  const wire: Record<string, unknown> = {};
  if (partial.stage !== undefined) wire.stage = partial.stage;
  if (partial.nextStep !== undefined) wire.next_step = partial.nextStep;
  if (partial.company !== undefined) wire.company = partial.company;
  if (partial.role !== undefined) wire.role = partial.role;
  if (partial.location !== undefined) wire.location = partial.location;
  if (partial.appliedDate !== undefined) wire.applied_date = Number(partial.appliedDate);
  return wire;
}

const readCache = async (): Promise<JobApplicationProps[]> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.jobApplications);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as JobApplicationProps[];
  } catch {
    return [];
  }
};

const writeCache = async (apps: JobApplicationProps[]): Promise<JobApplicationProps[]> => {
  await AsyncStorage.setItem(EKeyAsyncStorage.jobApplications, JSON.stringify(apps));
  return apps;
};

/**
 * GET /api/v1/tracker/applications — list all tracked job applications (both
 * active — Applied/Interviewing — and closed — Offer/Rejected). Screens
 * filter by `stage` client-side. Falls back to the last-known cache when
 * offline.
 */
export async function listApplications(): Promise<JobApplicationProps[]> {
  try {
    const {data} = await apiClient.get<JobApplicationWire[]>('/api/v1/tracker/applications');
    const apps = (data ?? []).map(fromWire);
    await writeCache(apps);
    // Newest first.
    return [...apps].sort((a, b) => Number(b.appliedDate) - Number(a.appliedDate));
  } catch (e) {
    const cached = await readCache();
    if (cached.length > 0) {
      return [...cached].sort((a, b) => Number(b.appliedDate) - Number(a.appliedDate));
    }
    throw e;
  }
}

/**
 * POST /api/v1/tracker/applications — add a new tracked application (e.g.
 * logged manually, or from a "Track this job" action elsewhere in the app).
 */
export async function addApplication(
  app: Omit<JobApplicationProps, 'id'>,
): Promise<JobApplicationProps> {
  const {data} = await apiClient.post<JobApplicationWire>(
    '/api/v1/tracker/applications',
    toWireCreate(app),
  );
  const created = fromWire(data);
  const cached = await readCache();
  await writeCache([created, ...cached]);
  return created;
}

/**
 * PATCH /api/v1/tracker/applications/{id} — move an application to a new
 * pipeline stage (Applied -> Interviewing -> Offer/Rejected).
 */
export async function updateApplicationStage(
  id: JobApplicationProps['id'],
  stage: Application_Stage_Enum,
): Promise<JobApplicationProps | null> {
  return updateApplication(id, {stage});
}

/**
 * PATCH /api/v1/tracker/applications/{id} — general update (stage and/or
 * `nextStep`/"notes"). `updateApplicationStage` above is a thin convenience
 * wrapper around this for the common "just move the stage" case.
 */
export async function updateApplication(
  id: JobApplicationProps['id'],
  partial: Partial<Omit<JobApplicationProps, 'id'>>,
): Promise<JobApplicationProps | null> {
  const {data} = await apiClient.patch<JobApplicationWire>(
    `/api/v1/tracker/applications/${id}`,
    toWirePatch(partial),
  );
  const updated = fromWire(data);
  const cached = await readCache();
  await writeCache(cached.map(item => (item.id === id ? updated : item)));
  return updated;
}

/**
 * DELETE /api/v1/tracker/applications/{id} — remove a tracked application.
 */
export async function deleteApplication(id: JobApplicationProps['id']): Promise<void> {
  await apiClient.delete(`/api/v1/tracker/applications/${id}`);
  const cached = await readCache();
  await writeCache(cached.filter(item => item.id !== id));
}
