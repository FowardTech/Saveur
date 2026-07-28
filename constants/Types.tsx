import {EvaStatus} from '@ui-kitten/components/devsupport';
import {ImageRequireSource, TextStyle, ViewStyle} from 'react-native';
import {AnimatedRegion, LatLng} from 'react-native-maps';
import * as ImagePicker from 'react-native-image-picker';

export enum EKeyAsyncStorage {
  theme = 'theme',
  intro = 'intro',
  userProfile = 'userProfile',
  jobApplications = 'jobApplications',
  practiceSessions = 'practiceSessions',
  resumeImportedSources = 'resumeImportedSources',
  coachChatHistory = 'coachChatHistory',
  networkingContacts = 'networkingContacts',
  negotiationHistory = 'negotiationHistory',
  billingPlans = 'billingPlans',
  subscriptionStatus = 'subscriptionStatus',
  notificationsCache = 'notificationsCache',
  gamificationStreak = 'gamificationStreak',
  gamificationLeaderboard = 'gamificationLeaderboard',
  goalTipsCache = 'goalTipsCache',
  jobAlertsCache = 'jobAlertsCache',
  scheduledInterviews = 'scheduledInterviews',
  // Whether the new-user "how this app works" tour (components/AppTour.tsx,
  // shown once from HomeSrc.tsx) has already been dismissed. Cleared by
  // MoreSrc.tsx's "Show app tour" row so a user can replay it any time.
  appTourSeen = 'appTourSeen',
  // Referenced by services/codingService.ts's language-list offline cache
  // but never added here — a real pre-existing compile error
  // ("Property 'codingLanguages' does not exist"), just never surfaced
  // because eslint alone doesn't type-check and the project's own `tsc`
  // run is slow enough that it's easy to miss.
  codingLanguages = 'codingLanguages',
  // App Store / Play Store review prompt — see utils/appRating.ts.
  hasPromptedAppReview = 'hasPromptedAppReview',
  hasCompletedFirstInterview = 'hasCompletedFirstInterview',
  hasCompletedFirstCourse = 'hasCompletedFirstCourse',
  // Referral code captured from a saveur://referral deep link, held until
  // the next POST /users/me (sync) sends it as referred_by_code — see
  // services/referralService.ts.
  pendingReferralCode = 'pendingReferralCode',
  // A job id captured from a shared-job deep link (AppsFlyer OneLink
  // deferred resolution, or a plain saveur://job?id=X link for an
  // already-installed app) before the user was ready to land on it (not
  // yet authenticated, or the navigator wasn't mounted yet) — consumed by
  // HomeSrc.tsx once the user reaches Home. See services/jobShareService.ts.
  pendingJobId = 'pendingJobId',
  // Last-known feature flags / release / maintenance config, cached so
  // App.tsx has something to render immediately on a cold start before the
  // network call in services/configService.ts resolves. See that file.
  appConfigCache = 'appConfigCache',
  // Language picked on the onboarding carousel's top-right dropdown (see
  // src/onboarding/index.tsx) before the user has signed up/in — i18next's
  // own `lng: 'en'` init option (i18n/config.ts) has no persistence of its
  // own, and AuthContext's syncLanguageFromProfile only kicks in once a
  // profile exists. Without this, a user who picks a language on the
  // onboarding slides and reopens the app before finishing signup would see
  // English again. Read back at i18n/config.ts's bootstrap; superseded by
  // the account's own `locale` field the moment a profile is fetched.
  preferredLocale = 'preferredLocale',
}
export enum Animation_Types_Enum {
  SlideTop,
  SlideBottom,
  SlideInRight,
  SlideInLeft,
}
export interface ButtonType {
  status?: EvaStatus;
  title: string;
  onPress: () => void;
}
export interface UserProps {
  name: string;
  id: number | string;
  avatar: ImageRequireSource;
  age: number;
  onlineState?: Onl_State_Types_Enum;
  gender?: Gender_Type;
  experience?: string;
  backgroundCheck?: boolean;
  carePro?: boolean;
  rate?: number;
  address?: string;
  distance?: string;
  reviews?: number;
  hourlyRate?: string;
  cared?: number;
  mapLocation: LatLng | AnimatedRegion;
}
export interface SuccessScreenType {
  image?: ImageRequireSource;
  title?: string;
  description?: string;
  children?: ButtonType[] | null;
  buttonsViewStyle?: ViewStyle;
  logo?: boolean;
}
export interface WeekdaysProps {
  title: string;
  isActive: boolean;
}
export interface JobItemProps {
  id: number;
  title: string;
  avatar: ImageRequireSource;
  children: number;
  ageType: string;
  name: string;
  location: string;
  startTime: string;
  hour: string;
  applicants: number;
  price: string;
  howOften?: string;
  dayInWeek?: WeekdaysProps[];
  online: boolean;
  mile: number;
  coordinate?: LatLng | AnimatedRegion;
}

