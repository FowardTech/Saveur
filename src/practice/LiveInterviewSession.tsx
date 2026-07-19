import React, { memo } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
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

import Text from 'components/Text';
import Container from 'components/Container';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList, LiveInterviewSessionScreenNavigationProp } from 'navigation/types';
import { Interview_Type_Enum, Practice_Mode_Enum } from 'constants/Types';
import { DATA_INTERVIEW_QUESTION_BANK } from 'constants/Data';
import { useFakeRecordingTimer } from 'services/recordingService';
import { useVideoInterviewAnalysis } from 'services/videoAnalysisService';
import * as interviewService from 'services/interviewService';
import * as feedbackService from 'services/feedbackService';

// Live mock-interview screen. For Voice/Text mode, the pulsing gradient orb
// stands in for a real voice-assistant UI (à la ChatGPT voice mode) — there
// is no real audio capture/playback wired up (see services/recordingService.ts)
// and that path is intentionally left untouched here. For Video mode, this
// screen renders a real front-facing <Camera> (react-native-vision-camera +
// react-native-vision-camera-face-detector) and drives on-device face/speech
// analysis via services/videoAnalysisService.ts — see that file for the
// real-vs-heuristic breakdown and native-dependency risk notes.
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
const DEFAULT_QUESTION = 'Tell me a little about yourself and your background.';
const ADVANCE_INTERVAL_SEC = 50;
// How often (ms) buffered on-device camera-frame samples are flushed to the
// backend during a live Video-mode session. Not once per ML-Kit detection
// (15-30x/sec) — see services/videoAnalysisService.ts's own internal
// per-sample throttle for where the buffer's actual resolution is set.
const CAMERA_FRAME_FLUSH_INTERVAL_MS = 5000;

