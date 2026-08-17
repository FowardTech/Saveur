import React, { memo } from 'react';
import { ActivityIndicator, Alert, Image, Linking, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  TopNavigationAction,
  Icon,
  useTheme,
  Button,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation, useRoute } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Camera as FaceDetectorCamera } from 'react-native-vision-camera-face-detector';
import { Camera as VisionCameraBase } from 'react-native-vision-camera';
import Video from 'react-native-video';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';

import Text from 'components/Text';
import Container from 'components/Container';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList, LiveInterviewSessionScreenNavigationProp } from 'navigation/types';
import { Interview_Type_Enum, Practice_Mode_Enum, VideoAnalysisMetrics } from 'constants/Types';
import { DATA_INTERVIEW_QUESTION_BANK } from 'constants/Data';
import { useFakeRecordingTimer } from 'services/recordingService';
import { useVideoInterviewAnalysis } from 'services/videoAnalysisService';
import * as speechService from 'services/speechService';
import { useSpeechToText } from 'services/speechService';
import * as interviewService from 'services/interviewService';
import * as feedbackService from 'services/feedbackService';
import { withTimeout } from 'utils/withTimeout';
import CtaButton from 'components/CtaButton';
import { Images } from 'assets/images';

// Fallback used when videoAnalysis.stopAnalysis() (see onEnd below) is
// abandoned after its own hard timeout — a zeroed-out result is strictly
// better than blocking navigation forever waiting on a native module that
// may never resolve; the camera-summary cross-check right after already
// treats a less-than-ideal on-device result as acceptable, same posture.
const EMPTY_VIDEO_METRICS: VideoAnalysisMetrics = {
  eyeContactPct: 0,
  smilePct: 0,
  avgHeadYaw: 0,
  avgHeadPitch: 0,
  fillerWordCount: 0,
  fillerWordBreakdown: {},
  speakingRateWpm: 0,
  silenceGapCount: 0,
  confidenceScore: 0,
  faceNotVisiblePct: 0,
  multipleFacesPct: 0,
  eyesClosedPct: 0,
  excessiveMovementPct: 0,
};

// Live mock-interview screen. Voice mode now has real audio: the AI's
// question is actually spoken aloud (services/speechService.ts's speak(),
// react-native-tts) and the user's spoken answer is actually transcribed
// on-device (same file's useSpeechToText(), reusing
// @dev-amirzubair/react-native-voice — already a dependency of this project
// via services/videoAnalysisService.ts's Video-mode transcript pipeline).
// The pulsing gradient orb is still a purely visual "who's turn is it"
// indicator (à la ChatGPT voice mode), not a stand-in for missing audio
// anymore. Text mode gets its own distinct typed-answer UI (see the render
// branch below), also backed by a real interviewService.submitAnswer call.
// For Video mode, this screen renders a real front-facing <Camera>
// (react-native-vision-camera + react-native-vision-camera-face-detector)
// and drives on-device face/speech analysis via services/videoAnalysisService.ts
// — see that file for the real-vs-heuristic breakdown and native-dependency
// risk notes.
//
// Adaptive follow-ups: every ADVANCE_INTERVAL_SEC of "listening" time, the
// screen asks the real backend for the next question
// (POST /interviews/sessions/{id}/next-question) — similar to how a real
// interviewer moves to a follow-up once you've had a fair amount of time to
// answer. If that call fails (offline, backend down, etc.) it falls back to
// advancing through the local static bank (constants/Data.ts ->
// DATA_INTERVIEW_QUESTION_BANK) instead of leaving the interview stuck with
// no question — this fallback path is exactly why the mock never needed one
// (it couldn't fail) but a real network call can. The questions actually
// surfaced are tracked in `askedQuestions` and passed into
// interviewService.completeSession so the ended session's record reflects
// what was actually asked.
const DEFAULT_QUESTION = () =>
  i18n.t('find:live_default_question', {
    defaultValue: 'Tell me a little about yourself and your background.',
  });
const ADVANCE_INTERVAL_SEC = 50;
// Falls back to this if a caller ever reaches this screen without a
// durationMin param (only MockInterviewSetup does today, and it always
// passes one) — better to enforce a sane default than to run unbounded.
const DEFAULT_DURATION_MIN = 15;
// Brief, varied spoken transitions played (Voice/Video mode only) between
// the end of the user's answer and the next question — this is what makes
// the interview feel like the AI is actually acknowledging what was said,
// rather than the question just cutting over abruptly. Kept short on
// purpose so it never meaningfully eats into the user's selected time.
const ACKNOWLEDGMENT_KEYS = [
  { key: 'find:live_ack_1', defaultValue: 'Thanks for sharing that.' },
  { key: 'find:live_ack_2', defaultValue: "Got it — let's continue." },
  { key: 'find:live_ack_3', defaultValue: "That's helpful, thank you." },
  { key: 'find:live_ack_4', defaultValue: 'I appreciate that answer.' },
  { key: 'find:live_ack_5', defaultValue: 'Good — noted.' },
];
function pickAcknowledgment(): string {
  const pick = ACKNOWLEDGMENT_KEYS[Math.floor(Math.random() * ACKNOWLEDGMENT_KEYS.length)];
  return i18n.t(pick.key, { defaultValue: pick.defaultValue });
}
// BUG FIX (product report: "it's responding even when the user did not
// speak" / "even when the user did not give an answer it just says thank
// you for the response") — the auto-advance beat below used to always
// play an ACKNOWLEDGMENT_KEYS line, regardless of whether the user
// actually said anything. In Voice mode that's directly checkable (the
// real transcript captured since the question started); in Video mode
// there is NO checkable signal at all — the on-device speech recognizer
// that used to run alongside the camera recording was removed entirely
// (see videoAnalysisService.ts's header comment: it fought VisionCamera
// for the same iOS AVAudioSession and corrupted the recording's audio
// track), so this screen genuinely cannot know whether the user spoke
// during a video-mode turn; the real transcript only exists later via
// server-side transcription of the uploaded video. Rather than keep
// falsely thanking the user for an answer that may not exist, Video mode
// always uses this neutral transition (which doesn't assert anything was
// heard), and Voice mode picks between the two based on whether a real
// transcript was actually captured for that turn.
const NEUTRAL_TRANSITION_KEYS = [
  { key: 'find:live_transition_1', defaultValue: "Let's move to the next question." },
  { key: 'find:live_transition_2', defaultValue: 'Okay, next question.' },
  { key: 'find:live_transition_3', defaultValue: "Let's continue." },
  { key: 'find:live_transition_4', defaultValue: 'Moving on.' },
  { key: 'find:live_transition_5', defaultValue: "Let's keep going." },
];
function pickNeutralTransition(): string {
  const pick = NEUTRAL_TRANSITION_KEYS[Math.floor(Math.random() * NEUTRAL_TRANSITION_KEYS.length)];
  return i18n.t(pick.key, { defaultValue: pick.defaultValue });
}
// Played once, right before the session auto-ends because the user's
// selected duration has elapsed — gives the interview a natural close
// instead of just silently cutting off.
const CLOSING_STATEMENT = () =>
  i18n.t('find:live_closing_statement', {
    defaultValue:
      "That's time for today — nice work. Let's wrap up here and take a look at your feedback.",
  });
// How often (ms) buffered on-device camera-frame samples are flushed to the
// backend during a live Video-mode session. Not once per ML-Kit detection
// (15-30x/sec) — see services/videoAnalysisService.ts's own internal
// per-sample throttle for where the buffer's actual resolution is set.
const CAMERA_FRAME_FLUSH_INTERVAL_MS = 5000;

