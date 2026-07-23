import React, { memo } from "react";
import { Alert, View } from "react-native";
import { pick, isErrorWithCode, errorCodes, types as documentTypes } from "@react-native-documents/picker";
import * as ImagePicker from "react-native-image-picker";
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

import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { RootStackParamList, MessagesStackParamList } from "navigation/types";
import AttachItem from "./Components/AttachItem";
import BrandWordmark from "components/BrandWordmark";
import { CoachChatMessageProps, Practice_Mode_Enum } from "constants/Types";
import * as coachService from "services/coachService";
import * as resumeService from "services/resumeService";
import { ImportedFileInfo } from "services/resumeService";
import { AuthContext } from "../../AuthContext";
import VoiceCoachView from "./VoiceCoachView";
import * as configService from "services/configService";

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
  const route = useRoute<RouteProp<MessagesStackParamList, 'Chat'>>();
  const { initialPrompt } = route.params ?? {};
  const { profile } = React.useContext(AuthContext);

  const [showAction, setShowAction] = React.useState(false);
  // Voice is the default mode per product direction ("instead of it being
  // a text chat it should be a AI voice responding to the user") — Text
  // stays available as a toggle rather than being removed outright, since
  // both modes share the exact same persisted conversation thread (see
  // coachService.sendVoiceMessage's doc comment). Arriving here with a
  // pre-composed `initialPrompt` (a "Suggested Topic" tap on the Coach
  // tab) starts in Text mode instead — that flow auto-sends a specific
  // typed question via the text pipeline below, which wouldn't feed into
  // the voice conversation loop.
  // Admin-configurable — see the Feature Flags page / services/configService.ts.
  // Turning "voice_coach" off falls back to text-only, no release needed.
  const voiceCoachEnabled = configService.isFeatureEnabled('voice_coach');
  const [mode, setMode] = React.useState<'voice' | 'text'>(
    initialPrompt || !voiceCoachEnabled ? 'text' : 'voice',
  );

  React.useEffect(() => {
    coachService.getChatHistory().then(history => {
      // GiftedChat renders newest-first.
      setMessages([...history].reverse().map(toGiftedMessage));
    });
  }, []);

  // Arrived here from a "Suggested Topic" tap on the Coach tab — see below,
  // after onSend is defined, for the effect that actually fires this.
  const hasSentInitialPromptRef = React.useRef(false);

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
      const { coachMessage } = await coachService.sendMessage(draft.text, {
        goals: profile?.goals,
        industries: profile?.industries,
        desiredRoles: profile?.desiredRoles,
        preferredCountries: profile?.preferredCountries,
      });
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
  }, [isSending, profile]);

  // Arrived here from a "Suggested Topic" tap on the Coach tab
  // (src/messages/MessagesScreen.tsx) — auto-send that topic's text as the
  // opening question instead of dropping the user on a blank thread. Guarded
  // by a ref (not state) so this only ever fires once per screen visit, even
  // though `messages` above updates asynchronously right after mount.
  React.useEffect(() => {
    if (!initialPrompt || hasSentInitialPromptRef.current) return;
    hasSentInitialPromptRef.current = true;
    onSend([{ _id: `topic_${Date.now()}`, text: initialPrompt, createdAt: Date.now(), user: ME_USER }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

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

  // Appends a small local confirmation bubble (not sent to the backend —
  // just visual feedback that the upload actually happened) after a
  // successful attach/camera/photo-library action below.
  const appendAttachmentNotice = React.useCallback((file: ImportedFileInfo) => {
    setMessages(previous =>
      GiftedChat.append(previous, [
        {
          _id: `attach_${Date.now()}`,
          text: `📎 Attached: ${file.name}`,
          createdAt: Date.now(),
          user: ME_USER,
        },
      ]),
    );
  }, []);

  const [isAttaching, setIsAttaching] = React.useState(false);
  const uploadAttachment = React.useCallback(
    async (file: ImportedFileInfo | null, key: 'resume' | 'portfolio') => {
      if (!file || isAttaching) return;
      setIsAttaching(true);
      try {
        // Reused from the same real upload path as ResumeBuilder's import
        // cards (POST /resume/upload — see services/resumeService.ts) —
        // there's no separate "chat attachment" endpoint, so a file shared
        // here becomes part of the user's resume/portfolio sources the AI
        // coach and resume tools can already reference.
        await resumeService.importSource(key, file);
        appendAttachmentNotice(file);
      } catch (e: any) {
        Alert.alert(
          "Upload failed",
          e?.message ?? "Something went wrong. Please try again.",
        );
      } finally {
        setIsAttaching(false);
      }
    },
    [isAttaching, appendAttachmentNotice],
  );

  const onAttach = React.useCallback(async () => {
    try {
      const [result] = await pick({
        type: [documentTypes.pdf, documentTypes.doc, documentTypes.docx, documentTypes.plainText, documentTypes.images],
      });
      await uploadAttachment(
        { uri: result.uri, name: result.name ?? 'Selected file', sizeBytes: result.size, mimeType: result.type },
        'resume',
      );
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert("Upload failed", "Something went wrong. Please try again.");
    }
  }, [uploadAttachment]);

  const onCamera = React.useCallback(() => {
    ImagePicker.launchCamera({ mediaType: 'photo', saveToPhotos: false }, response => {
      const asset = response.assets?.[0];
      if (response.didCancel || !asset?.uri) return;
      uploadAttachment(
        { uri: asset.uri, name: asset.fileName ?? 'Photo.jpg', sizeBytes: asset.fileSize, mimeType: asset.type },
        'portfolio',
      );
    });
  }, [uploadAttachment]);

  const onPhotoLibrary = React.useCallback(() => {
    ImagePicker.launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 }, response => {
      const asset = response.assets?.[0];
      if (response.didCancel || !asset?.uri) return;
      uploadAttachment(
        { uri: asset.uri, name: asset.fileName ?? 'Photo.jpg', sizeBytes: asset.fileSize, mimeType: asset.type },
        'portfolio',
      );
    });
  }, [uploadAttachment]);

  // Routes to the real, already-working video interview flow
  // (LiveInterviewSession, Video mode) via MockInterviewSetup so the user can
  // still pick a role/company/duration first — rather than the old
  // VideoCall.tsx, a leftover static-image placeholder from the pre-Saveur
  // template with no real camera, session, or AI question flow at all.
  const onMakeCall = React.useCallback(() => {
    navigate("MockInterviewSetup", { mode: Practice_Mode_Enum.Video });
  }, [navigate]);
  const onViewProgress = React.useCallback(() => {
    navigate("MyProgress");
  }, [navigate]);

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
            onCamera={onCamera}
            onPhotoLibrary={onPhotoLibrary}
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
    [showAction, Platform.OS, keyboardShow, onCamera, onPhotoLibrary]
  );

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
        accessoryRight={
          voiceCoachEnabled ? (
            <NavigationAction
              title={mode === 'voice' ? 'Text' : 'Voice'}
              titleStatus="link"
              onPress={() => setMode(m => (m === 'voice' ? 'text' : 'voice'))}
            />
          ) : undefined
        }
      />
      {mode === 'voice' ? (
        <VoiceCoachView
          userContext={{
            goals: profile?.goals,
            industries: profile?.industries,
            desiredRoles: profile?.desiredRoles,
            preferredCountries: profile?.preferredCountries,
          }}
        />
      ) : (
      <>
      {/* Was a KeyboardAwareScrollView (scrollEnabled={false}, used only for
          its automatic keyboard-follow behavior, never for actual
          scrolling) — that's still a ScrollView, and GiftedChat renders its
          message list as a FlatList internally, so nesting them triggered
          RN's "VirtualizedLists should never be nested inside plain
          ScrollViews with the same orientation" warning (and the windowing
          bugs that warning exists to prevent). That was fixed by swapping in
          a manual KeyboardAvoidingView here — but GiftedChat already wraps
          itself in its own keyboard-avoiding container by default
          (isKeyboardInternallyHandled defaults to true), so this outer one
          was stacking a second "padding" offset on top of GiftedChat's own,
          pushing the whole screen (message list AND input toolbar) up by
          roughly double the keyboard height — reported as "the keyboard is
          pushing the UI upward... input field and other things not
          visible." A plain View has no scroll-container conflict and lets
          GiftedChat's internal handling do its job unopposed. */}
      <View style={styles.container}>
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
      </View>
      </>
      )}
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
