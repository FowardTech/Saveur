import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
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
  interview_laboratory: boolean;
  career_dna: boolean;
  dream_company_dashboard: boolean;
  daily_challenge: boolean;
  interview_heat_map: boolean;
  // Product request: "all those new features I asked you to implement
  // newly I want all of them to be configurable in the admin" — see
  // Saveur-Backend/app_config_service.py's DEFAULTS["feature_flags"] for
  // the exact default/behavior of each when off.
  location_language_gate: boolean;
  username_editing: boolean;
  learning_course_onboarding_banner: boolean;
  job_alerts_onboarding_banner: boolean;
  post_offer_plan: boolean;
  // Job Tracker inbox/calendar auto-scan (product follow-up: "build the
  // calendar-connect one for both and then we can activate and deactivate
  // any from the admin dashboard"). See DEFAULT_CONFIG below for why these
  // four deliberately default to false instead of following this file's
  // usual "fail open" convention.
  gmail_inbox_scan: boolean;
  outlook_inbox_scan: boolean;
  google_calendar_scan: boolean;
  outlook_calendar_scan: boolean;
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

// Product request: "add a banner in the homescreen at the top top for
// regular informations like policy change, change in terms and conditions
// etc." — a small, dismissible strip pinned above the Home greeting (see
// src/home/AnnouncementBanner.tsx), NOT the same thing as maintenance
// above (that's a full-screen blocking gate for outages). No id/version
// field — the banner component itself fingerprints title+message+link_url
// and remembers that exact combination as dismissed per account, so
// editing the copy here automatically re-shows it once, with nothing for
// an admin to remember to bump.
export interface HomeBannerConfig {
  enabled: boolean;
  title: string;
  message: string;
  link_url: string;
  link_label: string;
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
  // Full App Store listing URL (Admin > System > App Store / Play Store
  // listing) — reference-only today, nothing on mobile reads this yet
  // (utils/appRating.ts builds its deep link from ios_app_store_id above).
  ios_app_store_url: string;
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

// AI Interview Laboratory — interviewer personality catalog (see
// saveur-backend's app_config_service.py "interview_personas" section and
// src/practice/MockInterviewSetup.tsx's persona picker). `style` ships here
// too (see that section's own comment for why) but nothing on mobile reads
// it — it's only ever used server-side when generating questions.
export interface InterviewPersona {
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  icon: string;
  style: string;
}

export interface InterviewPersonasConfig {
  items: InterviewPersona[];
}

// Surprise Daily Challenge — challenge type labels (see saveur-backend's
// "daily_challenge" section and src/home/DailyChallengeCard.tsx).
export interface DailyChallengeType {
  id: string;
  enabled: boolean;
  name: string;
}

export interface DailyChallengeConfig {
  enabled: boolean;
  xp_reward: number;
  types: DailyChallengeType[];
}

// Upcoming Features teaser (product request item — see
// src/home/NextLessonHomeCard.tsx and src/more/UpcomingFeatures.tsx). Shown
// on Home in place of the "Next Lesson" card once a learner has no next
// curriculum lesson to take (see learningService.getNextLesson()), and
// listed in full on the screen that card navigates into. Same
// {id, enabled, name/description, icon} passthrough shape as
// InterviewPersona above, just with `title` in place of `name`.
export interface UpcomingFeatureItem {
  id: string;
  enabled: boolean;
  title: string;
  description: string;
  icon: string;
}

export interface UpcomingFeaturesConfig {
  items: UpcomingFeatureItem[];
}

// Pre-signup onboarding carousel illustrations (product request:
// "implement the ability to upload the app onboarding images i.e the one
// at signup... single image upload for the 4 onboarding screen that is in
// the signup part" — src/onboarding/index.tsx's DATA array actually has 5
// slides today). Flat string map, deliberately no per-language variant —
// unlike the Job Alerts/Learning Courses onboarding banners, this
// carousel's headline/subtitle text was specifically cropped OUT of each
// source image and rebuilt as this app's own translatable <Text>, so
// there's no baked-in text to localize, just one image per slide. Blank =
// keep using the bundled asset (assets/images/index.ts's onboarding*
// entries) — see src/onboarding/index.tsx's slideImage() helper.
export interface SignupOnboardingImagesConfig {
  interview: string;
  feedback: string;
  job_alert: string;
  resume_scan: string;
  learning: string;
}

export interface AppConfig {
  feature_flags: FeatureFlags;
  release: ReleaseConfig;
  maintenance: MaintenanceConfig;
  home_banner: HomeBannerConfig;
  appsflyer: AppsFlyerConfig;
  faq: FaqConfig;
  about: AboutConfig;
  store: StoreConfig;
  student_eligibility: StudentEligibilityConfig;
  interview_personas: InterviewPersonasConfig;
  daily_challenge: DailyChallengeConfig;
  signup_onboarding_images: SignupOnboardingImagesConfig;
  upcoming_features: UpcomingFeaturesConfig;
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
    interview_laboratory: true,
    career_dna: true,
    dream_company_dashboard: true,
    daily_challenge: true,
    interview_heat_map: true,
    location_language_gate: true,
    username_editing: true,
    learning_course_onboarding_banner: true,
    job_alerts_onboarding_banner: true,
    post_offer_plan: true,
    // Deliberately false, unlike every flag above — these gate real
    // external OAuth connections that don't work at all until an admin
    // both registers credentials AND flips the flag on (see the backend
    // DEFAULTS' own comment). "Fail open" is the right call for a flag
    // that just hides an otherwise-working feature during a network
    // hiccup; showing a "Connect Gmail" button that's guaranteed to fail
    // isn't a better fallback than hiding it, so these fail closed instead.
    gmail_inbox_scan: false,
    outlook_inbox_scan: false,
    google_calendar_scan: false,
    outlook_calendar_scan: false,
  },
  release: {
    ios_min_version: '',
    android_min_version: '',
    force_update: false,
    // Left blank on purpose -- App.tsx falls back to a live, reactive
    // t('common:update_required_title'/'update_required_message') call at
    // render time when these are empty. Hardcoding translated (or English)
    // text here would run once at module-load time, before i18n has
    // resolved the device/saved language, and would then always win over
    // App.tsx's `|| t(...)` fallback since a non-empty string here is
    // truthy -- silently making that fallback dead code again.
    update_title: '',
    update_message: '',
    update_url_ios: '',
    update_url_android: '',
  },
  maintenance: {enabled: false, title: '', message: ''},
  home_banner: {enabled: false, title: '', message: '', link_url: '', link_label: ''},
  appsflyer: {enabled: false, dev_key: '', ios_dev_key: '', onelink_id: '', onelink_subdomain: '', ios_app_id: ''},
  faq: {items: []},
  about: {tagline: '', description: '', contact_email: '', website_url: ''},
  store: {ios_app_store_id: '', android_package_name: 'com.saveur.app', ios_app_store_url: ''},
  student_eligibility: {eligible_countries: [], discount_percent: 3},
  interview_personas: {items: []},
  daily_challenge: {enabled: true, xp_reward: 30, types: []},
  signup_onboarding_images: {interview: '', feedback: '', job_alert: '', resume_scan: '', learning: ''},
  upcoming_features: {items: []},
};