export interface MessagesItemProps {
  id: number;
  name: string;
  title: string;
  readed: boolean;
  time: string;
  isWeb: boolean;
  onlineState: Onl_State_Types_Enum;
  avatar: ImageRequireSource;
}
export enum Onl_State_Types_Enum {
  Online,
  Offline,
  LiveStream,
  JustLeave,
}
export interface RequestInterviewItemProps {
  type: Request_Status_Type_Enum;
  avatar: ImageRequireSource;
  name: string;
  dateIn: string;
  time: Date | number; // number is time stamp
  status: Onl_State_Types_Enum;
}
export interface PlanProps {
  id: number | string;
  type?: Request_Type_Enum;
  date?: number | Date;
  meeting_time?: string;
  title?: string;
  user?: UserProps;
}

export interface CaregiverCardProps {
  name: string;
  age: number;
  avatar: ImageRequireSource;
  yearExp: number;
  location: string;
  rate: {rateNumber: number; review: number};
  price: string;
  caredFamily: number;
  gender: 'male' | 'female';
  backgroundCheck: boolean;
  carePro: boolean;
  onlineStatus: Onl_State_Types_Enum;
}

export enum Request_Status_Type_Enum {
  Accepted = 'Accepted',
  Unconfirmed = 'Unconfirmed',
  Completed = 'Completed',
  Declined = 'Declined',
  Canceled = 'Canceled',
}
export enum Request_Type_Enum {
  Interview = 'Interview',
  Booking = 'Booking',
  Application = 'Application',
}
// Credit Card type
export interface FormModel {
  holderName: string;
  cardNumber: string;
  expiration: string;
  cvv: string;
}
export enum Gender_Type {
  Male = 'male',
  Female = 'female',
}
export enum CardFields {
  CardNumber,
  CardHolderName,
  Expiration,
  CVV,
}

export type TranslationsNonNull = {
  cardNumber: string;
  cardHolderName: string;
  nameSurname: string;
  mmYY: string;
  expiration: string;
  securityCode: string;
  next: string;
  done: string;
  cardNumberRequired: string;
  cardNumberInvalid: string;
  cardHolderNameRequired: string;
  cardHolderNameInvalid: string;
  expirationRequired: string;
  expirationInvalid: string;
  securityCodeRequired: string;
  securityCodeInvalid: string;
};
type Partial<T> = {
  [P in keyof T]?: T[P];
};
export type Translations = Partial<TranslationsNonNull>;

type Style = ViewStyle | TextStyle;
export type Overrides = {
  cardPreview?: Style;
  labelText?: TextStyle;
  cardHolderPreview?: TextStyle;
  expirationPreview?: Style;
  outline?: ViewStyle;
  input?: ViewStyle;
  button?: ViewStyle;
  labelContainer?: ViewStyle;
  inputLabel?: TextStyle;
  errorText?: TextStyle;
};

export type InputColors = {
  focused?: string;
  errored?: string;
  regular?: string;
};

export type Fonts = {
  regular?: string;
  bold?: string;
};

export type LibraryProps = {
  LottieView?: any;
  horizontalStart?: boolean;
  formOnly?: boolean;
  requiresName?: boolean;
  backgroundImage?: React.ReactNode;
  translations?: Translations;
  inputColors?: InputColors;
  fonts?: Fonts;
  overrides?: Overrides;
};
export interface CreatPostChildren {
  name: string;
  typeAge: string;
  checked:boolean
}
export interface ActionPickerImage {
  title?: string;
  type: 'capture' | 'library';
  options: ImagePicker.CameraOptions | ImagePicker.ImageLibraryOptions;
}

