import React from 'react';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
} from 'react-native-vision-camera';
import type {VideoFile} from 'react-native-vision-camera';
import type {Face, FrameFaceDetectionOptions} from 'react-native-vision-camera-face-detector';
import Voice from '@dev-amirzubair/react-native-voice';
import type {
  SpeechEndEvent,
  SpeechErrorEvent,
  SpeechResultsEvent,
  SpeechStartEvent,
} from '@dev-amirzubair/react-native-voice';
import i18n from 'i18next';

import {VideoAnalysisMetrics} from 'constants/Types';
import {getSttLocale} from 'constants/languages';

// ---------------------------------------------------------------------------
// videoAnalysisService — REAL on-device camera + speech analysis for
// Video-mode mock interviews.
//
// Unlike services/recordingService.ts (still used for Voice/Text mode, which
// stays a simulated timer — see that file), this module drives:
//   - react-native-vision-camera (^4.7.3) for the camera preview + frame
//     stream. Pinned to v4 deliberately: v5 rewrote frame processors around
//     Nitro Modules and the face-detector plugin below is only confirmed
//     compatible with v4's JSI-based frame processor API.
//   - react-native-vision-camera-face-detector (^1.10.1) for on-device
//     Google ML Kit face detection (bounding box, head Euler angles,
//     smiling probability, eye-open probability). No cloud API, no API key
//     — this runs entirely on-device via ML Kit.
//   - @dev-amirzubair/react-native-voice (a New-Architecture-compatible fork
//     of the abandoned @react-native-voice/voice) for on-device, no-cloud
//     speech-to-text, from which filler words / speaking rate / silence
//     gaps are derived client-side.
//
// This hook does NOT render the <Camera> itself (that stays in
// src/practice/LiveInterviewSession.tsx, using the <Camera> wrapper exported
// by react-native-vision-camera-face-detector, which internally wires up the
// frame processor + face-detector plugin + JS callback bridging via
// react-native-worklets-core). This hook instead owns:
//   - camera/mic permission state
//   - the face-detection frame callback (aggregates per-frame face metrics)
//   - the speech-recognition event wiring (transcript + filler words + pace
//     + silence-gap detection)
//   - start/stop lifecycle + the final metrics aggregation/scoring
//
// RISK NOTE (read before debugging a crash/build failure here): VisionCamera
// 4.x's frame processors require react-native-worklets-core, which is a
// SEPARATE worklet runtime from react-native-worklets (the package Reanimated
// 4 uses, already wired into babel.config.js). Running two worklet runtimes
// in one app is a known combination for VisionCamera + Reanimated 3.x
// projects, but this project uses Reanimated 4 (a very recent major), so
// this exact combination is NOT independently verified here — see
// babel.config.js for the plugin registration and the top-level task report
// for diagnostic steps if native builds fail.
// ---------------------------------------------------------------------------

// "Looking at the camera" tolerance, in degrees, for both head yaw (left/
// right) and pitch (up/down). ML Kit's Euler angles are 0 when facing the
// camera dead-on.
const EYE_CONTACT_YAW_THRESHOLD_DEG = 15;
const EYE_CONTACT_PITCH_THRESHOLD_DEG = 15;
const SMILE_PROBABILITY_THRESHOLD = 0.5;

// Gap between the end of one speech segment and the start of the next that
// counts as an "awkward pause", per the spec (~4s).
const AWKWARD_PAUSE_MS = 4000;

// How often (ms) the live UI indicator is allowed to re-render off the back
// of face-detector callbacks, which can fire 15-30x/sec — without this,
// LiveInterviewSession would re-render far more than the UI needs.
const LIVE_METRICS_THROTTLE_MS = 250;

// Was hardcoded to 'en-US' regardless of the user's preferred language (see
// constants/languages.ts) — same bug fixed in services/speechService.ts's
// currentSttLocale(), duplicated here since Video mode's STT is wired up
// independently of Voice mode's. Read at call time (not once at module
// load) so it always reflects whatever i18next's current language is.
function currentSttLocale(): string {
  return getSttLocale(i18n.language);
}

