import {createStackNavigator, TransitionPresets} from '@react-navigation/stack';
import React, {memo} from 'react';

import {RequestsStackParamList} from './types';
import ApplicationDetails from 'src/requests/Applications/ApplicationDetails';

// This stack used to also carry a whole caregiver-booking sub-tree
// (RequestInterview, ReviewRequestInterview, BookingRequest,
// ReviewRequestBooking, InterviewDetails, BookingDetails, ConfirmHour,
// SelectCard) — every one of those screens was unreachable from any real
// user flow (confirmed: no navigate() call anywhere outside that same dead
// cluster targeted any of them). ApplicationDetails is the only screen
// actually pushed onto this stack, from ApplicationItem.tsx inside the real
// Application Tracker feature (RequestsSrc -> ApplicationsTab).
const Stack = createStackNavigator<RequestsStackParamList>();
const RequestsStackNavigator = memo(() => {
  return (
    <Stack.Navigator
      screenOptions={{headerShown: false, ...TransitionPresets.SlideFromRightIOS}}
      initialRouteName="ApplicationDetails">
      <Stack.Screen name="ApplicationDetails" component={ApplicationDetails} />
    </Stack.Navigator>
  );
});
export default RequestsStackNavigator;
