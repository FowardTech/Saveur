import React, {memo} from 'react';
import {AuthStackParamList} from './types';
import createStackNavigator from './createStackNavigator';
import Login from 'src/auth/Login/Login';
import ForgetPassword from 'src/auth/ForgetPassword';
import SignupFirstStep from 'src/auth/Signup/SignupFirstStep';
import SignupSecondStep from 'src/auth/Signup/SignupSecondStep';
import SignupThirdStep from 'src/auth/Signup/SignupThirdStep';
import NewPassword from 'src/auth/NewPassword';

const Stack = createStackNavigator<AuthStackParamList>();

const AuthNavigator = memo(() => {
  return (
    <Stack.Navigator
      screenOptions={{headerShown: false}}
      initialRouteName="Login">
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="SignupFirstStep" component={SignupFirstStep} />
      <Stack.Screen name="SignupSecondStep" component={SignupSecondStep} />
      <Stack.Screen name="SignupThirdStep" component={SignupThirdStep} />
      <Stack.Screen name="ForgetPassword" component={ForgetPassword} />
      <Stack.Screen name="NewPassword" component={NewPassword} />
    </Stack.Navigator>
  );
});

export default AuthNavigator;
