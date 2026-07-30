import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage} from 'constants/Types';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// configService — reads the admin-configurable app config (feature flags,
// forced-update gate, maintenance-mode banner) from the public, unauthenticated
// GET /api/v1/content/config (see saveur-backend's app/api/content.py +
// app/services/app_config_service.py, and the admin dashboard's Feature
// Flags/Release page). Fetched once at App.tsx startup, cached to
// AsyncStorage so a cold start with no network still has last-known values
// instead of nothing, and exposed as plain in-memory getters the rest of the
// app can read synchronously after the initial fetch resolves.
//
// Deliberately fails OPEN, not closed: if the fetch fails, every feature
// flag defaults to enabled and maintenance/force-update both default to
// off — a network hiccup should never lock users out of the app or hide a
// feature that's actually fine.
// ---------------------------------------------------------------------------

export interface FeatureFlags {
  learning_courses: boolean;
  career_diary: boolean;
  referral_program: boolean;
  voice_coach: boolean;
  coding_practice: boolean;
  salary_negotiation: boolean;
  job_alerts: boolean;
  networking: boolean;
  ai_curriculum_builder: boolean;
  cover_letter_generator: boolean;
  weekly_career_report: boolean;
  daily_industry_news: boolean;
  video_interview_replay: boolean;
  resume_evolution: boolean;
  linkedin_optimizer: boolean;
  emotional_coach: boolean;
  company_intelligence: boolean;
  career_os_briefing: boolean;
  student_verification: boolean;
  career_roadmap: boolean;
  practical_scenarios: boolean;
}

export interface ReleaseConfig {
  ios_min_version: string;
  android_min_version: string;
  force_update: boolean;
  update_title: string;
  update_message: string;
  update_url_ios: string;
  update_url_android: string;
}

export interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  message: string;
}

// AppsFlyer deferred deep linking — "share a job" (see services/
// jobShareService.ts and App.tsx's onInstallConversionData/
// onAppOpenAttribution listeners). A dev key alone is enough to init the
// SDK for install attribution; onelink_id + onelink_subdomain (set by an
// admin from the AppsFlyer dashboard's OneLink template, Admin > System)
// are what make generateInviteLink actually produce a deferred link —
// until both are present, jobShareService falls back to a plain saveur://
// share link.
//
// dev_key / ios_dev_key: AppsFlyer issues a SEPARATE dev key per platform
// app registration (iOS and Android are two different "apps" in the
// AppsFlyer dashboard) — dev_key is Android's, ios_dev_key is iOS's. See
// services/appsFlyerService.ts's init(), which picks the right one by
// Platform.OS. These used to be a single shared `dev_key` field, which was
// wrong — the one key that had actually been configured was iOS's, so
// Android was silently initializing with the wrong platform's key.
export interface AppsFlyerConfig {
  enabled: boolean;
  dev_key: string;
  ios_dev_key: string;
  onelink_id: string;
  onelink_subdomain: string;
  ios_app_id: string;
}

// FAQ + About content (product request item) — both screens used to show
// unmodified leftover content from the original RN template ("We are team
// UI/UX and Developer...", a stranger's WhatsApp number/Messenger link, a
// link to the template author's own portfolio). Now real, admin-editable
// content — see saveur-backend's app_config_service.py's "faq"/"about"
// sections and the admin dashboard's Content page.
export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqConfig {
  items: FaqItem[];
}

export interface AboutConfig {
  tagline: string;
  description: string;
  contact_email: string;
  website_url: string;
}

// App Store / Play Store listing identifiers (product request item) — used
// by utils/appRating.ts's post-first-interview/first-course review prompt.
// ios_app_store_id starts blank until an admin sets it (app not published
// yet); the prompt safely no-ops on iOS until then, same as the old
// hardcoded-constant behavior it replaced.
export interface StoreConfig {
  ios_app_store_id: string;
  android_package_name: string;
}

// Student verification eligibility + discount (see src/more/StudentVerification.tsx
// and saveur-backend's app_config_service.py "student_eligibility" section).
// discount_percent used to be a hardcoded "3%" baked into 4 separate strings
// in StudentVerification.tsx and a STUDENT_DISCOUNT_PERCENT constant in
// stripe_service.py — both now read this single admin-editable value.
export interface StudentEligibilityConfig {
  eligible_countries: string[];
  discount_percent: number;
}

export interface AppConfig {
  feature_flags: FeatureFlags;
  release: ReleaseConfig;
  maintenance: MaintenanceConfig;
  appsflyer: AppsFlyerConfig;
  faq: FaqConfig;
  about: AboutConfig;
  store: StoreConfig;
  student_eligibility: StudentEligibilityConfig;
}

