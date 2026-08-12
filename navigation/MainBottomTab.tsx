import React, { memo } from "react";
import { AppState, View } from "react-native";
import {
  useTheme,
  useStyleSheet,
  Icon,
  StyleService,
} from "@ui-kitten/components";
import { useTranslation } from "react-i18next";
import { MainBottomTabStackParamList } from "./types";
import Text from "components/Text";
import { globalStyle } from "styles/globalStyle";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import useLayout from "hooks/useLayout";
import ModalRequest from "components/ModalRequest";
import useModal from "hooks/useModal";
import { Images } from "assets/images";
import * as notificationService from "services/notificationService";
import { getMoreMenuBadges } from "services/moreMenuBadgesService";
import { NotificationProps } from "constants/Types";
import HomeStackNavigator from "./HomeStackNavigator";
// "Find" is repurposed as the Practice hub (pick interview type / mode / difficulty).
import FindScreen from "src/find/FindScreen";
// "Messages" is repurposed as the AI Coach chat. Product follow-up: "the
// chat icon tab in the bottom navigation will just lead straight to the AI
// coach screen" — used to render MessagesScreen.tsx (a menu page: a hero
// card you had to tap to actually reach the chat, plus a Salary
// Negotiation Simulator card and a Suggested Topics grid). That hero card
// is gone (see Home's own new "Salary Negotiation Simulator" row, and
// Chat.tsx's own greeting screen, which now carries the Suggested Topics
// grid instead), so there's nothing left on that intermediate screen worth
// keeping — this tab now renders MessagesNavigator directly, which mounts
// Chat.tsx as its first screen (see that navigator's own
// initialRouteName="Chat"). MessagesScreen.tsx itself has been deleted.
import MessagesNavigator from "./MessagesNavigator";
import RequestsBottomNavigator from "./RequestsBottomNavigator";
import MoreNavigator from "./MoreNavigator";
import VerifyEmailGate from "src/auth/VerifyEmailGate";
import ProLockGate from "components/ProLockGate";
import { AuthContext } from "../AuthContext";

// Module scope (not defined inline in the BottomTab.Screen component prop)
// so it's a stable component reference across renders — same reasoning as
// the other component-swap patterns in this file/session (e.g.
// renderCheckoutSpinner in Subscription.tsx). Used as a bare `component=`
// on a BottomTab.Screen below (React Navigation renders it with its own
// navigation/route props, not custom ones) — so unlike a normal inline
// render, it can't just receive `t` as a prop from its call site. It needs
// its own useTranslation() call instead.
//
// BUG FIX (full-app translation sweep): title/description used to be raw
// hardcoded English string literals, never translated at all.
const CoachProLockGate = () => {
  const { t } = useTranslation(["common", "message"]);
  return (
    <ProLockGate
      title={t('message:ai_coach_name', { defaultValue: 'AI Career Coach' })}
      description={t('common:coach_prolock_description', {
        defaultValue: 'Chat with your AI coach, get personalized suggested topics, and practice salary negotiations — all on the Pro plan.',
      })}
    />
  );
};

interface ButtonTabProps {
  focused: boolean;
  icon: string;
  numberNotification?: number;
  onPress?: void;
}

const BottomTab = createBottomTabNavigator<MainBottomTabStackParamList>();

