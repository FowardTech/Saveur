import { createStackNavigator, TransitionPresets } from "@react-navigation/stack";
import React, { memo } from "react";
import EditProfile from "src/more/EditProfile";
import MoreSrc from "src/more/MoreSrc";
import MyChildren from "src/more/MyChildren";
import MyPost from "src/more/MyPost";
import PaymentMethod from "src/more/PaymentMethod";
import ProfileSrc from "src/more/ProfileSrc";

import { MoreStackParamList } from "./types";

const Stack = createStackNavigator<MoreStackParamList>();
const MoreNavigator = memo(() => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, ...TransitionPresets.SlideFromRightIOS }}
      initialRouteName="MoreSrc"
    >
      <Stack.Screen name="MoreSrc" component={MoreSrc} />
      <Stack.Screen name="MyPost" component={MyPost} />
      <Stack.Screen name="MyChildren" component={MyChildren} />
      <Stack.Screen name="ProfileSrc" component={ProfileSrc} />
      <Stack.Screen name="EditProfile" component={EditProfile} />
      <Stack.Screen name="PaymentMethod" component={PaymentMethod} />
    </Stack.Navigator>
  );
});
export default MoreNavigator;