const LiveInterviewSession = memo(() => {
  const { navigate, goBack } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<LiveInterviewSessionScreenNavigationProp>();
  const theme = useTheme();
  const { t } = useTranslation(['find', 'common']);

  const { sessionId, interviewType, mode, company, durationMin, firstQuestion, firstQuestionId } =
    route.params ?? { sessionId: '' };
  // Counts DOWN from the selected duration rather than up — see the
  // time-limit effect below, which is what actually enforces this (the
  // countdown display alone was never what was missing; nothing compared
  // elapsed time against a limit at all before).
  const durationSeconds = (durationMin ?? DEFAULT_DURATION_MIN) * 60;
  const isVideoMode = mode === Practice_Mode_Enum.Video;
  // Voice and Text used to render the exact same "AI is speaking…" orb UI —
  // Text mode never actually let you type anything. Text mode now gets its
  // own real answer-box interface (see the render branch below) backed by
  // interviewService.submitAnswer, which existed in the service layer
  // already but had no caller anywhere in the app.
  const isTextMode = mode === Practice_Mode_Enum.Text;
  const isVoiceMode = mode === Practice_Mode_Enum.Voice;

  const questions = React.useMemo(() => {
    const bank = interviewType && DATA_INTERVIEW_QUESTION_BANK[interviewType];
    return bank && bank.length > 0 ? bank : [DEFAULT_QUESTION()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewType, i18n.language]);

  const { isRecording, seconds, start, stop } = useFakeRecordingTimer();
  // Read inside advanceQuestion's whiteboard-handoff branch below to
  // compute a remaining-time endsAt without needing `seconds` in that
  // callback's own dependency array (which would recreate it, and every
  // effect that calls it, on every single tick).
  const secondsRef = React.useRef(seconds);
  secondsRef.current = seconds;
  const [isMuted, setIsMuted] = React.useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = React.useState(true);

  // Video-mode ElevenLabs playback ("the AI voice defaults to the device
  // voice instead of ElevenLabs during a video interview") — the AI's
  // speech used to be forced onto react-native-tts's on-device voice for
  // the entire Video-mode interview (see speechService.ts's speak(),
  // preserveRecordingSession) because react-native-nitro-sound (the
  // default ElevenLabs playback engine) has NO option to opt out of
  // managing the shared iOS AVAudioSession, and device logs from a real
  // repro confirmed it fighting VisionCamera's concurrent .playAndRecord
  // recording session for control of it — the confirmed root cause of
  // recorded video interviews coming back with no audio track.
  // react-native-video (already used for interview replay, see
  // InterviewReplay.tsx) DOES expose disableAudioSessionManagement, so it
  // can play the exact same ElevenLabs audio file without touching
  // VisionCamera's session at all. This hidden player (rendered at the
  // bottom of this component's JSX) is that path — Video mode only; Voice
  // mode keeps using speechService.speak()'s normal nitro-sound path
  // unchanged, since there's no camera recording to conflict with there.
  const [videoSpeechSource, setVideoSpeechSource] = React.useState<speechService.ElevenLabsAudioSource | null>(null);
  const [videoSpeechPaused, setVideoSpeechPaused] = React.useState(true);
  const videoSpeechResolveRef = React.useRef<(() => void) | null>(null);
  // True once videoAnalysis.startVideoRecording() has actually been CALLED
  // (see the effect below) — gates the very first question's speakSmart()
  // call in Video mode (see the "speak each question" effect) so
  // VisionCamera's own activateAudioSession()/.playAndRecord category
  // switch, which happens synchronously inside startRecording(), always
  // wins the race against any playback (ElevenLabs-via-RNV OR the
  // on-device fallback) trying to use the audio session first. Without
  // this, both effects fire independently on mount with no ordering
  // between them — the "speak the first question" effect doesn't wait on
  // anything camera-related at all, while startVideoRecording depends on
  // an async permission check + the camera device resolving, so it's
  // entirely possible (and, given a network fetch for the ElevenLabs audio
  // takes real time, quite likely) for TTS/ElevenLabs playback to already
  // be underway by the time VisionCamera activates ITS OWN session and
  // switches category out from under it -- the exact same class of
  // mid-utterance category-switch conflict already diagnosed and fixed for
  // Tts.setDucking (see speechService.ts's preserveRecordingSession
  // comment), just triggered by mount-order timing instead of an explicit
  // per-question call. This is the most likely explanation for recordings
  // made on iOS coming back with NO audio track at all, confirmed by
  // cross-device testing (an iOS-recorded file has no audio on ANY
  // player, while an Android-recorded file plays fine even on iOS) --
  // i.e. the audio was never captured in the first place, not a playback
  // issue, which points squarely at something disrupting VisionCamera's
  // capture-time session setup, and this mount-order race is exactly that.
  const [videoRecordingStarted, setVideoRecordingStarted] = React.useState(false);

  // Stops whatever the hidden player is doing and drops its source —
  // called both when a new utterance's effect gets cancelled/superseded
  // (mirrors speechService.stopSpeaking()'s role in the same cleanup) and
  // isn't needed for a resolved playback (onEnd/onError below already
  // clear the ref themselves).
  const stopVideoModeSpeech = React.useCallback(() => {
    videoSpeechResolveRef.current = null;
    setVideoSpeechPaused(true);
    setVideoSpeechSource(null);
  }, []);

  const speakVideoMode = React.useCallback(async (text: string): Promise<void> => {
    const source = await speechService.fetchElevenLabsAudioUrl(text, i18n.language);
    if (!source) {
      // Fetch failed (offline, backend/ElevenLabs error, timeout) — same
      // safety net Video mode has always had: the on-device voice, not a
      // silent interview.
      await speechService.speak(text, i18n.language, { preserveRecordingSession: true });
      return;
    }
    return new Promise<void>(resolve => {
      videoSpeechResolveRef.current = resolve;
      setVideoSpeechSource(source);
      setVideoSpeechPaused(false);
    });
  }, []);

  // Single entry point every call site below uses instead of calling
  // speechService.speak() directly — picks the right engine per mode so
  // none of the three speaking call sites (question, acknowledgment,
  // closing statement) need their own isVideoMode branching.
  const speakSmart = React.useCallback(async (text: string): Promise<void> => {
    if (isVideoMode) {
      await speakVideoMode(text);
    } else {
      await speechService.speak(text, i18n.language);
    }
  }, [isVideoMode, speakVideoMode]);
  const [isEnding, setIsEnding] = React.useState(false);
  // Deliberately separate from `isEnding` (which flips true immediately on
  // "End Interview", before the real video file has finished being
  // finalized) — the <Camera>'s `isActive` prop must stay true until
  // stopVideoRecording() has actually resolved inside onEnd() below, or
  // deactivating the camera mid-stop risks a corrupt/truncated recording.
  // See onEnd()'s ordering: stopVideoRecording() -> stopAnalysis() ->
  // THEN this flips false.
  const [isCameraActive, setIsCameraActive] = React.useState(true);
  // True only while the real recorded video is uploading, right after the
  // interview ends (Video mode only) — surfaced as a brief status line so
  // "Ending…" doesn't look stuck while a multi-minute recording finishes
  // uploading in the background.
  const [isUploadingVideo, setIsUploadingVideo] = React.useState(false);
  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [askedQuestions, setAskedQuestions] = React.useState<string[]>([]);
  // Set once a real POST /next-question call succeeds — takes priority over
  // the local bank below. Reset to null whenever a call fails so the local
  // fallback (indexed by questionIndex) is what renders instead.
  //
  // BUG FIX (product report: "voice/video interview starts in English,
  // then later changes to the user's preferred language"): this used to
  // always start as `null`, so the very first question shown/spoken was
  // whatever `questions[0]` (the LOCAL, English-only static bank below)
  // held — even though a real, correctly-translated first question already
  // came back from POST /interviews/sessions and was just sitting unused
  // in route.params (see MockInterviewSetup.tsx and navigation/types.tsx's
  // LiveInterviewSession params). Seeding these two from that param means
  // the first question rendered/spoken is the real one from mount, not the
  // English fallback — the "later changes to Spanish" the user saw was
  // just the first real adaptive follow-up finally overwriting it.
  const [backendQuestionText, setBackendQuestionText] = React.useState<string | null>(
    firstQuestion ?? null,
  );
  // Real question id from the backend, when we have one — needed for Text
  // mode's submitAnswer call below (POST .../answer takes a questionId).
  const [backendQuestionId, setBackendQuestionId] = React.useState<string | null>(
    firstQuestionId ?? null,
  );
  const isFetchingQuestionRef = React.useRef(false);

  // Text mode only: what the user is currently typing, and whether their
  // last submit is in flight.
  const [answerText, setAnswerText] = React.useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = React.useState(false);

  const question =
    backendQuestionText ?? questions[Math.min(questionIndex, questions.length - 1)];
  const isFollowUp = questionIndex > 0;

  // Every ADVANCE_INTERVAL_SEC of "listening" time, ask the real backend for
  // the next question; a lightweight stand-in for a real interviewer
  // deciding it's time for a follow-up. Falls back to advancing through the
  // local static bank if the call fails so the session never gets stuck
  // showing no question at all (see file header comment).
  //
  // IMPORTANT: questionIndex/backendQuestionText/backendQuestionId are all
  // set together, in ONE batch, only once we actually know what the next
  // question is (real or fallback) — never before. `question` (derived
  // below) is a function of all three, so committing them separately used
  // to make `question` flip TWICE per advance: once immediately when
  // questionIndex bumped (showing the local fallback text while the network
  // call was still in flight), and again moments later once the real text
  // arrived. That double-flip is what caused the "suddenly changes to the
  // next question" glitch — the TTS effect below re-runs on every `question`
  // change, so the first flip started speaking the fallback text and the
  // second flip yanked it away mid-sentence to speak the real text instead.
  // Resolving the next question fully before touching any of this state
  // fixes that at the source.
  const advanceQuestion = React.useCallback(async () => {
    if (isFetchingQuestionRef.current) return;
    isFetchingQuestionRef.current = true;
    try {
      let nextText: string | null = null;
      let nextId: string | null = null;
      let requiresWhiteboard = false;
      if (sessionId) {
        try {
          const next = await interviewService.getNextQuestion(sessionId);
          nextText = next.text;
          nextId = next.questionId ?? null;
          requiresWhiteboard = !!next.requiresWhiteboard;
        } catch {
          // Offline, backend down — fall back to the local bank at whatever
          // index we're about to advance to.
          nextText = null;
          nextId = null;
        }
      }
      // Product report: "the AI interviewer can ask the user to create some
      // design in the whiteboard as part of the interview questions... the
      // app should automatically navigate the user to the system design
      // whiteboard and the count down timer... should continue counting
      // down until the user finishes... and then the overall feedback of
      // both the two interview (theoretical and practical) should now be
      // generated." The backend (interviews.py's _generate_question)
      // decides this deterministically, never the client — see
      // requiresWhiteboard's own comment on NextQuestionResult. Once it
      // fires, this screen's Q&A loop is done: hand off to the whiteboard
      // with the SAME sessionId (so its own "Finish Interview" completes
      // THIS session via the new combined feedback pipeline, not a
      // separate one) and an absolute endsAt deadline derived from however
      // much of the selected duration is actually left, so the countdown
      // genuinely continues instead of the whiteboard starting a fresh
      // full-length timer of its own.
      if (requiresWhiteboard && sessionId) {
        setBackendQuestionText(nextText);
        setBackendQuestionId(nextId);
        const remainingSec = Math.max(0, durationSeconds - secondsRef.current);
        const endsAt = Date.now() + remainingSec * 1000;
        if ((isVoiceMode || isVideoMode) && nextText) {
          // Speak the handoff instruction itself before leaving — the
          // candidate should hear "let's see this in practice, sketch..."
          // the same way they heard every other question, not just be
          // silently teleported to a blank-looking screen.
          setIsAiSpeaking(true);
          try {
            await speakSmart(nextText);
          } catch {
            // best-effort — a TTS hiccup shouldn't block the handoff
          }
        }
        // Freezes this screen's own countdown/recording loop (clears the
        // interval useFakeRecordingTimer.start() set up) so it sits fully
        // inert underneath the whiteboard rather than continuing to tick,
        // auto-advance, or auto-end in the background — React Navigation's
        // stack keeps this screen mounted under the pushed
        // SystemDesignWhiteboard, it doesn't unmount it.
        try {
          await stop();
        } catch {
          // best-effort — still navigate even if teardown hiccups
        }
        navigate('SystemDesignWhiteboard', {
          sessionId,
          interviewType,
          endsAt,
          designPrompt: nextText ?? undefined,
        });
        return;
      }
      setQuestionIndex(prev => prev + 1);
      setBackendQuestionText(nextText);
      setBackendQuestionId(nextId);
    } finally {
      isFetchingQuestionRef.current = false;
    }
  }, [sessionId, durationSeconds, isVoiceMode, isVideoMode, speakSmart, navigate, interviewType, stop]);

  // Text mode advances on the user's own "Submit Answer" tap (see
  // onSubmitTextAnswer below), not on a listening timer — there's no
  // "AI speaking"/"listening" turn-taking when the user is typing at their
  // own pace, so this timer-based auto-advance is Video/Voice-mode only. In
  // Voice mode, the real spoken-answer transcript accumulated since the
  // question started is submitted (POST .../answer, same real endpoint Text
  // mode uses) before moving on.
  React.useEffect(() => {
    if (isTextMode) return;
    if (!isRecording || isAiSpeaking) return;
    if (seconds === 0 || seconds % ADVANCE_INTERVAL_SEC !== 0) return;
    // Don't kick off another follow-up if we're already at/past the
    // session's selected time limit — the time-up effect below is about to
    // (or just did) end the session, and starting a fresh question right as
    // that happens is exactly the kind of race this whole rewrite is trying
    // to eliminate.
    if (seconds >= durationSeconds) return;
    (async () => {
      // See NEUTRAL_TRANSITION_KEYS's comment above — only Voice mode can
      // ever confirm a real answer was given (Video mode has no live
      // speech signal at all), so hasRealAnswer stays false there and the
      // acknowledgment phrasing below is chosen accordingly.
      let hasRealAnswer = false;
      if (isVoiceMode) {
        const finalTranscript = await speechToText.stop();
        hasRealAnswer = !!finalTranscript.trim();
        if (sessionId && hasRealAnswer) {
          // BUG FIX (product report: AI interviewer language flipping mid-
          // session): this used to be fire-and-forget. advanceQuestion()
          // below calls the backend's "next question" endpoint, which reads
          // this session's message history to build its prompt — if that
          // read raced ahead of this POST actually committing, the backend
          // would generate the next question against STALE history (missing
          // this answer), which is exactly the malformed-prompt shape that
          // was found to trigger the language-drift bug (see interviews.py's
          // _generate_question for the backend-side fix to the same root
          // cause). Awaiting it here removes the race entirely rather than
          // relying only on the backend-side mitigation.
          try {
            await interviewService.submitAnswer(sessionId, {
              questionId: backendQuestionId ?? `local_q${questionIndex}`,
              text: finalTranscript.trim(),
            });
          } catch (err) {
            console.warn('[LiveInterviewSession] voice submitAnswer failed', err);
          }
        }
      }
      if (isVoiceMode || isVideoMode) {
        // Speak a brief acknowledgment (only when a real answer was
        // actually captured) or a neutral transition (silent turn, or
        // Video mode which can never confirm one way or the other), and
        // WAIT for it to finish before moving on — this is the "AI
        // responding to what you said" beat, and awaiting it (rather than
        // firing-and-forgetting) is what keeps it from being cut off.
        setIsAiSpeaking(true);
        try {
          await speakSmart(hasRealAnswer ? pickAcknowledgment() : pickNeutralTransition());
        } catch {
          // best-effort — a TTS hiccup shouldn't block the interview
        }
      }
      await advanceQuestion();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, isRecording, isAiSpeaking, isTextMode, isVoiceMode, isVideoMode, durationSeconds, advanceQuestion]);

  // Text mode: send the typed answer to the real backend
  // (POST .../sessions/{id}/answer — previously implemented in
  // interviewService.ts but never called from anywhere, since no screen had
  // an actual answer-capture UI), then move to the next question. Falls back
  // to a locally-generated question id for the very first question (sourced
  // from the local bank, not a backend next-question call, so it has no real
  // id yet) rather than skipping the submit entirely.
  const onSubmitTextAnswer = React.useCallback(async () => {
    const trimmed = answerText.trim();
    if (!trimmed || isSubmittingAnswer) return;
    setIsSubmittingAnswer(true);
    try {
      if (sessionId) {
        await interviewService.submitAnswer(sessionId, {
          questionId: backendQuestionId ?? `local_q${questionIndex}`,
          text: trimmed,
        });
      }
    } catch (err) {
      // Best-effort — don't block the user from moving on to the next
      // question just because this particular answer failed to sync.
      console.warn('[LiveInterviewSession] submitAnswer failed', err);
    } finally {
      setAnswerText('');
      setIsSubmittingAnswer(false);
      advanceQuestion();
    }
  }, [answerText, isSubmittingAnswer, sessionId, backendQuestionId, questionIndex, advanceQuestion]);

  // Track every question that's actually been shown (including the first)
  // so it can be threaded into completeSession on end.
  React.useEffect(() => {
    setAskedQuestions(prev => (prev[prev.length - 1] === question ? prev : [...prev, question]));
  }, [question]);
  // Only meaningful in Video mode — Voice/Text mode never requests real
  // camera/mic access so this state just stays 'checking' and unused there.
  const [cameraPermissionState, setCameraPermissionState] = React.useState<
    'checking' | 'granted' | 'denied'
  >('checking');

  const videoAnalysis = useVideoInterviewAnalysis();
  // Voice mode only — see services/speechService.ts. Unused (but harmless)
  // in Video/Text mode.
  const speechToText = useSpeechToText();

  React.useEffect(() => {
    start(isVideoMode ? 'video' : 'audio');
    // isAiSpeaking for Voice AND Video mode is now driven entirely by real
    // TTS completion (see the effect below) — Text mode is the only one
    // that never speaks, and it doesn't read isAiSpeaking for anything, so
    // there's nothing left for this mount effect to manage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Voice AND Video mode: speak each question aloud as it appears (first
  // question and every follow-up), then — Voice mode only — start listening
  // for the spoken answer once done. Video mode has its own separate
  // speech/face pipeline (useVideoInterviewAnalysis, wired below) rather
  // than useSpeechToText, so it doesn't touch speechToText at all here; it
  // just needs the audio played so the session feels interactive instead of
  // silent (the user still answers on camera as before).
  React.useEffect(() => {
    if (!isVoiceMode && !isVideoMode) return;
    // Video mode: don't speak until startVideoRecording() has actually been
    // called (see videoRecordingStarted's own comment above) — otherwise
    // this fires on mount with no ordering guarantee against VisionCamera's
    // own session activation, which is the most likely cause of iOS
    // recordings coming back with no audio track at all. Voice mode has no
    // camera/recording session to race against, so it's unaffected.
    //
    // Also unblocks (rather than waiting forever) once it's clear recording
    // is simply never going to happen at all — camera/mic permission was
    // denied, or this device has no front camera (videoAnalysis.device
    // resolves to undefined and stays that way) — either is a dead end
    // videoRecordingStarted would otherwise never flip true for, which
    // would strand the interview on "AI speaking" forever with nothing
    // ever actually said. Both states are already surfaced to the user via
    // their own dedicated UI branches below (denied/no-camera messaging),
    // so there's nothing left to protect by staying silent too.
    const videoRecordingWontHappen =
      cameraPermissionState === 'denied' ||
      (cameraPermissionState === 'granted' && !videoAnalysis.device);
    if (isVideoMode && !videoRecordingStarted && !videoRecordingWontHappen) return;
    let cancelled = false;
    setIsAiSpeaking(true);
    if (isVoiceMode) speechToText.reset();
    (async () => {
      try {
        await speakSmart(question);
      } catch {
        // best-effort — a TTS failure shouldn't strand the session with
        // isAiSpeaking stuck true forever
      }
      if (cancelled) return;
      setIsAiSpeaking(false);
      if (isVoiceMode && !isMuted) {
        await speechToText.start();
      }
    })();
    return () => {
      cancelled = true;
      speechService.stopSpeaking();
      stopVideoModeSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, isVoiceMode, isVideoMode, videoRecordingStarted, cameraPermissionState, videoAnalysis.device]);

  // Video mode only: request real camera+mic permission, then kick off the
  // face-detection/speech-recognition pipeline once granted.
  //
  // REVISED (previous version of this fix caused "This session's video
  // couldn't be saved" — a regression, not a fix): the first attempt at
  // fixing "iOS records no audio track" mounted the <Camera> immediately
  // with audio={false}, then flipped audio to true on that SAME, already-
  // mounted, already-running instance once permission settled. That's a
  // hot reconfiguration of a LIVE AVCaptureSession's audio input, which is
  // a materially riskier operation than configuring it once at initial
  // mount — and very plausibly what broke recording entirely this time
  // (worse than before: previously video always recorded fine, just
  // without audio). Reverted that approach.
  //
  // This version keeps the underlying real fix (don't let VisionCamera's
  // one-shot audio configuration attempt race ahead of
  // AVCaptureDevice.authorizationStatus actually settling) but applies it
  // BEFORE the Camera ever mounts at all, by delaying the
  // cameraPermissionState → 'granted' transition itself — so the Camera
  // component's very FIRST commit already has a settled, confirmed-granted
  // audio permission and a plain, constant `audio` prop, with no later
  // reconfiguration of a live session required.
  React.useEffect(() => {
    if (!isVideoMode) return;
    let cancelled = false;
    (async () => {
      const granted = await videoAnalysis.requestPermissions();
      if (cancelled) return;
      if (!granted) {
        setCameraPermissionState('denied');
        return;
      }
      // Confirm the OS-level authorization has actually settled (see
      // VisionCameraBase.getMicrophonePermissionStatus() — a direct read
      // of AVCaptureDevice.authorizationStatus(for: .audio) on iOS) before
      // ever mounting the Camera, rather than trusting that our own JS
      // permission promise resolving means the native side already agrees.
      // Polled, not a blind delay; 1.5s ceiling before proceeding anyway
      // (same "never block the interview forever on a native module"
      // posture as this file's other hard timeouts) — a real-world case
      // where this never resolves would mean permission wasn't actually
      // granted, which the denied-state UI already covers separately.
      for (let attempt = 0; attempt < 10; attempt++) {
        if (cancelled) return;
        if (VisionCameraBase.getMicrophonePermissionStatus() === 'granted') break;
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      if (cancelled) return;
      setCameraPermissionState('granted');
      await videoAnalysis.startAnalysis();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideoMode]);

  // Starts the REAL on-device video recording (react-native-vision-camera's
  // startRecording()) once the <Camera> below has actually mounted — not in
  // the permission effect above, which fires startAnalysis() the moment
  // permission is granted but BEFORE React has committed the render that
  // mounts <FaceDetectorCamera ref={videoAnalysis.cameraRef} .../>. Gated on
  // the exact same condition that JSX render branch below uses
  // (cameraPermissionState === 'granted' && cameraDevice), so by the time
  // this effect runs, the ref from that same commit is guaranteed attached.
  // This is the fix for "Interview Replay isn't real video" — everything
  // else in this screen already worked without it.
  //
  // ROOT CAUSE OF "iOS records video but no audio" (found by reading
  // VisionCamera's native iOS source, not guessing):
  // - CameraSession.swift's configure() dispatches configureAudioSession()
  //   onto CameraQueues.audioQueue.async — a SEPARATE serial queue from the
  //   one used for video/session setup.
  // - CameraSession+Video.swift's startRecording() runs on
  //   CameraQueues.cameraQueue.async and only initializes an audio track if
  //   `self.audioOutput`/`self.audioDeviceInput` are already non-nil — and
  //   those two properties are ONLY set inside configureAudioSession(), on
  //   the other queue.
  // - cameraQueue and audioQueue have NO ordering guarantee between them.
  //   Video setup always survives because configure()'s video work and
  //   startRecording() both run on the same cameraQueue (FIFO), but if
  //   startRecording() fires before the audioQueue's configureAudioSession()
  //   task has finished, the `if let audioOutput = ..., let audioInput = ...`
  //   guard in startRecording() silently fails — no error thrown, no
  //   callback fired — and recording proceeds video-only. This matches
  //   every observed symptom exactly (100% reproducible, zero surfaced
  //   error) and explains why the earlier permission-timing fix alone
  //   wasn't enough: permission being granted doesn't mean
  //   configureAudioSession() has actually FINISHED running on its own
  //   queue yet.
  // - VisionCamera exposes no JS callback for "audio session configuration
  //   finished", so the safe fix (no touching the `audio` prop again, no
  //   repeat of the earlier hot-reconfiguration regression) is a fixed
  //   delay between the Camera mounting and calling startRecording(),
  //   giving the audioQueue's task time to complete first. Adding/removing
  //   an AVCaptureDeviceInput + AVCaptureAudioDataOutput is normally a
  //   low-tens-of-milliseconds operation, so 600ms was calculated as a
  //   generous safety margin, not a fragile guess.
  //
  // BUG FIX (product report: "the video interview is not capturing the
  // voice of the user again — I thought we solved this issue already"):
  // that 600ms margin was sized assuming a mostly-idle device during this
  // startup window. It wasn't — `startAnalysis()` (called by the
  // permission effect above, which runs and completes BEFORE this effect's
  // timer even starts) flips `isAnalyzingRef.current` true, and this
  // Camera's `faceDetectionCallback={faces => videoAnalysis.onFacesDetected(faces)}`
  // prop means every detected frame starts running its full per-frame ML
  // Kit-derived analysis (gaze/smile/pose/movement signals — several of
  // which were added after this delay was originally tuned) from the
  // moment the camera mounts, i.e. for this entire delay window, not just
  // after recording starts. That's real concurrent CPU work on the same
  // device racing the native audioQueue's one-shot
  // configureAudioSession() for CPU time — on a slower device or under any
  // thermal/background load, 600ms is no longer the generous margin it was
  // calculated to be when this fix was written, and the exact same silent,
  // no-error failure mode returns with zero code having been reverted. No
  // JS-visible signal exists to confirm audio-session-ready (still true,
  // per this fix's original research), so short of patching VisionCamera's
  // native Swift source (a real fix, but not one that can be written and
  // verified without an actual iOS device/build here), a materially larger
  // fixed margin is the safe, low-risk mitigation available from JS.
  React.useEffect(() => {
    if (!isVideoMode || cameraPermissionState !== 'granted' || !videoAnalysis.device) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      videoAnalysis.startVideoRecording();
      // Flips the gate the "speak each question" effect checks (see
      // videoRecordingStarted's own comment) — startRecording()'s native
      // call happens synchronously the moment this line runs, so anything
      // gated on this flag is guaranteed to only attempt playback AFTER
      // that, never racing it.
      setVideoRecordingStarted(true);
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideoMode, cameraPermissionState, videoAnalysis.device]);

  // Make sure the mic/analysis pipeline is torn down even if the user
  // navigates away without tapping "End Interview" (e.g. the close button).
  React.useEffect(() => {
    return () => {
      if (isVideoMode) {
        // Best-effort, no upload attempted here (unlike onEnd() below) —
        // this only fires on an abrupt navigate-away (e.g. the close
        // button) rather than a real "End Interview" tap, so there's no
        // sessionId-scoped completion to attach a video to anyway. This
        // just releases the native recorder so it doesn't keep running.
        videoAnalysis.stopVideoRecording().catch(() => { });
        videoAnalysis.stopAnalysis().catch(() => { });
      } else if (isVoiceMode) {
        speechService.stopSpeaking();
        speechToText.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Video mode only: periodically stream the real on-device face-detection
  // samples buffered by videoAnalysisService to the backend
  // (POST /camera-frame), rather than only at session end. Best-effort — a
  // failed batch is logged, not surfaced, so it never interrupts the live
  // interview (see feedbackService.postCameraFrames).
  React.useEffect(() => {
    if (!isVideoMode || cameraPermissionState !== 'granted' || !sessionId) return;
    const interval = setInterval(() => {
      const frames = videoAnalysis.drainFrameBuffer();
      if (frames.length === 0) return;
      feedbackService.postCameraFrames(sessionId, frames).catch(err => {
        console.warn('[LiveInterviewSession] camera-frame batch upload failed', err);
      });
    }, CAMERA_FRAME_FLUSH_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideoMode, cameraPermissionState, sessionId]);

  // Hard time limit — the actual enforcement of the duration the user
  // picked in MockInterviewSetup. Nothing compared elapsed time against a
  // limit before this; the on-screen timer was purely cosmetic and the
  // adaptive follow-up effect above would happily keep firing forever. Once
  // `seconds` reaches the selected duration, this fires exactly once (guarded
  // by the ref so it can't double-fire if `seconds` ticks again before
  // onEnd's teardown finishes), speaks a short closing line in Voice/Video
  // mode, then calls the same onEnd() the "End Interview" button uses — so
  // feedback generation and teardown are identical either way.
  const hasEndedForTimeRef = React.useRef(false);
  React.useEffect(() => {
    if (hasEndedForTimeRef.current) return;
    if (seconds < durationSeconds) return;
    hasEndedForTimeRef.current = true;
    (async () => {
      if (isVoiceMode || isVideoMode) {
        setIsAiSpeaking(true);
        try {
          await speakSmart(CLOSING_STATEMENT());
        } catch {
          // best-effort — still end the session even if the closing line
          // fails to play
        }
      }
      onEnd();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, durationSeconds, isVoiceMode, isVideoMode]);

  // Breathing pulse animation for the orb.
  const pulse = useSharedValue(0);
  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * (isAiSpeaking ? 0.09 : 0.05) }],
    opacity: 0.92 + pulse.value * 0.08,
  }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1.15 + pulse.value * 0.18 }],
    opacity: 0.35 - pulse.value * 0.2,
  }));

  // Counts DOWN to 0 from the selected duration (was counting up forever
  // with no relationship to what the user picked) — this is the visible
  // half of the fix; the time-up effect above is what actually enforces it.
  const remainingSeconds = Math.max(0, durationSeconds - seconds);
  const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const ss = String(remainingSeconds % 60).padStart(2, '0');

  // Video mode no longer has a real mute action: it used to just stop/start
  // videoAnalysisService's on-device speech recognizer, which has been
  // removed entirely (see that file's header comment — it was fighting
  // VisionCamera's own recording for the microphone, which is the actual
  // fix for "no audio in the replay"). There's nothing left for a
  // client-side mute to meaningfully pause — the camera keeps recording
  // real audio the whole interview regardless — so the mute control is
  // hidden for Video mode below (isTextMode || isVideoMode ? null : ...)
  // rather than kept as a button that visibly does nothing.
  const onToggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (isVoiceMode) {
        if (next) {
          speechToText.stop();
        } else if (!isAiSpeaking) {
          speechToText.start();
        }
      }
      return next;
    });
  };

  const onEnd = async () => {
    if (isEnding) return;
    setIsEnding(true);
    // BUG FIX (product report: "the end interview just keep saying ending
    // interview and it refuses to let me close... it just freezes the
    // screen") — everything from here down to the existing try/finally a
    // little further below used to run with NO surrounding try/catch at
    // all. withTimeout (see utils/withTimeout.ts) only ever protected
    // against one of its wrapped promises HANGING, never against one of
    // them REJECTING (a real native error, not just slowness) — a
    // rejection propagated straight out of this function, which meant (a)
    // the `finally { navigate(...) }` a bit further down never ran, and
    // (b) `isEnding` (set true just above) never got reset anywhere in
    // this file. onCloseAttempt (the X button) and the End Interview
    // button both check `isEnding` before doing anything, so the combined
    // effect was exactly "frozen, refuses to let me close" — no exception
    // ever surfaced to the user, it just silently went nowhere. withTimeout
    // itself is now fixed to swallow rejections too, not just hangs (see
    // its own comment), but this outer try/catch is a second, independent
    // safety net: no matter what unexpectedly throws in this whole
    // teardown sequence, execution still falls through to the video-
    // metrics/complete-session stage and its own guaranteed-to-run
    // `finally { navigate(...) }`, so the user is never stuck on this
    // screen again.
    try {
      await stop();
      speechService.stopSpeaking();
    } catch (err) {
      console.warn('[LiveInterviewSession] pre-teardown step failed, continuing anyway', err);
    }
    if (isVoiceMode) {
      // Was a bare `await` on a native-module bridge promise
      // (react-native-voice's Voice.stop()) with no timeout at all — this is
      // the actual root cause of "stuck on Saving your Recording forever"
      // for at least some reports: if the native side never fires its
      // resolve/reject callback (a known class of RN native-module edge
      // case), this await hung forever, and since `navigate()` only ever
      // runs after this whole chain settles, the user was stuck with no way
      // out (isEnding disables both End Interview and the X button the
      // instant onEnd starts). withTimeout gives every hang-prone step in
      // this teardown a hard ceiling instead.
      await withTimeout(speechToText.stop(), 5000, '');
    }
    // Stop the real video recording BEFORE deactivating the camera view
    // below (isCameraActive) — stopVideoRecording() awaits the file
    // actually being finalized on disk (VisionCamera's onRecordingFinished)
    // AND, since the persistent-storage fix, a move of that file into the
    // app's Document directory — both can legitimately take well past a
    // few seconds for a longer recording on a slower device.
    //
    // THIS is why "no video was recorded for this session" kept happening
    // even after the persistent-storage-path + upload-retry-queue fix:
    // videoAnalysis.stopVideoRecording()'s promise was being raced against
    // a 15s withTimeout, and on timeout the function returned `null` and
    // the caller (below) just... never uploaded anything. The recording
    // itself was fine and finishing correctly, on disk, in the app's own
    // persistent folder — it was this UI-wait ceiling silently throwing
    // the reference away the moment it ran a beat past 15s, which a 30-60
    // minute video-mode interview on a mid-range phone does routinely.
    //
    // Fixed by decoupling "how long this screen waits" from "whether the
    // video ever gets uploaded": the upload is now attached directly to
    // stopVideoRecording()'s own promise (see recordedVideoPromise.then
    // below), which is NEVER abandoned — it keeps running and will upload
    // the video whenever VisionCamera actually finishes, even if that's
    // well after this screen has already navigated to Feedback. The
    // withTimeout below only bounds how long the on-screen "Saving your
    // recording…" wait lasts, purely a UX nicety now, not a correctness
    // gate.
    const recordedVideoPromise = isVideoMode
      ? videoAnalysis.stopVideoRecording()
      : Promise.resolve(null);
    if (isVideoMode && sessionId) {
      recordedVideoPromise
        .then(async video => {
          if (!video) {
            // The recording itself never produced a file to upload --
            // report WHY, not just that it happened. getRecordingError()
            // holds the real native reason (insufficient storage,
            // session/camera-not-ready surviving its retry, etc.) set by
            // videoAnalysisService's startVideoRecording/stopVideoRecording
            // — see that file's lastRecordingErrorRef comment. Previously
            // this was invisible: a console.warn on-device and nothing
            // else, which is exactly why repeated "no video was recorded"
            // reports were impossible to diagnose past guessing.
            const reason = videoAnalysis.getRecordingError() ?? 'unknown: stopVideoRecording resolved null with no reason set';
            interviewService.reportVideoError(sessionId, reason).catch(() => { });
            return;
          }
          setIsUploadingVideo(true);
          try {
            // uploadSessionVideoResilient enqueues to its AsyncStorage
            // retry queue as its very first step (before attempting any
            // network call) — safe to call from here even long after this
            // component has unmounted/navigated away.
            await interviewService.uploadSessionVideoResilient(
              sessionId, video.path, video.durationSec,
            );
          } catch (err) {
            console.warn('[LiveInterviewSession] deferred video upload failed, queued for retry', err);
            // Not necessarily a permanent failure -- flushPendingVideoUploads
            // will keep retrying from the queue -- but reporting it now
            // still gives visibility into how often this path gets hit at
            // all, and what the error looks like when it does.
            interviewService.reportVideoError(
              sessionId, `upload_failed (will retry): ${err instanceof Error ? err.message : String(err)}`,
            ).catch(() => { });
          } finally {
            setIsUploadingVideo(false);
          }
        })
        .catch(err => console.warn('[LiveInterviewSession] video finalize failed', err));
    }
    // Value intentionally discarded — this await exists only to bound how
    // long onEnd() (and the "Saving your recording…" wait it drives) lasts
    // before navigating on; the upload itself was already wired up above
    // and does not depend on this resolving in time.
    await withTimeout(recordedVideoPromise, 15000, null);
    let videoMetrics = isVideoMode
      ? await withTimeout(videoAnalysis.stopAnalysis(), 8000, EMPTY_VIDEO_METRICS)
      : undefined;
    if (isVideoMode) setIsCameraActive(false);
    try {
      if (isVideoMode && sessionId) {
        // Flush any samples buffered since the last periodic upload, then
        // fetch the backend's own aggregation as a cross-check/replacement
        // for the frame-derived fields specifically (eye contact / smile /
        // head yaw+pitch) — speech metrics (fillers, pace, silence,
        // confidenceScore) stay the on-device values since /camera-summary
        // doesn't cover them (see feedbackService.getCameraSummary).
        const leftoverFrames = videoAnalysis.drainFrameBuffer();
        try {
          if (leftoverFrames.length > 0) {
            await feedbackService.postCameraFrames(sessionId, leftoverFrames);
          }
          const summary = await feedbackService.getCameraSummary(sessionId);
          if (videoMetrics) {
            videoMetrics = {
              ...videoMetrics,
              eyeContactPct: summary.eyeContactPct,
              smilePct: summary.smilePct,
              avgHeadYaw: summary.avgHeadYaw,
              avgHeadPitch: summary.avgHeadPitch,
            };
          }
        } catch (err) {
          // Backend cross-check unavailable — the on-device aggregation
          // from videoAnalysis.stopAnalysis() above is a complete, real
          // result on its own, so just keep it rather than blocking on this.
          console.warn('[LiveInterviewSession] camera-summary fetch failed, using on-device metrics', err);
        }
      }
      if (sessionId) {
        try {
          await interviewService.completeSession(sessionId, videoMetrics, askedQuestions);
        } catch (err: any) {
          Alert.alert(
            t('find:live_sync_failed_title', { defaultValue: 'Could not sync interview' }),
            err?.message ??
            t('find:live_sync_failed_message', {
              defaultValue:
                'Your session ended locally but we could not reach the server to finalize it. Your feedback may be incomplete.',
            }),
          );
        }
      }
      // Real video upload — the actual "watch the moment back" feature.
      // Best-effort: a failed/slow upload should never block finishing the
      // interview or navigating to Feedback (every other part of the
      // session — transcript, scores, camera/voice metrics — was already
      // saved independently of this). The actual upload call now lives on
      // recordedVideoPromise.then() above, not here — see that block's
      // comment for why: it must fire no matter how long the recording
      // takes to finalize, not just when it beats a fixed UI-wait ceiling.
    } finally {
      // Product request: "success screens aside the success screens for
      // the subscription payment" — a completed mock interview used to
      // land directly on Feedback with zero acknowledgment that the
      // session itself was done; same dedicated-success-screen treatment
      // signup/password-reset/subscription payment already get, via the
      // same shared SuccessScr/NotificationScreen this app already uses
      // for those (see src/SuccessScr.tsx).
      navigate('SuccessScr', {
        successScr: {
          title: t('find:interview_complete_title', { defaultValue: 'Interview complete!' }) as string,
          description: t('find:interview_complete_body', {
            defaultValue: "Nice work. Your feedback is ready — let's see how you did.",
          }) as string,
          children: [
            {
              title: t('find:interview_view_feedback_cta', { defaultValue: 'View Feedback' }),
              onPress: () =>
                navigate('InterviewFeedback', { sessionId, interviewType, videoAnalysis: videoMetrics }),
              status: 'basic',
            },
          ],
          buttonsViewStyle: { marginHorizontal: 32 },
        },
      });
    }
  };

  // The top-left "X" used to call goBack() directly -- zero teardown, no
  // upload, nothing. The useEffect cleanup above still fires on unmount and
  // stops the recorder so it doesn't keep running, but explicitly does NOT
  // call uploadSessionVideo() or completeSession() (see its own comment) --
  // a completely natural tap (X is the universal "leave this screen"
  // affordance) silently threw away the entire recording and skipped
  // feedback generation, with no warning at all. This was the actual
  // "video replay was never saved" bug: the fix that shipped earlier
  // (adding the file:// prefix in stopVideoRecording()) only touches the
  // onEnd() path below, which the X button never reached. Now confirms
  // first, and offers the correct "finish properly" path instead of
  // silently discarding.
  const onCloseAttempt = () => {
    if (isEnding) return;
    Alert.alert(
      t('find:live_leave_title', { defaultValue: 'Leave this interview?' }),
      isVideoMode
        ? t('find:live_leave_video_message', {
          defaultValue:
            'Leaving now discards your recording and you won’t get feedback. Tap "End Interview" instead to save your video and see your results.',
        })
        : t('find:live_leave_message', {
          defaultValue:
            'Leaving now discards this session and you won’t get feedback. Tap "End Interview" instead to save your progress and see your results.',
        }),
      [
        { text: t('find:live_leave_keep_going', { defaultValue: 'Keep going' }), style: 'cancel' },
        {
          text: t('find:live_leave_discard', { defaultValue: 'Discard' }),
          style: 'destructive',
          onPress: goBack,
        },
        {
          text: t('find:live_leave_end_and_save', { defaultValue: 'End & save' }),
          onPress: onEnd,
        },
      ],
    );
  };

  // Local alias so TS narrows CameraDevice | undefined -> CameraDevice
  // cleanly inside the ternary below.
  const cameraDevice = videoAnalysis.device;

  return (
    <Container style={styles.container}>
      <TopNavigation
        title=""
        accessoryLeft={() => (
          <TopNavigationAction
            icon={props => <Icon {...props} name="close-outline" />}
            onPress={onCloseAttempt}
          />
        )}
        accessoryRight={
          interviewType === Interview_Type_Enum.SystemDesign
            ? () => (
              <TopNavigationAction
                icon={props => <Icon {...props} pack="eva" name="edit-2-outline" />}
                onPress={() => navigate('SystemDesignWhiteboard')}
              />
            )
            : undefined
        }
      />
      <View style={styles.body}>
        {isVideoMode ? (
          <>
            <View style={styles.cameraWrap}>
              {cameraPermissionState === 'checking' ? (
                <Flex vertical center justify="center" style={styles.cameraStateFill}>
                  <ActivityIndicator size="large" color={theme['color-primary-500']} />
                  <Text category="h9-s" center mt={12} status="placeholder">
                    {t('find:live_requesting_camera', { defaultValue: 'Requesting camera access…' })}
                  </Text>
                </Flex>
              ) : cameraPermissionState === 'denied' ? (
                <Flex vertical center justify="center" style={[styles.cameraStateFill, styles.cameraStatePadded]}>
                  <Icon
                    pack="eva"
                    name="video-off-outline"
                    style={[globalStyle.icon40, { tintColor: theme['text-placeholder-color'] }]}
                  />
                  <Text category="h8" bold center mt={16}>
                    {t('find:live_camera_access_needed', { defaultValue: 'Camera access needed' })}
                  </Text>
                  <Text category="h9-s" center mt={8} status="placeholder">
                    {t('find:live_camera_access_description', {
                      defaultValue: 'Enable Camera and Microphone access in Settings to run a video mock interview.',
                    })}
                  </Text>
                  <CtaButton
                    style={{ marginTop: 20 }}
                    size="small"
                    onPress={() => Linking.openSettings()}
                  >
                    {t('find:live_open_settings', { defaultValue: 'Open Settings' })}
                  </CtaButton>
                </Flex>
              ) : !cameraDevice ? (
                <Flex vertical center justify="center" style={styles.cameraStateFill}>
                  <Text category="h9-s" center status="placeholder">
                    {t('find:live_no_camera', { defaultValue: 'No front camera found on this device.' })}
                  </Text>
                </Flex>
              ) : (
                <>
                  <FaceDetectorCamera
                    ref={videoAnalysis.cameraRef}
                    style={StyleSheet.absoluteFill}
                    device={cameraDevice}
                    // Required on Android whenever videoBitRate is set (see
                    // videoAnalysisService.ts's format/useCameraFormat
                    // comment) — Android throws format/format-required and
                    // fails camera init entirely without this, which is what
                    // was causing the black-screen-with-no-preview report.
                    format={videoAnalysis.format}
                    isActive={isCameraActive}
                    // Enables the real video+audio recording pipeline this
                    // screen now drives via videoAnalysis.startVideoRecording/
                    // stopVideoRecording (services/videoAnalysisService.ts) —
                    // without these two, startRecording() has nothing to
                    // record. videoBitRate="low" keeps a multi-minute
                    // talking-head recording upload-able; both props pass
                    // straight through to the underlying VisionCamera (see
                    // react-native-vision-camera-face-detector's Camera.tsx:
                    // `<VisionCamera {...props} ref={ref} .../>`).
                    // Plain, constant props again — audio is safe as a
                    // one-shot `true` here because by the time this
                    // component ever mounts, cameraPermissionState is
                    // already 'granted' via the REVISED permission effect
                    // above, which now itself waits for
                    // VisionCameraBase.getMicrophonePermissionStatus() to
                    // confirm 'granted' before flipping that state. So
                    // VisionCamera's one-shot audio configuration attempt
                    // (see that effect's own comment) already happens at a
                    // safe, settled moment on this component's very FIRST
                    // commit — no later hot-reconfiguration of a live
                    // session needed, which is what the previous version of
                    // this fix did and which caused a new "video couldn't
                    // be saved" regression.
                    video
                    audio
                    videoBitRate="low"
                    faceDetectionOptions={videoAnalysis.faceDetectionOptions}
                    faceDetectionCallback={faces => videoAnalysis.onFacesDetected(faces)}
                    // Camera init failures are rare after the format fix
                    // above, but still worth a console trail (device logs)
                    // rather than being silently swallowed — no on-screen
                    // banner though, that was a one-time diagnostic aid for
                    // tracking down the format/format-required bug and is
                    // no longer needed now that it's fixed.
                    onError={(e) => console.warn('[LiveInterviewSession] camera error', e.code, e.message)}
                  />
                  <View style={styles.liveIndicatorRow}>
                    <View style={styles.liveIndicatorPill}>
                      <Text category="h10" status="control" bold>
                        {videoAnalysis.liveMetrics.isSmiling
                          ? t('find:live_smiling', { defaultValue: '😊 Smiling' })
                          : t('find:live_looking', { defaultValue: '🙂 Looking' })}
                      </Text>
                    </View>
                    <View style={styles.liveIndicatorPill}>
                      <Text category="h10" status="control" bold>
                        {videoAnalysis.liveMetrics.isLookingAtCamera
                          ? t('find:live_eye_contact', { defaultValue: '👀 Eye contact' })
                          : t('find:live_look_at_camera', { defaultValue: 'Look at camera' })}
                      </Text>
                    </View>
                    {/* BUG FIX (product report: "it's only flagging the eye
                        contact — it should flag any other things that it
                        thinks could make the user lose focus") — a single
                        conditional pill (not three permanent ones, which
                        would clutter the preview) for whichever real,
                        ML-Kit-derived focus-loss signal is most severe right
                        now. Priority: no face at all > someone else in
                        frame > eyes closed — excessive head-movement stays
                        summary-only (see InterviewFeedback.tsx) rather than
                        live, since a single frame-to-frame jump is too
                        noisy to flag moment-to-moment without it just
                        flickering constantly. */}
                    {!videoAnalysis.liveMetrics.isFaceVisible ? (
                      <View style={[styles.liveIndicatorPill, styles.liveIndicatorPillWarning]}>
                        <Text category="h10" status="control" bold>
                          {t('find:live_face_not_visible', { defaultValue: "😕 Can't see you" })}
                        </Text>
                      </View>
                    ) : videoAnalysis.liveMetrics.hasMultipleFaces ? (
                      <View style={[styles.liveIndicatorPill, styles.liveIndicatorPillWarning]}>
                        <Text category="h10" status="control" bold>
                          {t('find:live_multiple_faces', { defaultValue: '👥 Multiple faces' })}
                        </Text>
                      </View>
                    ) : videoAnalysis.liveMetrics.isEyesClosed ? (
                      <View style={[styles.liveIndicatorPill, styles.liveIndicatorPillWarning]}>
                        <Text category="h10" status="control" bold>
                          {t('find:live_eyes_closed', { defaultValue: '😴 Eyes closed' })}
                        </Text>
                      </View>
                    ) : null}
                    {/* Was a live "Fillers: N" pill, driven by
                        videoAnalysisService's on-device speech recognizer —
                        removed along with that recognizer (see
                        services/videoAnalysisService.ts's header comment):
                        it was fighting VisionCamera's own recording for the
                        microphone the entire interview, which is the actual
                        cause of recorded interviews coming back with no
                        audio. Only the two purely visual (ML Kit,
                        audio-session-free) indicators remain. */}
                  </View>
                </>
              )}
            </View>
            {company ? (
              <Text category="h10" center mt={16} bold status="link">
                {t('find:live_practicing_for', { defaultValue: 'Practicing for {{company}}', company })}
              </Text>
            ) : null}
            {isFollowUp ? (
              <Text category="h10" center mt={company ? 4 : 16} status="placeholder">
                {t('find:live_followup_question', {
                  defaultValue: 'Follow-up question {{n}}',
                  n: questionIndex + 1,
                })}
              </Text>
            ) : null}
            <Text
              category="h9-s"
              center
              mt={company || isFollowUp ? 6 : 16}
              maxWidth={300}
              numberOfLines={4}
              ellipsizeMode="tail"
              style={{ color: theme['text-placeholder-color'] }}>
              {question}
            </Text>
          </>
        ) : isTextMode ? (
          <View style={styles.textModeWrap}>
            {company ? (
              <Text category="h10" center mb={4} bold status="link">
                {t('find:live_practicing_for', { defaultValue: 'Practicing for {{company}}', company })}
              </Text>
            ) : null}
            {isFollowUp ? (
              <Text category="h10" center mb={4} status="placeholder">
                {t('find:live_followup_question', {
                  defaultValue: 'Follow-up question {{n}}',
                  n: questionIndex + 1,
                })}
              </Text>
            ) : null}
            <Text
              category="h7"
              bold
              center
              mb={20}
              maxWidth={320}
              numberOfLines={4}
              ellipsizeMode="tail"
              style={{ color: theme['text-basic-color'] }}>
              {question}
            </Text>
            <TextInput
              style={[
                styles.textAnswerInput,
                {
                  color: theme['text-basic-color'],
                  backgroundColor: theme['background-basic-color-2'],
                  borderColor: theme['border-basic-color-3'],
                },
              ]}
              placeholder={t('find:live_type_answer_placeholder', { defaultValue: 'Type your answer here…' }).toString()}
              placeholderTextColor={theme['text-placeholder-color']}
              value={answerText}
              onChangeText={setAnswerText}
              multiline
              textAlignVertical="top"
              editable={!isSubmittingAnswer}
            />
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onSubmitTextAnswer}
              disabled={!answerText.trim() || isSubmittingAnswer}
              style={[
                styles.submitAnswerBtn,
                {
                  backgroundColor: theme['color-primary-500'],
                  opacity: !answerText.trim() || isSubmittingAnswer ? 0.5 : 1,
                },
              ]}
            >
              <Text category="h8" bold status="control">
                {isSubmittingAnswer
                  ? t('find:live_submitting', { defaultValue: 'Submitting…' })
                  : t('find:live_submit_answer', { defaultValue: 'Submit Answer' })}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Flex vertical center style={styles.orbWrap}>
              <Animated.View style={[styles.halo, haloStyle]}>
                <LinearGradient
                  colors={['rgba(90,150,255,0.35)', 'rgba(90,150,255,0.05)']}
                  style={styles.haloFill}
                />
              </Animated.View>
              {/* Redesign (explicit product request — "replace the pink
                  circle design... with image 4"): was the same two-layer
                  purple/pink LinearGradient sphere as VoiceCoachView.tsx
                  (see that file's own comment) — now Images.voiceOrb,
                  same image, same reasoning. */}
              <Animated.View style={[styles.orb, orbStyle]}>
                <Image source={Images.voiceOrb} style={styles.orbImage} resizeMode="contain" />
              </Animated.View>
            </Flex>

            <Text category="h7" bold center mt={28} style={{ color: theme['text-basic-color'] }}>
              {isAiSpeaking
                ? t('find:live_ai_speaking', { defaultValue: 'AI is speaking…' })
                : isMuted
                  ? t('find:live_muted', { defaultValue: 'Muted' })
                  : t('find:live_listening', { defaultValue: 'Listening…' })}
            </Text>
            {company ? (
              <Text category="h10" center mt={12} bold status="link">
                {t('find:live_practicing_for', { defaultValue: 'Practicing for {{company}}', company })}
              </Text>
            ) : null}
            {isFollowUp ? (
              <Text category="h10" center mt={company ? 4 : 12} status="placeholder">
                {t('find:live_followup_question', {
                  defaultValue: 'Follow-up question {{n}}',
                  n: questionIndex + 1,
                })}
              </Text>
            ) : null}
            <Text
              category="h9-s"
              center
              mt={6}
              maxWidth={300}
              numberOfLines={4}
              ellipsizeMode="tail"
              style={{ color: theme['text-placeholder-color'] }}>
              {question}
            </Text>
            {!isAiSpeaking && speechToText.transcript ? (
              <Text category="h10" center mt={16} maxWidth={300} numberOfLines={3} style={{ color: theme['text-hint-color'] }}>
                “{speechToText.transcript}”
              </Text>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Text category="h9" center status="placeholder" mb={isUploadingVideo ? 4 : 20}>
          {mm}:{ss}
        </Text>
        {isUploadingVideo ? (
          <Text category="h10" center status="placeholder" mb={16}>
            {t('find:live_saving_recording', { defaultValue: 'Saving your recording…' })}
          </Text>
        ) : null}
        <Flex justify="center" itemsCenter>
          {isTextMode || isVideoMode ? null : (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onToggleMute}
              style={[
                styles.controlBtn,
                { backgroundColor: isMuted ? theme['color-danger-500'] : theme['background-basic-color-2'] },
              ]}
            >
              <Icon
                pack="assets"
                name={isMuted ? 'mute' : 'call'}
                style={[globalStyle.icon24, { tintColor: isMuted ? theme['text-primary-color'] : theme['text-basic-color'] }]}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onEnd}
            disabled={isEnding}
            style={[styles.endBtn, { backgroundColor: theme['color-danger-500'], opacity: isEnding ? 0.6 : 1 }]}
          >
            <Text category="h8" bold status="control">
              {isEnding
                ? t('find:live_ending', { defaultValue: 'Ending…' })
                : t('find:live_end_interview', { defaultValue: 'End Interview' })}
            </Text>
          </TouchableOpacity>
        </Flex>
        {!isRecording ? null : (
          <View style={[styles.recDot, { backgroundColor: theme['color-danger-100'] }]} />
        )}
      </View>
      {/* Hidden ElevenLabs player for Video mode — see videoSpeechSource's
         own comment above. 1x1/opacity 0 rather than 0x0: some players
         skip decoding entirely for a zero-size view, since that's
         normally a signal nothing is ever going to be visible. Never
         rendered in Voice/Text mode (videoSpeechSource only ever gets set
         from speakVideoMode, which speakSmart only calls in Video mode). */}
      {videoSpeechSource ? (
        <Video
          source={{ uri: videoSpeechSource.uri, headers: videoSpeechSource.headers }}
          paused={videoSpeechPaused}
          disableAudioSessionManagement
          ignoreSilentSwitch="ignore"
          style={styles.hiddenSpeechPlayer}
          onEnd={() => {
            setVideoSpeechPaused(true);
            videoSpeechResolveRef.current?.();
            videoSpeechResolveRef.current = null;
          }}
          onError={() => {
            // Playback failed after all — resolve anyway so the interview
            // moves on rather than hanging; the question was already
            // fetched successfully so there's no fallback-to-on-device
            // retry here (same "don't strand isAiSpeaking" posture as
            // every other catch block around speakSmart's call sites).
            videoSpeechResolveRef.current?.();
            videoSpeechResolveRef.current = null;
          }}
        />
      ) : null}
    </Container>
  );
});

export default LiveInterviewSession;

const ORB_SIZE = 200;
const HALO_SIZE = ORB_SIZE * 1.6;

const styles = StyleSheet.create({
  // Hidden ElevenLabs player, Video mode only — see videoSpeechSource's
  // comment near the top of this component. 1x1 + opacity 0 (not 0x0):
  // some native video players treat a zero-size view as "never going to
  // be visible" and skip decoding entirely, which would silently break
  // this the exact same way the original bug looked (audio track exists,
  // nothing audible).
  hiddenSpeechPlayer: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  container: {
    // No hardcoded background here anymore — Container (ui-kitten Layout)
    // already picks up background-basic-color-1 from the active theme, so
    // this screen now follows the app's real light/dark setting instead of
    // always forcing a dark background regardless of theme.
    flex: 1,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    // Was unbounded before — a long backend-generated question plus the
    // company/follow-up labels plus (Voice mode) the live transcript quote
    // could add up to more height than this flex region actually has, and
    // with no clipping the overflow rendered straight through into the
    // footer below, visually colliding with the timer. Capping question
    // text to 4 lines (see the Text elements above) keeps this from
    // happening in the first place; this is just a backstop.
    overflow: 'hidden',
  },
  orbWrap: {
    width: HALO_SIZE,
    height: HALO_SIZE,
  },
  halo: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloFill: {
    width: '100%',
    height: '100%',
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
  },
  orbImage: {
    width: '100%',
    height: '100%',
  },
  textModeWrap: {
    width: '100%',
  },
  textAnswerInput: {
    width: '100%',
    minHeight: 160,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
  },
  submitAnswerBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  cameraStateFill: {
    flex: 1,
    width: '100%',
  },
  cameraStatePadded: {
    paddingHorizontal: 24,
  },
  liveIndicatorRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  liveIndicatorPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  // Warmer, more attention-grabbing fill than the neutral pill above —
  // this one only ever appears when something's actually wrong (see the
  // conditional pill's own comment), so it should read as a real flag.
  liveIndicatorPillWarning: {
    backgroundColor: 'rgba(230,83,53,0.75)',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  endBtn: {
    paddingHorizontal: 28,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recDot: {
    position: 'absolute',
    top: -4,
    right: 24,
    width: 8,
    height: 8,
    borderRadius: 4,
    // Color applied inline at the usage site (theme['color-danger-100']) —
    // this is a plain StyleSheet.create block, not ui-kitten's themed
    // StyleService, so it can't resolve a theme token string on its own.
  },
});