const MainBottomTab = memo(() => {
  const theme = useTheme();
  const { t } = useTranslation(["common"]);
  const { height, bottom } = useLayout();
  const styles = useStyleSheet(themedStyles);
  const { visible, show, hide } = useModal();
  const tabBarHeight = (54 + bottom) * (height / 812);
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
  // Menu tab badge (product request item: "the badge count on the profile
  // tab should be determined by the badge counts on these [Job Alerts,
  // Daily Industry News, Weekly Career Report]") — reuses the exact same
  // GET /api/v1/more/badges the More screen itself reads (see
  // services/moreMenuBadgesService.ts / src/more/MoreSrc.tsx). Job Alerts
  // contributes its real unread count; Daily Industry News/Weekly Career
  // Report each contribute at most 1 (they're a single "is there something
  // new" dot, not a countable list — see moreMenuBadgesService.ts's own
  // comment on that distinction). Refetched on mount and whenever the app
  // returns to the foreground — this component (unlike MoreSrc.tsx) stays
  // mounted for the whole session once signed in, so there's no natural
  // "screen focus" moment to hook a refetch to the way MoreSrc.tsx does.
  const [menuBadgeCount, setMenuBadgeCount] = React.useState<number | undefined>(undefined);
  const refreshMenuBadges = React.useCallback(async () => {
    const badges = await getMoreMenuBadges();
    const total =
      badges.jobAlertsUnreadCount +
      (badges.dailyIndustryNewsUnread ? 1 : 0) +
      (badges.weeklyCareerReportUnread ? 1 : 0);
    setMenuBadgeCount(total > 0 ? total : undefined);
  }, []);
  React.useEffect(() => {
    refreshMenuBadges();
    const subscription = AppState.addEventListener("change", nextState => {
      if (nextState === "active") refreshMenuBadges();
    });
    return () => subscription.remove();
  }, [refreshMenuBadges]);

  const onDismissFeedbackNotif = React.useCallback(() => {
    hide();
    const notif = feedbackNotifRef.current;
    if (notif) {
      notificationService.markNotificationsRead([notif.id]).catch(() => { });
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
          {/* Redesign v2 (full reskin, "screenshot 3" reference —
              "colorful pill bottom nav"): the active tab's icon now sits on
              a filled brand-blue pill instead of the earlier flat black/
              gray monochrome look (which itself replaced an even older
              plain-blue-tint icon). Icon tints white on the pill so it
              stays legible against the solid fill; inactive icons keep the
              same neutral placeholder tint as before. Not pink — the
              reskin reference's color is swapped for Saveur's own brand
              blue (color-primary-100) per explicit instruction. */}
          <View style={focused ? styles.activePill : undefined}>
            <Icon
              pack="assets"
              name={!focused ? icon : `${icon}Active`}
              style={{
                width: 22,
                height: 22,
                tintColor: focused
                  ? theme["text-primary-color"]
                  : theme["text-placeholder-color"],
              }}
            />
          </View>
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
          // Was unset — react-navigation's bottom-tabs falls back to its
          // own default active tint (a bright blue) for the label text
          // whenever this isn't provided, regardless of the ButtonTab
          // icon's own tintColor logic just above (that only recolors the
          // icon, not react-navigation's separately-rendered label). Per
          // explicit follow-up ("the color of these tab text should be
          // black when active not blue"), matches the icon's own
          // focused/unfocused colors exactly.
          tabBarActiveTintColor: theme["text-basic-color"],
          tabBarInactiveTintColor: theme["text-placeholder-color"],
          tabBarStyle: [
            styles.tabBarStyle,
            {
              height: tabBarHeight,
            },
          ],
        }}
      >
        <BottomTab.Screen
          name="Home"
          component={isGated ? VerifyEmailGate : HomeStackNavigator}
          options={{
            tabBarLabel: t("common:tab_home", { defaultValue: "Home" }),
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
            tabBarLabel: t("common:tab_practice", { defaultValue: "Practice" }),
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
          component={isGated ? VerifyEmailGate : !isPro ? CoachProLockGate : MessagesNavigator}
          options={{
            // Product follow-up (revert): "the floating chat icon in the
            // bottom navigation should return as normal like the other
            // icons no more floating" -- Coach used to hide its own
            // label/icon here in favor of a separately-rendered floating
            // circular button raised above the bar (see git history).
            // Back to a normal inline tab like Home/Practice/Interviews/
            // Menu, same ButtonTab component the other four use.
            tabBarLabel: t("common:tab_coach", { defaultValue: "Coach" }),
            tabBarIcon: ({ focused }) => (
              <ButtonTab
                focused={focused}
                icon="comment"
                numberNotification={undefined}
              />
            ),
          }}
        />
        <BottomTab.Screen
          name="Interviews"
          component={isGated ? VerifyEmailGate : RequestsBottomNavigator}
          options={{
            // BUG FIX (pre-launch redundancy/flow audit): this tab is really
            // an application tracker + a Practice History log — the
            // "Interviews" label made it read as a duplicate of the
            // "Practice" tab, where interviews are actually taken. Route
            // name ("Interviews") stays as-is to avoid touching every
            // navigate('Interviews'/'RequestStack', ...) call site — only
            // the user-facing label changes.
            tabBarLabel: t("common:tab_interviews", { defaultValue: "Applications" }),
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
          // Refetch the moment the user navigates AWAY from this tab, not
          // just on app foreground/mount — the common path for clearing
          // one of these badges is opening Job Alerts/Weekly Career
          // Report/Daily Industry News (all reached from inside this tab),
          // which marks it seen server-side, then backing out. Catching
          // that here means the tab bar badge updates right away instead
          // of waiting for the next app foreground.
          listeners={{ blur: () => refreshMenuBadges() }}
          options={{
            // Renamed from "Profile" per explicit request — this tab is the
            // Settings/More menu (My Documents, Job Alerts, Weekly Career
            // Report, Logout, etc.), not an actual profile screen, so the
            // old label was misleading. Route name/param key ("Profile")
            // stays as-is — only the user-facing label changes — to avoid
            // touching every navigate('Profile', ...) call site elsewhere.
            tabBarLabel: t("common:tab_profile", { defaultValue: "Menu" }),
            tabBarIcon: ({ focused }) => (
              <ButtonTab focused={focused} icon="more" numberNotification={menuBadgeCount} />
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
        name={feedbackNotif?.title ?? t('common:default_coach_name', { defaultValue: 'Your AI Coach' })}
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -46,
    paddingTop: 12,
    backgroundColor: "background-basic-color-2",
    borderColor: "transparent",
    borderTopWidth: -1,
    // Redesign v2 (full reskin): soft ambient lift above the tab bar
    // (matches globalStyle.shadowFade) instead of the flat borderless bar
    // from the earlier ZipRecruiter direction — a visible seam between the
    // bar and the screen content above it is part of the reference look.
    // shadowColor/Offset/Opacity/Radius below are iOS-only (Android
    // ignores them entirely); elevation is Android-only (iOS ignores it) —
    // so `elevation: 0` per the "remove Android shadows, leave iOS alone"
    // request removes the tab bar's shadow on Android specifically without
    // touching iOS's shadow at all.
    shadowColor: "rgba(31, 41, 84, 0.35)",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 0,
  },
  // The colored pill behind the active tab's icon (see ButtonTab above).
  activePill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "color-primary-100",
    justifyContent: "center",
    alignItems: "center",
  },
  styleLabel: {
    fontFamily: "PlusJakartaSans-Medium",
    fontSize: 11,
    lineHeight: 24,
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
