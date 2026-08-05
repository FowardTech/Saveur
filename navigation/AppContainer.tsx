import * as React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator, TransitionPresets} from '@react-navigation/stack';
import {RootStackParamList} from './types';
import {ActivityIndicator, LogBox, View} from 'react-native';
import Onboarding from 'src/onboarding';
import {AuthContext} from '../AuthContext';
import SuccessScr from 'src/SuccessScr';
import AuthNavigator from './AuthNavigator';
import MainBottomTab from './MainBottomTab';
import SelectLanguage from 'src/home/MyFavorites/SelectLanguage';
import Notification from 'src/home/Notification';
import MessagesNavigator from './MessagesNavigator';
import RequestsStackNavigator from './RequestStackNavigator';
import MoreNavigator from './MoreNavigator';
import AddMorePayment from 'src/more/AddMorePayment/AddMorePayment';
import FaqScreen from 'src/more/faqScreen';
import AboutScreen from 'src/more/aboutScreen';
import ChangeCareType from 'src/more/ChangeCareType';
import JobPreferences from 'src/more/JobPreferences';
import PolicyScreen from 'src/more/policyScreen';
import MockInterviewSetup from 'src/practice/MockInterviewSetup';
import MyProgress from 'src/practice/MyProgress';
import Leaderboard from 'src/home/Leaderboard';
import ScheduleInterview from 'src/practice/ScheduleInterview';
import LiveInterviewSession from 'src/practice/LiveInterviewSession';
import CodingInterview from 'src/practice/CodingInterview';
import InterviewFeedback from 'src/practice/InterviewFeedback';
import ResumeBuilder from 'src/more/ResumeBuilder';
import MyDocuments from 'src/more/MyDocuments';
import JDAnalyzer from 'src/more/JDAnalyzer';
import GenerateResume from 'src/more/GenerateResume';
import CoverLetterGenerator from 'src/more/CoverLetterGenerator';
import JDCoverLetterGenerator from 'src/more/JDCoverLetterGenerator';
import WeeklyCareerReport from 'src/more/WeeklyCareerReport';
import DailyIndustryNews from 'src/more/DailyIndustryNews';
import ResumeVariants from 'src/more/ResumeVariants';
import GeneratedDocuments from 'src/more/GeneratedDocuments';
import LinkedInOptimizer from 'src/more/LinkedInOptimizer';
import EmotionalCoach from 'src/more/EmotionalCoach';
import CompanyIntelligence from 'src/more/CompanyIntelligence';
import DreamCompanies from 'src/more/DreamCompanies';
import CareerDna from 'src/more/CareerDna';
import InterviewReplay from 'src/practice/InterviewReplay';
import StudentVerification from 'src/more/StudentVerification';
import ChooseUsername from 'src/auth/Signup/ChooseUsername';
import SharedWithMe from 'src/more/SharedWithMe';
import SharedContentDetail from 'src/more/SharedContentDetail';
import CareerBriefingDetail from 'src/home/CareerBriefingDetail';
import GoalTipDetail from 'src/home/GoalTipDetail';
import SalaryNegotiation from 'src/practice/SalaryNegotiation';
import SystemDesignWhiteboard from 'src/practice/SystemDesignWhiteboard';
import LearningCourses from 'src/more/LearningCourses';
import CourseSession from 'src/more/CourseSession';
import NetworkingAssistant from 'src/more/NetworkingAssistant';
import CareerDiary from 'src/more/CareerDiary';
import MyRatings from 'src/more/MyRatings';
import CareerRoadmap from 'src/more/CareerRoadmap';
import PracticalScenarioSetup from 'src/practice/PracticalScenarioSetup';
import PracticalScenarioSession from 'src/practice/PracticalScenarioSession';
import PracticalScenarioFeedback from 'src/practice/PracticalScenarioFeedback';
import ReferralProgram from 'src/more/ReferralProgram';
import JobAlerts from 'src/more/JobAlerts';
import JobAlertDetails from 'src/more/JobAlertDetails';
import AdDetails from 'src/more/AdDetails';
import WebViewScreen from 'src/more/WebViewScreen';
import Subscription from 'src/more/Subscription';
import PaymentHistory from 'src/more/PaymentHistory';
import SecuritySettings from 'src/more/SecuritySettings';
import TwoFactorVerify from 'src/auth/TwoFactorVerify';
import BiometricLockScreen from 'src/auth/BiometricLockScreen';
import * as biometricAuthService from 'services/biometricAuthService';
import {navigationRef, flushPendingNavigation} from './navigationRef';

