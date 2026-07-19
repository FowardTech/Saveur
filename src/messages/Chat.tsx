import React, { memo } from "react";
import { Alert, View } from "react-native";
import {
  Bubble,
  GiftedChat,
  IMessage,
  Send,
  InputToolbarProps,
  InputToolbar,
  SendProps,
  MessageImage,
  BubbleProps,
} from "react-native-gifted-chat";
import {
  Icon,
  StyleService,
  TopNavigation,
  useStyleSheet,
  useTheme,
  Layout,
} from "@ui-kitten/components";
import useLayout from "hooks/useLayout";
import Container from "components/Container";
import NavigationAction from "components/NavigationAction";
import { globalStyle } from "styles/globalStyle";
import { Platform } from "react-native";
import Flex from "components/Flex";
import Composer from "./Components/Composer";
import useKeyboard from "hooks/useKeyboard";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { NavigationProp, useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "navigation/types";
import AttachItem from "./Components/AttachItem";
import BrandWordmark from "components/BrandWordmark";
import { CoachChatMessageProps } from "constants/Types";
import * as coachService from "services/coachService";

// No avatar image asset — the coach's avatar is the live-drawn Saveur brand
// orb (see renderAvatar below), same mark used on the Login screen and
// onboarding art, instead of the old "Care.n" logo.png raster asset.
const COACH_USER = { _id: 2, name: "AI Career Coach" };
const ME_USER = { _id: 1 };

// Maps a persisted CoachChatMessageProps (see services/coachService.ts) to
// the IMessage shape react-native-gifted-chat expects.
const toGiftedMessage = (msg: CoachChatMessageProps): IMessage => ({
  _id: msg.id,
  text: msg.text,
  createdAt: msg.createdAt,
  user: msg.role === "user" ? ME_USER : COACH_USER,
});

// Real AI coach chat — see services/coachService.ts, backed by
// POST /api/v1/coach/advice. History is cached to AsyncStorage so it
// survives navigating away from this screen and back (the cache itself is
// not the source of truth — see coachService's comment on why history
// read/clear stay local for now).
const Chat = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { width, bottom } = useLayout();
  const { keyboardShow } = useKeyboard();
  const [messages, setMessages] = React.useState<IMessage[]>([]);
  const [isSending, setIsSending] = React.useState(false);
  const theme = useTheme();
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();

  const [showAction, setShowAction] = React.useState(false);

  React.useEffect(() => {
    coachService.getChatHistory().then(history => {
      // GiftedChat renders newest-first.
      setMessages([...history].reverse().map(toGiftedMessage));
    });
  }, []);

  React.useEffect(() => {
    if (keyboardShow) {
      setShowAction(false);
    }
  }, [keyboardShow]);

  const onSend = React.useCallback(async (outgoing: IMessage[] = []) => {
    const draft = outgoing[0];
    if (!draft || !draft.text || isSending) return;
    // Optimistically show the user's message immediately.
    setMessages(previous => GiftedChat.append(previous, [draft]));
    setIsSending(true);
    try {
      const { coachMessage } = await coachService.sendMessage(draft.text);
      setMessages(previous => GiftedChat.append(previous, [toGiftedMessage(coachMessage)]));
    } catch (e: any) {
      // Real network call now — the coach can actually fail (offline, 5xx,
      // timeout). The user's message stays visible (optimistic append above
      // already happened, and coachService persists it too) but no reply
      // arrives, so surface it instead of leaving the chat hanging silently.
      Alert.alert(
        "Coach unavailable",
        e?.message ?? "Couldn't reach your AI coach. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  }, [isSending]);

  const renderBubble = React.useCallback((props: BubbleProps<IMessage>) => {
    return (
      <Bubble
        {...props}
        wrapperStyle={{
          left: [
            styles.wrapperLeftStyle,
            {
              backgroundColor: props.currentMessage?.image
                ? "transparent"
                : theme["background-basic-color-3"],
            },
            { maxWidth: 267 * (width / 375) },
          ],
          right: [
            styles.wrapperRightStyle,
            {
              backgroundColor: props.currentMessage?.image
                ? "transparent"
                : theme["button-basic-color"],
            },
            { maxWidth: 267 * (width / 375) },
          ],
        }}
        textStyle={{
          left: styles.leftTextStyle,
          right: styles.rightTextStyle,
        }}
      />
    );
  }, []);
  const renderSend = (props: SendProps<IMessage>) => (
    <Send {...props} containerStyle={styles.containerSend}>
      <Icon pack="assets" name="send" style={styles.iconSend} />
    </Send>
  );

  const renderInputToolbar = React.useCallback(
    (props: InputToolbarProps) => (
      <InputToolbar
        {...props}
        containerStyle={{
          backgroundColor: theme["background-basic-color-2"],
        }}
        primaryStyle={{
          alignItems: "center",
          backgroundColor: theme["background-basic-color-3"],
          borderRadius: 8,
          marginRight: 16,
          marginTop: 8,
          marginBottom: Platform.OS === "android" ? 8 : 24,
          marginLeft: keyboardShow ? 56 : 144,
        }}
        accessoryStyle={{
          position: "absolute",
          bottom: 0,
        }}
        renderAccessory={() => (
          <Composer
            onShowAction={() => setShowAction(!showAction)}
            style={[
              styles.composer,
              {
                bottom: Platform.OS == "ios" ? bottom : 16,
              },
            ]}
          />
        )}
      />
    ),
    [showAction, Platform.OS, keyboardShow]
  );

  // Attach isn't wired to anything real yet (no file-upload endpoint) —
  // separate from the chat itself, which is now backed by coachService.
  const onAttach = React.useCallback(() => {}, []);
  const onMakeCall = React.useCallback(() => {
    navigate("MessagesStack", { screen: "VideoCall" });
  }, []);
  const onViewProgress = React.useCallback(() => {
    navigate("MainBottomTab");
  }, []);

  // Draws the Saveur brand orb for the coach's avatar instead of an <Image>
  // (no logo.png asset needed). Returns null for the current user's own
  // messages so GiftedChat falls back to its default (blank) treatment.
  const renderAvatar = React.useCallback((props: any) => {
    if (props?.currentMessage?.user?._id !== COACH_USER._id) {
      return null;
    }
    return (
      <View style={styles.coachAvatar}>
        <BrandWordmark markOnly size={32} />
      </View>
    );
  }, [styles.coachAvatar]);

  return (
    <Container style={[styles.container, { marginBottom: -bottom }]}>
      <TopNavigation
        title={"AI Career Coach"}
        accessoryLeft={<NavigationAction />}
        accessoryRight={<NavigationAction icon="option" />}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        extraScrollHeight={28}
      >
        <GiftedChat
          user={{ _id: 1 }}
          messages={messages}
          onSend={onSend}
          renderBubble={renderBubble}
          renderAvatar={renderAvatar}
          imageStyle={{}}
          renderTime={() => null}
          renderSend={renderSend}
          messagesContainerStyle={{ paddingBottom: 32 }}
          renderInputToolbar={renderInputToolbar}
          showUserAvatar
          alwaysShowSend
          renderMessageImage={(props) => {
            return (
              <MessageImage
                {...props}
                containerStyle={{ width: 247, height: 160 }}
                imageStyle={{ width: 247, height: 160 }}
              />
            );
          }}
        />
        {showAction === true ? (
          <Layout level={"3"}>
            <Flex margin={32}>
              <AttachItem
                title={"Attach Resume / Files"}
                icon={"attach"}
                _onPress={onAttach}
              />
              <AttachItem
                title={"Start Video Practice"}
                icon={"call"}
                _onPress={onMakeCall}
              />
              <AttachItem
                title={"View My Progress"}
                icon={"payment"}
                _onPress={onViewProgress}
              />
            </Flex>
          </Layout>
        ) : null}
      </KeyboardAwareScrollView>
    </Container>
  );
});

export default Chat;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  composer: {
    position: "absolute",
    left: 0,
    zIndex: 10,
  },
  containerSend: {
    backgroundColor: "transparent",
  },
  leftTextStyle: {
    color: "text-basic-color",
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 24,
    fontFamily: "GothamPro",
  },
  rightTextStyle: {
    color: "text-primary-color",
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 24,
    fontFamily: "GothamPro",
  },
  wrapperLeftStyle: {
    borderBottomLeftRadius: 4,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  wrapperRightStyle: {
    borderBottomRightRadius: 4,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 8
  },
  iconSend: {
    tintColor: "button-basic-color",
    ...globalStyle.icon24,
    marginBottom: 10,
    marginRight: 12,
  },
  coachAvatar: {
    marginRight: 4,
  },
});
