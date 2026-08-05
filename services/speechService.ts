import React from 'react';
import {AppState, PermissionsAndroid, Platform} from 'react-native';
import Tts from 'react-native-tts';
import Sound from 'react-native-nitro-sound';
import auth from '@react-native-firebase/auth';
import i18n from 'i18next';
import Voice, {SpeechResultsEvent, SpeechErrorEvent} from '@dev-amirzubair/react-native-voice';

import {API_BASE_URL} from 'constants/env';
import {getSttLocale} from 'constants/languages';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// speechService — real text-to-speech (the AI actually speaking its
// questions) and speech-to-text (transcribing the user's spoken answer),
// backing Voice mode in src/practice/LiveInterviewSession.tsx.
//
// Before this, Voice mode was a fully simulated pulsing orb — no audio was
// ever played or captured (see recordingService.ts's file-header comment,
// still accurate for Video mode's recording-indicator plumbing, but no
// longer accurate about Voice mode's TTS/STT, which is now real).
//
// STT reuses @dev-amirzubair/react-native-voice — already a dependency of
// this project (see services/videoAnalysisService.ts), explicitly documented
// there as "a New-Architecture-compatible fork of the abandoned
// @react-native-voice/voice". Deliberately NOT adding the original
// @react-native-voice/voice package here too: this project is New
// Architecture only, the original package is why the fork exists, and
// running two different speech-recognition native modules side by side is
// pure added risk for zero benefit.
//
// TTS is two-tier: the primary path is real ElevenLabs-generated speech from
// the backend (POST /api/v1/tts/speak — see speakRemote below), played back
// via react-native-nitro-sound. If that fails for ANY reason (network down,
// backend/ElevenLabs error, timeout, player failure), it silently falls back
// to on-device TTS (react-native-tts, AVSpeechSynthesizer on iOS / Android's
// TextToSpeech) so a live interview never just goes silent because of a
// backend hiccup. Both halves need `pod install` (iOS) and a full native
// rebuild — same pattern as every prior native addition this session
// (Firebase, Stripe, react-native-vision-camera) — not just a JS reload. iOS
// also needs NSSpeechRecognitionUsageDescription in Info.plist for the voice
// fork (added alongside this file) in addition to the
// NSMicrophoneUsageDescription that already existed for Video mode.
// ---------------------------------------------------------------------------

// Was hardcoded to 'en-US' — meaning if the user's preferred language
// (constants/languages.ts, set at signup or Settings → Language) was
// Spanish, the AI would ask its question in Spanish (see speak() below) but
// this on-device speech recognizer would still be listening for English,
// mis-transcribing every spoken answer. Now derived from whatever i18next's
// current language actually is, at call time (not read once at module load),
// so a mid-session language change (unlikely, but Settings is reachable at
// any time) takes effect on the next Voice.start() rather than needing an
// app restart.
function currentSttLocale(): string {
  return getSttLocale(i18n.language);
}

// BUG FIX (product report: "The AI career coach always breaks or intercept
// while talking. It has not finish one sentence it will just flip to
// another sentence without completing the first one") — this is a
// LAST-RESORT "give up and resolve anyway" guard against the real
// playback-end event never firing at all (a genuine native-bridge edge
// case), not the normal way a speak() call is expected to end. The old
// ~11 chars/sec (90ms/char, floor 8s) estimate was tight enough that a
// slower, natural-paced coaching voice with real pauses between sentences
// could still legitimately be playing when this fired — and the instant
// this promise resolved, the caller (VoiceCoachView's sendTurn re-arming
// the mic via Voice.start(), or LiveInterviewSession moving straight to
// the next question's own speak() call) would switch the OS audio session
// category or start a second native player, cutting off audio that was
// still actually playing. That's what "cuts off mid-sentence and jumps to
// the next one" actually was: not one clip glitching, but this timeout
// resolving early and the next turn's mic/audio action stepping on the
// tail of the previous one. Widened to 150ms/char (floor 15s) — closer to
// a slow, expressive voice than a rushed reading-speed estimate — and see
// speakRemote/speakOnDevice below for the second half of this fix (force-
// stopping playback when this safety path is actually the one that fires,
// so a genuinely-still-playing clip doesn't keep going in the background
// afterward either).
function safetyTimeoutMs(text: string): number {
  return Math.max(15000, text.length * 150);
}

