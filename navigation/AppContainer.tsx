import * as React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {RootStackParamList} from './types';
import {LogBox} from 'react-native';
import Onboarding from 'src/onboarding';
import SuccessScr from 'src/SuccessScr';
import AuthNavigator from './AuthNavigator';
import MainBottomTab from './MainBottomTab';
import FavoritesFilter from 'src/home/MyFavorites/FavoritesFilter';
import SelectLanguage from 'src/home/MyFavorites/SelectLanguage';
import FavoritesMap from 'src/home/MyFavorites/FavoritesMap';
import Notification from 'src/home/Notification';
import MessagesNavigator from './MessagesNavigator';
import ViewOnMap from 'src/find/ViewOnMap';
import CaregiverProfile from 'src/find/CaregiverProfile';
import ProfileGallery from 'src/find/ProfileGallery';
import WriteReview from 'src/find/WriteReview';
import CreateJobNavigator from './CreateJobNavigator';
import RequestsStackNavigator from './RequestStackNavigator';
import MoreNavigator from './MoreNavigator';
import AddMorePayment from 'src/more/AddMorePayment/AddMorePayment';
import CaregiverPostDetails from 'src/more/CaregiverPostDetails';
import AddChild from 'src/more/MyChildren/AddChild';
import FaqScreen from 'src/more/faqScreen';
import AboutScreen from 'src/more/aboutScreen';
import ChangeCareType from 'src/more/ChangeCareType';
import PolicyScreen from 'src/more/policyScreen';
import MockInterviewSetup from 'src/practice/MockInterviewSetup';
import LiveInterviewSession from 'src/practice/LiveInterviewSession';
import CodingInterview from 'src/practice/CodingInterview';
import InterviewFeedback from 'src/practice/InterviewFeedback';
import ResumeBuilder from 'src/more/ResumeBuilder';
import JDAnalyzer from 'src/more/JDAnalyzer';
import SalaryNegotiation from 'src/practice/SalaryNegotiation';
import SystemDesignWhiteboard from 'src/practice/SystemDesignWhiteboard';
import LearningCourses from 'src/more/LearningCourses';
import NetworkingAssistant from 'src/more/NetworkingAssistant';
import Subscription from 'src/more/Subscription';

const Stack = createStackNavigator<RootStackParamList>();

LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);
const AppContainer = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
        initialRouteName="Intro">
        <Stack.Screen name="Intro" component={Onboarding} />
        <Stack.Screen name="AuthStack" component={AuthNavigator} />

        <Stack.Screen name="FavoritesFilter" component={FavoritesFilter} />
        <Stack.Screen name="SelectLanguage" component={SelectLanguage} />
        <Stack.Screen name="FavoritesMap" component={FavoritesMap} />
        <Stack.Screen name="Notification" component={Notification} />
        <Stack.Screen name="ViewOnMap" component={ViewOnMap} />
        <Stack.Screen name="CaregiverProfile" component={CaregiverProfile} />
        <Stack.Screen name="ProfileGallery" component={ProfileGallery} />
        <Stack.Screen name="WriteReview" component={WriteReview} />

        <Stack.Screen name="CreateJobStack" component={CreateJobNavigator} />
        <Stack.Screen name="MessagesStack" component={MessagesNavigator} />
        <Stack.Screen name="MainBottomTab" component={MainBottomTab} />
        <Stack.Screen name="RequestStack" component={RequestsStackNavigator} />

        <Stack.Screen name="MoreNavigator" component={MoreNavigator} />
        <Stack.Screen name="AddMorePayment" component={AddMorePayment} />
        <Stack.Screen name="AddChild" component={AddChild} />
        <Stack.Screen name="ChangeCareType" component={ChangeCareType} />
        <Stack.Screen name="AboutScreen" component={AboutScreen} />
        <Stack.Screen name="FaqScreen" component={FaqScreen} />
        <Stack.Screen name="PolicyScreen" component={PolicyScreen} />
        
        <Stack.Screen name="CaregiverPostDetails" component={CaregiverPostDetails} />

        {/* AI Interview Coach — practice & career-tools screens */}
        <Stack.Screen name="MockInterviewSetup" component={MockInterviewSetup} />
        <Stack.Screen name="LiveInterviewSession" component={LiveInterviewSession} />
        <Stack.Screen name="CodingInterview" component={CodingInterview} />
        <Stack.Screen name="InterviewFeedback" component={InterviewFeedback} />
        <Stack.Screen name="ResumeBuilder" component={ResumeBuilder} />
        <Stack.Screen name="JDAnalyzer" component={JDAnalyzer} />
        <Stack.Screen name="SalaryNegotiation" component={SalaryNegotiation} />
        <Stack.Screen name="SystemDesignWhiteboard" component={SystemDesignWhiteboard} />
        <Stack.Screen name="LearningCourses" component={LearningCourses} />
        <Stack.Screen name="NetworkingAssistant" component={NetworkingAssistant} />
        <Stack.Screen name="Subscription" component={Subscription} />

        <Stack.Screen name="SuccessScr" component={SuccessScr} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
export default AppContainer;