// ---- AI Interview Coach additions (job-application tracker) ----
export enum Application_Stage_Enum {
  Applied = 'Applied',
  Interviewing = 'Interviewing',
  Offer = 'Offer',
  Rejected = 'Rejected',
}
export interface JobApplicationProps {
  id: number | string;
  company: string;
  role: string;
  location: string;
  logo: ImageRequireSource;
  appliedDate: number | Date;
  stage: Application_Stage_Enum;
  nextStep?: string;
  // The employer ATS URL this was applied on. Set when this entry was
  // created from the in-app apply WebView (see WebViewScreen.tsx) rather
  // than typed in manually — also what the backend dedupes on, so reopening
  // the same job's apply page twice doesn't create two tracker rows. See
  // services/applicationsService.ts.
  applyUrl?: string;
  // "auto_detected" | "manual_confirm" | undefined (pre-existing manual
  // "Add application" entries). Informational only.
  source?: string;
  // Best-effort company logo, carried over from the JobAlert this was
  // tracked from — see JobAlertProps.companyLogoUrl and
  // components/CompanyLogoAvatar.tsx (which is what should render this
  // instead of `logo` above when present).
  companyLogoUrl?: string;
}

export enum Practice_Mode_Enum {
  Voice = 'Voice',
  Text = 'Text',
  Video = 'Video',
}
export enum Interview_Type_Enum {
  Behavioral = 'Behavioral',
  Technical = 'Technical',
  Coding = 'Coding',
  SystemDesign = 'System Design',
  ProductManagement = 'Product Management',
  Sales = 'Sales',
  Marketing = 'Marketing',
  Finance = 'Finance',
  Healthcare = 'Healthcare',
  CustomerService = 'Customer Service',
  Government = 'Government',
  Consulting = 'Consulting',
  Executive = 'Executive',
  Graduate = 'Graduate',
  Internship = 'Internship',
  Sports = 'Sports',
}
export enum Difficulty_Enum {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
}
export interface MockInterviewSessionProps {
  id: number | string;
  interviewType: Interview_Type_Enum;
  mode: Practice_Mode_Enum;
  difficulty: Difficulty_Enum;
  date: number | Date;
  durationMin: number;
  overallScore?: number;
  status: 'Completed' | 'Scheduled';
  // Only populated for Practice_Mode_Enum.Video sessions — see
  // services/videoAnalysisService.ts and interviewService.completeSession.
  videoAnalysis?: VideoAnalysisMetrics;
  // Optional company the session was "targeted" at (see MockInterviewSetup's
  // company picker) — purely used for question-copy flavor today, but kept
  // on the persisted session so InterviewFeedback/Practice History could
  // reference it later.
  company?: string;
  // Which questions from the adaptive question bank were actually "asked"
  // during the session — see LiveInterviewSession.tsx.
  askedQuestions?: string[];
}

// A user-scheduled future interview — the real "Upcoming Session" on Home
// (previously a hardcoded DATA_UPCOMING_SESSIONS entry that never changed).
// See services/scheduledInterviewService.ts and src/practice/ScheduleInterview.tsx.
// Deliberately a separate type from MockInterviewSessionProps (rather than
// reusing its `status: 'Scheduled'` member) — a scheduled interview isn't a
// session yet (no sessionId, no transcript, nothing backend-side to score);
// it's purely a reminder of intent that gets handed to MockInterviewSetup's
// existing startSession flow once the user taps it.
export interface ScheduledInterviewProps {
  id: string;
  interviewType: Interview_Type_Enum;
  mode: Practice_Mode_Enum;
  difficulty: Difficulty_Enum;
  role: string;
  company?: string;
  durationMin: number;
  scheduledAt: number; // ms epoch — when the user wants to take it
}
export interface SkillScoreProps {
  label: string;
  score: number;
}
export interface StarBreakdownItemProps {
  letter: 'S' | 'T' | 'A' | 'R';
  label: string;
  score: number;
  note: string;
}

