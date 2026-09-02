import {NativeEventEmitter, NativeModules, Platform} from 'react-native';

// ---------------------------------------------------------------------------
// duplexVoiceService — thin JS wrapper over the native DuplexVoiceEngine
// module (ios/caren_family/DuplexVoiceEngine.swift). See that file's own
// header comment for the full "why does this module exist" history —
// short version: it's a from-scratch native audio engine built specifically
// to make real speak-to-interrupt possible for the AI Career Coach's voice
// screen, after two prior JS-level/session-config-only attempts both
// failed on a real device.
//
// iOS ONLY, deliberately, for now. Android would need its own equivalent
// native module (AAudio/Oboe + an echo canceller, e.g. via WebRTC's audio
// processing module or Android's built-in AcousticEchoCanceler effect) —
// a separate, comparable-sized project. Every export here is a safe no-op
// on Android (resolves/rejects predictably) so this can be imported
// unconditionally without every call site needing its own Platform check.
//
// PHASE 1 / TEST-ONLY: not wired into VoiceCoachView.tsx yet. See
// src/dev/DuplexVoiceTestScreen.tsx (reachable from Settings in dev builds
// only) for how to exercise this in isolation on a real device before any
// production screen depends on it — see that screen's own comment for why
// testing it standalone first matters.
// ---------------------------------------------------------------------------

const isSupportedPlatform = Platform.OS === 'ios';
const nativeModule = isSupportedPlatform ? NativeModules.DuplexVoiceEngine : null;
const emitter = nativeModule ? new NativeEventEmitter(nativeModule) : null;

const NOT_SUPPORTED_ERROR = new Error('DuplexVoiceEngine is iOS-only (phase 1) — not available on this platform.');

export interface TranscriptEvent {
  text: string;
  isFinal: boolean;
}

export interface ListeningStateEvent {
  listening: boolean;
}

export interface SpeakingStateEvent {
  speaking: boolean;
}

export interface DuplexErrorEvent {
  context: string;
  message: string;
}

export function isDuplexVoiceSupported(): boolean {
  return !!nativeModule;
}

/**
 * Starts the shared audio engine: activates the AVAudioSession, enables
 * voice processing (echo cancellation) on the engine's input/output nodes,
 * and begins continuous speech recognition. Resolves once listening has
 * actually started. Safe to call once per "conversation session" — unlike
 * the old react-native-voice-based model, this does NOT need to be
 * stopped/restarted between turns; speak() below runs concurrently with
 * listening, not instead of it.
 */
export async function start(): Promise<boolean> {
  if (!nativeModule) throw NOT_SUPPORTED_ERROR;
  return nativeModule.start();
}

/** Fully tears down the engine, tap, and recognition session. */
export async function stop(): Promise<void> {
  if (!nativeModule) throw NOT_SUPPORTED_ERROR;
  return nativeModule.stop();
}

/**
 * Synthesizes `text` on-device and plays it through the SAME engine that's
 * capturing the mic (see DuplexVoiceEngine.swift for why that's the whole
 * point) — resolves once playback finishes naturally, same contract as
 * speechService.ts's speak(). NOT ElevenLabs — phase 1 is on-device-TTS
 * only; see this file's own header comment.
 */
export async function speak(text: string): Promise<void> {
  if (!nativeModule) throw NOT_SUPPORTED_ERROR;
  return nativeModule.speak(text);
}

/** Cuts off whatever speak() call is currently playing, immediately. */
export async function stopSpeaking(): Promise<void> {
  if (!nativeModule) throw NOT_SUPPORTED_ERROR;
  return nativeModule.stopSpeaking();
}

export function addTranscriptListener(handler: (event: TranscriptEvent) => void) {
  return emitter?.addListener('onTranscript', handler);
}

export function addListeningStateListener(handler: (event: ListeningStateEvent) => void) {
  return emitter?.addListener('onListeningState', handler);
}

export function addSpeakingStateListener(handler: (event: SpeakingStateEvent) => void) {
  return emitter?.addListener('onSpeakingState', handler);
}

export function addErrorListener(handler: (event: DuplexErrorEvent) => void) {
  return emitter?.addListener('onError', handler);
}