// getInitStatus() resolves once the underlying engine is actually ready
// (notably on Android, where TextToSpeech binds to a system service
// asynchronously) — calling Tts.speak() before that can silently no-op on
// some devices. Memoized as a single shared promise so every call site
// awaits the same one-time init instead of re-triggering it.
let ttsReady: Promise<void> | null = null;
function ensureTtsConfigured(): Promise<void> {
  if (!ttsReady) {
    ttsReady = Tts.getInitStatus()
      .then(() => {
        Tts.setDefaultRate(0.5);
        Tts.setDefaultPitch(1.0);
        Tts.setDucking?.(true);
        // iOS only, no-op elsewhere: by default this library leaves the
        // audio session category as "inherit", which means the AI's speech
        // stays silent if the phone's physical mute switch is flipped on —
        // easy to miss during testing and not the behavior an interview
        // coach app should have (the questions are core functionality, not
        // a background sound effect). 'ignore' makes it play regardless of
        // the switch, same as e.g. a phone call or timer alarm would.
        Tts.setIgnoreSilentSwitch?.('ignore');
      })
      .catch(() => {
        // Engine unavailable (e.g. no TTS voices installed) — swallow so
        // speak() below still resolves via its own safety timeout instead
        // of hanging forever on a rejected init promise.
      });
  }
  return ttsReady;
}

// Monotonic cancellation token. stopSpeaking() (and every new speak() call)
// bumps this; each speak() call captures the value at its own start and
// checks it again right before actually starting audio playback. Fixes a
// real race that isn't about UI ordering: stopSpeaking() can only stop
// audio that has ALREADY started — it does nothing to a speak() call that's
// still mid-network-fetch (ElevenLabs) or mid-engine-init when the cancel
// happens. Left unguarded, that call simply finishes a moment later and
// starts playing anyway, even though the screen has already been backed out
// of, or a newer speak() call (next module/next coach reply) has already
// superseded it. That's the actual cause behind two separate-looking product
// reports: "the AI keeps talking after I tap back" (stopSpeaking() from the
// screen's unmount/blur cleanup fired too early to catch a still-in-flight
// call) and "voice sometimes starts speaking out of sync with the text"
// (a stale call from the PREVIOUS module/reply finishing late and playing
// over newly-shown content). Every call site that can actually start audio
// (Sound.startPlayer, Tts.speak) now checks isStale() immediately before
// doing so and silently no-ops if a stop or a newer speak() happened since.
let speechToken = 0;
function isStale(token: number): boolean {
  return token !== speechToken;
}

interface TtsSpeakWire {
  audio_url: string;
}

// audio_url can be relative ("/api/v1/tts/audio/abc123") or already absolute
// (e.g. a CDN/storage URL) — normalize either into something Sound.startPlayer
// can fetch directly.
function resolveAudioUrl(audioUrl: string): string {
  return /^https?:\/\//i.test(audioUrl) ? audioUrl : `${API_BASE_URL}${audioUrl}`;
}

export interface ElevenLabsAudioSource {
  uri: string;
  headers: Record<string, string>;
}

/**
 * Same backend call as speakRemote below (POST /api/v1/tts/speak), but
 * returns the resolved, auth-header-ready audio source instead of playing
 * it — for Video-mode's own playback path (see
 * src/practice/LiveInterviewSession.tsx's VideoModeSpeechPlayer), which
 * plays this through react-native-video instead of react-native-nitro-sound
 * specifically so it can pass disableAudioSessionManagement. nitro-sound's
 * startPlayer() takes no such option (see speak()'s own comment on
 * preserveRecordingSession for the full history of why that mattered), so
 * it could never be made safe to use DURING an active VisionCamera
 * recording the way react-native-video now can be.
 *
 * Returns null (never throws) on any failure — missing/failed request or
 * missing audio_url — so the caller can fall back to on-device TTS instead
 * of the interview going silent.
 */
export async function fetchElevenLabsAudioUrl(text: string, language: string): Promise<ElevenLabsAudioSource | null> {
  try {
    const {data} = await apiClient.post<TtsSpeakWire>('/api/v1/tts/speak', {text, language});
    if (!data?.audio_url) return null;
    const uri = resolveAudioUrl(data.audio_url);
    const user = auth().currentUser;
    const headers: Record<string, string> = {};
    if (user) {
      headers.Authorization = `Bearer ${await user.getIdToken()}`;
    }
    return {uri, headers};
  } catch {
    return null;
  }
}

