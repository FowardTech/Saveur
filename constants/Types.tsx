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
  goals: string[];
  industries: string[];
  preferredCountries: string[];
  locale?: string;
  subscriptionTier: 'free' | 'premium' | 'premium_plus';
}
export interface SignUpPayload {
  email: string;
  password: string;
  name?: string;
  goals?: string[];
  industries?: string[];
  preferredCountries?: string[];
}

// ---- AI Interview Coach additions (billing/subscriptions — see
// services/billingService.ts and src/more/Subscription.tsx) ----

// A purchasable plan as returned by GET /api/v1/billing/plans. `priceId` is
// the Stripe Price id to send to POST /api/v1/billing/checkout — it's `null`
// for the `free` plan since there's nothing to check out (no Stripe price
// backs $0/mo).
export interface BillingPlanProps {
  id: string;
  code: string | null; // plan_code (e.g. "pro_monthly") — pass this to billingService.createCheckoutSession
  tier: UserProfileProps['subscriptionTier'];
  priceId: string | null; // Stripe Price id — informational only, checkout now uses `code`
  title: string;
  price: string;
  period: string;
  features: string[];
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
}