// How often (ms) a face-detection sample is pushed into the frame buffer
// that gets streamed to the backend (POST /camera-frame — see
// services/feedbackService.ts + LiveInterviewSession.tsx). Deliberately much
// coarser than LIVE_METRICS_THROTTLE_MS (which only throttles UI re-renders)
// — this controls actual payload size on an interval upload, so ~1
// sample/sec is plenty of resolution for a per-few-seconds batch upload
// without ballooning the buffer between flushes.
const FRAME_BUFFER_SAMPLE_INTERVAL_MS = 1000;

// Regex-based filler word counting — case-insensitive, word-boundary
// matched, as specified. "um"/"uh" allow a trailing repeated vowel (e.g.
// "ummm") since that's how STT engines often transcribe drawn-out fillers.
const FILLER_PATTERNS: Array<[string, RegExp]> = [
  ['um', /\bum+\b/gi],
  ['uh', /\buh+\b/gi],
  ['like', /\blike\b/gi],
  ['you know', /\byou\s+know\b/gi],
];

function countFillerWords(text: string): {total: number; breakdown: Record<string, number>} {
  const breakdown: Record<string, number> = {};
  let total = 0;
  for (const [label, pattern] of FILLER_PATTERNS) {
    // RegExp objects with the /g flag are stateful (lastIndex) — reset by
    // re-matching against a fresh pattern via `text.match`, which does not
    // mutate/reuse `pattern`'s lastIndex the way `pattern.exec` would.
    const matches = text.match(pattern);
    const count = matches ? matches.length : 0;
    if (count > 0) {
      breakdown[label] = count;
    }
    total += count;
  }
  return {total, breakdown};
}

/**
 * Score how close a speaking rate is to a natural interview pace. 110-160
 * wpm is treated as "ideal" (scores 100); the score tapers off by 2 points
 * per wpm outside that band, floored at 0.
 */
function speakingPaceScore(wpm: number): number {
  if (wpm <= 0) return 0;
  const IDEAL_MIN = 110;
  const IDEAL_MAX = 160;
  if (wpm >= IDEAL_MIN && wpm <= IDEAL_MAX) return 100;
  const distance = wpm < IDEAL_MIN ? IDEAL_MIN - wpm : wpm - IDEAL_MAX;
  return Math.max(0, 100 - distance * 2);
}

/**
 * CONFIDENCE_SCORE_FORMULA
 *
 * A heuristic 0-100 "how confident did this look/sound" score, blended from
 * five weighted sub-scores. This is intentionally simple and transparent —
 * every input is real, on-device signal (ML Kit face detection + on-device
 * speech-to-text); what's a heuristic is how they're *combined*.
 *
 *   confidenceScore =
 *       eyeContactPct                              * 0.40   (looking at camera)
 *     + smilePct                                     * 0.15   (warmth/engagement)
 *     + max(0, 100 - fillerWordCount * 4)             * 0.25   (verbal fluency)
 *     + speakingPaceScore(speakingRateWpm)             * 0.10   (110-160 wpm ideal, tapers outside)
 *     + max(0, 100 - silenceGapCount * 15)             * 0.10   (fewer awkward pauses)
 *
 *   ...clamped to [0, 100] and rounded.
 *
 * BACKEND TODO: the frame-level ML Kit face-detection output (yaw/pitch/
 * smiling/eye-open probabilities) and the on-device speech-to-text
 * transcript feeding into this ARE the real signal already — no cloud API
 * needed to produce those. What could later move server-side is this
 * aggregation/weighting: a backend could take the raw per-frame samples +
 * transcript (POST /interviews/sessions/{id}/video-analysis) and return a
 * properly trained/calibrated confidenceScore + richer coaching notes,
 * without changing this hook's public shape (`VideoAnalysisMetrics` stays
 * the contract InterviewFeedback renders).
 */