/**
 * POST /api/v1/tts/speak — asks the backend to synthesize `text` via
 * ElevenLabs and hands back a URL to the generated audio. Plays it via
 * react-native-nitro-sound, passing the same Firebase ID token every other
 * authenticated request uses — Sound.startPlayer does its own native HTTP
 * fetch outside axios, so it doesn't get apiClient's Authorization-header
 * interceptor for free; it has to be attached manually here.
 *
 * `language` (e.g. "en", "es" — see constants/languages.ts) is now sent so
 * the backend can pick an appropriate ElevenLabs voice/model for the user's
 * preferred language instead of always using one fixed English-configured
 * voice — see docs/BACKEND_SPEC_ADDENDUM_2026-07.md for the contract this
 * assumes. If the backend doesn't use this field yet, it's simply ignored
 * server-side and behavior is unchanged from before.
 *
 * Rejects (never resolves) on any failure — request, missing audio_url, or
 * playback error — so speak() below can catch that and fall back to
 * on-device TTS instead of the interview going silent.
 */
async function speakRemote(text: string, language: string, token: number): Promise<void> {
  const {data} = await apiClient.post<TtsSpeakWire>('/api/v1/tts/speak', {text, language});
  // Superseded (a stop or a newer speak() call) while this request was in
  // flight — never start playing audio for a call nobody's waiting on
  // anymore. See the speechToken comment above for the full race this fixes.
  if (isStale(token)) return;
  if (!data?.audio_url) {
    throw new Error('TTS backend did not return an audio_url.');
  }
  const url = resolveAudioUrl(data.audio_url);
  const user = auth().currentUser;
  const headers: Record<string, string> = {};
  if (user) {
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  if (isStale(token)) return; // re-check — the token await above can also race past a cancel

  // BUG FIX (product report: "AI coach not talking at all in Voice mode" —
  // works everywhere else, e.g. mock interviews, only the coach is silent).
  // speakOnDevice (below) has always re-asserted the iOS audio session
  // category to .playback before every utterance, specifically because
  // @dev-amirzubair/react-native-voice's Voice.start() leaves the session in
  // .playAndRecord after listening for the user's spoken input, and that
  // category doesn't cleanly hand off to a new player starting right after
  // it — see speakOnDevice's comment for the full history (that one manifests
  // as "routed to the earpiece", not silence, but it's the same underlying
  // handoff). This path never had that reset at all: nitro-sound's
  // startPlayer() does no session management of its own. Every other Voice
  // mode screen in the app (mock interviews) also hits this handoff, but the
  // AI coach's turn-taking is the tightest (mic stop -> speak -> mic restart,
  // repeatedly, every single turn including the very first greeting) so it's
  // the one place a stuck/failed session acquisition shows up as "never
  // speaks, not even once" instead of an occasional glitch. Cheap and
  // idempotent to call unconditionally here too.
  try {
    await ensureTtsConfigured();
    await Tts.setDucking?.(true)?.catch(() => {});
  } catch {
    // best-effort — a failed session reset shouldn't block trying to play
  }
  if (isStale(token)) return;

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let started = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      Sound.removePlaybackEndListener();
      clearTimeout(safety);
      clearTimeout(startWatchdog);
      resolve();
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      Sound.removePlaybackEndListener();
      clearTimeout(safety);
      clearTimeout(startWatchdog);
      reject(error instanceof Error ? error : new Error('Remote TTS playback failed.'));
    };
    // This safety path firing means the real playback-end event never
    // came within our (now generous) grace window — force-stop whatever
    // nitro-sound still thinks is playing before resolving, rather than
    // leaving it to keep playing in the background while the caller's
    // very next action (re-arming the mic, or speaking the next line)
    // races against it. See safetyTimeoutMs's doc comment for the full
    // story on why that race was the actual "cuts off mid-sentence" bug.
    const onSafetyTimeout = () => {
      Sound.stopPlayer().catch(() => {});
      finish();
    };
    const safety = setTimeout(onSafetyTimeout, safetyTimeoutMs(text) + 8000); // + generation/network overhead
    // BUG FIX (same report as above): startPlayer's own promise normally
    // settles almost instantly once native playback actually begins — it
    // does NOT wait for playback to finish (that's what the playback-end
    // listener above is for). If the native player can't acquire the audio
    // session (the handoff race described above) it can end up neither
    // resolving nor rejecting that promise at all, and previously the ONLY
    // thing that would eventually notice was the full-utterance `safety`
    // timeout above — 15-40+ seconds of dead silence for a typical coach
    // reply before finish() ever ran, which looks exactly like "the coach
    // isn't talking." This fires much sooner and, since it rejects instead
    // of resolving, lets speak() below fall back to on-device TTS in ~4s
    // instead of leaving the user staring at silence.
    const startWatchdog = setTimeout(() => {
      if (!started) fail(new Error('Remote TTS player did not start in time.'));
    }, 4000);
    Sound.addPlaybackEndListener(finish);
    Sound.startPlayer(url, headers)
      .then(() => {
        started = true;
      })
      .catch(fail);
  });
}