// The JS-bundle-declared app version (package.json). Good enough to gate a
// forced update without pulling in a native module (react-native-device-info)
// purely for a version string — this project has a documented history of
// native-linking pain (see constants/env.ts), so plain constants are
// preferred until there's a stronger reason to add a native dependency.
export const APP_VERSION: string = require('../package.json').version ?? '0.0.0';

let cached: AppConfig = DEFAULT_CONFIG;

// Tiny pub/sub so screens that read getCachedConfig() synchronously in their
// render body (FaqScreen, AboutScreen) can re-render themselves once a
// fresh fetch lands — otherwise a language switch mid-session (see
// i18n/config.ts's 'languageChanged' listener, which now calls
// loadAppConfig() below) would update `cached` correctly but any already-
// mounted screen would keep showing the stale snapshot it read at mount
// time until it happened to re-render for some unrelated reason.
const subscribers = new Set<() => void>();

export function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function notifySubscribers(): void {
  subscribers.forEach(cb => {
    try {
      cb();
    } catch {
      // a subscriber throwing shouldn't break the others
    }
  });
}

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

/** Admin-uploaded override for one signup-onboarding carousel slide, or
 * null if the admin hasn't uploaded one (or the config hasn't loaded yet)
 * — callers fall back to their own bundled local asset in that case. See
 * SignupOnboardingImagesConfig's own comment above. */
export function getSignupOnboardingImage(key: keyof SignupOnboardingImagesConfig): string | null {
  return cached.signup_onboarding_images[key] || null;
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
    // BUG FIX (product report: "help & FAQs screen" / "about this app
    // screen" stuck in English regardless of language) — this call never
    // told the backend what language to respond in, so the "faq"/"about"
    // sections always came back as the single admin-authored English copy.
    // The backend now translates those two sections when `language` is
    // non-English (see app/api/content.py's get_public_config). Originally
    // this only ever ran once at app launch, so a language switch mid-
    // session left FAQ/About stuck in whatever language was active at last
    // cold start — i18n/config.ts's 'languageChanged' listener now also
    // calls loadAppConfig() so a mid-session switch re-fetches immediately
    // instead of waiting for the next app launch.
    const {data} = await apiClient.get<Partial<AppConfig>>('/api/v1/content/config', {
      params: {language: i18n.language || 'en'},
    });
    cached = {
      feature_flags: {...DEFAULT_CONFIG.feature_flags, ...data.feature_flags},
      release: {...DEFAULT_CONFIG.release, ...data.release},
      maintenance: {...DEFAULT_CONFIG.maintenance, ...data.maintenance},
      appsflyer: {...DEFAULT_CONFIG.appsflyer, ...data.appsflyer},
      faq: {...DEFAULT_CONFIG.faq, ...data.faq},
      about: {...DEFAULT_CONFIG.about, ...data.about},
      store: {...DEFAULT_CONFIG.store, ...data.store},
      student_eligibility: {...DEFAULT_CONFIG.student_eligibility, ...data.student_eligibility},
      interview_personas: {...DEFAULT_CONFIG.interview_personas, ...data.interview_personas},
      daily_challenge: {...DEFAULT_CONFIG.daily_challenge, ...data.daily_challenge},
      signup_onboarding_images: {...DEFAULT_CONFIG.signup_onboarding_images, ...data.signup_onboarding_images},
      home_banner: {...DEFAULT_CONFIG.home_banner, ...data.home_banner},
      upcoming_features: {...DEFAULT_CONFIG.upcoming_features, ...data.upcoming_features},
    };
    AsyncStorage.setItem(EKeyAsyncStorage.appConfigCache, JSON.stringify(cached)).catch(() => {});
  } catch {
    // Network/backend unavailable — proceed with whatever's cached (or
    // DEFAULT_CONFIG on a true first-ever launch). Fails open by design.
  }
  notifySubscribers();
  return cached;
}
