import { createStackNavigator, TransitionPresets } from "@react-navigation/stack";
import React, { memo } from "react";
import Chat from "src/messages/Chat";

import { MessagesStackParamList } from "./types";

// VideoCall (a leftover pre-Saveur template screen — static placeholder,
// no real camera/session/AI question flow) removed: pre-launch redundancy
// audit confirmed zero navigate('VideoCall') call sites anywhere in the
// app. Video-style practice is handled for real by MockInterviewSetup ->
// LiveInterviewSession (see Chat.tsx's onMakeCall, which already routes
// there instead).
const Stack = createStackNavigator<MessagesStackParamList>();
const MessagesNavigator = memo(() => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, ...TransitionPresets.SlideFromRightIOS }}
      initialRouteName="Chat"
    >
      <Stack.Screen name="Chat" component={Chat} />
    </Stack.Navigator>
  );
});
export default MessagesNavigator;