/**
 * On-device fallback (AVSpeechSynthesizer / Android TextToSpeech) — the
 * original implementation, used whenever speakRemote() fails or the request
 * simply takes too long. Also language-aware: sets the engine's language to
 * match the user's preferred language (constants/languages.ts) before
 * speaking, so a Spanish-language session at least gets Spanish on-device
 * speech (accented/robotic compared to the real ElevenLabs voice, but
 * correct-language) instead of an English voice reading Spanish text
 * phonetically.
 */
async function speakOnDevice(text: string, sttLocale: string, token: number, preserveRecordingSession = false): Promise<void> {
  await ensureTtsConfigured();
  if (isStale(token)) return; // superseded while the engine was initializing
  try {
    await Tts.setDefaultLanguage(sttLocale);
  } catch {
    // Voice/language pack not installed on-device for this locale — Tts.speak
    // below will just fall back to whatever the engine's current language is
    // rather than throwing, so this is safe to swallow.
  }
  // Re-assert the audio session category right before every utterance, not
  // just once at init. @dev-amirzubair/react-native-voice's Voice.start()
  // (called right after this resolves, to listen for the spoken answer)
  // switches iOS's AVAudioSession category to .playAndRecord so it can use
  // the mic — and .playAndRecord defaults to routing output through the
  // quiet earpiece receiver, not the main speaker, unless something resets
  // it. Without this, question 1 plays through the speaker fine, but every
  // follow-up question after the first answer gets routed to the earpiece
  // and sounds like it's "not working" even though it's technically
  // speaking. setDucking(true) re-sets the category to .playback (which
  // routes to the main speaker), so this runs before every question, not
  // just the first.
  //
  // EXCEPT during Video mode: react-native-vision-camera is, at this exact
  // moment, holding its OWN active .playAndRecord audio session for the
  // in-progress video+audio recording. Forcing the category to .playback
  // right out from under it (which this call does, every single question)
  // is the confirmed cause of recorded video-mode interviews coming back
  // with no audio track -- device logs from a real repro show VisionCamera's
  // own capture pipeline failing right in this window ("SessionCore.mm:602
  // Error: category option 'defaultToSpeaker' is only applicable with
  // category 'playAndRecord'", followed by a FigCaptureSourceRemote/
  // AVFoundation capture assertion failure) -- video frames keep recording
  // fine since that's a separate capture output, but the audio input tap
  // gets knocked out by this category switch and the resulting file ends up
  // silent. `preserveRecordingSession` skips this specific call in that
  // case -- the AI's question may route through the earpiece instead of the
  // speaker on some devices as a result (the original problem this ducking
  // call fixed), which is a real but much smaller regression than the
  // recorded interview having no audio at all.
  if (!preserveRecordingSession) {
    await Tts.setDucking?.(true)?.catch(() => {});
  }
  if (isStale(token)) return; // re-check right before actually speaking
  return new Promise<void>(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      Tts.removeAllListeners('tts-finish');
      Tts.removeAllListeners('tts-cancel');
      clearTimeout(safety);
      resolve();
    };
    // No 'tts-error' event exists on this version of react-native-tts (it
    // only emits tts-start/tts-finish/tts-pause/tts-resume/tts-progress/
    // tts-cancel — confirmed by the runtime redbox this used to throw:
    // "'tts-error' is not a supported event type"). An engine failure that
    // never fires tts-finish/tts-cancel is still caught by the safety
    // timeout below instead.
    const onSafetyTimeout = () => {
      // See speakRemote's identical comment — force-stop rather than
      // leaving the engine to keep talking in the background while the
      // caller's next action (re-arming the mic, next line) races it.
      try {
        const result: unknown = Tts.stop(false);
        if (result && typeof (result as Promise<unknown>).catch === 'function') {
          (result as Promise<unknown>).catch(() => {});
        }
      } catch {
        // ignored — see stopSpeaking()'s comment on this native bridge quirk.
      }
      finish();
    };
    const safety = setTimeout(onSafetyTimeout, safetyTimeoutMs(text));
    Tts.addEventListener('tts-finish', finish);
    Tts.addEventListener('tts-cancel', finish);
    Tts.speak(text);
  });
}