// ---- AI Interview Coach additions (account / profile) ----
export interface UserProfileProps {
  uid?: string; // Firebase UID, set once real auth is wired in — see AuthContext.tsx
  email: string;
  name: string;
  // Random, non-identifying handle generated server-side at signup — the
  // only identity the leaderboard shows to other users. Shown under the
  // real name in the avatar header (HeaderHome.tsx) / profile screen.
  username?: string;
  goals: string[];
  industries: string[];
  preferredCountries: string[];
  // Job titles/roles/positions the user is searching for or preparing to
  // interview for (e.g. "Product Manager", "Senior Software Engineer") —
  // collected alongside preferredCountries at signup (SignupSecondStep) and
  // editable later from the Job Alerts screen. Drives job-alert matching —
  // see services/jobAlertsService.ts.
  desiredRoles: string[];
  locale?: string;
  // Profile photo — set via src/more/EditProfile.tsx, which uploads the
  // picked image through documentsService.uploadDocument (POST
  // /api/v1/documents/upload, already-existing generic file storage) then
  // persists the returned fetchable URL here via PATCH /api/users/me. See
  // authService.ts's wire mapping (avatar_url) and
  // docs/BACKEND_SPEC_ADDENDUM_2026-07.md — flag to backend if
  // GET/PATCH /api/users/me doesn't already round-trip this field.
  avatarUrl?: string;
  // Edit Profile screen fields (src/more/EditProfile.tsx / ProfileSrc.tsx).
  // Previously collected in the form but never sent to the backend — there
  // was no PATCH /api/users/me field for either, and My Profile displayed
  // hardcoded placeholder text regardless of what was actually saved.
  phoneNumber?: string;
  homeAddress?: string;
  // 'pro' = Saveur Pro (Monthly) — unlimited practice, AI coach, resume/JD
  // analysis, camera & voice analytics, application tracker.
  // 'premium' = Saveur Pro Premium (was "Team") or Pro (Yearly) —
  // everything 'pro' has, PLUS Job Alerts and Learning Courses. See
  // saveur-backend/app/services/entitlements_service.py's module docstring
  // for the full tier breakdown this mirrors.
  subscriptionTier: 'free' | 'pro' | 'premium' | 'premium_plus';
  // Master push-notification opt-out, editable from More/Settings. Backend
  // defaults this to true for every account (fail open) — see
  // saveur-backend/app/models/user.py's notifications_enabled column and
  // app/services/push_service.py, which now skips a user entirely here.
  notificationsEnabled?: boolean;
  // How often the backend's scheduled job-alert refresh re-checks every
  // user is now a single admin-controlled dial
  // (saveur-backend/app/services/app_config_service.py's "job_alerts"
  // section), not a per-user field — used to be jobAlertRefreshMinutes
  // here, editable from the Job Alerts screen down to 5 minutes, until one
  // account set that low was enough on its own to exhaust Firecrawl's rate
  // limit/credits for every user.
  // Max number of NEW job alerts created per calendar day — editable from
  // the Job Alerts screen. Backend default/floor/ceiling: 10 / 1 / 50
  // (saveur-backend/app/api/users.py's update_me,
  // job_search_service.refresh_alerts_for_user's daily-cap check).
  jobAlertDailyLimit?: number;
  // Email-code 2FA on/off — editable from More/Settings > Security. See
  // services/twoFactorService.ts and AuthContext's twoFactorPending gating.
  twoFactorEnabled?: boolean;
}
export interface SignUpPayload {
  email: string;
  password: string;
  name?: string;
  goals?: string[];
  industries?: string[];
  preferredCountries?: string[];
  desiredRoles?: string[];
  // Preferred language picked in SignupFirstStep (see constants/languages.ts)
  // — persisted as UserProfileProps.locale via PATCH /api/users/me so it's
  // the same value driving both UI text (i18next) and AI voice (ElevenLabs
  // TTS, see services/speechService.ts).
  locale?: string;
}

// ---- AI Interview Coach additions (goal tips + job alerts) ----

// One AI-generated "how to make progress on this goal today" tip, tied to
// one of the goals the user picked at signup (profile.goals). Refreshed
// daily server-side — see services/goalTipsService.ts.
export interface GoalTipProps {
  id: string;
  goal: string;
  tip: string;
  createdAt: number; // unix ms
}

