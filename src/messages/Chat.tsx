import React, { memo } from "react";
import { Alert, TouchableOpacity, View } from "react-native";
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
import { useTranslation } from "react-i18next";
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
import Text from "components/Text";
import { CoachChatMessageProps, Practice_Mode_Enum } from "constants/Types";
import { NEW_JOB_COURSE_TITLE, NEW_JOB_COURSE_MODULES } from "constants/Data";
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

// gifted-chat's IMessage is a loose interface — carrying this extra field
// straight through lets renderCustomView below (per-message) know whether
// to show the "Learn more about X" chip, without a parallel lookup
// structure keyed by message id.
interface CoachIMessage extends IMessage {
  suggestedCourseTopic?: string;
  suggestedAction?: 'mock_interview' | 'daily_challenge';
}

// Same module/tier length "Learn Anything" custom topics use — see
// src/more/LearningCourses.tsx's CUSTOM_TOPIC_MODULES. Not imported
// directly to avoid exporting a screen-local constant just for this;
// keep the two in sync if that value ever changes.
const COACH_SUGGESTED_COURSE_MODULES = 5;

// Maps a persisted CoachChatMessageProps (see services/coachService.ts) to
// the IMessage shape react-native-gifted-chat expects.
const toGiftedMessage = (msg: CoachChatMessageProps): CoachIMessage => ({
  _id: msg.id,
  text: msg.text,
  createdAt: msg.createdAt,
  user: msg.role === "user" ? ME_USER : COACH_USER,
  suggestedCourseTopic: msg.suggestedCourseTopic,
  suggestedAction: msg.suggestedAction,
});