/**
 * Speak `text` aloud and resolve once speech finishes. Tries the real
 * ElevenLabs voice from the backend first; falls back to on-device TTS on
 * any failure (offline, backend/ElevenLabs error, slow response) so a live
 * interview never just goes silent.
 *
 * `language` defaults to the app's current i18next language (constants/
 * languages.ts) — the same "preferred language" set at signup or Settings →
 * Language — so every existing call site (LiveInterviewSession.tsx,
 * CourseSession.tsx) automatically speaks in the user's chosen language with
 * no call-site changes needed. Pass it explicitly only if a caller ever
 * needs to override that (none do today).
 */
export async function speak(
  text: string,
  language: string = i18n.language,
  options?: {
    // Set by LiveInterviewSession.tsx during Video mode. react-native-
    // nitro-sound's startPlayer() (speakRemote, the primary ElevenLabs
    // path) takes no options to control its own internal iOS audio-session
    // handling, and device logs from a real repro show it actively
    // fighting react-native-vision-camera's concurrent .playAndRecord
    // recording session for control of the shared AVAudioSession right as
    // it starts ("Setting up the audio session for playback...", followed
    // by a '!pri' property-set failure and, moments later, VisionCamera's
    // own capture pipeline throwing a FigCaptureSourceRemote assertion) --
    // this is the confirmed cause of recorded video-mode interviews coming
    // back with no audio track. Since there's no JS-level override
    // available for nitro-sound's side of this, the only reliable fix is
    // to not invoke it at all while a recording is active: this skips
    // straight to the on-device fallback (which speakOnDevice's own
    // preserveRecordingSession handling keeps session-safe) rather than
    // trying speakRemote first and hoping its failure mode happens to be
    // survivable. Trades the nicer ElevenLabs voice for a robotic
    // on-device one during Video mode specifically -- a real downgrade,
    // but a much smaller one than the recorded interview having no audio
    // at all.
    preserveRecordingSession?: boolean;
  },
): Promise<void> {
  // Captured now, before any awaiting — this call becomes THE current one,
  // automatically superseding (via isStale()) whatever speak() call, if any,
  // is still in flight from before (e.g. a previous module's/reply's speech
  // that hadn't started playing yet). See the speechToken comment above.
  const token = ++speechToken;
  if (options?.preserveRecordingSession) {
    await speakOnDevice(text, getSttLocale(language), token, true);
    return;
  }
  try {
    await speakRemote(text, language, token);
  } catch {
    if (!isStale(token)) {
      await speakOnDevice(text, getSttLocale(language), token);
    }
  }
}

export function stopSpeaking(): void {
  // Invalidate any speak() call currently in flight — even one still stuck
  // mid-network-fetch or mid-engine-init that hasn't started playing
  // anything yet — so it no-ops instead of starting audio late. See the
  // speechToken comment above for the full race this fixes.
  speechToken += 1;
  // Best-effort stop of whichever path is currently playing — safe to call
  // both even though only one is ever actually active, since a no-op stop
  // on the idle one is harmless.
  try {
    Sound.stopPlayer().catch(() => {});
  } catch {
    // ignored
  }
  // iOS's native Tts.stop: is declared as `stop:(BOOL *)onWordBoundary` — a
  // pointer-to-BOOL, a non-standard signature that this app's bridge can't
  // convert regardless of what JS passes (confirmed: explicitly passing
  // `false` throws the exact same "Objective C type BOOL is unsupported"
  // error as calling it with no argument at all — this is a library/native
  // bridge incompatibility, not a missing-argument bug). It also throws
  // SYNCHRONOUSLY the moment the method is invoked, not via a rejected
  // promise — chaining `.catch()` on the result doesn't help because the
  // call never gets that far. This has since been fixed at the source (see
  // patches/react-native-tts+4.1.1.patch via patch-package), but the
  // try/catch stays as cheap insurance against a stale/un-rebuilt native
  // binary or a future regression — every call site here is fire-and-forget
  // anyway, so a failed stop() doesn't need to be surfaced.
  try {
    const result: unknown = Tts.stop(false);
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      (result as Promise<unknown>).catch(() => {});
    }
  } catch {
    // ignored — see comment above
  }
}