const Stack = createStackNavigator<RootStackParamList>();

LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);
const AppContainer = () => {
  // Firebase persists sessions on-device (see AuthContext.tsx) and
  // correctly restores isSignedIn on cold start — but this navigator used to
  // hardcode initialRouteName="Intro" regardless of that, so every app
  // launch dropped a signed-in user back on the onboarding carousel with
  // Login/Signup buttons instead of straight into the app. Firebase's
  // restore is async (isInitialized flips true once it resolves), so render
  // nothing but a brief spinner until it settles, then pick the real
  // starting route: MainBottomTab for an already-signed-in user, Intro
  // otherwise. Read once here rather than reactively switching screens later
  // — Stack.Navigator's initialRouteName is only honored on first mount, and
  // we don't want to yank a signed-in user back to Intro if they sign out
  // deeper in the app (SignOut already navigates explicitly where needed).
  const {isInitialized, isSignedIn, twoFactorPending} = React.useContext(AuthContext);

  // Device-wide biometric app-lock (see services/biometricAuthService.ts) —
  // checked once per isSignedIn/twoFactorPending transition (i.e. cold start
  // with a restored session, or right after 2FA clears), not on every
  // render. `biometricChecked` avoids flashing the real app for a frame
  // before we've actually confirmed whether a lock is required.
  const [biometricLocked, setBiometricLocked] = React.useState(false);
  const [biometricLabel, setBiometricLabel] = React.useState('Biometrics');
  const [biometricChecked, setBiometricChecked] = React.useState(false);
  React.useEffect(() => {
    if (!isSignedIn || twoFactorPending) {
      // Nothing to lock yet (not signed in), or 2FA hasn't cleared yet —
      // don't stack a biometric prompt on top of/before the 2FA screen.
      setBiometricChecked(!isSignedIn);
      return;
    }
    let cancelled = false;
    (async () => {
      const enabled = await biometricAuthService.isEnabled();
      if (cancelled) return;
      if (enabled) {
        const {label} = await biometricAuthService.checkAvailability();
        if (cancelled) return;
        setBiometricLabel(label);
        setBiometricLocked(true);
      } else {
        setBiometricLocked(false);
      }
      setBiometricChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, twoFactorPending]);

  if (!isInitialized) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Firebase already considers this user authenticated (isSignedIn), but
  // they haven't entered their 2FA code yet — show that instead of the real
  // app until it resolves. See AuthContext's onAuthStateChanged handler for
  // when this gets set, and services/twoFactorService.ts for the backend
  // side. Not a Stack.Screen (nothing to navigate around it to).
  if (isSignedIn && twoFactorPending) {
    return <TwoFactorVerify />;
  }

  if (isSignedIn && !twoFactorPending && !biometricChecked) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isSignedIn && biometricLocked) {
    return <BiometricLockScreen label={biometricLabel} onUnlock={() => setBiometricLocked(false)} />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      // Flushes a push-notification-tap navigation that was queued if the
      // push launched the app cold (getInitialNotification resolving before
      // this ref was ready — see navigation/navigationRef.ts).
      onReady={flushPendingNavigation}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          ...TransitionPresets.SlideFromRightIOS,
        }}
        initialRouteName={isSignedIn ? 'MainBottomTab' : 'Intro'}>
        <Stack.Screen name="Intro" component={Onboarding} />
        <Stack.Screen name="AuthStack" component={AuthNavigator} />

        <Stack.Screen name="SelectLanguage" component={SelectLanguage} />
        <Stack.Screen name="Notification" component={Notification} />

        <Stack.Screen name="MessagesStack" component={MessagesNavigator} />
        <Stack.Screen name="MainBottomTab" component={MainBottomTab} />
        <Stack.Screen name="RequestStack" component={RequestsStackNavigator} />

        <Stack.Screen name="MoreNavigator" component={MoreNavigator} />
        <Stack.Screen name="AddMorePayment" component={AddMorePayment} />
        <Stack.Screen name="ChangeCareType" component={ChangeCareType} />
        <Stack.Screen name="JobPreferences" component={JobPreferences} />
        <Stack.Screen name="MyProgress" component={MyProgress} />
        <Stack.Screen name="Leaderboard" component={Leaderboard} />
        <Stack.Screen name="AboutScreen" component={AboutScreen} />
        <Stack.Screen name="FaqScreen" component={FaqScreen} />
        <Stack.Screen name="PolicyScreen" component={PolicyScreen} />

        {/* AI Interview Coach — practice & career-tools screens */}
        <Stack.Screen name="MockInterviewSetup" component={MockInterviewSetup} />
        <Stack.Screen name="ScheduleInterview" component={ScheduleInterview} />
        <Stack.Screen name="LiveInterviewSession" component={LiveInterviewSession} />
        <Stack.Screen name="CodingInterview" component={CodingInterview} />
        <Stack.Screen name="InterviewFeedback" component={InterviewFeedback} />
        <Stack.Screen name="ResumeBuilder" component={ResumeBuilder} />
        <Stack.Screen name="MyDocuments" component={MyDocuments} />
        <Stack.Screen name="JDAnalyzer" component={JDAnalyzer} />
        <Stack.Screen name="GenerateResume" component={GenerateResume} />
        <Stack.Screen name="CoverLetterGenerator" component={CoverLetterGenerator} />
        <Stack.Screen name="JDCoverLetterGenerator" component={JDCoverLetterGenerator} />
        <Stack.Screen name="WeeklyCareerReport" component={WeeklyCareerReport} />
        <Stack.Screen name="DailyIndustryNews" component={DailyIndustryNews} />
        <Stack.Screen name="ResumeVariants" component={ResumeVariants} />
        <Stack.Screen name="GeneratedDocuments" component={GeneratedDocuments} />
        <Stack.Screen name="LinkedInOptimizer" component={LinkedInOptimizer} />
        <Stack.Screen name="EmotionalCoach" component={EmotionalCoach} />
        <Stack.Screen name="CompanyIntelligence" component={CompanyIntelligence} />
        <Stack.Screen name="DreamCompanies" component={DreamCompanies} />
        <Stack.Screen name="CareerDna" component={CareerDna} />
        <Stack.Screen name="InterviewReplay" component={InterviewReplay} />
        <Stack.Screen name="StudentVerification" component={StudentVerification} />
        <Stack.Screen name="ChooseUsername" component={ChooseUsername} />
        <Stack.Screen name="SharedWithMe" component={SharedWithMe} />
        <Stack.Screen name="SharedContentDetail" component={SharedContentDetail} />
        <Stack.Screen name="CareerBriefingDetail" component={CareerBriefingDetail} />
        <Stack.Screen name="GoalTipDetail" component={GoalTipDetail} />
        <Stack.Screen name="CourseSession" component={CourseSession} />
        <Stack.Screen name="SalaryNegotiation" component={SalaryNegotiation} />
        <Stack.Screen name="SystemDesignWhiteboard" component={SystemDesignWhiteboard} />
        <Stack.Screen name="LearningCourses" component={LearningCourses} />
        <Stack.Screen name="NetworkingAssistant" component={NetworkingAssistant} />
        <Stack.Screen name="CareerDiary" component={CareerDiary} />
        <Stack.Screen name="MyRatings" component={MyRatings} />
        <Stack.Screen name="CareerRoadmap" component={CareerRoadmap} />
        <Stack.Screen name="PracticalScenarioSetup" component={PracticalScenarioSetup} />
        <Stack.Screen name="PracticalScenarioSession" component={PracticalScenarioSession} />
        <Stack.Screen name="PracticalScenarioFeedback" component={PracticalScenarioFeedback} />
        <Stack.Screen name="ReferralProgram" component={ReferralProgram} />
        <Stack.Screen name="JobAlerts" component={JobAlerts} />
        <Stack.Screen name="JobAlertDetails" component={JobAlertDetails} />
        <Stack.Screen name="AdDetails" component={AdDetails} />
        <Stack.Screen name="WebViewScreen" component={WebViewScreen} />
        <Stack.Screen name="Subscription" component={Subscription} />
        <Stack.Screen name="PaymentHistory" component={PaymentHistory} />
        <Stack.Screen name="SecuritySettings" component={SecuritySettings} />

        <Stack.Screen name="SuccessScr" component={SuccessScr} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
export default AppContainer;
