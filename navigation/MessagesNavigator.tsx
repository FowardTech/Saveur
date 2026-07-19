import { createStackNavigator } from "@react-navigation/stack";
import React, { memo } from "react";
import Chat from "src/messages/Chat";
import VideoCall from "src/messages/VideoCall";

import { MessagesStackParamList } from "./types";

const Stack = createStackNavigator<MessagesStackParamList>();
const MessagesNavigator = memo(() => {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="Chat"
    >
      <Stack.Screen name="Chat" component={Chat} />
      <Stack.Screen name="VideoCall" component={VideoCall} />
    </Stack.Navigator>
  );
});
export default MessagesNavigator;