async function ensureMicPermissionAndroid(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * React hook driving live speech-to-text for the duration of a Voice-mode
 * answer. `transcript` accumulates final recognized segments; most on-device
 * recognizers time out after a few seconds of silence, so `start()`
 * auto-restarts listening while `isListening` is true and the caller hasn't
 * called `stop()` — from the UI's perspective this behaves like one
 * continuous listening session for as long as the user is answering.
 */
export function useSpeechToText() {
  const [isListening, setIsListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const transcriptRef = React.useRef('');
  // BUG FIX (product report: "The Voice to text is typing the users word
  // multiple times") — react-native-voice's onSpeechResults delivers each
  // *session's* full recognized-so-far text on every call, not just the
  // newest words since the last call. This hook auto-restarts a fresh
  // recognition session on every onSpeechEnd/"no speech detected" (below —
  // needed since on-device recognizers time out after a few seconds of
  // silence), and onSpeechResults can fire more than once before a session
  // actually ends. The old code appended `best` onto transcriptRef on
  // EVERY onSpeechResults call — so a session that reported "hello", then
  // "hello world", then "hello world how are you" as it refined its
  // hypothesis got all three appended in sequence, duplicating every
  // earlier word each time. sessionTranscriptRef now holds only the
  // CURRENT session's latest (replaced, not appended) text; it gets
  // folded into transcriptRef exactly once, when the session actually
  // ends (see commitSessionTranscript below), so cross-session
  // accumulation still works but within-session duplication doesn't.
  const sessionTranscriptRef = React.useRef('');
  // DIAGNOSTIC + SELF-HEALING (product report: "AI coach isn't picking up
  // anything at all" -- confirmed via the no-speech nudge that Voice.start()
  // reports success but no transcript ever arrives, on a device where this
  // exact same hook works fine in Mock Interview). onSpeechError's existing
  // auto-restart logic below treats EVERY error as the normal "brief pause
  // between sentences" case and silently retries forever whenever
  // wantsListeningRef is true -- which was the right call for the common
  // case, but it also means a genuinely broken recognition session (one
  // that errors out immediately on every single restart, before the user
  // ever gets a chance to say anything) retries silently forever too, with
  // the real native error code/message never reaching setError() or this
  // app's own logs. That's indistinguishable from "just isn't hearing me"
  // from the outside. This tracks recent error timestamps -- normal
  // between-sentence pauses are seconds apart; a genuine broken-session
  // loop fires near-instantly on every restart -- and if it sees a tight
  // burst, stops the silent retry loop and surfaces the actual error
  // instead, so the next report has the real native error text instead of
  // just "nothing happened."
  const recentErrorTimestampsRef = React.useRef<number[]>([]);

  const commitSessionTranscript = React.useCallback(() => {
    if (sessionTranscriptRef.current) {
      transcriptRef.current = transcriptRef.current
        ? `${transcriptRef.current} ${sessionTranscriptRef.current}`
        : sessionTranscriptRef.current;
      setTranscript(transcriptRef.current);
      sessionTranscriptRef.current = '';
    }
  }, []);
  const wantsListeningRef = React.useRef(false);

  React.useEffect(() => {
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const best = e.value?.[0];
      if (best) {
        // Replace, don't append — see this hook's own doc comment above.
        sessionTranscriptRef.current = best;
        // A real result came back -- whatever error streak was building
        // (recentErrorTimestampsRef, see onSpeechError below) is now stale;
        // the session is demonstrably working.
        recentErrorTimestampsRef.current = [];
      }
    };
    // Auto-restart used to fire unconditionally on any "no speech
    // detected"/session-end event as long as wantsListeningRef was true —
    // including while the app is backgrounded (e.g. the phone just got
    // locked mid-conversation). iOS interrupts/reclaims the audio session
    // on lock, so every one of those blind Voice.start() retries while
    // backgrounded either fails outright or leaves the native session in a
    // half-reconfigured state; by the time the app is foregrounded again,
    // the next speak() call's ElevenLabs playback (speakRemote) fails
    // against that broken session and silently falls back to the on-device
    // voice — this is the root cause of "the phone locks and the voice
    // just changes to the default phone TTS voice". Only auto-restart while
    // the app is actually in the foreground; VoiceCoachView.tsx's own
    // AppState handling does a clean stop/restart around the lock instead.
    const canAutoRestart = () => wantsListeningRef.current && AppState.currentState === 'active';
    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      // "No speech detected" style errors fire constantly during normal
      // pauses between sentences — not a real failure, just the recognizer's
      // session ending. Restart it silently if we're still supposed to be
      // listening (and the app is actually in the foreground) rather than
      // surfacing every pause as an error. Either way the session that just
      // ended may have recognized something before erroring out, so commit
      // it first (see commitSessionTranscript's doc comment).
      commitSessionTranscript();
      if (canAutoRestart()) {
        // See recentErrorTimestampsRef's doc comment above: a genuine
        // broken-session loop errors out almost instantly on every restart,
        // unlike the multi-second gaps a normal "waiting for the user to
        // speak" pause produces. 4 errors inside 3 seconds is well outside
        // any plausible normal pause pattern.
        const now = Date.now();
        const recent = recentErrorTimestampsRef.current.filter(t => now - t < 3000);
        recent.push(now);
        recentErrorTimestampsRef.current = recent;
        if (recent.length >= 4) {
          recentErrorTimestampsRef.current = [];
          setError(
            `${i18n.t('find:speech_recognition_error', { defaultValue: 'Speech recognition error' })}${
              e.error?.message ? ` (${e.error.message})` : e.error?.code ? ` (code ${e.error.code})` : ''
            }`,
          );
          // Deliberately stop retrying here rather than looping forever —
          // wantsListeningRef stays true (the caller can still explicitly
          // stop()/start() again, e.g. via VoiceCoachView's onInterrupt/tap-
          // to-retry), but this hook won't keep silently re-triggering a
          // session that's demonstrably not working.
          return;
        }
        Voice.start(currentSttLocale()).catch(() => {});
      } else if (!wantsListeningRef.current) {
        setError(e.error?.message ?? i18n.t('find:speech_recognition_error', { defaultValue: 'Speech recognition error' }));
      }
      // else: still "wants listening" but the app is backgrounded — do
      // nothing (no restart storm against a reclaimed audio session, no
      // error the user can't see anyway while the phone is locked).
    };
    Voice.onSpeechEnd = () => {
      commitSessionTranscript();
      if (canAutoRestart()) {
        Voice.start(currentSttLocale()).catch(() => {});
      }
    };
    return () => {
      Voice.destroy().then(Voice.removeAllListeners).catch(() => {});
    };
  }, []);

  const start = React.useCallback(async () => {
    setError(null);
    const hasPermission = await ensureMicPermissionAndroid();
    if (!hasPermission) {
      setError(i18n.t('find:mic_permission_required', { defaultValue: 'Microphone permission is required to speak your answer.' }));
      return false;
    }
    wantsListeningRef.current = true;
    setIsListening(true);
    try {
      await Voice.start(currentSttLocale());
      return true;
    } catch (e: any) {
      wantsListeningRef.current = false;
      setIsListening(false);
      setError(e?.message ?? i18n.t('find:speech_recognition_start_failed', { defaultValue: 'Could not start speech recognition.' }));
      return false;
    }
  }, []);

  const stop = React.useCallback(async (): Promise<string> => {
    wantsListeningRef.current = false;
    setIsListening(false);
    try {
      await Voice.stop();
    } catch {
      // Already stopped — fine.
    }
    // Voice.stop() doesn't reliably fire onSpeechEnd before this await
    // resolves on every platform — commit whatever the still-active
    // session had recognized directly, rather than risking losing the
    // last few words the user said right before the turn ended.
    commitSessionTranscript();
    return transcriptRef.current;
  }, [commitSessionTranscript]);

  const reset = React.useCallback(() => {
    transcriptRef.current = '';
    sessionTranscriptRef.current = '';
    setTranscript('');
  }, []);

  return {isListening, transcript, error, start, stop, reset};
}
