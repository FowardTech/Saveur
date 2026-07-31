import React, { memo } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
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

  const { sessionId, interviewType, mode, company, durationMin } = route.params ?? { sessionId: '' };
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
  const [isMuted, setIsMuted] = React.useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = React.useState(true);
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
  const [backendQuestionText, setBackendQuestionText] = React.useState<string | null>(null);
  // Real question id from the backend, when we have one — needed for Text
  // mode's submitAnswer call below (POST .../answer takes a questionId).
  const [backendQuestionId, setBackendQuestionId] = React.useState<string | null>(null);
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
      if (sessionId) {
        try {
          const next = await interviewService.getNextQuestion(sessionId);
          nextText = next.text;
          nextId = next.questionId ?? null;
        } catch {
          // Offline, backend down — fall back to the local bank at whatever
          // index we're about to advance to.
          nextText = null;
          nextId = null;
        }
      }
      setQuestionIndex(prev => prev + 1);
      setBackendQuestionText(nextText);
      setBackendQuestionId(nextId);
    } finally {
      isFetchingQuestionRef.current = false;
    }
  }, [sessionId]);

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
      if (isVoiceMode) {
        const finalTranscript = await speechToText.stop();
        if (sessionId && finalTranscript.trim()) {
          interviewService
            .submitAnswer(sessionId, {
              questionId: backendQuestionId ?? `local_q${questionIndex}`,
              text: finalTranscript.trim(),
            })
            .catch(err => console.warn('[LiveInterviewSession] voice submitAnswer failed', err));
        }
      }
      if (isVoiceMode || isVideoMode) {
        // Speak a brief acknowledgment and WAIT for it to finish before
        // moving on — this is the "AI responding to what you said" beat
        // that was missing entirely before, and awaiting it (rather than
        // firing-and-forgetting) is what keeps it from being cut off.
        setIsAiSpeaking(true);
        try {
          await speechService.speak(pickAcknowledgment(), i18n.language, {preserveRecordingSession: isVideoMode});
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
    let cancelled = false;
    setIsAiSpeaking(true);
    if (isVoiceMode) speechToText.reset();
    (async () => {
      try {
        await speechService.speak(question, i18n.language, {preserveRecordingSession: isVideoMode});
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, isVoiceMode, isVideoMode]);

  // Video mode only: request real camera+mic permission, then kick off the
  // face-detection/speech-recognition pipeline once granted.
  React.useEffect(() => {
    if (!isVideoMode) return;
    let cancelled = false;
    (async () => {
      const granted = await videoAnalysis.requestPermissions();
      if (cancelled) return;
      setCameraPermissionState(granted ? 'granted' : 'denied');
      if (granted) {
        await videoAnalysis.startAnalysis();
      }
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
  React.useEffect(() => {
    if (!isVideoMode || cameraPermissionState !== 'granted' || !videoAnalysis.device) return;
    videoAnalysis.startVideoRecording();
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
        videoAnalysis.stopVideoRecording().catch(() => {});
        videoAnalysis.stopAnalysis().catch(() => {});
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
          await speechService.speak(CLOSING_STATEMENT(), i18n.language, {preserveRecordingSession: isVideoMode});
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
    await stop();
    speechService.stopSpeaking();
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
            interviewService.reportVideoError(sessionId, reason).catch(() => {});
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
            ).catch(() => {});
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
      navigate('InterviewFeedback', { sessionId, interviewType, videoAnalysis: videoMetrics });
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
        { text: t('common:cancel', { defaultValue: 'Keep going' }), style: 'cancel' },
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
                  <Button
                    style={{ marginTop: 20 }}
                    size="small"
                    onPress={() => Linking.openSettings()}
                  >
                    {t('find:live_open_settings', { defaultValue: 'Open Settings' })}
                  </Button>
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
                  colors={['rgba(124,109,255,0.35)', 'rgba(90,150,255,0.05)']}
                  style={styles.haloFill}
                />
              </Animated.View>
              <Animated.View style={[styles.orb, orbStyle]}>
                <LinearGradient
                  colors={['#6E8CFF', '#9B7BFF', '#C58BFF']}
                  start={{ x: 0.1, y: 0.1 }}
                  end={{ x: 0.9, y: 0.9 }}
                  style={styles.orbFill}
                />
                <LinearGradient
                  colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
                  start={{ x: 0.25, y: 0.15 }}
                  end={{ x: 0.7, y: 0.6 }}
                  style={styles.orbHighlight}
                />
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
    </Container>
  );
});

export default LiveInterviewSession;

const ORB_SIZE = 200;
const HALO_SIZE = ORB_SIZE * 1.6;

const styles = StyleSheet.create({
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
    borderRadius: ORB_SIZE / 2,
    overflow: 'hidden',
  },
  orbFill: {
    ...StyleSheet.absoluteFillObject,
  },
  orbHighlight: {
    ...StyleSheet.absoluteFillObject,
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
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 24,
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
