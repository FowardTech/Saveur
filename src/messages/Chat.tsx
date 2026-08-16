import React, { memo } from "react";
import { Alert, Image, ImageSourcePropType, ImageStyle, Modal, StyleSheet, TouchableOpacity, View } from "react-native";
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
import { CoachChatMessageProps, Practice_Mode_Enum, SuggestedActionId } from "constants/Types";
import * as coachService from "services/coachService";
import { SuggestedTopic } from "services/coachService";
import { ACTION_META, actionTitle, runSuggestedAction } from "services/suggestedActions";
import * as resumeService from "services/resumeService";
import { ImportedFileInfo } from "services/resumeService";
import { AuthContext } from "../../AuthContext";
import VoiceCoachView from "./VoiceCoachView";
import * as configService from "services/configService";
import * as notificationService from "services/notificationService";
import i18n from "i18next";
import { Images } from "assets/images";

// No avatar image asset — the coach's avatar is the live-drawn Saveur brand
// orb (see renderAvatar below), same mark used on the Login screen and
// onboarding art, instead of the old "Care.n" logo.png raster asset.
//
// BUG FIX (final audit): `name` was a raw hardcoded English literal —
// GiftedChat can surface `user.name` in some system-message/accessibility
// contexts depending on props, so it wasn't guaranteed to stay invisible.
// This is a module-level constant (outside any component), so it can't use
// the useTranslation() hook — calling the standalone i18n.t() instance
// directly works the same way here as it does in services/*.ts files.
// Reuses common:default_coach_name, which already existed, fully
// translated in all 12 locales, but had no real call site anywhere in the
// app until now.
const COACH_USER = { _id: 2, name: i18n.t('common:default_coach_name', { defaultValue: 'Your AI Coach' }) };
const ME_USER = { _id: 1 };

// gifted-chat's IMessage is a loose interface — carrying this extra field
// straight through lets renderCustomView below (per-message) know whether
// to show the "Learn more about X" chip, without a parallel lookup
// structure keyed by message id.
interface CoachIMessage extends IMessage {
  suggestedCourseTopic?: string;
  suggestedAction?: SuggestedActionId;
}

// Same module/tier length "Learn Anything" custom topics use — see
// src/more/LearningCourses.tsx's CUSTOM_TOPIC_MODULES. Not imported
// directly to avoid exporting a screen-local constant just for this;
// keep the two in sync if that value ever changes.
const COACH_SUGGESTED_COURSE_MODULES = 5;

