import React from "react";
import {
  View,
  StyleSheet,
  ImageRequireSource,
  ViewStyle,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import { useTheme, Avatar, Layout } from "@ui-kitten/components";
import { useTranslation } from "react-i18next";

import Text from "./Text";
import useLayout from "hooks/useLayout";
import { Images } from "assets/images";
import Flex from "./Flex";
interface ModalConfirmProps {
  name: string;
  style?: ViewStyle;
  avatar?: ImageRequireSource;
  onDetails?(): void;
  // Was hardcoded to "OK, Thanks!" — fine for the original "dismiss this
  // acknowledgement" use (feedback-ready), but the ad popup
  // (src/home/HomeSrc.tsx) wants its single action to read as an actual
  // "go look at this" prompt rather than a plain acknowledgement, since
  // tapping it there navigates to AdDetails.tsx instead of just dismissing.
  detailsLabel?: string;
  // When onDetails is a real navigation/action (e.g. the ad popup's "View
  // Details" opening AdDetails.tsx), the whole card no longer doubles as a
  // dismiss control the way it did when its only action was a plain
  // acknowledgement — tapping outside still closes it, but that's not
  // discoverable as an explicit "no thanks" choice. Set this to show a
  // second, explicit Cancel action next to onDetails so the two intents
  // (view vs. dismiss) aren't collapsed into one button.
  showCancel?: boolean;
  cancelLabel?: string;
  isOnl: boolean;
  visible: boolean;
  show(): void;
  hide(): void;
  message?: string;
}

function ModalRequest({
  name,
  onDetails,
  detailsLabel,
  showCancel,
  cancelLabel,
  avatar,
  visible,
  hide,
  show,
  style,
  isOnl,
  message,
}: ModalConfirmProps) {
  const { t } = useTranslation("common");
  const { width, height, bottom } = useLayout();
  const themes = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable onPress={hide} style={styles.container}>
        <Layout
          level="1"
          style={{
            width: width - 80,
            height: 334 * (height / 812),
            // Google-style furnishing pass (see styles/globalStyle.ts's
            // `card`) -- 14 -> 20.
            borderRadius: 8,
            overflow: "hidden",
            // Was a decorative Image (Images.modalBg — scattered pastel
            // polka-dot/confetti shapes) covering the whole card. Plain
            // Layout background per explicit request; `level="1"` is
            // UI Kitten's flat white/basic surface, not a themed tint.
          }}
        >
          <View style={styles.avatarView}>
            <Avatar
              source={avatar ? avatar : Images.avatar}
              size={"large"}
              style={styles.avatar}
              shape="rounded"
            />
            <View
              style={[
                styles.onlineIcon,
                {
                  backgroundColor: !isOnl
                    ? themes["color-warning-100"]
                    : themes["color-success-100"],
                  borderColor: themes["background-basic-color-2"],
                },
              ]}
            />
          </View>
          <Flex
            mh={32}
            mt={32}
            style={{
              maxWidth: 231 * (width / 375),
              backgroundColor: "transparent",
            }}
          >
            <Text category="h7" center>
              {name}
              <Text
                category="para-m"
                ml={4}
                children={message ?? t('common:accepted_interview_request', { defaultValue: ' accepted your interview request.' })}
              />
            </Text>
          </Flex>
          <View
            style={[
              styles.buttonView,
              styles.btnOk,
              { borderColor: themes["color-basic-300"] },
              showCancel ? styles.btnRow : undefined,
            ]}
          >
            {showCancel ? (
              <TouchableOpacity
                activeOpacity={0.54}
                onPress={hide}
                style={styles.btnHalf}
              >
                <Text category="h7" status="basic" center mt={16} mb={20}>
                  {cancelLabel ?? t('cancel', { defaultValue: 'Cancel' })}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              activeOpacity={0.54}
              onPress={onDetails !== undefined ? onDetails : hide}
              style={
                showCancel
                  ? [styles.btnHalf, styles.btnDivider, { borderColor: themes["color-basic-300"] }]
                  : undefined
              }
            >
              <Text category="h7" status={"link"} center mt={16} mb={20}>
                {detailsLabel ?? t('common:ok_thanks', { defaultValue: 'OK, Thanks!' })}
              </Text>
            </TouchableOpacity>
          </View>
        </Layout>
      </Pressable>
    </Modal>
  );
}

export default ModalRequest;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(30, 31, 32, 0.86)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    flex: 1,
    // Google-style furnishing pass (see styles/globalStyle.ts's `card`) --
    // 14 -> 20.
    borderRadius: 8,
  },
  avatarView: {
    alignSelf: "center",
    marginTop: 40,
  },
  buttonView: {
    marginTop: 32,
  },
  button: {
    marginTop: 12,
  },
  avatar: {
    alignSelf: "center",
    marginTop: 16,
  },
  btnOk: {
    // Was borderTopWidth + borderBottomWidth, boxing in a "Send a message"
    // row that sat above "OK, Thanks!" — now that row is gone, just a top
    // divider separating the single remaining action from the text above.
    borderTopWidth: 1,
  },
  btnRow: {
    flexDirection: "row",
  },
  btnHalf: {
    flex: 1,
  },
  btnDivider: {
    borderLeftWidth: 1,
  },
  onlineIcon: {
    width: 16,
    height: 16,
    position: "absolute",
    borderRadius: 99,
    borderWidth: 2,
    bottom: 0,
    right: 0,
  },
});
