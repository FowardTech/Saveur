import {NativeEventEmitter, NativeModules, PermissionsAndroid, Platform} from 'react-native';
import i18n from 'i18next';

import {fetchElevenLabsAudioUrl} from './speechService';

// ---------------------------------------------------------------------------
// duplexVoiceService — thin JS wrapper over the native DuplexVoiceEngine
// module: ios/caren_family/DuplexVoiceEngine.swift on iOS,
// android/app/src/main/java/com/saveur/app/DuplexVoiceEngineModule.kt on
// Android. See DuplexVoiceEngine.swift's own header comment for the full
// "why does this module exist" history — short version: a from-scratch
// native audio engine built specifically to make real speak-to-interrupt
// possible for the AI Career Coach's voice screen, after two prior JS-
// level/session-config-only attempts both failed on a real device.
//
// The two platforms' native implementations are NOT architecturally
// identical — see DuplexVoiceEngineModule.kt's own header comment for why
// (Android's public SpeechRecognizer API doesn't expose raw mic buffers
// the way iOS's SFSpeechRecognizer does, so echo cancellation during
// barge-in relies on the OS/device's own handling rather than anything
// explicitly engineered here, unlike iOS's Voice-Processing I/O unit).
// Both expose the exact same JS-facing contract below, though, so nothing
// in this file (or VoiceCoachView.tsx) needs to know which platform it's
// talking to beyond the isSupportedPlatform check itself.
//
// PHASE 1 on both platforms: on-device TTS only. speakRemote/
// speakWithFallback below (the real ElevenLabs voice) already gracefully
// falls back to on-device speech on ANY failure, which is what happens on
// Android today (speakRemoteAudio rejects immediately there — see
// DuplexVoiceEngineModule.kt) until a Phase 2 Android implementation
// lands, same as iOS before its own Phase 2 shipped.
// ---------------------------------------------------------------------------

const isSupportedPlatform = Platform.OS === 'ios' || Platform.OS === 'android';

// Android requires RECORD_AUDIO as a runtime permission (not just the
// manifest declaration) before SpeechRecognizer will work — same
// requirement services/speechService.ts's ensureMicPermissionAndroid()
// already handles for the legacy react-native-voice pipeline. Requested
// here, before the native start() call, rather than inside the native
// module itself, since PermissionsAndroid's request flow is JS-side API;
// the native module just checks best-effort and surfaces a clear error if
// this was somehow skipped.
async function ensureAndroidMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

// BUG FIX ATTEMPT (product report: after a full app close+reopen -- not
// just backgrounding -- Voice mode never captures anything at all, no
// error, nothing in DuplexVoiceEngine.swift's own Xcode-console logging
// even though those logs are unconditional on any successful engine
// start; only a full logout/login recovers it). If literally NOTHING from
// that file's own NSLog calls ever appears, the most likely explanation
// isn't inside DuplexVoiceEngine.swift at all -- it's that `start()` is
// never even being invoked, because THIS module decided at import time
// that the native module doesn't exist.
//
// `NativeModules.DuplexVoiceEngine` used to be read exactly ONCE, into a
// plain top-level `const`, at the moment this file is first imported --
// which happens very early in app bootstrap (VoiceCoachView.tsx imports
// this module, and Chat.tsx mounts VoiceCoachView as soon as the Coach
// screen exists). If the native bridge hadn't finished registering this
// particular module yet at that exact instant -- a real, documented class
// of React Native native-module-resolution race, more likely to bite on
// SOME cold-start timings than others, and not something a plain relaunch
// reliably avoids -- `nativeModule` would be permanently cached as `null`
// for the rest of that JS runtime's lifetime, silently downgrading this
// entire screen to the legacy react-native-voice path for the whole
// session, with no error anywhere (isDuplexVoiceSupported() just quietly
// returns false, same as a real Android device). Logging out and back in
// doesn't re-trigger this: it's the same JS runtime the whole time, this
// module is only ever evaluated once. That its NSLog lines are always
// missing after close+reopen but never after other paths described so far
// fits this exact failure mode.
//
// Fix: resolve the native module LAZILY instead, on every call, and only
// cache a SUCCESSFUL resolution (never cache a `null`/`undefined` result
// permanently) -- the standard, documented mitigation for this class of
// bridge-timing race. Once the module is genuinely registered, later
// lookups reliably find it; until then, every call just keeps retrying
// instead of being stuck on one unlucky early snapshot.
let cachedNativeModule: any = null;
function getNativeModule(): any {
  if (!isSupportedPlatform) return null;
  if (!cachedNativeModule) {
    cachedNativeModule = NativeModules.DuplexVoiceEngine ?? null;
    if (__DEV__ && cachedNativeModule) {
      console.warn('[duplexVoiceService] native module resolved (lazily)');
    }
  }
  return cachedNativeModule;
}

let cachedEmitter: NativeEventEmitter | null = null;
function getEmitter(): NativeEventEmitter | null {
  const mod = getNativeModule();
  if (!mod) return null;
  if (!cachedEmitter) {
    cachedEmitter = new NativeEventEmitter(mod);
  }
  return cachedEmitter;
}

const NOT_SUPPORTED_ERROR = new Error('DuplexVoiceEngine is not available on this platform.');

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
  return !!getNativeModule();
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
  const mod = getNativeModule();
  if (!mod) throw NOT_SUPPORTED_ERROR;
  const micGranted = await ensureAndroidMicPermission();
  if (!micGranted) {
    throw new Error(
      i18n.t('message:voice_mic_permission_denied', {
        defaultValue: 'Microphone permission is required for Voice mode.',
      }) as string,
    );
  }
  return mod.start();
}

/** Fully tears down the engine, tap, and recognition session. */
export async function stop(): Promise<void> {
  const mod = getNativeModule();
  if (!mod) throw NOT_SUPPORTED_ERROR;
  return mod.stop();
}

/**
 * Synthesizes `text` on-device and plays it through the SAME engine that's
 * capturing the mic (see DuplexVoiceEngine.swift for why that's the whole
 * point) — resolves once playback finishes naturally, same contract as
 * speechService.ts's speak(). NOT ElevenLabs — phase 1 is on-device-TTS
 * only; see this file's own header comment.
 */
export async function speak(text: string): Promise<void> {
  const mod = getNativeModule();
  if (!mod) throw NOT_SUPPORTED_ERROR;
  return mod.speak(text);
}

/** Cuts off whatever speak() call is currently playing, immediately. */
export async function stopSpeaking(): Promise<void> {
  const mod = getNativeModule();
  if (!mod) throw NOT_SUPPORTED_ERROR;
  return mod.stopSpeaking();
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
  const mod = getNativeModule();
  if (!mod) throw NOT_SUPPORTED_ERROR;
  const source = await fetchElevenLabsAudioUrl(text, language);
  if (!source) {
    throw new Error('ElevenLabs TTS backend did not return a usable audio URL.');
  }
  return mod.speakRemoteAudio(source.uri, source.headers);
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
  return getEmitter()?.addListener('onTranscript', handler);
}

export function addListeningStateListener(handler: (event: ListeningStateEvent) => void) {
  return getEmitter()?.addListener('onListeningState', handler);
}

export function addSpeakingStateListener(handler: (event: SpeakingStateEvent) => void) {
  return getEmitter()?.addListener('onSpeakingState', handler);
}

export function addErrorListener(handler: (event: DuplexErrorEvent) => void) {
  return getEmitter()?.addListener('onError', handler);
}