// One job posting matched against the user's preferredCountries +
// desiredRoles, surfaced "like a Google Alert" — see
// services/jobAlertsService.ts. `applyUrl` is opened in an in-app WebView
// (src/more/WebViewScreen.tsx) rather than the system browser, so the user
// stays in the app.
export interface JobAlertProps {
  id: string;
  title: string;
  company: string;
  location?: string;
  source?: string; // e.g. "LinkedIn", "Indeed", "Company site"
  matchedRole?: string; // which of the user's desiredRoles this matched
  applyUrl: string;
  postedAt?: number; // unix ms, when the job was posted (if known)
  createdAt: number; // unix ms, when this alert was generated/found
  read: boolean;
  // Opts this alert out of the standard 7-day auto-delete in favor of 30
  // days — see the pin icon on each card in src/more/JobAlerts.tsx and the
  // backend's job_search_service.cleanup_old_alerts.
  pinned: boolean;
  // Best-effort — see job_search_service._company_logo_url on the backend
  // and components/CompanyLogoAvatar.tsx here, which handles a missing/
  // broken logo gracefully.
  companyLogoUrl?: string;
  // True when this exact job already has a tracked Application row (see
  // src/more/WebViewScreen.tsx's auto-detection) — drives the "Applied"
  // badge on JobAlerts.tsx's list and JobAlertDetails.tsx.
  applied?: boolean;
}

// Admin-configured in-app advert popup — see services/adsService.ts (GET
// /api/v1/ads/next, POST /api/v1/ads/<id>/impression), src/home/HomeSrc.tsx
// (where the popup is triggered) and src/more/AdDetails.tsx (the screen a
// tap opens). Created/edited from the admin dashboard's Advertisements
// page, including how many times it should show per user.
export interface AdvertisementProps {
  id: number;
  title: string;
  body: string; // short teaser shown in the popup itself
  imageUrl?: string;
  detailBody: string; // full write-up shown on AdDetails.tsx
  ctaUrl?: string; // optional — opens src/more/WebViewScreen.tsx if set
  ctaLabel?: string;
}

// ---- AI Interview Coach additions (billing/subscriptions — see
// services/billingService.ts and src/more/Subscription.tsx) ----