const DEFAULT_CONFIG: AppConfig = {
  feature_flags: {
    learning_courses: true,
    career_diary: true,
    referral_program: true,
    voice_coach: true,
    coding_practice: true,
    salary_negotiation: true,
    job_alerts: true,
    networking: true,
    ai_curriculum_builder: true,
    cover_letter_generator: true,
    weekly_career_report: true,
    daily_industry_news: true,
    video_interview_replay: true,
    resume_evolution: true,
    linkedin_optimizer: true,
    emotional_coach: true,
    company_intelligence: true,
    career_os_briefing: true,
    student_verification: true,
    career_roadmap: true,
    practical_scenarios: true,
  },
  release: {
    ios_min_version: '',
    android_min_version: '',
    force_update: false,
    update_title: 'Update required',
    update_message: 'A new version of Saveur is available. Please update to continue.',
    update_url_ios: '',
    update_url_android: '',
  },
  maintenance: {enabled: false, title: 'Down for maintenance', message: ''},
  appsflyer: {enabled: false, dev_key: '', ios_dev_key: '', onelink_id: '', onelink_subdomain: '', ios_app_id: ''},
  faq: {items: []},
  about: {tagline: '', description: '', contact_email: '', website_url: ''},
  store: {ios_app_store_id: '', android_package_name: 'com.saveur.app'},
  student_eligibility: {eligible_countries: [], discount_percent: 3},
};

// The JS-bundle-declared app version (package.json). Good enough to gate a
// forced update without pulling in a native module (react-native-device-info)
// purely for a version string — this project has a documented history of
// native-linking pain (see constants/env.ts), so plain constants are
// preferred until there's a stronger reason to add a native dependency.
export const APP_VERSION: string = require('../package.json').version ?? '0.0.0';

let cached: AppConfig = DEFAULT_CONFIG;

/** Parses "1.2.3" -> [1,2,3]; missing/garbage segments treated as 0. */
function parseVersion(v: string): number[] {
  return (v || '')
    .split('.')
    .map(p => parseInt(p, 10))
    .map(n => (Number.isFinite(n) ? n : 0));
}

/** true if `current` < `minimum` (semantic version compare, segment by segment). */
export function isVersionBelow(current: string, minimum: string): boolean {
  if (!minimum) return false;
  const a = parseVersion(current);
  const b = parseVersion(minimum);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

export function getCachedConfig(): AppConfig {
  return cached;
}

export function isFeatureEnabled(key: keyof FeatureFlags): boolean {
  return cached.feature_flags[key] !== false;
}

/** Whether the CURRENT app build is below the admin-configured minimum for
 * this platform — i.e. whether the force-update screen should show. */
export function needsForceUpdate(config: AppConfig): boolean {
  if (!config.release.force_update) return false;
  const minVersion =
    Platform.OS === 'ios' ? config.release.ios_min_version : config.release.android_min_version;
  return isVersionBelow(APP_VERSION, minVersion);
}

export function getUpdateUrl(config: AppConfig): string {
  return Platform.OS === 'ios' ? config.release.update_url_ios : config.release.update_url_android;
}

/** Fetch the live config, update the in-memory cache + AsyncStorage, and
 * return it. Never throws — falls back to the last cached value (or safe
 * defaults on a true cold start) so a network failure never blocks app
 * startup. Call once from App.tsx before rendering the main navigator. */
export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const stored = await AsyncStorage.getItem(EKeyAsyncStorage.appConfigCache);
    if (stored) cached = {...DEFAULT_CONFIG, ...JSON.parse(stored)};
  } catch {
    // ignore — cached stays at DEFAULT_CONFIG
  }
  try {
    const {data} = await apiClient.get<Partial<AppConfig>>('/api/v1/content/config');
    cached = {
      feature_flags: {...DEFAULT_CONFIG.feature_flags, ...data.feature_flags},
      release: {...DEFAULT_CONFIG.release, ...data.release},
      maintenance: {...DEFAULT_CONFIG.maintenance, ...data.maintenance},
      appsflyer: {...DEFAULT_CONFIG.appsflyer, ...data.appsflyer},
      faq: {...DEFAULT_CONFIG.faq, ...data.faq},
      about: {...DEFAULT_CONFIG.about, ...data.about},
      store: {...DEFAULT_CONFIG.store, ...data.store},
      student_eligibility: {...DEFAULT_CONFIG.student_eligibility, ...data.student_eligibility},
    };
    AsyncStorage.setItem(EKeyAsyncStorage.appConfigCache, JSON.stringify(cached)).catch(() => {});
  } catch {
    // Network/backend unavailable — proceed with whatever's cached (or
    // DEFAULT_CONFIG on a true first-ever launch). Fails open by design.
  }
  return cached;
}
