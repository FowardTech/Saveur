import {NavigatorScreenParams, RouteProp} from '@react-navigation/native';
import {
  AdvertisementProps,
  CreatPostChildren,
  Difficulty_Enum,
  Interview_Type_Enum,
  JobAlertProps,
  JobApplicationProps,
  Practice_Mode_Enum,
  Request_Status_Type_Enum,
  Request_Type_Enum,
  SuccessScreenType,
  VideoAnalysisMetrics,
} from 'constants/Types';

export type RootStackParamList = {
  Intro: undefined;
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  NewJob: NavigatorScreenParams<NewJobStackParamList>;
  FavoritesFilter: undefined;
  SelectLanguage: undefined;
  FavoritesMap: undefined;
  Notification: undefined;
  ViewOnMap: undefined;
  CaregiverProfile: undefined;
  ProfileGallery: undefined;
  WriteReview: undefined;
  AddMorePayment: undefined;
  CaregiverPostDetails: undefined;
  MoreNavigator: NavigatorScreenParams<MoreStackParamList>;
  AddChild: undefined;
  CreateJobStack: NavigatorScreenParams<CreateJobStackParamList>;
  FindStack: NavigatorScreenParams<FindStackParamList>;
  MessagesStack: NavigatorScreenParams<MessagesStackParamList>;
  RequestStack: NavigatorScreenParams<RequestsStackParamList>;
  MainBottomTab: undefined;
  ChangeCareType: undefined;
  // "Change it later" settings screen for profile.desiredRoles /
  // profile.preferredCountries — see src/more/JobPreferences.tsx.
  JobPreferences: undefined;
  MyProgress: undefined;
  // Full leaderboard — see src/home/Leaderboard.tsx. HomeSrc.tsx's dashboard
  // card shows only the top 4 with a "View all" link into this screen.
  Leaderboard: undefined;
  FaqScreen: undefined;
  PolicyScreen: undefined;
  AboutScreen: undefined;
  SuccessScr: {
    successScr: SuccessScreenType;
  };
  // AI Interview Coach — practice & career-tools screens
  MockInterviewSetup: {
    interviewType?: Interview_Type_Enum;
    // Lets a caller preselect the mode pill (e.g. Chat.tsx's "Start Video
    // Practice" quick action jumps straight into Video mode rather than
    // defaulting to Voice) — the user can still change it before starting.
    mode?: Practice_Mode_Enum;
    // Full pre-fill for a tapped "Upcoming Session" reminder
    // (src/home/HomeSrc.tsx) — see services/scheduledInterviewService.ts.
    // All optional so every other existing caller (which only ever passed
    // interviewType/mode) keeps working unchanged.
    difficulty?: Difficulty_Enum;
    role?: string;
    company?: string;
    durationMin?: number;
  };
  ScheduleInterview: undefined;
  LiveInterviewSession: {
    sessionId: string;
    interviewType?: Interview_Type_Enum;
    mode?: Practice_Mode_Enum;
    company?: string;
    // Minutes the user picked in MockInterviewSetup. Falls back to 15 in
    // LiveInterviewSession if a caller forgets to pass it (e.g. an entry
    // point other than MockInterviewSetup) so the hard time-limit logic
    // always has a real number to enforce against.
    durationMin?: number;
  };
  CodingInterview: {
    sessionId?: string;
    interviewType?: Interview_Type_Enum;
  };
  InterviewFeedback: {
    sessionId?: string;
    interviewType?: Interview_Type_Enum;
    // Only passed for Video-mode sessions — LiveInterviewSession has already
    // merged the on-device metrics with the backend's /camera-summary
    // cross-check by the time it navigates here (see that screen's onEnd).
    // GET /api/v1/feedback/session/:id doesn't itself return this data.
    videoAnalysis?: VideoAnalysisMetrics;
  };
  ResumeBuilder: undefined;
  // Generic uploaded-file manager (POST/GET/DELETE /api/v1/documents, see
  // services/documentsService.ts) — was previously only a dead "My
  // Documents" menu label in MoreSrc.tsx that mis-navigated to the leftover
  // childcare-template MyChildren screen; now a real screen, and also
  // reachable from ResumeBuilder's import buttons as a "choose from My
  // Documents" alternative to the device file picker.
  MyDocuments: undefined;
  JDAnalyzer: undefined;
  // JD Analyzer's "build a matching resume" flow, and the standalone
  // "Create CV" entry point from ResumeBuilder — see
  // services/resumeGenerationService.ts and src/more/GenerateResume.tsx.
  // `jdText` (the raw pasted job description) is what POST /resume/generate
  // actually uses server-side to tailor content — keywordSuggestions/
  // missingSkills are kept only for the "consider adding" display until the
  // real generation call returns its own suggested_keywords.
  GenerateResume: {
    keywordSuggestions?: string[];
    missingSkills?: string[];
    role?: string;
    jdText?: string;
    docType?: 'resume' | 'cv';
  };
  SalaryNegotiation: undefined;
  SystemDesignWhiteboard: undefined;
  LearningCourses: undefined;
  // AI-taught module-by-module course session — see
  // services/learningService.ts and src/more/CourseSession.tsx. `level`
  // picks the basic/intermediate/advanced tier (progress + certificate
  // eligibility are tracked per tier — see learningService.courseIdFor).
  CourseSession: {
    topic: string;
    totalModules: number;
    level: 'basic' | 'intermediate' | 'advanced';
    coreSubtopics?: string[];
  };
  NetworkingAssistant: undefined;
  // Career Diary — log what the user did/learned/achieved day-to-day
  // regarding a role, career, or job. See services/careerDiaryService.ts
  // and src/more/CareerDiary.tsx.
  CareerDiary: undefined;
  // Referral program — see services/referralService.ts and
  // src/more/ReferralProgram.tsx.
  ReferralProgram: undefined;
  // Biometric unlock + 2FA toggles — see src/more/SecuritySettings.tsx.
  SecuritySettings: undefined;
  JobAlerts: undefined;
  // Reached from JobAlerts (tapping a card), the bell notification list
  // (tapping a "job_alert" notification), and, once push notifications are
  // wired, an OS push tap too — all three hand this the same JobAlertProps
  // object. See src/more/JobAlertDetails.tsx.
  JobAlertDetails: {job: JobAlertProps};
  // Reached by tapping the admin-configured ad popup (src/home/HomeSrc.tsx)
  // — see services/adsService.ts and src/more/AdDetails.tsx.
  AdDetails: {ad: AdvertisementProps};
  // Generic in-app browser — see src/more/WebViewScreen.tsx. Currently only
  // reached from JobAlerts (tapping a matched job opens its real apply page
  // here instead of the system browser), but kept generic so anything else
  // needing an in-app browser later can reuse it too.
  WebViewScreen: {url: string; title?: string};
  Subscription:
    | {
        fromOnboarding?: boolean;
        onboardingSuccessPayload?: SuccessScreenType;
      }
    | undefined;
  // Payment History — src/more/PaymentHistory.tsx. Reached from
  // MoreSrc.tsx, right next to Subscription/Payment Methods.
  PaymentHistory: undefined;
};
export type CreateJobStackParamList = {
  TypeOfCare: undefined;
  FrequencyDate: undefined;
  AboutYourFamily: {children: CreatPostChildren[]};
  AboutYourChild: undefined;
  HourlyRate: undefined;
  Qualifications: undefined;
  SelectResponsibilities: undefined;
  CreateJob: undefined;
  CreatePostDetails: undefined;
};
export type MainBottomTabStackParamList = {
  Home: undefined;
  Practice: undefined;
  Coach: undefined;
  Interviews: NavigatorScreenParams<RequestsBottomStackParamList>;
  Profile: NavigatorScreenParams<MoreStackParamList>;
};
export type AuthStackParamList = {
  Login: undefined;
  SignupFirstStep: undefined;
  SignupSecondStep: {goal?: string; locale?: string} | undefined;
  SignupThirdStep:
    | {
        goals?: string[];
        industries?: string[];
        preferredCountries?: string[];
        desiredRoles?: string[];
        locale?: string;
      }
    | undefined;
  ForgetPassword: undefined;
  NewPassword: undefined;
};
export type NewJobStackParamList = {
  TypeOfCare: undefined;
  FrequencyDate: undefined;
  AboutYourFamily: undefined;
};
export type FindStackParamList = {
  FindSrc: undefined;
  ViewOnMap: undefined;
  JobDetails: {name: string};
};
export type MessagesStackParamList = {
  // initialPrompt: when set (e.g. tapping a "Suggested Topic" on the Coach
  // tab — see src/messages/MessagesScreen.tsx), Chat.tsx auto-sends this as
  // the first message once chat history has loaded, instead of opening to a
  // blank thread regardless of which topic was tapped.
  Chat: {initialPrompt?: string} | undefined;
  VideoCall: undefined;
};
export type RequestsBottomStackParamList = {
  RequestsSrc: undefined;
  RequestsInPast: {requestType: Request_Type_Enum};
};
export type RequestsStackParamList = {
  RequestInterview: undefined;
  BookingRequest: undefined;
  ReviewRequestInterview: undefined;
  ReviewRequestBooking: undefined;
  ConfirmHour: undefined;
  SelectCard: undefined;
  InterviewDetails: {type: Request_Status_Type_Enum};
  BookingDetails: {type: Request_Status_Type_Enum};
  ApplicationDetails: {id: JobApplicationProps['id']};
};