// Real AI coach chat — see services/coachService.ts, backed by
// POST /api/v1/coach/advice. History is cached to AsyncStorage so it
// survives navigating away from this screen and back (the cache itself is
// not the source of truth — see coachService's comment on why history
// read/clear stay local for now).
const Chat = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(["message", "common", "more"]);
  const { width, bottom } = useLayout();
  const { keyboardShow } = useKeyboard();
  const [messages, setMessages] = React.useState<CoachIMessage[]>([]);
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
        t("message:coach_unavailable_title", { defaultValue: "Coach unavailable" }),
        e?.message ?? t("message:coach_unavailable_body", {
          defaultValue: "Couldn't reach your AI coach. Please try again.",
        })
      );
    } finally {
      setIsSending(false);
    }
  }, [isSending, profile, t]);

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

  // Appends a small confirmation bubble after a successful attach/camera/
  // photo-library action below. Was setMessages-only (React state, nothing
  // persisted) — the bubble looked fine until the user navigated away and
  // back, at which point getChatHistory() re-read the AsyncStorage thread
  // and this notice simply wasn't in it, so it silently disappeared. Now
  // persists via coachService.appendLocalNote (same store sendMessage
  // writes to) so it's part of the real thread, same as everything else.
  const appendAttachmentNotice = React.useCallback((file: ImportedFileInfo) => {
    coachService.appendLocalNote(
      t("message:attachment_note", { defaultValue: "📎 Attached: {{fileName}}", fileName: file.name }),
    ).then(note => {
      setMessages(previous => GiftedChat.append(previous, [toGiftedMessage(note)]));
    });
  }, [t]);

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
          t("more:upload_failed", { defaultValue: "Upload failed" }),
          e?.message ?? t("common:something_went_wrong", {
            defaultValue: "Something went wrong. Please try again.",
          }),
        );
      } finally {
        setIsAttaching(false);
      }
    },
    [isAttaching, appendAttachmentNotice, t],
  );

  const onAttach = React.useCallback(async () => {
    try {
      const [result] = await pick({
        type: [documentTypes.pdf, documentTypes.doc, documentTypes.docx, documentTypes.plainText, documentTypes.images],
      });
      await uploadAttachment(
        {
          uri: result.uri,
          name: result.name ?? t("message:selected_file_fallback", { defaultValue: "Selected file" }),
          sizeBytes: result.size,
          mimeType: result.type,
        },
        'resume',
      );
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert(
        t("more:upload_failed", { defaultValue: "Upload failed" }),
        t("common:something_went_wrong", { defaultValue: "Something went wrong. Please try again." }),
      );
    }
  }, [uploadAttachment, t]);

  const onCamera = React.useCallback(() => {
    ImagePicker.launchCamera({ mediaType: 'photo', saveToPhotos: false }, response => {
      const asset = response.assets?.[0];
      if (response.didCancel || !asset?.uri) return;
      uploadAttachment(
        {
          uri: asset.uri,
          name: asset.fileName ?? t("message:photo_fallback_name", { defaultValue: "Photo.jpg" }),
          sizeBytes: asset.fileSize,
          mimeType: asset.type,
        },
        'portfolio',
      );
    });
  }, [uploadAttachment, t]);

  const onPhotoLibrary = React.useCallback(() => {
    ImagePicker.launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 }, response => {
      const asset = response.assets?.[0];
      if (response.didCancel || !asset?.uri) return;
      uploadAttachment(
        {
          uri: asset.uri,
          name: asset.fileName ?? t("message:photo_fallback_name", { defaultValue: "Photo.jpg" }),
          sizeBytes: asset.fileSize,
          mimeType: asset.type,
        },
        'portfolio',
      );
    });
  }, [uploadAttachment, t]);

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

  // Tapping a coach reply's "Learn more about X" chip (see renderCustomView
  // below) jumps straight into that topic as a real course — same
  // shape/level as LearningCourses.tsx's catalog "Start" button
  // (CourseSession accepts any free-text topic, not just a fixed catalog),
  // skipping the manual career-path picker/topic-check step entirely since
  // the coach already vetted this as a real, specific professional topic
  // worth a course.
  const onStartSuggestedCourse = React.useCallback((topic: string) => {
    navigate('CourseSession', { topic, totalModules: COACH_SUGGESTED_COURSE_MODULES, level: 'basic' });
  }, [navigate]);

  // Product request item: "the AI coach can ask the user if they want the
  // coach to navigate to the specific screen... and the app will navigate
  // automatically" — see app/api/coach.py's SUGGESTED_ACTION marker. Mock
  // Interviews, the Daily Challenge (a Home-tab card, no dedicated route of
  // its own), and — new-job/first-job coaching track product request item —
  // the "Starting Your New Job" Learning Course are the three real
  // destinations the backend can name.
  const onRunSuggestedAction = React.useCallback((action: 'mock_interview' | 'daily_challenge' | 'new_job_course') => {
    if (action === 'mock_interview') {
      navigate('MockInterviewSetup', {});
    } else if (action === 'new_job_course') {
      navigate('CourseSession', {
        topic: NEW_JOB_COURSE_TITLE,
        totalModules: NEW_JOB_COURSE_MODULES,
        level: 'basic',
      });
    } else {
      // Daily Challenge lives as a card on the Home tab, not a dedicated
      // route — same "jump to Home tab" navigation MoreSrc.tsx and
      // navigationRef.ts already use elsewhere in the app.
      navigate('MainBottomTab', { screen: 'Home' });
    }
  }, [navigate]);

  const renderCustomView = React.useCallback((props: any) => {
    const topic: string | undefined = props?.currentMessage?.suggestedCourseTopic;
    if (topic) {
      return (
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.suggestedCourseChip, { backgroundColor: theme['color-primary-transparent-200'] }]}
          onPress={() => onStartSuggestedCourse(topic)}
        >
          <Icon pack="eva" name="book-open-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
          <Text
            category="h10"
            bold
            style={{ color: theme['color-primary-500'], marginLeft: 6 }}
            numberOfLines={1}
          >
            {t("message:learn_more_about_topic", { defaultValue: "Learn more about {{topic}}", topic })}
          </Text>
        </TouchableOpacity>
      );
    }
    const action: 'mock_interview' | 'daily_challenge' | 'new_job_course' | undefined = props?.currentMessage?.suggestedAction;
    if (action) {
      const label = action === 'mock_interview'
        ? t('message:suggested_action_mock_interview', { defaultValue: 'Start a mock interview' })
        : action === 'new_job_course'
        ? t('message:suggested_action_new_job_course', { defaultValue: 'Get ready for your new job' })
        : t('message:suggested_action_daily_challenge', { defaultValue: "Try today's Daily Challenge" });
      const icon = action === 'mock_interview' ? 'mic-outline' : action === 'new_job_course' ? 'briefcase-outline' : 'flash-outline';
      return (
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.suggestedCourseChip, { backgroundColor: theme['color-primary-transparent-200'] }]}
          onPress={() => onRunSuggestedAction(action)}
        >
          <Icon pack="eva" name={icon} style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
          <Text
            category="h10"
            bold
            style={{ color: theme['color-primary-500'], marginLeft: 6 }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </TouchableOpacity>
      );
    }
    return null;
  }, [styles.suggestedCourseChip, theme, onStartSuggestedCourse, onRunSuggestedAction, t]);

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
        title={t("message:ai_coach_name", { defaultValue: "AI Career Coach" })}
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          voiceCoachEnabled ? (
            <NavigationAction
              title={
                mode === 'voice'
                  ? t("message:mode_text", { defaultValue: "Text" })
                  : t("message:mode_voice", { defaultValue: "Voice" })
              }
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
          onSuggestedAction={onRunSuggestedAction}
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
              renderCustomView={renderCustomView}
              messagesContainerStyle={{ paddingBottom: 32 }}
              renderInputToolbar={renderInputToolbar}
              // gifted-chat's Composer has its own hardcoded default text color
              // (dark gray/black) with no idea this app has a dark theme --
              // without these it renders unreadable dark-on-dark text in the
              // input pill. textInputStyle covers what's actually typed;
              // placeholderTextColor covers the empty-state hint text.
              textInputStyle={{ color: theme['text-basic-color'] }}
              placeholderTextColor={theme['text-hint-color']}
              // BUG FIX (product report: "Coach Text chat is not translating —
              // renders in English even when the language is changed"): with no
              // `placeholder` prop, gifted-chat's Composer falls back to its own
              // hardcoded English default ("Type a message..."), which is the
              // single most visible string on this screen (the empty input
              // field) and was rendering in English regardless of app language.
              placeholder={t("message:chat_input_placeholder", { defaultValue: "Type a message..." })}
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
                    title={t("message:attach_resume_files", { defaultValue: "Attach Resume / Files" })}
                    icon={"attach"}
                    _onPress={onAttach}
                  />
                  <AttachItem
                    title={t("message:start_video_practice", { defaultValue: "Start Video Practice" })}
                    icon={"call"}
                    _onPress={onMakeCall}
                  />
                  <AttachItem
                    title={t("message:view_my_progress", { defaultValue: "View My Progress" })}
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
    fontFamily: "PlusJakartaSans-Regular",
  },
  rightTextStyle: {
    color: "text-primary-color",
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 24,
    fontFamily: "PlusJakartaSans-Regular",
  },
  wrapperLeftStyle: {
    borderBottomLeftRadius: 4,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  wrapperRightStyle: {
    borderBottomRightRadius: 4,
    borderRadius: 16,
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
  suggestedCourseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 99,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 6,
  },
});