const LiveInterviewSession = memo(() => {
  const { navigate, goBack } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<LiveInterviewSessionScreenNavigationProp>();
  const theme = useTheme();

  const { sessionId, interviewType, mode, company } = route.params ?? { sessionId: '' };
  const isVideoMode = mode === Practice_Mode_Enum.Video;

  const questions = React.useMemo(() => {
    const bank = interviewType && DATA_INTERVIEW_QUESTION_BANK[interviewType];
    return bank && bank.length > 0 ? bank : [DEFAULT_QUESTION];
  }, [interviewType]);

  const { isRecording, seconds, start, stop } = useFakeRecordingTimer();
  const [isMuted, setIsMuted] = React.useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = React.useState(true);
  const [isEnding, setIsEnding] = React.useState(false);
  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [askedQuestions, setAskedQuestions] = React.useState<string[]>([]);
  // Set once a real POST /next-question call succeeds — takes priority over
  // the local bank below. Reset to null whenever a call fails so the local
  // fallback (indexed by questionIndex) is what renders instead.
  const [backendQuestionText, setBackendQuestionText] = React.useState<string | null>(null);
  const isFetchingQuestionRef = React.useRef(false);

  const question =
    backendQuestionText ?? questions[Math.min(questionIndex, questions.length - 1)];
  const isFollowUp = questionIndex > 0;

  // Every ADVANCE_INTERVAL_SEC of "listening" time, ask the real backend for
  // the next question; a lightweight stand-in for a real interviewer
  // deciding it's time for a follow-up. Falls back to advancing through the
  // local static bank if the call fails so the session never gets stuck
  // showing no question at all (see file header comment).
  const advanceQuestion = React.useCallback(async () => {
    if (isFetchingQuestionRef.current) return;
    isFetchingQuestionRef.current = true;
    setQuestionIndex(prev => prev + 1);
    try {
      if (!sessionId) throw new Error('No sessionId — cannot fetch a real next question.');
      const next = await interviewService.getNextQuestion(sessionId);
      setBackendQuestionText(next.text);
    } catch {
      // Offline, backend down, or no sessionId — fall back to the local
      // bank at whatever index we've now advanced to (clamped to its end).
      setBackendQuestionText(null);
    } finally {
      isFetchingQuestionRef.current = false;
    }
  }, [sessionId]);

  React.useEffect(() => {
    if (!isRecording || isAiSpeaking) return;
    if (seconds === 0 || seconds % ADVANCE_INTERVAL_SEC !== 0) return;
    advanceQuestion();
  }, [seconds, isRecording, isAiSpeaking, advanceQuestion]);

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

  React.useEffect(() => {
    start(isVideoMode ? 'video' : 'audio');
    // Simulate the AI "finishing" its question after a couple seconds and
    // handing the floor to the user — purely cosmetic state, no real audio.
    const toListening = setTimeout(() => setIsAiSpeaking(false), 2600);
    return () => clearTimeout(toListening);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Make sure the mic/analysis pipeline is torn down even if the user
  // navigates away without tapping "End Interview" (e.g. the close button).
  React.useEffect(() => {
    return () => {
      if (isVideoMode) {
        videoAnalysis.stopAnalysis().catch(() => {});
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

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  const onToggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (isVideoMode) {
        videoAnalysis.setMuted(next);
      }
      return next;
    });
  };

  const onEnd = async () => {
    if (isEnding) return;
    setIsEnding(true);
    await stop();
    let videoMetrics = isVideoMode ? await videoAnalysis.stopAnalysis() : undefined;
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
            'Could not sync interview',
            err?.message ??
              'Your session ended locally but we could not reach the server to finalize it. Your feedback may be incomplete.',
          );
        }
      }
    } finally {
      navigate('InterviewFeedback', { sessionId, interviewType, videoAnalysis: videoMetrics });
    }
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
            onPress={goBack}
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
                <Flex vertical center style={styles.cameraStateFill}>
                  <ActivityIndicator size="large" color={theme['color-primary-500']} />
                  <Text category="h9-s" center mt={12} status="placeholder">
                    Requesting camera access…
                  </Text>
                </Flex>
              ) : cameraPermissionState === 'denied' ? (
                <Flex vertical center style={[styles.cameraStateFill, styles.cameraStatePadded]}>
                  <Icon
                    pack="eva"
                    name="video-off-outline"
                    style={[globalStyle.icon40, { tintColor: theme['text-placeholder-color'] }]}
                  />
                  <Text category="h8" bold center mt={16}>
                    Camera access needed
                  </Text>
                  <Text category="h9-s" center mt={8} status="placeholder">
                    Enable Camera and Microphone access in Settings to run a video mock interview.
                  </Text>
                  <Button
                    style={{ marginTop: 20 }}
                    size="small"
                    onPress={() => Linking.openSettings()}
                  >
                    Open Settings
                  </Button>
                </Flex>
              ) : !cameraDevice ? (
                <Flex vertical center style={styles.cameraStateFill}>
                  <Text category="h9-s" center status="placeholder">
                    No front camera found on this device.
                  </Text>
                </Flex>
              ) : (
                <>
                  <FaceDetectorCamera
                    ref={videoAnalysis.cameraRef}
                    style={StyleSheet.absoluteFill}
                    device={cameraDevice}
                    isActive={!isEnding}
                    faceDetectionOptions={videoAnalysis.faceDetectionOptions}
                    faceDetectionCallback={faces => videoAnalysis.onFacesDetected(faces)}
                  />
                  <View style={styles.liveIndicatorRow}>
                    <View style={styles.liveIndicatorPill}>
                      <Text category="h10" status="control" bold>
                        {videoAnalysis.liveMetrics.isSmiling ? '😊 Smiling' : '🙂 Looking'}
                      </Text>
                    </View>
                    <View style={styles.liveIndicatorPill}>
                      <Text category="h10" status="control" bold>
                        {videoAnalysis.liveMetrics.isLookingAtCamera ? '👀 Eye contact' : 'Look at camera'}
                      </Text>
                    </View>
                    <View style={styles.liveIndicatorPill}>
                      <Text category="h10" status="control" bold>
                        Fillers: {videoAnalysis.liveMetrics.fillerWordCount}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
            {company ? (
              <Text category="h10" center mt={16} bold status="link">
                Practicing for {company}
              </Text>
            ) : null}
            {isFollowUp ? (
              <Text category="h10" center mt={company ? 4 : 16} status="placeholder">
                Follow-up question {questionIndex + 1}
              </Text>
            ) : null}
            <Text category="h9-s" center mt={company || isFollowUp ? 6 : 16} maxWidth={300} style={{ color: theme['text-placeholder-color'] }}>
              {question}
            </Text>
          </>
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
              {isAiSpeaking ? 'AI is speaking…' : isMuted ? 'Muted' : 'Listening…'}
            </Text>
            {company ? (
              <Text category="h10" center mt={12} bold status="link">
                Practicing for {company}
              </Text>
            ) : null}
            {isFollowUp ? (
              <Text category="h10" center mt={company ? 4 : 12} status="placeholder">
                Follow-up question {questionIndex + 1}
              </Text>
            ) : null}
            <Text category="h9-s" center mt={6} maxWidth={300} style={{ color: theme['text-placeholder-color'] }}>
              {question}
            </Text>
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Text category="h9" center status="placeholder" mb={20}>
          {mm}:{ss}
        </Text>
        <Flex justify="center" itemsCenter>
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
              style={[globalStyle.icon24, { tintColor: isMuted ? '#fff' : theme['text-basic-color'] }]}
            />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onEnd}
            disabled={isEnding}
            style={[styles.endBtn, { backgroundColor: theme['color-danger-500'], opacity: isEnding ? 0.6 : 1 }]}
          >
            <Text category="h8" bold status="control">
              {isEnding ? 'Ending…' : 'End Interview'}
            </Text>
          </TouchableOpacity>
        </Flex>
        {!isRecording ? null : (
          <View style={styles.recDot} />
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
    backgroundColor: '#FF4D4D',
  },
});
