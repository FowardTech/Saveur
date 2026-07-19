import React from "react";
import { View, TouchableOpacity } from "react-native";

import Text from "components/Text";
import {
  useStyleSheet,
  StyleService,
  useTheme,
} from "@ui-kitten/components";
import { NotificationProps } from "constants/Types";
import Flex from "components/Flex";
import dayjs from "utils/dayjs";

// Renders a single row in the real in-app notification list
// (src/home/Notification/index.tsx). Kept the original filename since
// nothing outside this folder imports it, but the props/content now map
// directly onto NotificationProps from the real GET /api/v1/notifications
// response instead of the old caregiver-marketplace "applications" mock.
export interface NotificationItemProps {
  item: NotificationProps;
  onPress?(): void;
}

const ApplicationItem = ({ item, onPress }: NotificationItemProps) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();

  return (
    <TouchableOpacity activeOpacity={item.read ? 1 : 0.6} onPress={onPress} disabled={item.read}>
      <Flex style={styles.container} justify="flex-start">
        <View
          style={[
            styles.dot,
            {
              backgroundColor: !item.read
                ? theme["color-danger-100"]
                : undefined,
            },
          ]}
        />
        <View style={styles.body}>
          <Text category="h7" bold={!item.read}>
            {item.title}
          </Text>
          <Text category="h8-s" mt={4} numberOfLines={3}>
            {item.message}
          </Text>
          <Text category="h8-s" mt={8} status={"placeholder"}>
            {dayjs(item.createdAt).fromNow()}
          </Text>
        </View>
      </Flex>
    </TouchableOpacity>
  );
};

export default ApplicationItem;

const themedStyles = StyleService.create({
  container: {
    marginBottom: 22,
  },
  body: {
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 24,
    marginRight: 12,
    marginTop: 6,
  },
});
