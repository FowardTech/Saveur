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
import * as notificationService from "services/notificationService";
import { NotificationProps } from "constants/Types";
import HomeStackNavigator from "./HomeStackNavigator";
// "Find" is repurposed as the Practice hub (pick interview type / mode / difficulty).
import FindScreen from "src/find/FindScreen";
// "Messages" is repurposed as the AI Coach chat.
import MessagesScreen from "src/messages/MessagesScreen";
import RequestsBottomNavigator from "./RequestsBottomNavigator";
import MoreNavigator from "./MoreNavigator";
import VerifyEmailGate from "src/auth/VerifyEmailGate";
import ProLockGate from "components/ProLockGate";
import {AuthContext} from "../AuthContext";

// Module scope (not defined inline in the BottomTab.Screen component prop)
// so it's a stable component reference across renders — same reasoning as
// the other component-swap patterns in this file/session (e.g.
// renderCheckoutSpinner in Subscription.tsx).
const CoachProLockGate = () => (
  <ProLockGate
    title="AI Career Coach"
    description="Chat with your AI coach, get personalized suggested topics, and practice salary negotiations — all on the Pro plan."
  />
);

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
  // Product decision: an unverified user can't use practice/coach/interview
  // tools, but the Profile tab itself stays untouched (Resend/Logout/account
  // settings must always be reachable) — see src/auth/VerifyEmailGate.tsx.
  // Was previously not enforced at all beyond a dismissible Home banner.
  const { isSignedIn, emailVerified, isPro } = React.useContext(AuthContext);
  const isGated = isSignedIn && !emailVerified;

  // Was an unconditional 1200ms timer that popped this modal up with a
  // hardcoded "has feedback ready" message every single time the Interviews
  // tab opened — even if the user had never completed a single interview.
  // Now backed by a real GET /api/v1/notifications check for an unread
  // "feedback_ready" notification (created server-side in
  // app/api/interviews.py's end_session, only once scoring actually
  // succeeds) — the popup simply doesn't appear when there's nothing real
  // to show. feedbackNotifRef exists because ButtonTab below is memoized
  // with an empty deps array (so its effect closure is frozen at first
  // render) — a ref is what lets that frozen closure still read whatever
  // was most recently fetched.
  const [feedbackNotif, setFeedbackNotif] = React.useState<NotificationProps | null>(null);
  const feedbackNotifRef = React.useRef<NotificationProps | null>(null);
  const checkFeedbackNotification = React.useCallback(async () => {
    try {
      const notifications = await notificationService.listNotifications();
      const unread = notifications.find(n => n.type === "feedback_ready" && !n.read) ?? null;
      feedbackNotifRef.current = unread;
      setFeedbackNotif(unread);
    } catch {
      // Offline or the request failed — err on the side of not showing a
      // popup for feedback we can't actually confirm exists.
      feedbackNotifRef.current = null;
      setFeedbackNotif(null);
    }
  }, []);
  const onDismissFeedbackNotif = React.useCallback(() => {
    hide();
    const notif = feedbackNotifRef.current;
    if (notif) {
      notificationService.markNotificationsRead([notif.id]).catch(() => {});
      feedbackNotifRef.current = null;
      setFeedbackNotif(null);
    }
  }, [hide]);

  const ButtonTab = React.useCallback(
    ({ focused, icon, numberNotification }: ButtonTabProps) => {
      React.useEffect(() => {
        if (focused && icon == "bookmark") {
          let cancelled = false;
          (async () => {
            await checkFeedbackNotification();
            if (cancelled) return;
            if (feedbackNotifRef.current) {
              setTimeout(() => {
                if (!cancelled) show();
              }, 1200);
            }
          })();
          return () => {
            cancelled = true;
          };
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
                <Text center category="h9" status="primary" fontSize={11} lineHeight={13}>
                  {numberNotification > 9 ? '9+' : numberNotification}
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
          component={isGated ? VerifyEmailGate : HomeStackNavigator}
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
          component={isGated ? VerifyEmailGate : FindScreen}
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
          component={isGated ? VerifyEmailGate : !isPro ? CoachProLockGate : MessagesScreen}
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
          component={isGated ? VerifyEmailGate : RequestsBottomNavigator}
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
      {/* Notification modal — only rendered visible when a real, unread
          "feedback_ready" notification exists (see checkFeedbackNotification
          above); its title/message come straight from that notification
          rather than a hardcoded string. Dismissing it (either button) marks
          the notification read server-side so it doesn't reappear next time
          this tab opens. */}
      <ModalRequest
        visible={visible}
        show={show}
        name={feedbackNotif?.title ?? "Your AI Coach"}
        avatar={Images.logoBadge}
        isOnl={true}
        onDetails={onDismissFeedbackNotif}
        hide={onDismissFeedbackNotif}
        message={feedbackNotif?.message}
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
    // Was 16x16 with a 14px-font label -- larger counts had no room to
    // breathe. 20x20 + capped "9+" text (see render above) is the standard
    // moderate size for a two-character count badge.
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "button-basic-color",
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    top: 0,
    right: -2,
  },
});
