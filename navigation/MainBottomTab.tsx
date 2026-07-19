import React, { memo } from "react";
import { View } from "react-native";
import {
  useTheme,
  useStyleSheet,
  Icon,
  StyleService,
} from "@ui-kitten/components";
import { MainBottomTabStackParamList } from "./types";
import Text from "components/Text";
import { globalStyle } from "styles/globalStyle";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import useLayout from "hooks/useLayout";
import ModalRequest from "components/ModalRequest";
import useModal from "hooks/useModal";
import { Images } from "assets/images";
import HomeStackNavigator from "./HomeStackNavigator";
// "Find" is repurposed as the Practice hub (pick interview type / mode / difficulty).
import FindScreen from "src/find/FindScreen";
// "Messages" is repurposed as the AI Coach chat.
import MessagesScreen from "src/messages/MessagesScreen";
import RequestsBottomNavigator from "./RequestsBottomNavigator";
import MoreNavigator from "./MoreNavigator";

interface ButtonTabProps {
  focused: boolean;
  icon: string;
  numberNotification?: number;
  onPress?: void;
}

const BottomTab = createBottomTabNavigator<MainBottomTabStackParamList>();

const MainBottomTab = memo(() => {
  const theme = useTheme();
  const { height, bottom } = useLayout();
  const styles = useStyleSheet(themedStyles);
  const { visible, show, hide } = useModal();

  const ButtonTab = React.useCallback(
    ({ focused, icon, numberNotification }: ButtonTabProps) => {
      React.useEffect(() => {
        if (focused && icon == "bookmark") {
          setTimeout(() => {
            show();
          }, 1200);
          clearTimeout;
        } else {
          hide();
        }
      }, [focused]);
      return (
        <View
          style={{
            width: 40,
            height: 40,
            ...globalStyle.center,
          }}
        >
          {numberNotification ? (
            focused ? null : (
              <View style={styles.notification}>
                <Text center category="h9" status="primary" mt={1.5}>
                  {numberNotification}
                </Text>
              </View>
            )
          ) : null}
          <Icon
            pack="assets"
            name={!focused ? icon : `${icon}Active`}
            style={{
              width: 24,
              height: 24,
              tintColor: focused
                ? theme["button-basic-color"]
                : theme["text-placeholder-color"],
            }}
          />
        </View>
      );
    },
    []
  );

  return (
    <View style={styles.container}>
      <BottomTab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarLabelStyle: styles.styleLabel,
          tabBarStyle: [
            styles.tabBarStyle,
            {
              height: (54 + bottom) * (height / 812),
            },
          ],
        }}
      >
        <BottomTab.Screen
          name="Home"
          component={HomeStackNavigator}
          options={{
            tabBarIcon: ({ focused }) => (
              <ButtonTab
                focused={focused}
                icon="home"
                numberNotification={undefined}
              />
            ),
          }}
        />
        <BottomTab.Screen
          name="Practice"
          component={FindScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <ButtonTab
                focused={focused}
                icon="search"
                numberNotification={undefined}
              />
            ),
          }}
        />
        <BottomTab.Screen
          name="Coach"
          component={MessagesScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <ButtonTab
                focused={focused}
                icon="comment"
                numberNotification={1}
              />
            ),
          }}
        />
        <BottomTab.Screen
          name="Interviews"
          component={RequestsBottomNavigator}
          options={{
            tabBarIcon: ({ focused }) => (
              <ButtonTab
                focused={focused}
                icon="bookmark"
                numberNotification={undefined}
              />
            ),
          }}
        />
        <BottomTab.Screen
          name="Profile"
          component={MoreNavigator}
          options={{
            tabBarIcon: ({ focused }) => (
              <ButtonTab focused={focused} icon="more" numberNotification={3} />
            ),
          }}
        />
      </BottomTab.Navigator>
      {/* Notification modal — surfaces when the Interviews tab is opened.
          TODO: wire up to real push/in-app notifications once backend exists. */}
      <ModalRequest
        visible={visible}
        show={show}
        name={"Your AI Coach"}
        avatar={Images.logo}
        isOnl={true}
        onDetails={hide}
        hide={hide}
        message={" has feedback ready on your last mock interview."}
      />
    </View>
  );
});
export default MainBottomTab;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  tabBarStyle: {
    overflow: "hidden",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -46,
    paddingTop: 12,
    backgroundColor: "background-basic-color-2",
    borderColor: "transparent",
    borderTopWidth: -1
  },
  styleLabel: {
    fontFamily: "GothamPro-Medium",
    fontSize: 11,
    lineHeight: 24,
  },
  buttonTab: {
    borderRadius: 12,
    height: 40,
    width: 40,
  },
  notification: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "button-basic-color",
    width: 16,
    height: 16,
    zIndex: 10,
    top: 2,
    right: 1,
  },
});
