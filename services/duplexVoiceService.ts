import {NativeEventEmitter, NativeModules, Platform} from 'react-native';
import i18n from 'i18next';

import {fetchElevenLabsAudioUrl} from './speechService';

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

/**
 * PHASE 2: the real ElevenLabs voice, played through this SAME duplex
 * engine (not react-native-nitro-sound's separate player, which -- like
 * react-native-tts before it -- has no way to be heard by this engine's
 * echo canceller; see DuplexVoiceEngine.swift's header comment for why
 * that mattered). Reuses services/speechService.ts's own
 * fetchElevenLabsAudioUrl for the URL + Firebase auth header -- same
 * backend call (POST /api/v1/tts/speak) and same auth handling already
 * proven working for the old TTS pipeline, so there's no duplicated
 * networking/auth logic here, just decode-and-play on the native side
 * (see speakRemoteAudio in DuplexVoiceEngine.swift).
 *
 * Throws (never silently resolves) on any failure -- missing URL, fetch
 * failure, decode failure -- so speakWithFallback() below can catch it
 * and fall back to on-device speech, same contract as speechService.ts's
 * own speakRemote().
 */
export async function speakRemote(text: string, language: string = i18n.language): Promise<void> {
  if (!nativeModule) throw NOT_SUPPORTED_ERROR;
  const source = await fetchElevenLabsAudioUrl(text, language);
  if (!source) {
    throw new Error('ElevenLabs TTS backend did not return a usable audio URL.');
  }
  return nativeModule.speakRemoteAudio(source.uri, source.headers);
}

/**
 * The eventual drop-in for VoiceCoachView.tsx's current speechService.speak()
 * call: tries the real ElevenLabs voice first, falls back to on-device
 * speech on any failure (offline, backend/ElevenLabs error, decode
 * failure) -- so a live conversation never just goes silent, same
 * reasoning as speechService.ts's own speak(). NOT wired into
 * VoiceCoachView yet -- see this file's header comment; exposed here so
 * DuplexVoiceTestScreen.tsx can exercise the full real-voice path in
 * isolation first.
 */
export async function speakWithFallback(text: string, language: string = i18n.language): Promise<void> {
  try {
    await speakRemote(text, language);
  } catch {
    await speak(text);
  }
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
