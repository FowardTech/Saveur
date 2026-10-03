import React from "react";
import { StyleSheet, View, TouchableOpacity } from "react-native";
import LinearGradient from "react-native-linear-gradient";

import Text from "components/Text";
import {
  useStyleSheet,
  StyleService,
  useTheme,
  Icon,
  Layout,
} from "@ui-kitten/components";
import { NotificationProps } from "constants/Types";
import Flex from "components/Flex";
import dayjs from "utils/dayjs";
import { globalStyle } from "styles/globalStyle";

// Renders a single row in the real in-app notification list
// (src/home/Notification/index.tsx). Kept the original filename since
// nothing outside this folder imports it, but the props/content now map
// directly onto NotificationProps from the real GET /api/v1/notifications
// response instead of the old caregiver-marketplace "applications" mock.
//
// Was just a bare 8px dot + three lines of plain text with no card, no
// icon, and no visual distinction between notification kinds — looked
// "too plain" next to every other list in the app (Job Alerts, Referral
// Program, etc.), which all use a rounded Layout card with a colored icon
// circle up front. Restyled to match that same language: a leading
// per-kind icon circle, a card container (unread ones get a subtle tinted
// background + accent-colored icon, matching JobAlerts.tsx's unread
// treatment), and a small unread dot beside the timestamp instead of a
// large one competing with the icon for attention.
export interface NotificationItemProps {
  item: NotificationProps;
  onPress?(): void;
}

// Per-kind icon + color — kinds come from the backend's Notification.kind
// column (see saveur-backend/app/services/job_search_service.py's
// "job_alert", app/api/goals.py's "goal_tip", app/api/interviews.py's
// "feedback_ready", app/api/admin.py's send_campaign "admin_broadcast" —
// the admin dashboard's Notifications page composer). Anything else (a
// plain/system notification with no recognized kind) falls back to a
// generic bell.
// Product follow-up ("give icons a linear gradient background in key
// places the way you did for the settings icons") -- same two-stop
// diagonal LinearGradient badge treatment as src/more/components/
// ButtonOptional.tsx's iconWrapGradient, one fixed gradient pair per kind
// (reusing that same MoreSrc.tsx ICON_GRADIENTS palette by hue) instead of
// the old flat transparent-tint fill. Icon glyph renders solid white on
// top, same as every other gradient-badge spot in the app.
const KIND_STYLE: Record<string, {icon: string; gradient: [string, string]}> = {
  job_alert: {icon: 'briefcase-outline', gradient: ['#2d76dbff', '#3B9DFF']}, // blue
  goal_tip: {icon: 'bulb-outline', gradient: ['#dd8039ff', '#FBBF24']}, // amber
  feedback_ready: {icon: 'checkmark-circle-2-outline', gradient: ['#28b35bff', '#4ADE80']}, // green
  admin_broadcast: {icon: 'radio-outline', gradient: ['#1ca3c8ff', '#22D3EE']}, // teal/cyan
};
const FALLBACK_GRADIENT: [string, string] = ['#5d636eff', '#9CA3AF']; // slate/gray

const ApplicationItem = ({ item, onPress }: NotificationItemProps) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();

  const kindStyle = (item.type && KIND_STYLE[item.type]) || {icon: 'bell-outline', gradient: FALLBACK_GRADIENT};

  return (
    <TouchableOpacity activeOpacity={item.read ? 1 : 0.7} onPress={onPress} disabled={item.read}>
      <Layout
        level="2"
        style={[
          styles.card,
          !item.read && {borderColor: theme['color-primary-500'], borderWidth: 1},
        ]}>
        <Flex justify="flex-start" style={globalStyle.flexOne}>
          <View style={styles.iconCircle}>
            <LinearGradient
              colors={kindStyle.gradient}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={StyleSheet.absoluteFillObject}
            />
            <Icon pack="eva" name={kindStyle.icon} style={[styles.icon, {tintColor: '#FFFFFF'}]} />
          </View>
          <View style={styles.body}>
            <Text category="h8" bold={!item.read} numberOfLines={2}>
              {item.title}
            </Text>
            <Text category="h9-s" status="placeholder" mt={4} numberOfLines={3}>
              {item.message}
            </Text>
            <Flex justify="flex-start" itemsCenter mt={8}>
              <Text category="h10" status="placeholder">
                {dayjs(item.createdAt).fromNow()}
              </Text>
              {!item.read ? (
                <View style={[styles.dot, {backgroundColor: theme['color-primary-solid']}]} />
              ) : null}
            </Flex>
          </View>
        </Flex>
      </Layout>
    </TouchableOpacity>
  );
};

export default ApplicationItem;

const themedStyles = StyleService.create({
  card: {
    ...globalStyle.card,
    flexDirection: 'row',
    padding: 8,
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    // overflow: 'hidden' clips the absolutely-filled LinearGradient
    // sibling to this circle's own rounded corners -- same pattern as
    // ButtonOptional.tsx's iconWrapGradient.
    overflow: 'hidden',
  },
  icon: {
    width: 22,
    height: 22,
  },
  body: {
    flex: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 8,
  },
});
