import {createStackNavigator, TransitionPresets} from '@react-navigation/stack';
import React, {memo} from 'react';
import HomeSrc from 'src/home/HomeSrc';
import MyFavorites from 'src/home/MyFavorites';
import {HomeStackParamList} from './types';

const Stack = createStackNavigator<HomeStackParamList>();
const HomeStackNavigator = memo(() => {
  return (
    <Stack.Navigator
      screenOptions={{headerShown: false, ...TransitionPresets.SlideFromRightIOS}}
      initialRouteName="HomeSrc">
      <Stack.Screen name="HomeSrc" component={HomeSrc} />
      <Stack.Screen name="MyFavorites" component={MyFavorites} />
    </Stack.Navigator>
  );
});
export default HomeStackNavigator;
