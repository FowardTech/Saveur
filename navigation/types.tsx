import {NavigatorScreenParams, RouteProp} from '@react-navigation/native';
import {
  AdvertisementProps,
  Difficulty_Enum,
  Interview_Type_Enum,
  JobAlertProps,
  JobApplicationProps,
  Practice_Mode_Enum,
  Request_Type_Enum,
  SuccessScreenType,
  VideoAnalysisMetrics,
} from 'constants/Types';
import { PracticalType, PracticalStep } from 'services/practicalService';

export type RootStackParamList = {
  Intro: undefined;
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  SelectLanguage: undefined;
  Notification: undefined;
  AddMorePayment: undefined;
  MoreNavigator: NavigatorScreenParams<MoreStackParamList>;
  MessagesStack: NavigatorScreenParams<MessagesStackParamList>;
  RequestStack: NavigatorScreenParams<RequestsStackParamList>;
  MainBottomTab: NavigatorScreenParams<MainBottomTabStackParamList> | undefined;
  ChangeCareType: undefined;
  // "Change it later" settings screen for profile.desiredRoles /
  // profile.preferredCountries — see src/more/JobPreferences.tsx.
  JobPreferences: undefined;
  MyProgress: undefined;
  // Full leaderboard — see src/home/Leaderboard.tsx. HomeSrc.tsx's dashboard
  // card shows only the top 4 with a "View all" link into this screen.
  Leaderboard: undefined;
  FaqScreen: undefined;
  // initialTab lets a caller (e.g. the signup/login Terms & Privacy
  // acceptance link — see src/auth/Signup/SignupThirdStep.tsx and
  // src/auth/Login/Login.tsx) open straight to the relevant tab instead of
  // always landing on Privacy Policy. 'privacy_policy' | 'terms_of_service'
  // written out plainly here (matches services/contentService.ts's
  // LegalSlug) rather than importing that type, to avoid a services -> nav
  // types import for one string union.
  PolicyScreen: {initialTab?: 'privacy_policy' | 'terms_of_service'} | undefined;
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
    // BUG FIX (product report: "voice/video interview starts in English,
    // then later changes to the user's preferred language"): the real,
    // correctly-language-instructed first question is already generated
    // server-side by POST /interviews/sessions (interviewService.startSession
    // returns it as `firstQuestion`) — but MockInterviewSetup used to just
    // discard it, so LiveInterviewSession had no first question to show/
    // speak until its very first 50-second adaptive-follow-up fetch
    // resolved, and rendered its LOCAL, English-only static question bank
    // (constants/Data.ts's DATA_INTERVIEW_QUESTION_BANK) in the meantime —
    // that's the "starts in English" the user saw. Passing it through here
    // lets the first question be the real, properly-translated one from
    // the moment the screen mounts.
    firstQuestion?: string;
    firstQuestionId?: string;
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
    // Product request (JDAnalyzer's "tailor an existing resume" choice) —
    // mutually exclusive. `useStoredResume` means "tailor whatever
    // structured resume I've already AI-generated" (GenerateResume fetches
    // it itself via resumeService.getStoredResumeSections());
    // `existingResumeDocumentId` means "tailor this SPECIFIC file from My
    // Documents" (see services/resumeService.ts's generateResume). Neither
    // set = build fresh, the original/default behavior.
    useStoredResume?: boolean;
    existingResumeDocumentId?: string;
  };
  // AI Cover Letter Generator — see services/coverLetterService.ts and
  // src/more/CoverLetterGenerator.tsx. Reachable from ResumeBuilder ("Generate
  // Cover Letter") and JDAnalyzer (tailored to the pasted JD, once analyzed).
  CoverLetterGenerator: {
    role?: string;
    company?: string;
    jdText?: string;
  };
  // AI Weekly Career Report — see services/careerReportService.ts and
  // src/more/WeeklyCareerReport.tsx. Reachable from the Home dashboard.
  WeeklyCareerReport: undefined;
  // Daily Industry News — see services/newsService.ts and
  // src/more/DailyIndustryNews.tsx.
  DailyIndustryNews: undefined;
  // AI Resume Evolution — see services/resumeVariantsService.ts and
  // src/more/ResumeVariants.tsx.
  ResumeVariants: undefined;
  // "Generated Documents" (product request item): redownload any resume/
  // CV, cover letter, or tailored resume variant ever exported to PDF/DOCX
  // — see services/generatedDocumentsService.ts and
  // src/more/GeneratedDocuments.tsx. Distinct from MyDocuments (the user's
  // own uploaded source files) below.
  GeneratedDocuments: undefined;
  // AI LinkedIn Optimizer — see services/linkedinOptimizerService.ts and
  // src/more/LinkedInOptimizer.tsx.
  LinkedInOptimizer: undefined;
  // AI Emotional Coach — see services/emotionalCoachService.ts and
  // src/more/EmotionalCoach.tsx.
  EmotionalCoach: undefined;
  // Company Intelligence — see services/companyIntelService.ts and
  // src/more/CompanyIntelligence.tsx.
  CompanyIntelligence: {
    company?: string;
    role?: string;
  };
  // Video Interview Replay (transcript + metrics timeline, not literal
  // video — see services/interviewReplayService.ts) — reachable from
  // MyProgress.tsx's recent-sessions list.
  InterviewReplay: {
    sessionId?: string;
  };
  // Student verification + discounted billing — see
  // services/studentVerificationService.ts and
  // src/more/StudentVerification.tsx. `fromSignup` is set when reached as
  // the optional post-signup step from SignupThirdStep.tsx (right after
  // account creation, since the verify endpoints require an authenticated
  // user) — it swaps the "stay on this screen" completion behavior for
  // continuing on into the normal SuccessScr celebration, and adds a
  // "Skip for now" way out for the (majority of) non-student signups.
  StudentVerification: {fromSignup?: boolean} | undefined;
  // "Choose your username" signup step (product request item) — lets the
  // user either keep/regenerate the random handle auto-assigned at signup
  // (see Saveur-Backend's app/services/username_service.py) or type their
  // own, with live availability + "don't use your real name" checking. See
  // src/auth/Signup/ChooseUsername.tsx. `fromSignup` mirrors
  // StudentVerification's flag above — same "reached right after account
  // creation" placement in the wizard, before the celebratory success
  // screen.
  ChooseUsername: {fromSignup?: boolean} | undefined;
  // Full-page "Today's Briefing" — HomeSrc.tsx's dashboard card only shows a
  // 3-line preview of the narrative with a "Read more" arrow; this shows the
  // whole thing plus all priorities. Takes the already-fetched briefing
  // straight via route params (see services/careerOsService.ts) rather than
  // re-fetching — it's a same-day, same-language, cached-on-the-server value
  // anyway, so there's nothing new to gain from a second network round trip.
  CareerBriefingDetail: {
    narrative: string;
    priorities: {label: string; action: string}[];
    // See careerOsService.ts's HomeBriefing.isTeaser — lets this screen
    // show a "Get Started" title instead of "Today's Briefing" for the
    // admin-editable teaser shown to a user with nothing real to
    // synthesize yet.
    isTeaser?: boolean;
  };
  // Full-page "Today's Goal Tips" — HomeSrc.tsx's dashboard card was removed
  // (product request item: rely on the daily push notification instead of a
  // persistent home card); this is where a "goal_tip" push tap now lands.
  // No params — fetches GET /api/v1/goals/tips/today itself (same cached,
  // same-day, same-language value the old card used), so it's always
  // current regardless of which tip triggered the push.
  GoalTipDetail: undefined;
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
  // My Ratings — the user's own history of QA rating-prompt submissions
  // (components/AppRatingModal.tsx). See services/appRatingService.ts and
  // src/more/MyRatings.tsx.
  MyRatings: undefined;
  // AI Career Roadmap (product request item #15) — "I want to become a
  // Senior Backend Engineer" -> the AI plans a linear sequence of
  // real-world milestones toward it, tracked step by step. See
  // services/roadmapService.ts and src/more/CareerRoadmap.tsx.
  CareerRoadmap: undefined;
  // Career DNA (product request item — merges what was pitched separately
  // as "Career DNA" and "Career Genome") — a living behavioral profile the
  // AI builds from real usage signals. See services/careerDnaService.ts.
  CareerDna: undefined;
  // Dream Company Dashboard (product request item) — a persisted, tracked
  // list of target companies with cached research + prep progress. See
  // services/dreamCompaniesService.ts.
  DreamCompanies: undefined;
  // Practical Scenarios — hands-on, multi-step decision practice for
  // non-engineering career tracks (healthcare/sales/marketing/finance/
  // consulting/science). See services/practicalService.ts and
  // src/practice/PracticalScenario{Setup,Session,Feedback}.tsx.
  PracticalScenarioSetup: undefined;
  PracticalScenarioSession: {
    sessionId: number;
    type: PracticalType;
    role?: string;
    initialStep: PracticalStep;
  };
  PracticalScenarioFeedback: {
    sessionId: number;
  };
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
  // `job` is optional — when present, the screen watches the loaded page for
  // signs the user actually submitted an application (confirmation text,
  // a "thank you"-style URL) and auto-adds it to the Application Tracker,
  // falling back to a "did you apply?" prompt if nothing was detected but
  // the user spent real time on the page. Omit it for any other in-app-browser
  // use that isn't a job application (that's the whole reason this stayed a
  // generic url/title screen instead of a job-alert-specific one).
  WebViewScreen: {
    url: string;
    title?: string;
    job?: {
      // The originating JobAlertProps.id, when this apply page came from a
      // job alert — lets WebViewScreen report this specific alert dead (see
      // services/jobAlertsService.ts's reportDeadJobAlert) if it detects a
      // dead-posting page after loading. Optional since not every WebViewScreen
      // call originates from a job alert with a real backend id.
      id?: string;
      company: string;
      role: string;
      applyUrl: string;
      companyLogoUrl?: string;
      // Bug report ("the job is not showing location") — carried over from
      // the originating JobAlertProps.location so trackApplication() below
      // can pass a real value on to POST /tracker/applications instead of
      // the hardcoded empty string this used to send. Optional since not
      // every JobAlert has a known location, and not every WebViewScreen
      // call originates from one.
      location?: string;
    };
  };
  Subscription:
    | {
        fromOnboarding?: boolean;
        onboardingSuccessPayload?: SuccessScreenType;
      }
    | undefined;
  // Payment History — src/more/PaymentHistory.tsx. Reached from
  // MoreSrc.tsx, right next to Subscription/Payment Methods.
  PaymentHistory: undefined;
  // In-app, user-to-user sharing inbox (product request item: share AI
  // feedback/video replay/jobs to other Saveur users by username) — see
  // services/sharesService.ts, src/more/SharedWithMe.tsx (the list) and
  // src/more/SharedContentDetail.tsx (one item, opened either from that
  // list or a "content_shared" push tap).
  // `initialTab: 1` opens directly on the "Pending Requests" tab — used by
  // a connection_request push tap (see navigationRef.ts's
  // navigateToSharedWithMe).
  SharedWithMe: {initialTab?: number} | undefined;
  SharedContentDetail: {shareId: string};
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
  ApplicationDetails: {id: JobApplicationProps['id']};
};

export type HomeStackParamList = {
  HomeSrc: undefined;
};
export type MoreStackParamList = {
  MoreSrc: undefined;
  EditProfile: undefined;
  PaymentMethod: undefined;
  ProfileSrc: undefined;
};
export type ModalScreenNavigationProp = RouteProp<
  RootStackParamList,
  'SuccessScr'
>;
export type RequestsInPassScreenNavigationProp = RouteProp<
  RequestsBottomStackParamList,
  'RequestsInPast'
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
