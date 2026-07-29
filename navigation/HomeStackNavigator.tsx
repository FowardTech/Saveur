import {createStackNavigator, TransitionPresets} from '@react-navigation/stack';
import React, {memo} from 'react';
import HomeSrc from 'src/home/HomeSrc';
import {HomeStackParamList} from './types';

// MyFavorites (a leftover caregiver-marketplace "favorites list" screen,
// never reachable from any real Home tab UI — nothing ever called
// navigate('MyFavorites')) was removed entirely, along with its whole
// unreachable sub-tree (FavoritesMap/FavoritesFilter/NameTagList,
// CaregiverProfile, ViewOnMap, IMapView/IRecommended). HomeSrc is the only
// real screen this stack has ever needed.
const Stack = createStackNavigator<HomeStackParamList>();
const HomeStackNavigator = memo(() => {
  return (
    <Stack.Navigator
      screenOptions={{headerShown: false, ...TransitionPresets.SlideFromRightIOS}}
      initialRouteName="HomeSrc">
      <Stack.Screen name="HomeSrc" component={HomeSrc} />
    </Stack.Navigator>
  );
});
export default HomeStackNavigator;