function computeConfidenceScore(m: {
  eyeContactPct: number;
  smilePct: number;
  fillerWordCount: number;
  speakingRateWpm: number;
  silenceGapCount: number;
}): number {
  const raw =
    m.eyeContactPct * 0.4 +
    m.smilePct * 0.15 +
    Math.max(0, 100 - m.fillerWordCount * 4) * 0.25 +
    speakingPaceScore(m.speakingRateWpm) * 0.1 +
    Math.max(0, 100 - m.silenceGapCount * 15) * 0.1;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export interface LiveVideoMetrics {
  isLookingAtCamera: boolean;
  isSmiling: boolean;
  fillerWordCount: number;
  speakingRateWpm: number;
  silenceGapCount: number;
}

// One real, on-device face-detection sample, buffered for the consuming
// screen to periodically POST to the backend — see `drainFrameBuffer` below
// and services/feedbackService.ts's CameraFrameSample (same shape,
// duplicated rather than imported so this file has zero dependency on the
// backend-facing service layer).
export interface CameraFrameSample {
  ts: number;
  lookingAtCamera: boolean;
  smiling: boolean;
  yaw: number;
  pitch: number;
}

const INITIAL_LIVE_METRICS: LiveVideoMetrics = {
  isLookingAtCamera: false,
  isSmiling: false,
  fillerWordCount: 0,
  speakingRateWpm: 0,
  silenceGapCount: 0,
};

// Detection options passed straight through to
// react-native-vision-camera-face-detector's <Camera>/useFaceDetector.
// classificationMode 'all' is required to get smiling/eye-open
// probabilities; landmark/contour detection is left off since this feature
// only needs the coarse per-frame signals.
const FACE_DETECTION_OPTIONS: FrameFaceDetectionOptions = {
  performanceMode: 'fast',
  classificationMode: 'all',
  landmarkMode: 'none',
  contourMode: 'none',
  trackingEnabled: false,
  cameraFacing: 'front',
};

/**
 * Hook that wraps the vision-camera frame processor + face-detector plugin
 * + on-device speech recognition for a single Video-mode interview session.
 *
 * The consuming screen (LiveInterviewSession) is responsible for actually
 * rendering the `<Camera>` from react-native-vision-camera-face-detector
 * with `ref={cameraRef}`, `device={device}`,
 * `faceDetectionOptions={faceDetectionOptions}` and
 * `faceDetectionCallback={onFacesDetected}` — this hook does not render
 * anything itself so it can be unit-testable and kept out of the JSX tree.
 */
export function useVideoInterviewAnalysis() {
  const device = useCameraDevice('front');
  const {hasPermission: hasCameraPermission, requestPermission: requestCameraPermission} =
    useCameraPermission();
  const {hasPermission: hasMicPermission, requestPermission: requestMicPermission} =
    useMicrophonePermission();

  const cameraRef = React.useRef<VisionCamera>(null);

  // --- Real video recording state (task: "real video replay, not just the
  // transcript/metrics reconstruction"). The <Camera> this hook doesn't
  // render itself (see LiveInterviewSession.tsx) is the SAME react-native-
  // vision-camera-face-detector-wrapped instance `cameraRef` already points
  // at for face detection — that wrapper forwards its `ref` straight through
  // to the real underlying VisionCamera instance (see that package's
  // Camera.tsx: `return <VisionCamera {...props} ref={ref} .../>`), so
  // `cameraRef.current` already has the full imperative
  // startRecording()/stopRecording() API without needing a second camera
  // instance. The consuming screen must additionally pass `video`/`audio`
  // props on the rendered <Camera> (see LiveInterviewSession.tsx) — those
  // aren't set here since this hook doesn't own the JSX. ---
  const recordingResultRef = React.useRef<{
    resolve: (video: VideoFile) => void;
    reject: (error: unknown) => void;
  } | null>(null);
  const recordingPromiseRef = React.useRef<Promise<VideoFile> | null>(null);

  // --- Face-detection aggregation state (refs, not state — this callback
  // can fire many times per second and we don't want a re-render per frame;
  // see refreshLiveMetrics's throttle below for what *does* re-render). ---
  const frameCountRef = React.useRef(0);
  const lookingFrameCountRef = React.useRef(0);
  const smilingFrameCountRef = React.useRef(0);
  const yawSumRef = React.useRef(0);
  const pitchSumRef = React.useRef(0);

  // Buffer of real per-frame samples waiting to be streamed to the backend
  // (POST /camera-frame) — drained periodically by the consuming screen via
  // `drainFrameBuffer`, not read every render.
  const frameBufferRef = React.useRef<CameraFrameSample[]>([]);
  const lastBufferPushRef = React.useRef(0);

  // --- Speech-recognition aggregation state. ---
  const transcriptRef = React.useRef('');
  const sessionStartRef = React.useRef<number | null>(null);
  const lastSpeechEndAtRef = React.useRef<number | null>(null);
  const silenceGapCountRef = React.useRef(0);
  const isMutedRef = React.useRef(false);
  const isAnalyzingRef = React.useRef(false);

  const lastUiUpdateRef = React.useRef(0);
  const [liveMetrics, setLiveMetrics] = React.useState<LiveVideoMetrics>(INITIAL_LIVE_METRICS);

  const computeSpeakingRate = React.useCallback(() => {
    if (!sessionStartRef.current) return 0;
    const elapsedSec = Math.max(1, (Date.now() - sessionStartRef.current) / 1000);
    const words = transcriptRef.current.trim().split(/\s+/).filter(Boolean).length;
    return Math.round((words / elapsedSec) * 60);
  }, []);

  const refreshLiveMetrics = React.useCallback(
    (partial?: Partial<LiveVideoMetrics>, force?: boolean) => {
      const now = Date.now();
      if (!force && now - lastUiUpdateRef.current < LIVE_METRICS_THROTTLE_MS) return;
      lastUiUpdateRef.current = now;
      const {total: fillerWordCount} = countFillerWords(transcriptRef.current);
      setLiveMetrics(prev => ({
        ...prev,
        fillerWordCount,
        speakingRateWpm: computeSpeakingRate(),
        silenceGapCount: silenceGapCountRef.current,
        ...partial,
      }));
    },
    [computeSpeakingRate],
  );

  /**
   * Passed as `faceDetectionCallback` to the face-detector package's
   * <Camera> wrapper. That wrapper runs ML Kit face detection inside a
   * frame-processor worklet on a background thread (via
   * react-native-worklets-core) and bridges the *results* (not raw frames)
   * back to this plain JS callback — so nothing in this function needs a
   * 'worklet' directive.
   */
  const onFacesDetected = React.useCallback(
    (faces: Face[]) => {
      if (!isAnalyzingRef.current || faces.length === 0) return;
      // Only the most prominent face is scored — this feature assumes a
      // single interviewee in frame, consistent with the mock-interview UX.
      const face = faces[0];
      frameCountRef.current += 1;
      yawSumRef.current += face.yawAngle;
      pitchSumRef.current += face.pitchAngle;

      const looking =
        Math.abs(face.yawAngle) <= EYE_CONTACT_YAW_THRESHOLD_DEG &&
        Math.abs(face.pitchAngle) <= EYE_CONTACT_PITCH_THRESHOLD_DEG;
      if (looking) lookingFrameCountRef.current += 1;

      const smiling = face.smilingProbability > SMILE_PROBABILITY_THRESHOLD;
      if (smiling) smilingFrameCountRef.current += 1;

      const now = Date.now();
      if (now - lastBufferPushRef.current >= FRAME_BUFFER_SAMPLE_INTERVAL_MS) {
        lastBufferPushRef.current = now;
        frameBufferRef.current.push({
          // Session-relative milliseconds, NOT an absolute Date.now() epoch
          // (was `ts: now` -- a ~13-digit epoch value like 1785297387579,
          // which overflows the backend's t_ms Postgres INTEGER column
          // (max ~2.1 billion) and made every single POST /camera-frame
          // batch during a Video-mode session fail with a 500
          // "integer out of range" -- silently, since the caller only
          // console.warns on failure. This also matches the exact
          // semantics app/api/feedback.py's replay() already assumes for
          // camera_points (relative to session start, same as transcript
          // t_ms), which is what InterviewReplay.tsx's video-seek relies
          // on -- an absolute epoch value here would have made
          // jumpToAnnotation try to seek the video to a nonsensical
          // multi-billion-second offset.
          ts: sessionStartRef.current != null ? now - sessionStartRef.current : now,
          lookingAtCamera: looking,
          smiling,
          yaw: face.yawAngle,
          pitch: face.pitchAngle,
        });
      }

      refreshLiveMetrics({isLookingAtCamera: looking, isSmiling: smiling});
    },
    [refreshLiveMetrics],
  );

  /**
   * Returns whatever real face-detection samples have accumulated since the
   * last call (or since startAnalysis), then clears the buffer. Intended to
   * be called on an interval by the consuming screen (every few seconds —
   * see LiveInterviewSession.tsx) and POSTed to the backend as one batch via
   * services/feedbackService.ts::postCameraFrames — NOT called per-frame.
   */
  const drainFrameBuffer = React.useCallback((): CameraFrameSample[] => {
    const frames = frameBufferRef.current;
    frameBufferRef.current = [];
    return frames;
  }, []);

  // --- Speech recognition event wiring. Registered once; guarded by
  // isAnalyzingRef/isMutedRef internally so the same listeners can be reused
  // across multiple start/stop cycles without re-subscribing. ---
  React.useEffect(() => {
    Voice.onSpeechStart = (_e: SpeechStartEvent) => {
      if (!isAnalyzingRef.current) return;
      const now = Date.now();
      if (lastSpeechEndAtRef.current != null && !isMutedRef.current) {
        const gap = now - lastSpeechEndAtRef.current;
        if (gap > AWKWARD_PAUSE_MS) {
          silenceGapCountRef.current += 1;
          refreshLiveMetrics(undefined, true);
        }
      }
    };
    Voice.onSpeechEnd = (_e: SpeechEndEvent) => {
      lastSpeechEndAtRef.current = Date.now();
      // On-device recognizers (esp. Android's) commonly stop listening after
      // a short pause in speech. Restart automatically so the session keeps
      // capturing the whole interview rather than only the first utterance.
      // NOTE: because we restart immediately here, the observed gap between
      // this onSpeechEnd and the next onSpeechStart mostly reflects engine
      // restart latency, not real-world silence — so silenceGapCount is an
      // approximation of awkward pauses, not an exact measurement. A more
      // precise approach would need native VAD (voice activity detection)
      // timestamps, which this community package does not expose.
      if (isAnalyzingRef.current && !isMutedRef.current) {
        Voice.start(currentSttLocale()).catch(() => {});
      }
    };
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0];
      if (text) {
        transcriptRef.current = `${transcriptRef.current} ${text}`.trim();
        refreshLiveMetrics(undefined, true);
      }
    };
    Voice.onSpeechError = (_e: SpeechErrorEvent) => {
      // "No speech detected" / timeout errors fire routinely during natural
      // silence on some platforms — treat like a segment boundary and keep
      // listening rather than surfacing this as a hard failure.
      lastSpeechEndAtRef.current = Date.now();
      if (isAnalyzingRef.current && !isMutedRef.current) {
        Voice.start(currentSttLocale()).catch(() => {});
      }
    };
    return () => {
      Voice.destroy()
        .then(() => Voice.removeAllListeners())
        .catch(() => {});
    };
  }, [refreshLiveMetrics]);

  const requestPermissions = React.useCallback(async (): Promise<boolean> => {
    const cam = hasCameraPermission || (await requestCameraPermission());
    const mic = hasMicPermission || (await requestMicPermission());
    return cam && mic;
  }, [hasCameraPermission, hasMicPermission, requestCameraPermission, requestMicPermission]);

  const startAnalysis = React.useCallback(async () => {
    frameCountRef.current = 0;
    lookingFrameCountRef.current = 0;
    smilingFrameCountRef.current = 0;
    yawSumRef.current = 0;
    pitchSumRef.current = 0;
    frameBufferRef.current = [];
    lastBufferPushRef.current = 0;
    transcriptRef.current = '';
    silenceGapCountRef.current = 0;
    lastSpeechEndAtRef.current = null;
    isMutedRef.current = false;
    sessionStartRef.current = Date.now();
    isAnalyzingRef.current = true;
    setLiveMetrics(INITIAL_LIVE_METRICS);
    try {
      await Voice.start(currentSttLocale());
    } catch (err) {
      // Speech recognition failing to start (e.g. permission race, engine
      // unavailable) shouldn't block the camera/face-detection half of the
      // session — the final metrics will just show 0 filler words / 0 wpm.
      console.warn('[videoAnalysisService] Voice.start failed to start speech recognition', err);
    }
  }, []);

  /**
   * Starts a real on-device video recording via VisionCamera's imperative
   * startRecording() API — separate from (but running alongside) the
   * face-detection frame processor, which keeps working on the live preview
   * the whole time. Fire-and-forget by design (VisionCamera's own API is
   * callback-based, not promise-based, for the finished file): call
   * stopVideoRecording() later to actually get the resulting file back.
   * No-ops silently if the camera isn't mounted yet or a recording is
   * already in progress — the caller (LiveInterviewSession) only calls this
   * once, right after the camera view becomes available.
   */
  const startVideoRecording = React.useCallback(() => {
    if (!cameraRef.current || recordingPromiseRef.current) return;
    recordingPromiseRef.current = new Promise<VideoFile>((resolve, reject) => {
      recordingResultRef.current = {resolve, reject};
    });
    try {
      // videoBitRate is a <Camera> component prop (not a startRecording()
      // option) — see LiveInterviewSession.tsx's videoBitRate="low" on the
      // rendered <FaceDetectorCamera>, which is what actually keeps a
      // multi-minute mock interview's file size upload-able over a typical
      // mobile connection (talking-head footage, not action, so 'low' still
      // holds up fine for reviewing your own delivery/body language later).
      cameraRef.current.startRecording({
        fileType: 'mp4',
        videoCodec: 'h264',
        onRecordingFinished: video => {
          recordingResultRef.current?.resolve(video);
          recordingResultRef.current = null;
        },
        onRecordingError: error => {
          console.warn('[videoAnalysisService] recording error', error);
          recordingResultRef.current?.reject(error);
          recordingResultRef.current = null;
        },
      });
    } catch (err) {
      // startRecording() can throw synchronously (e.g. camera not ready,
      // already recording) in addition to the async onRecordingError path.
      console.warn('[videoAnalysisService] startRecording threw', err);
      recordingResultRef.current?.reject(err);
      recordingResultRef.current = null;
      recordingPromiseRef.current = null;
    }
  }, []);

  /**
   * Stops the in-progress recording (if any) and resolves once the file has
   * actually finished being written to disk — VisionCamera's stopRecording()
   * only signals that the stop command was issued, not that
   * onRecordingFinished has fired yet, so this awaits the promise created in
   * startVideoRecording above to get the real, complete file. Returns null
   * (rather than throwing) on any failure — a failed/missing recording
   * should never block the rest of onEnd()'s teardown in
   * LiveInterviewSession, since the interview itself is still valid without
   * it (same "video is a bonus, not a requirement" posture the rest of this
   * feature already takes with e.g. the camera-summary cross-check).
   */
  const stopVideoRecording = React.useCallback(async (): Promise<
    {path: string; durationSec: number} | null
  > => {
    if (!cameraRef.current || !recordingPromiseRef.current) {
      // Previously a silent, unlogged no-op -- if startVideoRecording()
      // never actually got a recording going for this session (ref not yet
      // attached, or a synchronous startRecording() throw that isn't
      // retried), this is the only place that would ever know that
      // happened, and it said nothing. Logging here at least leaves a trace
      // when a "no video was recorded" report turns out to be this path
      // rather than an upload failure (see interviewService.
      // uploadSessionVideoResilient for that half of the fix).
      console.warn('[videoAnalysisService] stopVideoRecording called with no recording in progress -- video was never actually started for this session');
      return null;
    }
    const pending = recordingPromiseRef.current;
    recordingPromiseRef.current = null;
    try {
      await cameraRef.current.stopRecording();
      const video = await pending;
      // VideoFile.path is a bare filesystem path, NOT a file:// URI --
      // VisionCamera's own TemporaryFile type docs say as much ("you might
      // have to add the file:// prefix" to consume it). This was never
      // added anywhere downstream: interviewService.uploadSessionVideo()
      // hands this straight to FormData as the file's `uri`, and RN's
      // native multipart implementation needs a real file:// URI to read
      // local file bytes on both platforms -- without it, the upload
      // either throws or silently posts an empty/invalid part, which is
      // exactly why "the video interview is not saving" while every other
      // part of the session (transcript, scores, metrics) saved fine: this
      // was the one piece of the pipeline still passing a raw path through
      // instead of a real URI. Guarded so this stays a no-op if a future
      // VisionCamera version starts returning file:// already.
      const path = video.path.startsWith('file://') ? video.path : `file://${video.path}`;
      return {path, durationSec: video.duration};
    } catch (err) {
      console.warn('[videoAnalysisService] stopVideoRecording failed', err);
      return null;
    }
  }, []);

  const setMuted = React.useCallback((muted: boolean) => {
    isMutedRef.current = muted;
    if (muted) {
      Voice.stop().catch(() => {});
    } else if (isAnalyzingRef.current) {
      Voice.start(currentSttLocale()).catch(() => {});
    }
  }, []);

  const stopAnalysis = React.useCallback(async (): Promise<VideoAnalysisMetrics> => {
    isAnalyzingRef.current = false;
    try {
      await Voice.stop();
    } catch {
      // Already stopped/never started — fine to ignore.
    }

    const frames = frameCountRef.current;
    const eyeContactPct = frames > 0 ? Math.round((lookingFrameCountRef.current / frames) * 100) : 0;
    const smilePct = frames > 0 ? Math.round((smilingFrameCountRef.current / frames) * 100) : 0;
    const avgHeadYaw = frames > 0 ? Math.round((yawSumRef.current / frames) * 10) / 10 : 0;
    const avgHeadPitch = frames > 0 ? Math.round((pitchSumRef.current / frames) * 10) / 10 : 0;

    const {total: fillerWordCount, breakdown: fillerWordBreakdown} = countFillerWords(
      transcriptRef.current,
    );
    const speakingRateWpm = computeSpeakingRate();
    const silenceGapCount = silenceGapCountRef.current;

    const confidenceScore = computeConfidenceScore({
      eyeContactPct,
      smilePct,
      fillerWordCount,
      speakingRateWpm,
      silenceGapCount,
    });

    return {
      eyeContactPct,
      smilePct,
      avgHeadYaw,
      avgHeadPitch,
      fillerWordCount,
      fillerWordBreakdown,
      speakingRateWpm,
      silenceGapCount,
      confidenceScore,
    };
  }, [computeSpeakingRate]);

  return {
    device,
    cameraRef,
    hasCameraPermission,
    hasMicPermission,
    requestPermissions,
    faceDetectionOptions: FACE_DETECTION_OPTIONS,
    onFacesDetected,
    startAnalysis,
    stopAnalysis,
    startVideoRecording,
    stopVideoRecording,
    setMuted,
    liveMetrics,
    drainFrameBuffer,
  };
}
