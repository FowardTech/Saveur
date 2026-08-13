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
  // Product request ("the AI career coach should be the entering point
  // anytime users open the app... the app should only take the user to
  // the homescreen the first time they are entering the app") — set the
  // first time MainBottomTab ever resolves its starting tab for a signed-
  // in user, never cleared. See MainBottomTab.tsx's own comment for the
  // full first-open-vs-returning decision.
  hasOpenedAppOnce = 'hasOpenedAppOnce',
  // Referenced by services/codingService.ts's language-list offline cache
  // but never added here — a real pre-existing compile error
  // ("Property 'codingLanguages' does not exist"), just never surfaced
  // because eslint alone doesn't type-check and the project's own `tsc`
  // run is slow enough that it's easy to miss.
  codingLanguages = 'codingLanguages',
  // App Store / Play Store review prompt — see utils/appRating.ts.
  // BUG FIX (product report: "Ratings is not working well" — trigger
  // conditions changed from "first interview OR first course" to "5
  // completed interviews OR 1 tracked job application OR 1 finished AI
  // coach conversation") — hasCompletedFirstInterview/hasCompletedFirstCourse
  // (the old single-completion flags) are replaced by a real running count;
  // course completion is no longer one of the trigger conditions at all.
  hasPromptedAppReview = 'hasPromptedAppReview',
  completedInterviewCount = 'completedInterviewCount',
  // BUG FIX (product report: "the rating is not showing" — this milestone
  // system used to call Linking.openURL straight to the App Store/Play
  // Store the instant a milestone hit (see utils/appRating.ts), which is a
  // silent permanent no-op on iOS until an admin configures a real App
  // Store Connect id (this app isn't published yet) and, even once it is,
  // is a jarring "leaves the app" redirect rather than the actual in-app
  // rating modal (components/AppRatingModal.tsx) this app already has and
  // that the product reference screenshot shows. utils/appRating.ts's 3
  // milestone functions now just set this flag instead of opening a URL;
  // HomeSrc.tsx's rating-prompt check (re-run on every Home focus, not
  // just app-session mount) shows the real in-app modal as soon as it sees
  // this flag OR the server's own periodic due-check, whichever comes
  // first.
  ratingPromptQueued = 'ratingPromptQueued',
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
  // Video interviews whose upload to the backend (interviewService.
  // uploadSessionVideo) failed even after in-session retries -- e.g. the
  // network dropped right as the interview ended, or the app got
  // backgrounded mid-upload. The transcript/metrics/score for these
  // sessions already saved fine (separate call), only the video itself is
  // still sitting on-device; App.tsx flushes this queue on every foreground
  // so it gets uploaded automatically as soon as the network's back,
  // without the user having to redo the interview. See interviewService.ts's
  // enqueuePendingVideoUpload/flushPendingVideoUploads.
  pendingVideoUploads = 'pendingVideoUploads',
  // Daily career-goal check-in (product request item) — the server only
  // ever tracks whether TODAY's morning goal/evening reflection have been
  // ANSWERED (see services/dailyCheckinService.ts), not whether the popup
  // was already shown-and-dismissed-without-answering. Without this,
  // dismissing the popup would just show it again on every subsequent
  // Home focus the same day. Stores today's ISO date string the moment the
  // user dismisses either sheet without answering; cleared implicitly by
  // the date simply no longer matching "today" tomorrow.
  dailyCheckinGoalDismissedDay = 'dailyCheckinGoalDismissedDay',
  // Set by the "How did your day go?" push notification's tap handler
  // (see services/pushNotificationService.ts) before Home has necessarily
  // regained focus yet — same deferred-until-Home-is-ready pattern as
  // pendingJobId above. Consumed (and cleared) by HomeSrc.tsx to open the
  // reflection sheet once the screen is actually mounted/focused.
  pendingDailyCheckinReflection = 'pendingDailyCheckinReflection',
  // Goals screen (src/more/GoalsScreen.tsx) weekly targets -- e.g. "3 of 5
  // practice sessions this week". Deliberately a plain local preference
  // (not a backend model/endpoint) since it's just a personal target the
  // learner sets for themselves to glance at, not something any other part
  // of the product (admin dashboard, notifications, etc.) needs to read.
  goalsWeeklyTargets = 'goalsWeeklyTargets',
  // BUG FIX (product report: "The rate should only appear once every week
  // not everytime") — the server-side cooldown (User.last_rating_prompt_at,
  // see app/api/ratings.py) only actually resets when the dismiss/submit
  // POST successfully reaches the backend; HomeSrc.tsx's fire-and-forget
  // dismiss call silently swallows failures, which could leave the server
  // thinking the prompt was never shown and re-trigger it on the very next
  // Home focus. This is a purely LOCAL backstop set the instant the modal
  // is actually rendered (independent of whether the backend call later
  // succeeds), so a real device can't get stuck re-showing it every focus
  // no matter what the network does.
  ratingPromptLastShownAt = 'ratingPromptLastShownAt',
  // Product request: "when user comes to the learning course screen for the
  // first time, a full screen banner should appear first... its like an
  // onboarding for the learning course feature" — see
  // src/more/LearningCoursesOnboarding.tsx (shown once from
  // LearningCourses.tsx, same "shown once" pattern as appTourSeen above).
  learningCoursesOnboardingSeen = 'learningCoursesOnboardingSeen',
  // Product request: "when the user installs the app for the first time and
  // opens the app, one of the permissions the user must grant is the user
  // location... before continuing into the app" — gates App.tsx's
  // LocationLanguageGate (components/LocationLanguageGate.tsx) so it only
  // ever blocks first launch, exactly once ever, regardless of whether the
  // user granted or denied the permission (a denial falls back to the
  // device's own system language via i18n/language-detector.ts and still
  // lets them into the app — it never blocks forever).
  locationLanguageGateSeen = 'locationLanguageGateSeen',
  // The ISO country code the location gate resolved (see
  // utils/locationLanguage.ts's detectLanguageFromLocation) — cached
  // locally since that gate can run before sign-in, then read and sent up
  // by authService.ts's provisionProfile() on the next sign-in/signup.
  // Admin request item: "I also want to see the country where users are
  // using the app from in the admin".
  detectedCountryCode = 'detectedCountryCode',
  // Product request: "I also want an onboarding illustration for Job
  // alerts the same way you did for the learning course" — see
  // src/more/JobAlertsOnboarding.tsx (shown once from JobAlerts.tsx, same
  // "shown once" pattern as learningCoursesOnboardingSeen above).
  jobAlertsOnboardingSeen = 'jobAlertsOnboardingSeen',
}

