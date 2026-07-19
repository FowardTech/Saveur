import {createStackNavigator} from '@react-navigation/stack';
import React, {memo} from 'react';
import BookingRequest from 'src/requests/BookingRequest';
import ConfirmHour from 'src/requests/BookingRequest/ConfirmHour';
import ReviewRequestBooking from 'src/requests/BookingRequest/ReviewRequestBooking';
import BookingDetails from 'src/requests/Bookings/BookingDetails';
import InterviewDetails from 'src/requests/Interview/InterviewDetails';
import RequestInterview from 'src/requests/RequestInterview';
import ReviewRequestInterview from 'src/requests/RequestInterview/ReviewRequestInterview';
import SelectCard from 'src/requests/Payment/SelectCard';

import {RequestsStackParamList} from './types';
import ApplicationDetails from 'src/requests/Applications/ApplicationDetails';

const Stack = createStackNavigator<RequestsStackParamList>();
const RequestsStackNavigator = memo(() => {
  return (
    <Stack.Navigator
      screenOptions={{headerShown: false}}
      initialRouteName="RequestInterview">
      {/* RequestInterview */}
      <Stack.Screen name="RequestInterview" component={RequestInterview} />
      <Stack.Screen
        name="ReviewRequestInterview"
        component={ReviewRequestInterview}
      />
      {/* Booking Request */}
      <Stack.Screen name="BookingRequest" component={BookingRequest} />
      <Stack.Screen
        name="ReviewRequestBooking"
        component={ReviewRequestBooking}
      />
      <Stack.Screen name="InterviewDetails" component={InterviewDetails} />
      <Stack.Screen name="BookingDetails" component={BookingDetails} />
      <Stack.Screen name="ApplicationDetails" component={ApplicationDetails} />
      <Stack.Screen name="ConfirmHour" component={ConfirmHour} />
      <Stack.Screen name="SelectCard" component={SelectCard} />
    </Stack.Navigator>
  );
});
export default RequestsStackNavigator;
