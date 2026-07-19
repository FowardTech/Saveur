import React from "react";
import {
  View,
  StyleSheet,
  ImageRequireSource,
  ViewStyle,
  TouchableOpacity,
  Image,
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
  isOnl: boolean;
  visible: boolean;
  show(): void;
  hide(): void;
  message?: string;
}

function ModalRequest({
  name,
  onDetails,
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
          style={{
            width: width - 80,
            height: 334 * (height / 812),
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          <Image
            source={Images.modalBg}
            style={{
              width: width - 80,
              height: 334 * (height / 812),
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
            }}
          />
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
                children={message ?? ` accepted your interview request.`}
              />
            </Text>
          </Flex>
          <View style={styles.buttonView}>
            <TouchableOpacity
              activeOpacity={0.54}
              onPress={hide}
              style={[
                styles.btnOk,
                {
                  borderColor: themes["color-basic-300"],
                },
              ]}
            >
              <Text
                category="para-m"
                center
                status={"placeholder"}
                mt={16}
                mb={10}
              >
                Send a message
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.54}
              onPress={onDetails !== undefined ? onDetails : hide}
            >
              <Text category="h7" status={"link"} center mt={16} mb={20}>
                OK, Thanks!
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
    borderRadius: 24,
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
    borderTopWidth: 1,
    borderBottomWidth: 1,
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