// BUG FIX (product report: "the tour guide always shows every time the
// user login. It should only display once and thats the first time the
// user is entering the app for the first time") — appTourSeen (and the
// same "shown once" flags for jobAlertsOnboardingSeen/
// learningCoursesOnboardingSeen) used to be a single flat device-wide
// key. authService.ts's clearCache()/deleteAccount() explicitly wiped
// all three on every sign-out (see that file's own comment for why —
// originally to stop a SECOND, genuinely different account signing in
// on the same device from inheriting the first account's "already seen"
// state), but that meant the SAME account signing back out and back in
// also lost its "already seen" flag every time, so the tour (and the two
// onboarding banners) reshowed on every login instead of just once ever.
//
// Scoping the storage key itself to the signed-in account's Firebase uid
// fixes both cases at once: a returning account's own key is untouched
// by anyone else's sign-out, and a different account signing in next
// gets its own fresh key with nothing "seen" yet — no explicit clearing
// on sign-out needed at all anymore, see authService.ts's own updated
// comment.
export function accountScopedKey(base: EKeyAsyncStorage, uid?: string | null): string {
  return uid ? `${base}:${uid}` : base;
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
  // Separate, optional override for the leaderboard ONLY — never touches
  // avatarUrl/picture_url above. Product correction: picking a preset from
  // the curated grid (constants/avatarPresets.ts / AvatarPickerModal.tsx)
  // used to overwrite avatarUrl, silently replacing the user's real profile
  // photo everywhere it's shown (menu, header, My Profile) and defeating the
  // leaderboard's whole point of never revealing a user's real photo there.
  // Null/undefined means "no preset chosen" — the leaderboard falls back to
  // a deterministic generated avatar seeded off the user's anonymized
  // username (see saveur-backend's app/services/avatar_service.py).
  // Settable both from src/more/EditProfile.tsx (its own dedicated control,
  // separate from "Edit photo") and once during signup
  // (src/auth/Signup/SignupThirdStep.tsx).
  leaderboardAvatarUrl?: string;
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
  // Optional preset picked on SignupThirdStep's new avatar step — see
  // UserProfileProps.leaderboardAvatarUrl for what this is/isn't. Omitted
  // entirely if the user skips that step; leaderboard just uses the
  // generated default, same as any pre-existing account.
  leaderboardAvatarUrl?: string;
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
  // title/body/detailBody are all genuinely OPTIONAL captions now (product
  // report: "I dont want banner title, subtitle and detail screen body to
  // be mandatory... sometimes I might not want a caption to show in the
  // ads" — see Advertisement model's own comment on the backend). Kept as
  // plain `string` rather than `string | undefined` here since every call
  // site already treats '' the same as "no caption" (see AdPopupModal.tsx,
  // AdDetails.tsx, HomeSrc.tsx) and adsService.ts's fromWire() normalizes a
  // null/missing wire value to '' — an ad is only guaranteed to have an
  // imageUrl and/or at least one of these three non-empty (see admin.py's
  // create_ad validation), never all of them together.
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
  // BUG FIX (product report: "it's only flagging the eye contact — it
  // should flag any other things that it thinks could make the user lose
  // focus") — four more genuinely-derived ML Kit face-detection signals
  // (no fabricated data — see videoAnalysisService.ts's onFacesDetected
  // for exactly what each one is computed from), all as % of sampled
  // frames, same convention as eyeContactPct/smilePct above:
  faceNotVisiblePct: number; // frames where no face was detected at all (out of frame / camera blocked)
  multipleFacesPct: number; // frames where more than one face was detected (someone/something else in frame)
  eyesClosedPct: number; // frames where both eyes' open-probability was low (drowsy, reading notes, distracted)
  excessiveMovementPct: number; // frames with a large frame-to-frame head yaw/pitch jump (fidgeting/restlessness)
}

