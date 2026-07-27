import {createStackNavigator, TransitionPresets} from '@react-navigation/stack';
import React, {memo} from 'react';
import AboutYourChild from 'src/new-job/AboutYourChild';
import AboutYourFamily from 'src/new-job/AboutYourFamily';
import CreatePostDetails from 'src/new-job/CreatePostDetails';
import FrequencyDate from 'src/new-job/FrequencyDate';
import HourlyRate from 'src/new-job/HourlyRate';
import Qualifications from 'src/new-job/Qualifications';
import SelectResponsibilities from 'src/new-job/SelectResponsibilities';
import TypeOfCare from 'src/new-job/TypeOfCare';
import {CreateJobStackParamList} from './types';

const Stack = createStackNavigator<CreateJobStackParamList>();
const HomeStackNavigator = memo(() => {
  return (
    <Stack.Navigator
      screenOptions={{headerShown: false, ...TransitionPresets.SlideFromRightIOS}}
      initialRouteName="CreatePostDetails">
      <Stack.Screen name="TypeOfCare" component={TypeOfCare} />
      <Stack.Screen name="FrequencyDate" component={FrequencyDate} />
      <Stack.Screen name="AboutYourFamily" component={AboutYourFamily} />
      <Stack.Screen name="AboutYourChild" component={AboutYourChild} />
      <Stack.Screen name="HourlyRate" component={HourlyRate} />
      <Stack.Screen name="Qualifications" component={Qualifications} />
      <Stack.Screen
        name="SelectResponsibilities"
        component={SelectResponsibilities}
      />
      <Stack.Screen name="CreatePostDetails" component={CreatePostDetails} />
    </Stack.Navigator>
  );
});
export default HomeStackNavigator;
