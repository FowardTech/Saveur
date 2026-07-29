import { createStackNavigator, TransitionPresets } from "@react-navigation/stack";
import React, { memo } from "react";
import EditProfile from "src/more/EditProfile";
import MoreSrc from "src/more/MoreSrc";
import PaymentMethod from "src/more/PaymentMethod";
import ProfileSrc from "src/more/ProfileSrc";

import { MoreStackParamList } from "./types";

// MyPost (a leftover caregiver "post" template screen — hardcoded fake
// applications, no real backend) and MyChildren (a since-superseded "My
// Documents" implementation the More menu stopped pointing to once
// src/more/MyDocuments.tsx was built — see that file's own doc comment)
// were both fully unreachable and have been removed, along with MyChildren's
// AddChild sub-screen.
const Stack = createStackNavigator<MoreStackParamList>();
const MoreNavigator = memo(() => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, ...TransitionPresets.SlideFromRightIOS }}
      initialRouteName="MoreSrc"
    >
      <Stack.Screen name="MoreSrc" component={MoreSrc} />
      <Stack.Screen name="ProfileSrc" component={ProfileSrc} />
      <Stack.Screen name="EditProfile" component={EditProfile} />
      <Stack.Screen name="PaymentMethod" component={PaymentMethod} />
    </Stack.Navigator>
  );
});
export default MoreNavigator;