// ---- AI Interview Coach additions (coach chat) ----
export interface CoachChatMessageProps {
  id: string;
  role: 'user' | 'coach';
  text: string;
  createdAt: number;
  // Set only on a 'coach' message when the backend's reply recommends a
  // specific Learning Courses topic worth digging into further (see
  // coachService.ts's sendMessage/SUGGESTED_COURSE parsing) — lets
  // Chat.tsx render a tappable "Learn more about X" chip straight into
  // LearningCourses instead of the user having to go find it themselves.
  suggestedCourseTopic?: string;
  // Product request item: "the AI coach can ask the user if they want the
  // coach to navigate to the specific screen... and the app will navigate
  // automatically" — set only on a 'coach' message when the backend's
  // reply recommends actually DOING something in the app right now (see
  // coachService.ts's SUGGESTED_ACTION parsing). Mutually exclusive with
  // suggestedCourseTopic (the backend only ever sends one or the other).
  suggestedAction?: SuggestedActionId;
}

// Product request item: "The AI coach is redirecting but just to few
// screen... I want it take the user to any screen in the app... the AI
// coach has to be very accurate in this and must have access and able to
// navigate to every screen in the app automatically" — this used to be a
// closed set of exactly 4 ids ('mock_interview' | 'daily_challenge' |
// 'new_job_course' | 'networking_assistant'), independently redeclared as
// an inline union in THIS file, services/coachService.ts (x2), and
// src/messages/VoiceCoachView.tsx's own local type alias — any addition had
// to be kept in sync by hand in 4 places. Now a single source of truth,
// expanded to cover every screen that's reachable with no required dynamic
// id (a specific interview session id, application id, etc. — those can't
// be generically "opened" by name, so they're deliberately left out).
// Backend enum + prompt: Saveur-Backend/app/api/coach.py's
// SUGGESTED_ACTION_RE / ACTION_REFERRAL_INSTRUCTION must be kept in sync
// with this list by hand (Python can't import a TS type) — the ids below
// are exactly what the backend is allowed to send back.
// The actual per-id display label/icon/navigation-target table lives in
// services/suggestedActions.ts (kept out of this file to avoid a
// constants -> services import cycle, since that registry needs
// learningService for the continue_learning special case).
export type SuggestedActionId =
  // Pre-existing 4 (unchanged ids, just now part of the shared list)
  | 'mock_interview'
  | 'daily_challenge'
  | 'new_job_course'
  | 'networking_assistant'
  // Special-cased (async / multi-step) targets — see suggestedActions.ts
  | 'continue_learning'
  | 'application_tracker'
  // Plain single-screen destinations, no required params
  | 'career_goal'
  | 'job_preferences'
  | 'my_progress'
  | 'goals_hub'
  | 'leaderboard'
  | 'faq'
  | 'policy'
  | 'about'
  | 'resume_builder'
  | 'my_documents'
  | 'jd_analyzer'
  | 'saved_videos'
  | 'weekly_career_report'
  | 'daily_industry_news'
  | 'resume_variants'
  | 'generated_documents'
  | 'linkedin_optimizer'
  | 'emotional_coach'
  | 'company_intelligence'
  | 'student_verification'
  | 'salary_negotiation'
  | 'system_design_whiteboard'
  | 'learning_courses'
  | 'career_diary'
  | 'my_ratings'
  | 'career_roadmap'
  | 'career_dna'
  | 'dream_companies'
  | 'practical_scenarios'
  | 'referral_program'
  | 'security_settings'
  | 'job_alerts'
  | 'subscription'
  | 'payment_history'
  | 'shared_with_me'
  | 'schedule_interview'
  | 'cover_letter_generator'
  // Coding Practice — was reachable only via FindScreen.tsx's Tools tile,
  // never through the AI coach's SUGGESTED_ACTION marker at all (unlike
  // 'system_design_whiteboard' above, which already had an entry). Added
  // alongside the paid Add-ons gating in suggestedActions.ts's
  // runSuggestedAction — see that file for why both this and
  // 'system_design_whiteboard' now redirect to 'addons' instead of
  // navigating straight in when the user hasn't purchased the add-on yet.
  | 'coding_practice'
  // Paid Add-ons screen itself (product request item — "the AI coach should
  // be aware that its an add-on so that if it wants to navigate there
  // automatically it can know if the user have paid for the add-on or not
  // before it auto navigate the user there") — lets the coach send someone
  // straight to the purchase screen when asked directly, not just as a
  // redirect target for the two gated actions above.
  | 'addons';

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
  // Product request (reference screenshot: a green "+N%" under every
  // leaderboard row) — this period's XP vs. the equivalent prior window
  // (e.g. this week vs. last week), computed server-side. `null` for
  // period="all" (no natural "previous window") and for a user with zero
  // XP in BOTH windows (nothing to compare — see
  // Saveur-Backend/app/api/gamification.py's leaderboard() for the exact
  // rule, including why a from-zero spike renders as "New" instead of a
  // literal, misleadingly huge percentage).
  changePct?: number | null;
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
  // Generic per-type reference payload (e.g. {session_id: "123"} for
  // feedback_ready, {course_id: "abc"} for curriculum_week_unlocked) — the
  // same `data` a push for this exact event already carries. Lets
  // src/home/Notification/index.tsx route a tap through
  // services/pushNotificationService.ts's handleDataTap the same way a
  // push tap already does, instead of only job_alert going anywhere (see
  // Saveur-Backend's app/models/tracker.py Notification.data).
  data?: Record<string, string>;
}