// A purchasable plan as returned by GET /api/v1/billing/plans. `priceId` is
// the Stripe Price id to send to POST /api/v1/billing/checkout — it's `null`
// for the `free` plan since there's nothing to check out (no Stripe price
// backs $0/mo).
// A saved Stripe card — GET /api/v1/billing/payment-methods. See
// services/billingService.ts's setup-intent/payment-methods functions and
// src/more/PaymentMethod.tsx.
export interface SavedPaymentMethodProps {
  id: string; // Stripe PaymentMethod id, e.g. "pm_..."
  brand: string; // "visa", "mastercard", etc.
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

// One row in Payment History (src/more/PaymentHistory.tsx) — a successfully
// captured Stripe charge, per GET /api/v1/billing/payments. Card brand/last4
// are a snapshot taken at capture time server-side (app/models/payment.py),
// not a live Stripe lookup, so this keeps showing the right card even after
// it's later removed/replaced.
export interface PaymentHistoryItemProps {
  id: number;
  amount: number; // minor currency unit (cents)
  currency: string;
  status: string; // "succeeded", etc.
  description: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  receiptSentAt: number | null; // ms epoch, null if never sent
  createdAt: number; // ms epoch
}

export interface BillingPlanProps {
  id: string;
  code: string | null; // plan_code (e.g. "pro_monthly") — pass this to billingService.createCheckoutSession
  tier: UserProfileProps['subscriptionTier'];
  priceId: string | null; // Stripe Price id — informational only, checkout now uses `code`
  title: string;
  price: string;
  period: string;
  features: string[];
  recommended?: boolean;
  // Whether THIS plan is the one the signed-in user is currently on —
  // only present when GET /api/v1/billing/plans was called with a Bearer
  // token (it's optional-auth; apiClient always attaches one when signed
  // in, so this "just works"). Undefined for a signed-out fetch. This is
  // the primary source for Subscription.tsx's "CURRENT PLAN" badge — see
  // SubscriptionStatusProps below for the fallback chain when this isn't
  // present.
  isCurrent?: boolean;
}

// The user's current subscription state, as returned by
// GET /api/v1/billing/subscription. Richer than `UserProfileProps.subscriptionTier`
// alone (which is just the tier enum) — this also carries Stripe's
// status/renewal info, which is what actually determines whether a plan is
// "active" (e.g. `past_due` still shows the paid tier but should be flagged).
export interface SubscriptionStatusProps {
  tier: UserProfileProps['subscriptionTier'];
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'none';
  periodEnd?: number; // ms epoch — normalized from the backend's unix-seconds `period_end`
  cancelAtPeriodEnd?: boolean;
  // The specific Stripe Price the user is actually subscribed to — lets
  // Subscription.tsx disambiguate two plans that share the same `tier`
  // (e.g. "Pro Premium" (was "Team") vs "Pro Yearly" both being
  // tier: "premium") by matching on this instead of just tier.
  // `null`/undefined for the free plan (no Stripe price backs it) or when
  // the backend doesn't send this field yet — falls back to tier-only
  // matching in that case.
  priceId?: string | null;
  // Free-tier session gating (see services/entitlementsService.ts). Ideally
  // backend-reported (it owns the billing-period boundary), but both are
  // optional — entitlementsService falls back to counting practice history
  // client-side against a hardcoded monthly cap when the backend doesn't
  // send these yet. `sessionsLimit: null` means unlimited (any paid tier).
  sessionsUsed?: number;
  sessionsLimit?: number | null;
  // A second, standalone way (alongside priceId above) to identify the
  // exact plan the user is on straight from this one call — planCode
  // matches BillingPlanProps.code, planName is display-ready (e.g.
  // "Saveur Pro (Monthly)"). See Subscription.tsx's isCurrent for the full
  // match-order (plans[].isCurrent, then planCode, then priceId, then tier).
  planCode?: string | null;
  planName?: string | null;
  interval?: 'month' | 'year' | null;
}

// ---- AI Interview Coach additions (video-mode camera analysis) ----
// See services/videoAnalysisService.ts for how these are produced — frame
// (face) metrics come from an on-device ML Kit face detector, speech metrics
// from an on-device speech-to-text engine. Both run entirely on-device, no
// cloud API involved.
export interface VideoAnalysisMetrics {
  eyeContactPct: number; // % of sampled frames where head yaw/pitch were within a "looking at camera" threshold
  smilePct: number; // % of sampled frames with smilingProbability > 0.5
  avgHeadYaw: number;
  avgHeadPitch: number;
  fillerWordCount: number;
  fillerWordBreakdown: Record<string, number>; // { um: 3, like: 5, ... }
  speakingRateWpm: number;
  silenceGapCount: number;
  confidenceScore: number; // 0-100, derived formula — see CONFIDENCE_SCORE_FORMULA doc in services/videoAnalysisService.ts
}

// ---- AI Interview Coach additions (coach chat) ----
export interface CoachChatMessageProps {
  id: string;
  role: 'user' | 'coach';
  text: string;
  createdAt: number;
}

// ---- AI Interview Coach additions (networking assistant) ----
export interface NetworkingContactProps {
  id: number | string;
  name: string;
  company: string;
  role: string;
  lastContactedDate: number | Date | null;
  note?: string;
}

// ---- AI Interview Coach additions (badges / gamification) ----
export interface BadgeDefinitionProps {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconPack?: 'assets' | 'eva';
}

// ---- AI Interview Coach additions (real backend: gamification streak/XP,
// leaderboard) — see services/gamificationService.ts. Badge *definitions*
// (BadgeDefinitionProps above) and unlock state stay client-computed for now
// (see docs/BACKEND_API_SPEC.md §15); only streak/XP/leaderboard hit the
// real backend in this pass. ----
export interface GamificationStreakProps {
  streakDays: number;
  longestStreak?: number;
  xp: number;
  checkedInToday: boolean;
}

export interface LeaderboardEntryProps {
  id: string;
  name: string;
  avatarUrl?: string;
  xp: number;
  rank: number;
  isCurrentUser?: boolean;
}

// ---- AI Interview Coach additions (real backend: in-app notifications) —
// see services/notificationService.ts. Backs src/home/Notification/*. ----
export interface NotificationProps {
  id: string;
  title: string;
  message: string;
  type?: string;
  read: boolean;
  createdAt: number; // unix ms, normalized from whatever the wire format sends
  // Present when type === 'job_alert' — the backend embeds the full matched
  // job directly in the notification (rather than just an id) so tapping it
  // can open src/more/JobAlertDetails.tsx immediately, with no extra fetch
  // or correlation against the separate GET /api/v1/job-alerts list needed.
  // See services/notificationService.ts for the wire mapping.
  jobAlert?: JobAlertProps;
}