export type HomeStackParamList = {
  HomeSrc: undefined;
  MyFavorites: undefined;
};
export type MoreStackParamList = {
  MoreSrc: undefined;
  MyPost: undefined;
  EditProfile: undefined;
  PaymentMethod: undefined;
  MyChildren: undefined;
  ProfileSrc: undefined;
  ReferFriend: undefined;
};
export type ModalScreenNavigationProp = RouteProp<
  RootStackParamList,
  'SuccessScr'
>;
export type RequestsInPassScreenNavigationProp = RouteProp<
  RequestsBottomStackParamList,
  'RequestsInPast'
>;

export type JobDetailsScreenNavigationProp = RouteProp<
  FindStackParamList,
  'JobDetails'
>;
export type AboutYourFamilyScreenNavigationProp = RouteProp<
  CreateJobStackParamList,
  'AboutYourFamily'
>;
export type InterviewDetailsScreenNavigationProp = RouteProp<
  RequestsStackParamList,
  'InterviewDetails'
>;
export type BookingDetailsScreenNavigationProp = RouteProp<
  RequestsStackParamList,
  'BookingDetails'
>;
export type ApplicationDetailsScreenNavigationProp = RouteProp<
  RequestsStackParamList,
  "ApplicationDetails"
>;
export type MockInterviewSetupScreenNavigationProp = RouteProp<
  RootStackParamList,
  'MockInterviewSetup'
>;
export type InterviewFeedbackScreenNavigationProp = RouteProp<
  RootStackParamList,
  'InterviewFeedback'
>;
export type LiveInterviewSessionScreenNavigationProp = RouteProp<
  RootStackParamList,
  'LiveInterviewSession'
>;
export type CodingInterviewScreenNavigationProp = RouteProp<
  RootStackParamList,
  'CodingInterview'
>;
export type SubscriptionScreenNavigationProp = RouteProp<
  RootStackParamList,
  'Subscription'
>;