// Reference-redesign follow-up ("I want the career coach interface to look
// like the screenshot") — this screen's blank/empty thread used to just be
// an empty white GiftedChat list. Same pastel-tint chip palette
// MessagesScreen.tsx's Suggested Topics grid and Home's "More for you" rows
// already use, kept as its own module constant (rather than importing
// MessagesScreen's) since these are two independent screens.
// REDESIGN (product request: "I want you to use the new icons too in the
// suggested topics bottom sheet") -- `icon`/`iconColor` (plain tintable Eva
// glyphs) replaced with `image`, one of the real full-color icons8 PNGs
// already used elsewhere in this app (assets/images/index.ts). These can't
// be tinted (they're baked full-color source art, not single-color
// glyphs), so the pastel circle backdrop (`bg`) now does the "distinct
// color per topic" job on its own, same as before. Picked for a loose
// thematic match to what the old Eva glyph represented: a chat bubble for
// "message" topics, a rocket for "trending up"/momentum topics (no literal
// trending-up-chart icon in the pack), a lightbulb-in-a-head for "idea"
// topics, and a briefcase-and-gear for "job/career" topics.
const TOPIC_CHIP_STYLES: { bg: string; image: ImageSourcePropType }[] = [
  { bg: 'rgba(139, 92, 246, 0.08)', image: Images.iconCoachChatBlue },
  { bg: 'rgba(126, 168, 226, 0.12)', image: Images.iconRocket },
  { bg: 'rgba(216, 90, 48, 0.08)', image: Images.iconLightbulbHead },
  { bg: 'rgba(29, 158, 117, 0.08)', image: Images.iconBriefcaseGear },
];

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
  const { t, i18n: i18nInstance } = useTranslation(["message", "common", "more"]);
  const { width, bottom } = useLayout();
  const { keyboardShow } = useKeyboard();
  const [messages, setMessages] = React.useState<CoachIMessage[]>([]);
  const [isSending, setIsSending] = React.useState(false);
  const theme = useTheme();
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<MessagesStackParamList, 'Chat'>>();
  const { initialPrompt, openTopicsSheet } = route.params ?? {};
  const { profile } = React.useContext(AuthContext);

  const [showAction, setShowAction] = React.useState(false);
  // Product follow-up (revert of the earlier "voice is the default mode"
  // direction): "the chat icon tab in the bottom navigation will just lead
  // straight to the AI coach screen" — now that the Coach tab drops the
  // user straight into this screen with no intermediate menu (see
  // MainBottomTab.tsx), immediately launching into a live voice-listening
  // session (mic on, full-screen "I'm listening") was too aggressive as a
  // first thing to see. Text mode's own greeting screen (renderChatEmpty
  // below — headline, suggested topics, a "Suggested for you" card, real
  // text input) is the new landing state instead; Voice is still one tap
  // away via the same Text/Voice toggle in the header, just no longer
  // where the user starts.
  // Admin-configurable — see the Feature Flags page / services/configService.ts.
  // Turning "voice_coach" off hides the toggle entirely, same as before.
  const voiceCoachEnabled = configService.isFeatureEnabled('voice_coach');
  const [mode, setMode] = React.useState<'voice' | 'text'>('text');

  // Notification bell in this screen's header — product request: "the AI
  // career coach should be the entering point anytime users open the
  // app... that also means that the trophy icon and the notification icon
  // should also be in the AI career coach screen." Same GET
  // /api/v1/notifications unread-count fetch HeaderHome.tsx already runs
  // for Home's own bell badge. (Trophy/Leaderboard REMOVED per a later
  // follow-up — see the header JSX's own comment further down.)
  const [unreadCount, setUnreadCount] = React.useState(0);
  React.useEffect(() => {
    notificationService
      .listNotifications()
      .then(list => setUnreadCount(list.filter(n => !n.read).length))
      .catch(() => {
        // Non-critical — the badge just stays at its last-known count.
      });
  }, []);
  const onNotification = React.useCallback(() => navigate('Notification'), [navigate]);

  // BUG FIX (product report, twice now: "it's just automatically going to
  // the chat screen instead of letting the user see the suggested
  // topics"): the previous fix only special-cased a thread containing
  // NOTHING but the client-side placeholder greeting bubble — but any
  // account with real prior conversation history (i.e. basically anyone
  // who has ever actually used the coach) has more than that, so the
  // greeting/topics screen still never showed for them. The greeting is
  // meant to be this screen's own landing state regardless of whatever
  // history already exists underneath it — real history isn't gone, it's
  // just not the first thing shown; see giftedChatMessages below for how
  // this is applied. Starts false when arriving with an initialPrompt
  // (that flow auto-sends immediately below — there's nothing to land on
  // a greeting for).
  const [showGreeting, setShowGreeting] = React.useState(!initialPrompt);

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
    // A real message (typed directly, or a tapped topic's opening
    // question) is what actually starts the conversation — dismiss the
    // greeting/topics landing screen for the rest of this visit so the
    // just-sent message and the reply are visible.
    setShowGreeting(false);
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

  // Auto-sends a pre-composed opening question instead of dropping the
  // user on a blank thread, when this screen is entered with a specific
  // prompt already chosen (the route param itself has no current caller
  // now that MessagesScreen.tsx — the old intermediate "Suggested Topic"
  // tap-to-navigate menu — is gone, since the Coach tab opens straight
  // into this screen's own greeting/topics below; kept as the mechanism
  // any future entry point — a deep link, a suggested-action offer, etc. —
  // can reuse to jump straight into a specific opening question). Guarded
  // by a ref (not state) so this only ever fires once per screen visit,
  // even though `messages` above updates asynchronously right after mount.
  React.useEffect(() => {
    if (!initialPrompt || hasSentInitialPromptRef.current) return;
    hasSentInitialPromptRef.current = true;
    onSend([{ _id: `topic_${Date.now()}`, text: initialPrompt, createdAt: Date.now(), user: ME_USER }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  // Empty-thread greeting state (renderChatEmpty below) — real suggested
  // topics (services/coachService.ts's getSuggestedTopics), same data this
  // screen's now-removed MessagesScreen.tsx menu used to show in its own
  // grid before this screen absorbed it.
  // BUG FIX (product report: "when I change from one language to the
  // other, some part of the app still display in the former language...
  // imagine i change from french to chinese and then some places still
  // display in french"): getSuggestedTopics resolves this text server-side
  // in whatever language was active AT FETCH TIME (see coachService.ts's
  // own `language: currentLanguage()` param) and this effect's dep array
  // used to only track profile.goals/desiredRoles -- so switching the
  // app's language while sitting on the Coach tab (a bottom-tab screen,
  // never unmounted just by switching tabs) left these topics frozen in
  // whatever language was active when this screen first mounted, even
  // though the Suggested Topics pill/sheet stayed fully interactive and
  // looked like current content. i18nInstance.language (from this file's
  // own useTranslation() call above) re-runs this fetch on every real
  // language change, same as any other language-reactive data load in
  // this app.
  const [topics, setTopics] = React.useState<SuggestedTopic[]>([]);
  React.useEffect(() => {
    coachService
      .getSuggestedTopics({ goals: profile?.goals, desiredRoles: profile?.desiredRoles })
      .then(setTopics)
      .catch(() => {});
  }, [profile?.goals, profile?.desiredRoles, i18nInstance.language]);

  // Product follow-up: "move the suggested topic to be in a bottom sheet so
  // the suggested topic text will be like a button pill... so that the
  // screen will be more clean and tidy" — the topics card (see
  // renderChatEmpty below) used to sit permanently on the greeting screen;
  // now it only opens on demand, and the greeting screen's default state is
  // just the headline + the "Start a video practice" row + this one pill.
  const [topicsSheetVisible, setTopicsSheetVisible] = React.useState(false);
  // Product follow-up: Home's "Today's Career Focus" card now deep-links
  // here with openTopicsSheet=true (see HomeSrc.tsx / navigation/types.tsx's
  // MessagesStackParamList.Chat comment) instead of navigating to the
  // Leaderboard — pops the sheet open automatically once real topics have
  // actually loaded, rather than opening on to an empty sheet the instant
  // the screen mounts. The ref guards this to firing once per screen visit:
  // route.params keeps openTopicsSheet=true for as long as this screen
  // instance is mounted (react-navigation doesn't clear params on its own),
  // and topics re-fetches if profile.goals/desiredRoles change (see the
  // effect above) — without the ref, either of those would silently
  // re-open a sheet the user had already closed.
  const hasAutoOpenedTopicsSheetRef = React.useRef(false);
  React.useEffect(() => {
    if (!openTopicsSheet || hasAutoOpenedTopicsSheetRef.current || topics.length === 0) return;
    hasAutoOpenedTopicsSheetRef.current = true;
    setTopicsSheetVisible(true);
  }, [openTopicsSheet, topics]);

  // Product follow-up: "[the suggested topics] should be in the screen
  // that leads to the live conversation screen" — confirmed this means the
  // live VOICE conversation specifically, not a text bubble in place.
  // Tapping a topic switches into Voice mode and hands the title down as
  // VoiceCoachView's initialTopic — see that component's own focus effect
  // for what "starting the conversation with it" actually does (skips the
  // usual "wait for the user to speak first" open and immediately sends it
  // as the opening turn: thinking -> a real spoken reply -> live
  // listening).
  const [voiceInitialTopic, setVoiceInitialTopic] = React.useState<string | undefined>(undefined);
  const onTapTopic = React.useCallback((title: string) => {
    // Only ever called from inside the topics bottom sheet now — close it
    // on the way out so it isn't still sitting open once Voice mode takes
    // over the screen.
    setTopicsSheetVisible(false);
    setVoiceInitialTopic(title);
    setMode('voice');
    // A topic tap starts the conversation just as much as typing a real
    // message does (see onSend's own setShowGreeting) — if the user later
    // toggles back to Text mode, they should land on the real thread
    // (their voice exchange included, since both modes share one
    // persisted thread), not the greeting again.
    setShowGreeting(false);
  }, []);

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
    // BUG FIX (same stale-closure class as renderInputToolbar's own fix
    // just above): `theme` was read here but missing from this callback's
    // deps, so message bubble backgrounds froze at whatever theme was
    // active on first mount too.
  }, [theme, width]);
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
          // BUG FIX (product report, screenshot: "The dividing line at the
          // top is too white make it a little faint") — gifted-chat's
          // InputToolbar has its own default top border (a flat gray,
          // #b2b2b2) that this screen never overrode, so it rendered at
          // full opacity regardless of theme — glaringly bright against
          // this screen's dark background-basic-color-2 fill. Same scoped
          // `border-card-default` token every card border in the app
          // already uses (light: a soft #E7E7F0 hairline; dark: #3A3A57) —
          // a hairline width instead of gifted-chat's default 1pt reads as
          // a faint seam instead of a hard line.
          borderTopColor: theme["border-card-default"],
          borderTopWidth: StyleSheet.hairlineWidth,
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
    // BUG FIX (product report, screenshot: "This is displaying as dark
    // mode in light mode"): `theme` was missing from this dependency
    // list, so this callback's colors were frozen at whatever theme was
    // active the moment the Coach tab first mounted. Bottom-tab screens
    // stay mounted across tab switches (they aren't remounted every time
    // you come back to this tab), so a user who mounted this screen once
    // in dark mode and later switched the app to light mode (see
    // ThemeContext's toggleTheme) kept seeing the old dark
    // background-basic-color-2/3 fill on this input row forever, even
    // though every other theme-aware surface on the screen updated fine.
    [showAction, Platform.OS, keyboardShow, onCamera, onPhotoLibrary, theme]
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
  // automatically", expanded per the later report "I want it take the user
  // to any screen in the app... the AI coach has to be very accurate in
  // this and must have access and able to navigate to every screen in the
  // app automatically" — was a hardcoded if/else over exactly 4 ids;
  // now delegates to the shared registry (services/suggestedActions.ts),
  // which both this screen and VoiceCoachView.tsx call through, covering
  // ~40 destinations instead of 4.
  const onRunSuggestedAction = React.useCallback((action: SuggestedActionId) => {
    runSuggestedAction(action, navigate).catch(() => {});
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
    const action: SuggestedActionId | undefined = props?.currentMessage?.suggestedAction;
    if (action && ACTION_META[action]) {
      const label = t('message:suggested_action_chip', {
        defaultValue: 'Go to {{title}}',
        title: actionTitle(action),
      });
      const icon = ACTION_META[action].icon;
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

  // BUG FIX (product report, see showGreeting's own comment above for the
  // full story): GiftedChat itself decides whether to show renderChatEmpty
  // (the greeting/topics screen below) purely off whether the `messages`
  // array it's given is empty. While showGreeting is true, this hands it
  // an empty array regardless of what real history is actually loaded —
  // the moment the user acts (taps a topic -> Voice mode, or sends a real
  // message -> onSend flips showGreeting false), the real `messages`
  // (placeholder bubble and all prior history included) takes over.
  const giftedChatMessages = React.useMemo(
    () => (showGreeting ? [] : messages),
    [showGreeting, messages],
  );

  // Empty-thread greeting (reference-redesign: "I want the career coach
  // interface to look like the screenshot" — glowing avatar, headline,
  // suggested-topic chip grid, a "suggested for you" card, all above the
  // real message input). Wired into GiftedChat's own renderChatEmpty prop
  // below rather than replacing GiftedChat outright, so the same real
  // input toolbar/composer/attach flow stays mounted and working — only
  // the message-list area's content changes when there's no history yet.
  // Suppressed while an initialPrompt is about to auto-send (see the
  // effect above) so this doesn't flash for a frame before the real
  // thread appears.
  const renderChatEmpty = React.useCallback(() => {
    if (initialPrompt) return null;
    // BUG FIX: GiftedChat's own message list is `inverted` (default) — with
    // renderChatEmpty, it hands this content straight to that flipped
    // FlatList with no counter-transform of its own (RN's normal
    // auto-compensation for ListEmptyComponent doesn't reach a
    // no-props useCallback component like this one). Without the
    // scaleY(-1) below, the whole greeting renders upside down.
    return (
      <View style={[styles.emptyState, { transform: [{ scaleY: -1 }] }]}>
        {/* Product follow-up history: "the saveur logo background should be
            the default blue color" -- brand blue (#0063f8) solid fill.
            "replace the saveur icon in the AI career Coach with the chat
            icon of the new icons i uploaded" -- BrandWordmark's Saveur "S"
            mark swapped for an illustrated chat-bubble icon instead (first
            landed on Images.iconCoachChat, the orange/red bubble). Local
            edits then dropped emptyGlowWrap's solid blue backgroundColor
            and grew the icon to fill the full 88x88 circle, since a
            colored circle behind an already-colored bubble read as
            competing fills.
            "you are supposed to use the blue not the red icons" --
            Images.iconCoachChat swapped for Images.iconCoachChatBlue (the
            blue-teal bubble), matching the same fix already made to
            HomeSrc.tsx's Career Toolkit Coach icon and this file's own
            suggested-topics sheet (TOPIC_CHIP_STYLES[0]). */}
        <View style={styles.emptyGlowWrap}>
          <Image source={Images.iconCoachChatBlue} resizeMode="contain" style={styles.emptyGlowIcon as ImageStyle} />
        </View>
        <Text category="h6" center mt={18} style={styles.emptyHeadline}>
          {t("message:coach_greeting_headline", { defaultValue: "How can I support your career today?" })}
        </Text>

        {/* Product follow-up: "move the suggested topic to be in a bottom
            sheet so the suggested topic text will be like a button pill at
            the center down a little bit so that the screen will be more
            clean and tidy." Was a permanently-visible card (a header, a
            voice hint, and the 4-circle row all stacked on the greeting
            screen itself — see this block's own git history for that
            "too many content, card-ify it" pass). Now just this one pill;
            the actual card content moved into topicsSheet, rendered
            outside this scaleY-flipped view further down (see that
            Modal's own comment). */}
        {topics.length > 0 ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setTopicsSheetVisible(true)}
            style={styles.suggestedTopicsPill}>
            <Icon pack="eva" name="bulb-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
            <Text category="h9" bold ml={6} style={{ color: theme['color-primary-500'] }}>
              {t("message:suggested_topics_title", { defaultValue: "Suggested topics" })}
            </Text>
            <Icon pack="eva" name="chevron-down-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }, styles.suggestedTopicsPillChevron]} />
          </TouchableOpacity>
        ) : null}

        {/* "Suggested for you" — a real existing feature (same Composer
            action as "Start Video Practice" below, see onMakeCall), not a
            fabricated content card. */}
        <TouchableOpacity activeOpacity={0.7} onPress={onMakeCall} style={styles.emptySuggestedCard}>
          <View style={styles.emptySuggestedIconWrap}>
            <Icon pack="assets" name="call" style={[globalStyle.icon20, { tintColor: '#7EA8E2' }]} />
          </View>
          <View style={globalStyle.flexOne}>
            <Text category="h9" bold>
              {t("message:suggested_for_you_title", { defaultValue: "Start a video practice" })}
            </Text>
            <Text category="h10" status="placeholder" mt={2}>
              {t("message:suggested_for_you_subtitle", { defaultValue: "Get real-time feedback on a mock interview" })}
            </Text>
          </View>
          <Icon pack="assets" name="arrowRight" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
        </TouchableOpacity>
      </View>
    );
  }, [initialPrompt, topics, onMakeCall, t, theme, styles]);

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

  // Product follow-up (screenshot, reversing the earlier blue treatment):
  // "change the background of this AI coach from blue to white and its
  // text to black." Was a literal `voice-mode-background` token (brand
  // blue in light mode, navy in dark mode — see this const's own git
  // history above for that earlier request). Now just
  // `background-basic-color-2`/`text-basic-color`, the same white-card/
  // dark-ink pair every other screen in this app already uses — resolves
  // to literal white + this app's standard near-black ink in light mode
  // (exactly the ask), and the correct dark card surface + near-white ink
  // in dark mode, with no extra hardcoding needed to keep dark mode
  // legible. Still scoped to Voice mode only via `isVoiceMode` (Text mode
  // already uses the plain page background/ink with no override at all).
  const isVoiceMode = mode === 'voice';

  return (
    <Container
      style={[
        styles.container,
        // BUG FIX (product report, with screenshot: "the chat input field
        // is covered by the bottom navigation thereby not letting it
        // visible") — this used to cancel out Container's own default
        // `paddingBottom: bottom` safe-area inset (`marginBottom: -bottom`)
        // so the input toolbar could sit flush against the true bottom
        // edge of the screen. That was tuned for when this screen was only
        // ever reached as a full-screen push with no tab bar underneath it
        // (see MessagesNavigator's git history) — now that the Coach tab
        // renders this screen directly inside the bottom tab navigator
        // (see MainBottomTab.tsx), the tab bar itself already occupies
        // that space, so reclaiming it here pushed the input toolbar down
        // far enough to render partly behind the tab bar instead. Removed;
        // Container's normal safe-area padding is correct here now, same
        // as every other tab screen (Home, Practice, Interviews, Menu).
        // See isVoiceMode's own comment above for the current white-bg/
        // black-ink reasoning (was blue in light mode / navy in dark mode
        // before this follow-up).
        isVoiceMode && { backgroundColor: theme['background-basic-color-2'] },
      ]}>
      <TopNavigation
        style={isVoiceMode ? { backgroundColor: theme['background-basic-color-2'] } : undefined}
        title={renderProps => (
          <Text {...renderProps}>
            {t("message:ai_coach_name", { defaultValue: "AI Career Coach" })}
          </Text>
        )}
        accessoryLeft={<NavigationAction status="basic" />}
        accessoryRight={() => (
          <Flex justify="flex-start" itemsCenter>
            {/* Notification bell — product request: "the AI career coach
                should be the entering point anytime users open the app...
                the trophy icon and the notification icon should also be in
                the AI career coach screen." Same badge HeaderHome.tsx
                already exposes on Home, just laid out as a compact nav-bar
                accessory here instead of Home's larger circular button.
                Trophy (Leaderboard) REMOVED from here (product follow-up:
                "remove the trophy icon from the AI career coach") --
                Leaderboard is still reachable from Home's own header. */}
            <TouchableOpacity activeOpacity={0.7} onPress={onNotification} style={styles.headerIconButton}>
              <Icon
                pack="assets"
                name="notification"
                style={[globalStyle.icon20, { tintColor: theme['icon-basic-color'] }]}
              />
              {unreadCount ? (
                <View style={styles.headerNotifBadge}>
                  <Text category="h9" status="primary" fontSize={11} lineHeight={13}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
            {voiceCoachEnabled ? (
              // BUG FIX (product report: "the voice text in the AI career
              // coach should be like a button not a text. It should be
              // like button") — this used to be a bare NavigationAction
              // with just a `title` (see that component's own render
              // logic: passing `title` with no `icon` renders nothing but
              // plain Text in a TouchableOpacity, no button chrome at
              // all). Now a real pill button: icon + label on a filled
              // background, so it reads as a tappable mode switch instead
              // of a stray blue link floating in the header.
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setMode(m => (m === 'voice' ? 'text' : 'voice'))}
                style={styles.modeToggleButton}>
                <Icon
                  pack="eva"
                  name={mode === 'voice' ? 'message-square-outline' : 'mic-outline'}
                  // Product report: "Sorry just give it a gray border and a
                  // black text" (immediate follow-up, reversing the prior
                  // blue border/text) -- icon/label now use this app's
                  // theme-adaptive text-basic-color (near-black in light
                  // mode, near-white in dark mode -- see components/Text.tsx),
                  // matching the border's own gray below.
                  style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]}
                />
                <Text
                  category="h9"
                  style={[styles.modeToggleLabel, { color: theme['text-basic-color'] }]}>
                  {mode === 'voice'
                    ? t("message:mode_text", { defaultValue: "Text" })
                    : t("message:mode_voice", { defaultValue: "Voice" })}
                </Text>
              </TouchableOpacity>
            ) : null}
          </Flex>
        )}
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
          initialTopic={voiceInitialTopic}
          onInitialTopicHandled={() => setVoiceInitialTopic(undefined)}
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
              messages={giftedChatMessages}
              onSend={onSend}
              renderBubble={renderBubble}
              renderAvatar={renderAvatar}
              imageStyle={{}}
              renderTime={() => null}
              renderSend={renderSend}
              renderCustomView={renderCustomView}
              renderChatEmpty={renderChatEmpty}
              messagesContainerStyle={{ paddingBottom: 32 }}
              renderInputToolbar={renderInputToolbar}
              // gifted-chat's Composer has its own hardcoded default text color
              // (dark gray/black) with no idea this app has a dark theme --
              // without these it renders unreadable dark-on-dark text in the
              // input pill. textInputStyle covers what's actually typed;
              // placeholderTextColor covers the empty-state hint text.
              // BUG FIX (product report, with screenshot: "this is not
              // looking good in dark mode" — the input pill itself): the
              // real TextInput gifted-chat renders here has no
              // backgroundColor of its own in the library's source, so it
              // was falling back to the OS's own default fill (a light/
              // white Android EditText background) instead of showing
              // renderInputToolbar's primaryStyle color through it.
              // `transparent` lets that dark `background-basic-color-3`
              // pill color show through cleanly in both themes, rather than
              // duplicating that theme token in a second place here.
              textInputStyle={{ color: theme['text-basic-color'], backgroundColor: 'transparent' }}
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
            {/* Suggested-topics bottom sheet (product follow-up: "move the
                suggested topic to be in a bottom sheet... so that the
                screen will be more clean and tidy") — same Modal/backdrop/
                sheet idiom components/DocumentPickerModal.tsx already uses
                elsewhere in this app (slide-up, rounded top corners,
                tap-outside-to-dismiss). Rendered here rather than inside
                renderChatEmpty's returned tree because that tree is
                wrapped in a `scaleY(-1)` counter-transform (see its own
                comment) to compensate for GiftedChat's inverted message
                list — a Modal doesn't participate in that layout at all
                (it mounts at the native root), so keeping it outside
                avoids having to fight that transform. Same real
                topics/palette/mic-badge/onTapTopic behavior as the old
                inline card, just opened on demand instead of always
                taking up space on the greeting screen. */}
            <Modal
              visible={topicsSheetVisible}
              animationType="slide"
              transparent
              onRequestClose={() => setTopicsSheetVisible(false)}>
              <TouchableOpacity
                activeOpacity={1}
                style={styles.topicsSheetBackdrop}
                onPress={() => setTopicsSheetVisible(false)}>
                <TouchableOpacity activeOpacity={1} style={styles.topicsSheet}>
                  <Flex justify="space-between" itemsCenter mb={4}>
                    <Text category="h8" bold>
                      {t("message:suggested_topics_title", { defaultValue: "Suggested topics" })}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setTopicsSheetVisible(false)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, { tintColor: theme['text-basic-color'] }]} />
                    </TouchableOpacity>
                  </Flex>
                  {/* BUG FIX (pre-launch redundancy/flow audit): tapping a
                      topic here silently leaves text mode and starts a live
                      spoken voice call (see onTapTopic) — nothing previously
                      told the user that would happen, which read as a
                      surprising mode switch for anyone expecting a text
                      reply. This hint plus a small mic badge on each circle
                      (below) signal it up front. */}
                  <Text category="h10" mt={2} mb={18} style={{ color: theme['text-hint-color'] }}>
                    {t("message:topics_start_voice_hint", { defaultValue: "Tap a topic to start a voice conversation" })}
                  </Text>
                  <View style={styles.emptyTopicRow}>
                    {topics.slice(0, 4).map((item, i) => {
                      const chipStyle = TOPIC_CHIP_STYLES[i % TOPIC_CHIP_STYLES.length];
                      return (
                        <TouchableOpacity
                          key={item.id}
                          activeOpacity={0.7}
                          onPress={() => onTapTopic(item.title)}
                          style={styles.emptyTopicButton}>
                          <View style={[styles.emptyTopicCircle, { backgroundColor: chipStyle.bg }]}>
                            <Image source={chipStyle.image} resizeMode="contain" style={styles.emptyTopicIcon as ImageStyle} />
                            <View style={styles.emptyTopicMicBadge}>
                              <Icon pack="eva" name="mic-outline" style={{ width: 10, height: 10, tintColor: '#fff' }} />
                            </View>
                          </View>
                          {/* Product report: "some of the suggested topic
                              texts are truncated with ellipses -- they
                              should be fully visible so users know the
                              topic before they click on them." numberOfLines
                              was capping real topics (up to 60 chars per the
                              backend's own suggested-topics prompt -- see
                              coachService.ts) at 2 lines with a trailing
                              "...", hiding exactly the words a user needs to
                              decide whether to tap into a live voice call.
                              No numberOfLines here now -- see
                              emptyTopicButton's own comment for the wider
                              2-column layout that goes with this, so a
                              longer title has real room to wrap instead of
                              cramming into a narrow 72px column. */}
                          {/* Product report: "make the topics font a font
                              weight of 500 they are too bold" -- `bold`
                              (PlusJakartaSans-Bold) swapped for `medium`
                              (PlusJakartaSans-Medium, weight 500 -- see
                              Text.tsx's own `medium` prop comment). */}
                          <Text category="h10" medium center mt={8}>
                            {item.title}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
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
  // Notification header accessory (see accessoryRight above) — compact
  // nav-bar-scale hit target, unlike HeaderHome.tsx's larger 40x40
  // circular buttons which are sized for a full dashboard header row
  // rather than a TopNavigation accessory slot.
  headerIconButton: {
    width: 32,
    height: 32,
    marginRight: 4,
    ...globalStyle.center,
  },
  headerNotifBadge: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "button-basic-color",
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    top: 0,
    right: 0,
  },
  // Voice/Text mode pill button (see accessoryRight above) — product
  // request: "bake the button background the default blue color", the
  // app's standard solid brand-blue fill in normal (text) mode; on the
  // full-bleed voice-mode-background screen (already that same blue in
  // light mode) a translucent white fill instead, so the button still
  // reads as a distinct control against its own background there.
  // Product report: "Remove the blue background from the voice button...
  // Just give it a blue border and a blue text" -- was a solid
  // `button-basic-color` fill with white icon/text; now an outline pill
  // instead (no backgroundColor). Immediate follow-up: "Sorry just give it
  // a gray border and a black text" -- borderColor swapped from brand blue
  // to this app's standard card-border gray (rgba(128,128,128,0.3), same
  // value globalStyle.card's own border uses) -- see the render call site
  // for the matching icon/text color swap to theme-adaptive black.
  modeToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(128,128,128,0.3)",
  },
  modeToggleLabel: {
    marginLeft: 4,
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
  // Empty-thread greeting (reference-redesign, see renderChatEmpty).
  // Product follow-up: "The Saveur icon, the headline text and the
  // suggested topic button should move a little bit up so that there can
  // be space" -- paddingTop was 48, pushing the whole orb/headline/pill
  // cluster down and leaving little room before the "Suggested for you"
  // card + composer below it. 24 shifts that whole cluster up as one
  // group (alignItems:'center' keeps it centered either way) without
  // touching the spacing between the pieces themselves.
  // Follow-up round 2 ("still move [it] up more"): 24 -> 8, same group,
  // same reasoning, just a further nudge in the same direction.
  // Follow-up round 3 (same ask again): 8 -> 0. This is flex:1 with
  // alignItems:'center' and the default justifyContent:'flex-start', so
  // paddingTop is the only thing holding the cluster down at all -- 0 is
  // as far up as this one property can push it without going negative.
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 0,
  },
  // Product follow-up: solid brand blue (was a two-stop gradient — see the
  // JSX comment above).
  emptyGlowWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor: '#0063f8',
  },
  // See the REDESIGN comment at the render call site.
  emptyGlowIcon: {
    width: 88,
    height: 88,
  },
  // BUG FIX (product report: "too bold", "reduce the size"): `category`
  // was "h5" with the `bold` prop -- h5 was never actually added to this
  // app's own typography scale (constants/theme/mapping.json's category
  // block jumps straight from h3 to h6), so it was silently falling back
  // to Eva's stock default h5 size (22px), and `bold` swaps in
  // PlusJakartaSans-Bold (see components/Text.tsx), the heaviest cut this
  // app ships. "h6" (18px) IS part of this app's real scale, and an
  // explicit fontFamily/fontWeight override below gives an actual
  // medium (500-equivalent) weight instead of Bold -- same
  // fontFamily-swap + `fontWeight: 'normal'` convention CtaButton.tsx
  // already uses, since Android's font resolver needs the exact filename
  // (PlusJakartaSans-Medium.ttf), not a numeric weight, to find a custom
  // font's medium cut.
  emptyHeadline: {
    color: 'text-basic-color',
    paddingHorizontal: 12,
    fontFamily: 'PlusJakartaSans-Medium',
    fontWeight: 'normal',
  },
  // Product follow-up: "move the suggested topic to be in a bottom sheet
  // so the suggested topic text will be like a button pill at the center
  // down a little bit" — replaces the old always-visible emptyTopicsCard
  // (see this style's own git history) with just this trigger. Centered
  // via emptyState's own `alignItems: 'center'`, `marginTop` is the "down
  // a little bit" from the headline above it.
  suggestedTopicsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 99,
    backgroundColor: 'rgba(0, 99, 248, 0.08)',
  },
  suggestedTopicsPillChevron: {
    marginLeft: 2,
  },
  // Bottom sheet the pill above opens (see that TouchableOpacity's own
  // comment + the Modal further down this file for the full "why"). Same
  // backdrop/sheet idiom components/DocumentPickerModal.tsx already uses.
  topicsSheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topicsSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: 'background-basic-color-2',
  },
  // Reference-redesign follow-up: a single row of 4 round icon buttons
  // (was a 2x2 card grid — see the JSX comment above where this renders,
  // now inside topicsSheet instead of the old inline emptyTopicsCard).
  // Product follow-up (see the JSX comment at the Text above): switched
  // from a single row of 4 narrow (72px) columns to a 2-column wrapping
  // grid, now that topic titles render in full instead of truncating to 2
  // lines -- a real topic (up to 60 chars) needs meaningfully more than
  // 72px of width to wrap into something readable.
  emptyTopicRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  emptyTopicButton: {
    alignItems: 'center',
    width: '47%',
    marginBottom: 20,
  },
  emptyTopicCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // See the REDESIGN comment at TOPIC_CHIP_STYLES -- a touch bigger than
  // the old icon20 (28x28) glyph it replaced, since these are full
  // illustrated icons that read as too small at that size inside a 56px
  // circle.
  emptyTopicIcon: {
    width: 32,
    height: 32,
  },
  // Small mic badge on each topic circle — signals up front that tapping a
  // topic starts a live voice conversation, not a text reply (see the hint
  // text rendered just above emptyTopicRow).
  emptyTopicMicBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySuggestedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    // Product follow-up: "move the logo, headline, and suggested topics
    // pill up — they're too close to the Start a video practice card."
    // The cluster above (emptyGlowWrap/emptyHeadline/suggestedTopicsPill)
    // is already pinned as high as it can go (emptyState's paddingTop: 0,
    // flex-start), so the only lever that actually reads as "more space
    // above this card" is this card's own top margin — was 12, reads as
    // one connected block with the pill right above it.
    marginTop: 84,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'background-basic-color-2',
  },
  emptySuggestedIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(126, 168, 226, 0.14)',
    marginRight: 12,
  },
});
