import React, { memo } from "react";
import { Alert, Image, ImageSourcePropType, ImageStyle, Modal, TouchableOpacity, View } from "react-native";
import { pick, isErrorWithCode, errorCodes, types as documentTypes } from "@react-native-documents/picker";
import * as ImagePicker from "react-native-image-picker";
import {
  Bubble,
  GiftedChat,
  IMessage,
  Send,
  InputToolbarProps,
  SendProps,
  MessageImage,
  BubbleProps,
} from "react-native-gifted-chat";
// SYMPHONY REDESIGN follow-up (product report: "the input field is above
// the plus icon and the voice pill" -- Symphony's own reference card is a
// genuine 2-row layout: the real text field on its own row up top, the
// "+"/Speak-pill/Send controls on a row below it). gifted-chat's own
// <InputToolbar> (imported above) only ever lays those out in ONE row
// (actions, composer, send, left to right -- see that package's own
// InputToolbar.js), so matching the reference means not using
// <InputToolbar> as the outer wrapper at all anymore; this screen builds
// its own 2-row card in renderInputToolbar below and drops the real
// gifted-chat Composer (the actual TextInput) into its top row directly.
// Imported from this subpath rather than the package root because the
// root index's own type exports are already broken for this whole
// package in this app (see the 9 baseline "has no exported member"
// errors on the import block above, pre-existing and untouched here) --
// Composer.d.ts's own dedicated types resolve cleanly on their own.
import { Composer as GiftedComposer, ComposerProps as GiftedComposerProps } from "react-native-gifted-chat/lib/Composer";
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
import DrawerMenuButton from "components/DrawerMenuButton";
import { globalStyle } from "styles/globalStyle";
import { Platform } from "react-native";
import Flex from "components/Flex";
import Composer from "./Components/Composer";
import useKeyboard from "hooks/useKeyboard";

import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { RootStackParamList, MessagesStackParamList } from "navigation/types";
import AttachItem from "./Components/AttachItem";
import { CLUSTER_COLORS } from "components/OnboardingCluster";
import Text from "components/Text";
import { CoachChatMessageProps, SuggestedActionId } from "constants/Types";
import * as coachService from "services/coachService";
import { SuggestedTopic } from "services/coachService";
import { ACTION_META, actionTitle, runSuggestedAction } from "services/suggestedActions";
import * as resumeService from "services/resumeService";
import { ImportedFileInfo } from "services/resumeService";
import { AuthContext } from "../../AuthContext";
import VoiceCoachView from "./VoiceCoachView";
import * as configService from "services/configService";
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

// Product report: "when user type a question I want a text showing AI
// Thinking appearing in the chat just like in every AI apps letting the
// user know that the AI is thinking" -- a fixed, recognizable id so onSend
// (below) can reliably find-and-remove this one specific message once the
// real reply (or an error) arrives, without touching anything else in the
// thread. Rendered through the exact same renderBubble/renderAvatar path
// as any other coach message (see onSend) rather than a special-cased
// component, so it looks like a real, if temporary, message from the coach
// -- same "AI is typing" convention most chat apps use.
const THINKING_MESSAGE_ID = "ai-thinking-indicator";
// Cast (not a direct contextual return-type match) same as this file's own
// existing `as unknown as X` escape hatch elsewhere -- CoachIMessage
// extends the package root's IMessage, which is one of the 9 pre-existing
// broken exports (see the import block's own comment), so TS doesn't
// actually see `_id`/`text`/`createdAt`/`user` as real members of
// CoachIMessage at all (only its own suggestedCourseTopic/suggestedAction
// are). toGiftedMessage above already hits this same "excess property"
// wall and is left as a pre-existing, already-tolerated baseline error;
// this new literal uses the assertion form instead specifically so it
// doesn't add a second, brand-new instance of that same class of error.
const buildThinkingMessage = (label: string) =>
  ({
    _id: THINKING_MESSAGE_ID,
    text: label,
    createdAt: Date.now(),
    user: COACH_USER,
  } as unknown as CoachIMessage);

