import {NavigatorScreenParams, RouteProp} from '@react-navigation/native';
import {
  CreatPostChildren,
  Interview_Type_Enum,
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
  FaqScreen: undefined;
  PolicyScreen: undefined;
  AboutScreen: undefined;
  SuccessScr: {
    successScr: SuccessScreenType;
  };
  // AI Interview Coach — practice & career-tools screens
  MockInterviewSetup: {
    interviewType?: Interview_Type_Enum;
  };
  LiveInterviewSession: {
    sessionId: string;
    interviewType?: Interview_Type_Enum;
    mode?: Practice_Mode_Enum;
    company?: string;
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
  JDAnalyzer: undefined;
  SalaryNegotiation: undefined;
  SystemDesignWhiteboard: undefined;
  LearningCourses: undefined;
  NetworkingAssistant: undefined;
  Subscription:
    | {
        fromOnboarding?: boolean;
        onboardingSuccessPayload?: SuccessScreenType;
      }
    | undefined;
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
  SignupSecondStep: {goal?: string} | undefined;
  SignupThirdStep:
    | {
        goals?: string[];
        industries?: string[];
        preferredCountries?: string[];
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
  Chat: undefined;
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