// Real AI coach chat — see services/coachService.ts, backed by
// POST /api/v1/coach/advice. History is cached to AsyncStorage so it
// survives navigating away from this screen and back (the cache itself is
// not the source of truth — see coachService's comment on why history
// read/clear stay local for now).
const Chat = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { t, i18n: i18nInstance } = useTranslation(["message", "common", "more"]);
  const { width, bottom, height, top } = useLayout();
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

  // Notification bell REMOVED from this screen's header per product
  // follow-up ("in the AI career coach screen you can remove the
  // notification bell icon") — it's still reachable from Home's own
  // header (HeaderHome.tsx), this was just a second copy here.

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
      // BUG FIX (product report: "once they have started a conversation
      // with the AI then the chat icon should no longer display. It should
      // only display when the user have not started a conversation with
      // the coach"): this partially REVERSES the "always show the
      // greeting regardless of history" decision above (see showGreeting's
      // own comment) -- that fix's actual goal, suggested topics always
      // being reachable, is now covered instead by suggestedTopicsBar
      // (rendered further down, pinned to the very top of the screen
      // regardless of history), so it's safe to let a returning user with
      // a real prior conversation land on their real thread again instead
      // of the icon+headline landing screen every single time they open
      // this tab.
      if (history.length > 0) {
        setShowGreeting(false);
      }
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
    // Product report: "when user type a question I want a text showing AI
    // Thinking appearing in the chat" — a real (temporary) message in the
    // thread itself, appended right after the user's own so it shows up
    // directly below it while the request is in flight.
    setMessages(previous =>
      GiftedChat.append(previous, [
        buildThinkingMessage(t("message:ai_thinking", { defaultValue: "AI is thinking…" })),
      ]),
    );
    setIsSending(true);
    try {
      const { coachMessage } = await coachService.sendMessage(draft.text, {
        goals: profile?.goals,
        industries: profile?.industries,
        desiredRoles: profile?.desiredRoles,
        preferredCountries: profile?.preferredCountries,
      });
      // Swap the thinking placeholder out for the real reply in one update
      // (filter it out, then append the real message) rather than a
      // separate "remove" step first — avoids a one-frame flash where
      // neither the placeholder nor the real reply is visible.
      setMessages(previous =>
        GiftedChat.append(
          previous.filter((m: any) => m._id !== THINKING_MESSAGE_ID),
          [toGiftedMessage(coachMessage)],
        ),
      );
    } catch (e: any) {
      // Real network call now — the coach can actually fail (offline, 5xx,
      // timeout). The user's message stays visible (optimistic append above
      // already happened, and coachService persists it too) but no reply
      // arrives, so surface it instead of leaving the chat hanging silently.
      // The thinking placeholder is removed either way — it must never be
      // left sitting in the thread as if it were a real, permanent message.
      setMessages(previous => previous.filter((m: any) => m._id !== THINKING_MESSAGE_ID));
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
    <Flex itemsCenter>
      {/* SYMPHONY REDESIGN follow-up (product report: "instead of us
          having the voice pill button at the top right corner, lets have
          it inside the text input box like that" -- reference screenshot
          4). Only shown in Text mode (this whole input toolbar is
          unmounted in Voice mode, replaced by VoiceCoachView -- see the
          mode branch below), so tapping it switches TO Voice mode; the
          header accessoryRight above still holds the only way to switch
          back FROM Voice mode, since VoiceCoachView has no toggle of its
          own. */}
      {voiceCoachEnabled ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setMode('voice')}
          style={styles.modeToggleButtonInline}>
          {/* BUG FIX (product report: "the icon on it should not be mic
              it should be the same icon for speak") -- was mic-outline (a
              literal microphone), which reads as "record audio," not
              "speak/waveform" the way Symphony's own reference pill does.
              activity-outline (a zigzag waveform line, lucide's "Activity"
              glyph -- see assets/LucideEvaIconsPack.tsx) is this app's
              closest existing match to that. */}
          <Icon
            pack="eva"
            name="activity-outline"
            style={[globalStyle.icon16, { tintColor: '#FFFFFF' }]}
          />
          <Text
            category="h9"
            style={[styles.modeToggleLabel, { color: '#FFFFFF' }]}>
            {t("message:mode_voice", { defaultValue: "Speak" })}
          </Text>
        </TouchableOpacity>
      ) : null}
      <Send {...props} containerStyle={styles.containerSend}>
        <Icon pack="assets" name="send" style={styles.iconSend} />
      </Send>
    </Flex>
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

  // onMakeCall/onViewProgress REMOVED (product report: "Remove the start
  // video practice icon and the view my progress icon we dont need
  // that") — this attach sheet's own comment (where the rows they backed
  // used to live) has the fuller "why." Both destinations are still
  // reachable elsewhere in the app (Practice tab, MyProgress from other
  // entry points), just not from here anymore.

  // SYMPHONY REDESIGN follow-up ROUND 2 (product report, direct pixel
  // comparison against the reference: "the text box does not have a
  // height but the one in symphony has a height... the input field is
  // above the plus icon and the voice pill and the box has a box shadow
  // and the border radius is not 999 round"). Round 1 (see git history)
  // put the "+"/text field/Speak pill/Send icon all on ONE row inside
  // gifted-chat's own <InputToolbar> (primaryStyle carrying a pill-radius
  // card) -- closer to the reference than the original 3-loose-icons
  // layout, but still not a real match: Symphony's own card is a genuine
  // TWO-row layout (the text field alone on top, controls below), has
  // real height/padding rather than a thin pill, a moderate corner radius
  // instead of a full pill, and a real drop shadow. gifted-chat's
  // <InputToolbar> component only ever lays actions/composer/send out in
  // one row (see that package's own InputToolbar.js) -- there's no prop
  // to split them across two rows -- so matching the reference means not
  // using <InputToolbar> as the wrapper at all: this drops gifted-chat's
  // own real Composer (the actual TextInput, imported above from its own
  // subpath) into a hand-built 2-row card instead.
  const renderInputToolbar = React.useCallback(
    (props: InputToolbarProps) => {
      // `props` here is gifted-chat's merged runtime object (InputToolbar
      // props + Composer props + onSend/text/onTextChanged/etc -- see
      // node_modules/react-native-gifted-chat/lib/GiftedChat/index.js's
      // own inputToolbarProps construction). The exported InputToolbarProps
      // TYPE doesn't declare the Composer fields even though the real
      // object always has them at runtime (this package's whole type
      // surface is already broken in this app -- see the 9 baseline
      // "has no exported member" errors on the import block above), so a
      // cast is needed to hand it to the real Composer/Send below with
      // the fields they actually expect.
      const composerProps = props as unknown as GiftedComposerProps;
      const sendProps = props as unknown as SendProps<IMessage>;
      return (
        <View
          style={[
            styles.chatInputCard,
            { marginBottom: Platform.OS === "android" ? 8 : 24 },
          ]}>
          <GiftedComposer
            {...composerProps}
            // BUG FIX (product report: "the input field in the AI career
            // coach has no placeholder. How will users know that there is
            // an input field in the input box"): `composerProps.placeholder`
            // SHOULD already carry the real translated placeholder through
            // from `<GiftedChat placeholder={...}>` below via gifted-chat's
            // own object-rest spread into this callback's `props` -- but
            // that chain now crosses 3 layers (GiftedChat's internal
            // inputToolbarProps -> this callback's `props` -> a cast to
            // GiftedComposerProps -> spread here), any one of which silently
            // dropping the key would leave the field with no visible
            // affordance at all, which is exactly what was reported. Wiring
            // the same translated string explicitly and directly here
            // removes that whole chain as a dependency -- this is now the
            // single source of truth for the composer's placeholder,
            // guaranteed to win regardless of what {...composerProps} did
            // or didn't carry (an explicit prop always overrides same-name
            // keys from an earlier spread in JSX).
            placeholder={t("message:chat_input_placeholder", { defaultValue: "Type a message..." }).toString()}
            // BUG FIX (see chatTextInput's own comment -- same root cause):
            // a real floor value here as well, on TOP of chatTextInput's
            // `minHeight`, since Composer.js applies `{height: composerHeight}`
            // as the LAST style in its own array (after textInputStyle),
            // meaning a bad/zero composerHeight from GiftedChat's own
            // tracking would otherwise win over minHeight regardless.
            composerHeight={Math.max(composerProps.composerHeight ?? 0, 24)}
            textInputStyle={styles.chatTextInput}
            placeholderTextColor={theme["text-hint-color"]}
          />
          <View style={styles.chatInputControlsRow}>
            <Composer onShowAction={() => setShowAction(!showAction)} />
            <View style={globalStyle.flexOne} />
            {renderSend(sendProps)}
          </View>
        </View>
      );
    },
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
    [showAction, Platform.OS, theme, styles, renderSend, t]
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
    //
    // BUG FIX (product report, with screenshot: "I thought i told you to
    // move these 3 items up to the middle why are they still down") --
    // emptyState's own `flex: 1` + `justifyContent: 'center'` only centers
    // within whatever height ITS PARENT actually gives it, and GiftedChat's
    // inverted-list empty-component slot doesn't reliably stretch to the
    // full chat viewport -- it was sizing to content and then getting
    // anchored toward the bottom (the "start" of an inverted list is
    // visually the bottom of the screen), which is exactly why centering
    // never took visible effect. An explicit height (the real available
    // chat area: screen height minus the safe-area insets and a rough
    // header+input-toolbar allowance) gives this box real room to center
    // within, independent of whatever its parent does.
    const emptyStateHeight = Math.max(320, height - top - bottom - 150);
    return (
      <View style={[styles.emptyState, { height: emptyStateHeight, transform: [{ scaleY: -1 }] }]}>
        {/* REVERTED (product report: "I did not say you should touch the
            chat icon in the AI career coach screen, i am talking about the
            AI career coach card chat icon in the homescreen" -- the
            gray-bg/black-icon ask was actually for Home's CoachPromptCard,
            not this screen). Back to the illustrated blue chat-bubble PNG
            this screen has used since the original reference-redesign. */}
        <View style={styles.emptyGlowWrap}>
          <Image source={Images.iconCoachChatBlue} resizeMode="contain" style={styles.emptyGlowIcon as ImageStyle} />
        </View>
        {/* Product report: "reduce the size of the greeting text its too
            big" -- was category="h6" (20px, see constants/theme/
            mapping.json's text-heading-6-font-size). "h7" (18px) is one
            step down this app's real type scale. */}
        <Text category="h7" center mt={18} style={styles.emptyHeadline}>
          {t("message:coach_greeting_headline", { defaultValue: "How can I support your career today?" })}
        </Text>

        {/* Product follow-up (moved out of this box entirely -- see
            suggestedTopicsBar further down, rendered as its own persistent
            row pinned to the very top of the screen): "the suggested
            topics pill should always appear at the very top of the screen
            aligned in the center of the screen so that if user want to
            start a conversation from there they can" -- was permanently
            embedded in this greeting box, which per the chat-history check
            in the getChatHistory effect above (setShowGreeting(false) when
            history.length > 0) only renders at all for a user who's never
            actually talked to the coach. A returning user with real
            history skips this whole box, so the pill needed a home that
            isn't inside it. */}
        {/* "Start a video practice" card REMOVED per product report ("in
            screenshot 3 remove the start a video practice card"). Was
            still reachable via the attach panel's own "Start Video
            Practice" row for a while after that -- that row is gone too
            now (product report: "Remove the start video practice icon
            and the view my progress icon we dont need that"), so this
            action isn't surfaced anywhere on this screen anymore; it's
            still reachable from the Practice tab directly. */}
      </View>
    );
  }, [initialPrompt, topics, t, theme, styles, height, top, bottom]);

  // Product request: "there are some other places too in the app that you
  // can add some of those icons i uploaded too" -- was the Saveur brand
  // orb (BrandWordmark's "S" mark); swapped for the same illustrated blue
  // chat-bubble icon this file already uses for Coach elsewhere (the
  // empty-thread greeting icon, the suggested-topics sheet's first chip),
  // so every "this message is from the coach" marker in this screen now
  // matches. Returns null for the current user's own messages so
  // GiftedChat falls back to its default (blank) treatment.
  const renderAvatar = React.useCallback((props: any) => {
    if (props?.currentMessage?.user?._id !== COACH_USER._id) {
      return null;
    }
    return (
      <View style={styles.coachAvatar}>
        <Image source={Images.iconCoachChatBlue} resizeMode="contain" style={styles.coachAvatarIcon as ImageStyle} />
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
        // SYMPHONY REDESIGN (drawer nav shell) — Chat/Coach is one of the 3
        // drawer root screens (Home/Chat/More); this was a plain back
        // button (NavigationAction with no onPress defaults to goBack()),
        // which never had anywhere real to go back TO — MessagesStackParamList
        // only ever has this one screen. Now a real, functional affordance:
        // opens the drawer, matching Home/More's own headers.
        accessoryLeft={<DrawerMenuButton />}
        accessoryRight={() => (
          <Flex justify="flex-start" itemsCenter>
            {/* SYMPHONY REDESIGN follow-up (explicit product request, with
                reference screenshot: "I want the Text box in the AI career
                coach screen to be like the one in screenshot 4. So instead
                of us having the voice pill button at the top right
                corner, lets have it inside the text input box"). Moved
                into the text-input row itself now (see renderSend below)
                — but ONLY for Text mode; Voice mode has no text input row
                at all (VoiceCoachView replaces the whole GiftedChat area,
                see the render branch below), so this header pill still
                has to be the way back to Text mode while actually IN
                Voice mode. Without this, there would be no way to leave
                Voice mode at all once voiceCoachEnabled is on. */}
            {voiceCoachEnabled && mode === 'voice' ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setMode(m => (m === 'voice' ? 'text' : 'voice'))}
                style={styles.modeToggleButton}>
                <Icon
                  pack="eva"
                  name="message-square-outline"
                  style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]}
                />
                <Text
                  category="h9"
                  style={[styles.modeToggleLabel, { color: theme['text-basic-color'] }]}>
                  {t("message:mode_text", { defaultValue: "Text" })}
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
          {/* Product report: "the suggested topics pill should always
              appear at the very top of the screen aligned in the center of
              the screen so that if user want to start a conversation from
              there they can" -- pulled out of renderChatEmpty's own box
              (see that callback's own comment) into a real, always-mounted
              row here instead, so it's reachable both for a first-time
              user (still seeing the icon+headline greeting underneath it)
              and a returning user with real history (who no longer sees
              that greeting at all, per hasPriorHistory above -- this pill
              is now their only on-screen way back into the topics list
              without typing something first). Renders as a normal
              (non-absolute) row directly under the header, so it just
              pushes the message list down by its own height rather than
              floating over content. */}
          {topics.length > 0 ? (
            <View style={styles.suggestedTopicsBar}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setTopicsSheetVisible(true)}
                style={[styles.suggestedTopicsPill, styles.suggestedTopicsPillTop]}>
                <Icon pack="eva" name="bulb-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
                <Text category="h9" bold ml={6} style={{ color: theme['color-primary-500'] }}>
                  {t("message:suggested_topics_title", { defaultValue: "Suggested topics" })}
                </Text>
                <Icon pack="eva" name="chevron-down-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }, styles.suggestedTopicsPillChevron]} />
              </TouchableOpacity>
            </View>
          ) : null}
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
              // textInputStyle/placeholderTextColor REMOVED from here --
              // renderInputToolbar's own JSX now sets both directly on the
              // real Composer it renders (styles.chatTextInput / theme
              // text-hint-color), since this screen builds that whole card
              // itself now instead of delegating to gifted-chat's own
              // <InputToolbar> (see that callback's ROUND 2 comment).
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
              // SYMPHONY REDESIGN follow-up (explicit product request, with
              // reference screenshots: "when they click on the plus icon
              // it should pop up like the one in screenshot 3" — Symphony's
              // own "Add Attachment" sheet, a vertical list of full-width
              // rows rather than the old 3-across icon-tile grid this used
              // to be — see AttachItem.tsx's own comment for that layout
              // change). Also trimmed to just the 3 items the product
              // report kept ("File attachment, image icon, camera icon...
              // Remove the start video practice icon and the view my
              // progress icon we dont need that") — onMakeCall/
              // onViewProgress (and their rows) are gone; the real
              // onCamera/onPhotoLibrary handlers (previously their own
              // persistent icons in the input row itself, see Composer.tsx)
              // now live here instead, matching where Symphony puts them.
              <Layout style={styles.attachSheet}>
                <Flex justify="space-between" itemsCenter mb={4}>
                  <Text category="h8" bold>
                    {t("message:add_attachment_title", { defaultValue: "Add Attachment" })}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowAction(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, { tintColor: theme['text-basic-color'] }]} />
                  </TouchableOpacity>
                </Flex>
                <AttachItem
                  title={t("message:attach_resume_files", { defaultValue: "Attach Resume / Files" })}
                  icon={"attach"}
                  bg={CLUSTER_COLORS.blue}
                  _onPress={onAttach}
                />
                <AttachItem
                  title={t("message:photo_library", { defaultValue: "Photo Library" })}
                  icon={"photoLibrary"}
                  bg={CLUSTER_COLORS.pink}
                  _onPress={onPhotoLibrary}
                />
                <AttachItem
                  title={t("message:take_photo", { defaultValue: "Take Photo" })}
                  icon={"camera"}
                  bg={CLUSTER_COLORS.green}
                  _onPress={onCamera}
                />
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
                    {/* Product report: "the suggested topics cards should
                        not be more than 3" -- was slice(0, 4). */}
                    {topics.slice(0, 3).map((item, i) => {
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
  // SYMPHONY REDESIGN follow-up (explicit product request, with reference
  // screenshot: "the container housing them looks so bad and i want them
  // to pop"). Was a bare flat rectangle (`{backgroundColor: '#FFFFFF'}`
  // inline, no rounding at all) — rounded top corners now make it read as
  // a real sheet that slid up rather than a plain strip. `...
  // globalStyle.shadowFade` spread for consistency with every other
  // raised surface in the app (currently a no-op per this app's own
  // app-wide flat-design pass — see globalStyle.ts's cardShadow comment —
  // but wired the same way so a future shadow reintroduction picks this
  // up automatically too).
  attachSheet: {
    backgroundColor: 'background-basic-color-2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // Was padding via a wrapping `<Flex margin={32}>` around the old
    // 3-across icon-tile grid -- now that the sheet is a real vertical
    // list (see AttachItem.tsx's own comment), the padding lives directly
    // on the sheet itself instead.
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    ...globalStyle.shadowFade,
  },
  // Voice/Text mode pill button (see accessoryRight above). COLOR HISTORY:
  // solid brand-blue fill -> outline pill (blue border/text) -> gray
  // border + black text (no fill) -> product report: "give the voice pill
  // button beside it a light gray background and a black text" -- now a
  // filled light-gray pill (background-basic-color-3, same gray the
  // bottom tab bar's own active pill uses -- see MainBottomTab.tsx) with
  // no separate border, since a filled pill doesn't need one.
  modeToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "background-basic-color-3",
  },
  modeToggleLabel: {
    marginLeft: 4,
  },
  // SYMPHONY REDESIGN follow-up (reference screenshot 4: "+ icon, mic
  // icon, Speak pill, all inside one input bar") — same pill visual as
  // modeToggleButton above but sized/positioned to sit inline inside the
  // input toolbar next to the Send icon (see renderSend) instead of
  // floating in the header.
  // BUG FIX (product report: "the voice pill should have the default blue
  // background color and the icon on it should not be mic it should be
  // the same icon for speak") -- was the same neutral background-basic-
  // color-3 gray as the header's own Text-mode toggle (modeToggleButton
  // above); this one now uses the app's real primary blue instead, since
  // it's the sole always-visible CTA in the new unified input card and
  // needs to read as the primary action, not an equal-weight secondary
  // control. Icon/label swapped to white to stay legible on the solid
  // blue fill (see renderSend's own icon name change).
  modeToggleButtonInline: {
    flexDirection: "row",
    alignItems: "center",
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "color-primary-500",
    marginRight: 8,
  },
  // SYMPHONY REDESIGN follow-up ROUND 2 -- see renderInputToolbar's own
  // comment for the full "why this replaced <InputToolbar>" story. This
  // is the whole card: real height (padding, not a thin pill), a
  // moderate corner radius (NOT 999/fully round -- product report was
  // explicit about this), and a REAL drop shadow. Every other card
  // surface in this app currently uses globalStyle.shadowFade, which is a
  // deliberate app-wide no-op per that token's own comment (a prior flat-
  // design pass) -- this card is a direct, explicit exception to that,
  // since the product report specifically asked for a visible box shadow
  // here to match the reference, not the app's usual flat look.
  chatInputCard: {
    backgroundColor: "background-basic-color-2",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "border-card-default",
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    // Product report (screenshot): "this card needs more padding bottom.
    // The icons are extending outside the card" -- 8 wasn't enough room
    // under chatInputControlsRow's own icons (the "+" trigger and the
    // Voice pill/send icon, all ~20-24px tall) before the card's rounded
    // bottom edge, so they visually poked past it instead of sitting
    // inside the card like the composer row above them does.
    paddingBottom: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  // The real gifted-chat Composer (the actual TextInput), now on its own
  // top row inside chatInputCard instead of a separate gray pill --
  // product report: "the input field should not be gray since the input
  // box is white let it be white too." `backgroundColor: transparent`
  // lets the white card fill show through directly (gifted-chat's
  // Composer has no background of its own in the library's source, so an
  // unset value here would fall back to the OS's own default TextInput
  // fill instead -- same reasoning the old textInputStyle prop used to
  // rely on, kept here now that this screen renders Composer directly).
  // BUG FIX (product report: "you removed the input field? There is no
  // where for the user to type" -- the composer was still in the render
  // tree, just rendering at an invisible/collapsed height): gifted-chat's
  // real Composer sizes its TextInput off a style array that ends with
  // `[..., textInputStyle, {height: composerHeight}]` (see
  // node_modules/react-native-gifted-chat/lib/Composer.js) -- `composerHeight`
  // is a value GiftedChat itself tracks via onContentSizeChange callbacks
  // tied to its OWN default single-row <InputToolbar> layout. This screen
  // bypasses <InputToolbar> entirely for the 2-row card (see
  // renderInputToolbar's own comment), so that internal state was never
  // reliably reaching a real, non-zero value in this custom layout --
  // rendering a TextInput with no usable height, i.e. invisible, with
  // nothing to type into and no visible placeholder even though one was
  // being passed. `minHeight` here is a hard floor underneath whatever
  // `composerHeight` resolves to, independent of GiftedChat's own
  // tracking -- guarantees the field always has real, tappable, visible
  // room no matter what.
  chatTextInput: {
    color: "text-basic-color",
    backgroundColor: "transparent",
    fontSize: 15,
    lineHeight: 20,
    minHeight: 24,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  // Controls row (product report: "the input field is above the plus
  // icon and the voice pill") -- sits BELOW chatTextInput now, holding
  // the "+" trigger on the left and the Speak pill/Send icon on the
  // right, instead of all four elements sharing one row with the text
  // field.
  chatInputControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
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
    // BUG FIX (product report: "check the whole app" for the same
    // text-primary-color regression already found elsewhere) -- this is
    // the outgoing (user's own) chat bubble, filled with
    // theme["button-basic-color"] below (see containerToStyle). That's
    // the same #0063f8 blue text-primary-color now resolves to, so every
    // message the user sent was rendering invisible. text-control-color
    // is this app's real "always white on a colored surface" token.
    color: "text-control-color",
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
  // BUG FIX (product report: "the send icon is supposed to be color
  // should be dark gray not blue") -- was button-basic-color (brand
  // blue). text-hint-color (#5C5C78) is this app's real "dark gray" text
  // token (distinct from color-basic-600's lighter #9393AA, which the "+"
  // icon uses -- see Composer.tsx). marginBottom/marginRight dropped:
  // those were tuned for the old absolutely-positioned pill layout: this
  // icon now sits as a plain, vertically-centered sibling inside
  // chatInputControlsRow instead.
  iconSend: {
    tintColor: "text-hint-color",
    ...globalStyle.icon24,
    marginLeft: 8,
  },
  coachAvatar: {
    marginRight: 4,
  },
  coachAvatarIcon: {
    width: 32,
    height: 32,
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
  // COLOR/POSITION HISTORY: several earlier rounds nudged this cluster
  // progressively higher via paddingTop (48 -> 24 -> 8 -> 0) while the
  // "Start a video practice" card still anchored the bottom of the
  // screen. That card is gone now (product report: "remove the start a
  // video practice card"), and the immediate follow-up was the opposite
  // complaint -- "the chat icon and the suggested pill button should move
  // up to the center of the screen, they are too down" -- meaning
  // vertically centered in the now-taller empty space below, not pinned
  // to the very top. justifyContent: 'center' replaces the old
  // paddingTop tuning entirely.
  // `height` is set explicitly at the render call site now (see
  // renderChatEmpty's own BUG FIX comment) rather than relying on flex:1
  // to fill a parent that doesn't reliably stretch to the full chat
  // viewport.
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  // REVERTED (product report: the gray-bg ask was for Home's
  // CoachPromptCard, not this screen -- see the JSX comment above).
  emptyGlowWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  // Persistent top-of-screen placement (see the JSX comment right above
  // where this renders) -- the pill's own `marginTop: 28` above was tuned
  // for sitting further down inside the vertically-centered greeting box;
  // zeroed out here since suggestedTopicsBar already supplies its own
  // top spacing for this different placement.
  suggestedTopicsPillTop: {
    marginTop: 0,
  },
  suggestedTopicsBar: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  // Bottom sheet the pill above opens (see that TouchableOpacity's own
  // comment + the Modal further down this file for the full "why"). Same
  // backdrop/sheet idiom components/DocumentPickerModal.tsx already uses.
  topicsSheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  // Product report: "the suggested topics card border radius is too
  // much you need to reduce it" -- was 24, matches globalStyle.card's own
  // 16px radius (this app's standard card corner) instead.
  topicsSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
});
