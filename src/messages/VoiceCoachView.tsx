import React, { memo } from 'react';
import { AppState, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

import Text from 'components/Text';
import { Images } from 'assets/images';
import * as coachService from 'services/coachService';
import { CoachUserContext } from 'services/coachService';
import * as speechService from 'services/speechService';
import * as duplexVoiceService from 'services/duplexVoiceService';
import { actionTitle } from 'services/suggestedActions';
import { SuggestedActionId } from 'constants/Types';
import ThemeContext from '../../ThemeContext';

// Live, continuous voice conversation with the AI coach — replaces the
// text-chat box as the default way to talk to the coach (see Chat.tsx's
// mode toggle), per explicit product direction: "instead of it being a
// text chat it should be a AI voice responding to the user when the user
// talks with the AI... like a chat but a voice response... a conversation
// between a coach and a student kind."
//
// Visuals deliberately reuse the exact same pulsing orb used by the
// mock-interview Voice mode (src/practice/LiveInterviewSession.tsx) — same
// ORB_SIZE/HALO_SIZE, same Images.voiceOrb image, same reanimated pulse
// approach — so this feels like the same app's voice UI, not a
// one-off screen. The first version of this screen used the shared Flex
// component with `vertical center` for layout, which doesn't do what it
// looks like it does: Flex's `justify` prop defaults to "space-between",
// and `center` only centers the Flex box itself within ITS parent (via
// alignSelf), not its children — so the orb, status line, and transcript
// ended up shoved to the top/middle/bottom of the whole screen with huge
// gaps between them instead of forming one centered cluster. Fixed here by
// using a plain View + StyleSheet, same as LiveInterviewSession.tsx does.
//
// Turn-taking model (Android / any platform without the duplex engine —
// see below): services/speechService.ts's useSpeechToText() already
// auto-restarts listening on every pause (built for Voice-mode interview
// answers), which this reuses as-is for "always listening" rather than
// inventing a second speech pipeline. What's new here is *silence-based
// turn detection* on top of that continuous stream: whenever the
// recognized transcript changes, a short timer restarts; if nothing new
// comes in before it fires, that's treated as the end of the user's turn,
// and the accumulated transcript is sent to the coach.
//
// Interruption / barge-in: THIS SCREEN NOW HAS TWO SEPARATE
// IMPLEMENTATIONS, selected once per session via
// duplexVoiceService.isDuplexVoiceSupported() (iOS only, for now):
//
//   - iOS (duplexSupported === true): real, speech-triggered barge-in.
//     The mic runs continuously through both listening AND the coach's
//     own speech via services/duplexVoiceService.ts / the native
//     DuplexVoiceEngine module (ios/caren_family/DuplexVoiceEngine.swift),
//     which owns a single AVAudioEngine doing both playback and capture
//     with real echo cancellation, so the coach's own TTS is not picked
//     back up as user speech. If the user starts talking while the coach
//     is mid-reply, that's detected as a genuine new transcript arriving
//     during the 'speaking' phase and the coach is cut off immediately —
//     see the barge-in effect below. Tapping the orb / "Tap to interrupt"
//     still works too, as a manual backup.
//   - Everywhere else (duplexSupported === false, i.e. Android today):
//     the mic is deliberately NOT listening while the AI's reply is being
//     spoken (TTS) — the reply audio itself would otherwise very likely
//     get picked back up as "user speech" (no on-device echo cancellation
//     exists for this platform's audio pipeline). Interruption there is
//     only the visible tap (the orb itself, or the "Interrupt" pill below
//     it) — tapping either immediately stops playback and hands the mic
//     back. This is the exact behavior that shipped after the two failed
//     attempts documented below, and it's left completely untouched.
//
// REVERTED TWICE, then a working THIRD attempt — full history, because
// understanding why the first two failed is what made the third one
// possible:
//
// Attempt 1 (real-device report: "The AI voice is not talking even though
// its indicating that its speaking but i cant hear anything and its not
// even capturing my voice" — total silence AND a dead mic). Kept the mic
// running through TTS via speak()'s `preserveRecordingSession` option but
// never touched the iOS AVAudioSession's MODE, only its category — no
// echo cancellation was engaged, and the raw category-only session
// couldn't reliably do either half of simultaneous record+playback.
//
// Attempt 2 (real-device report: ElevenLabs voice gone AND "its listening
// to itself and answering itself" — the coach hearing and replying to its
// own TTS output). Added the missing piece from attempt 1 — a native
// patch (patches/@dev-amirzubair+react-native-voice+1.0.4.patch) setting
// AVAudioSessionModeVoiceChat, Apple's mode for concurrent record+playback
// with built-in echo cancellation — and it still didn't work. Two
// separate problems, both now understood:
//   1. ElevenLabs voice loss was actually just this file's own doing: the
//      speak() call sites all passed `preserveRecordingSession: true`,
//      and speak() (see speechService.ts) treats that flag as "skip
//      speakRemote (ElevenLabs) entirely, go straight to on-device TTS" —
//      that's Video mode's existing, deliberate behavior for protecting
//      VisionCamera's session, reused here for a different reason but
//      with the same effect. Not a bug in the new code, just an
//      unwelcome side effect of reusing that flag.
//   2. The self-listening loop is the real finding: AVAudioSessionMode's
//      built-in echo cancellation operates WITHIN a single AVAudioEngine's
//      voice-processing I/O unit — it cancels audio that the SAME engine
//      is rendering out, using that engine's own render callback as the
//      reference signal. It has no way to cancel audio that a DIFFERENT,
//      independent engine played. react-native-tts's on-device speech
//      (AVSpeechSynthesizer) and react-native-nitro-sound's ElevenLabs
//      playback both render through their own separate pipelines, not
//      through @dev-amirzubair/react-native-voice's capture engine —
//      setting the session-level mode was necessary but never sufficient
//      for these specific libraries to cancel each other out.
//
// Attempt 3 (THIS ONE — confirmed working on a real device): built the
// real fix attempt 2's own root-cause analysis called for — a from-scratch
// native module (DuplexVoiceEngine, see its own header comment for the
// full build/debug story) that owns ONE AVAudioEngine for both playback
// and capture, with voice processing explicitly enabled on both its
// input and output nodes, so the OS's echo canceller has an actual
// reference signal to work with. Built and proven in strict, isolated
// phases (on-device TTS + concurrent listening first, then ElevenLabs
// remote audio through the same engine — see src/dev/
// DuplexVoiceTestScreen.tsx) before ever being wired in here, per the
// discipline the first two failed attempts made clear was necessary.
// User-confirmed on a real device, in order: (1) "Yes the transcript
// picks up your actual words before it finishes" — proof the core
// duplex+echo-cancellation mechanism genuinely works — then (2) the same
// result with real ElevenLabs audio in place of on-device TTS. iOS only
// for now; Android has no equivalent native module yet, so it keeps the
// proven sequential tap-to-interrupt model above unchanged.
const SILENCE_DEBOUNCE_MS = 1300;

type Phase = 'listening' | 'thinking' | 'speaking' | 'idle';

const ORB_SIZE = 176;
const HALO_SIZE = ORB_SIZE * 1.5;

// Product request item: "the AI coach can ask the user if they want the
// coach to navigate to the specific screen for them... and the app will
// navigate automatically to that screen" — Text mode gets a tappable chip
// (see Chat.tsx's renderCustomView), but there's nothing to tap in Voice
// mode, so the coach instead asks out loud and this listens for a plain
// yes on the very next turn. Deliberately just a handful of common
// affirmatives per supported locale rather than a full NLU intent check —
// this only ever fires right after the coach itself asked a yes/no
// question, so the false-positive surface is small, and anything that
// doesn't match one of these is treated as "no" (i.e. falls through to a
// normal coaching turn instead of leaving the user stuck).
const AFFIRMATIVE_WORDS: Record<string, string[]> = {
  en: ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'please', 'go ahead', 'take me there', "let's do it"],
  es: ['si', 'sí', 'claro', 'vale', 'dale', 'por favor'],
  fr: ['oui', "d'accord", 'ok', 'vas-y', "s'il te plait", "s'il vous plait"],
  de: ['ja', 'klar', 'gerne', 'okay', 'ok'],
  it: ['si', 'sì', 'certo', 'va bene', 'ok', 'okay'],
  pt: ['sim', 'claro', 'vamos', 'ok', 'okay', 'por favor'],
  ru: ['да', 'конечно', 'давай', 'хорошо'],
  zh: ['是', '好', '好的', '可以', '去吧'],
  ja: ['はい', 'うん', 'お願いします', 'いいよ'],
  ko: ['네', '예', '좋아', '그래'],
  ar: ['نعم', 'اكيد', 'حسنا', 'تمام'],
  hi: ['हाँ', 'ठीक है', 'हां', 'चलो'],
};
const isAffirmative = (text: string, language: string): boolean => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  const lang = language?.split('-')[0] ?? 'en';
  const words = AFFIRMATIVE_WORDS[lang] ?? AFFIRMATIVE_WORDS.en;
  return words.some(w => normalized === w || normalized.includes(w));
};

const VoiceCoachView = memo(({
  userContext,
  onSuggestedAction,
  initialTopic,
  onInitialTopicHandled,
}: {
  userContext?: CoachUserContext;
  // Fired once the user affirms the coach's spoken offer — Chat.tsx passes
  // down the same handler its "Learn more about X"-style chip uses in Text
  // mode (onRunSuggestedAction), so both modes navigate identically.
  onSuggestedAction?: (action: SuggestedActionId) => void;
  // Product follow-up: "[the suggested topics] should be in the screen
  // that leads to the live conversation screen" / confirmed: tapping one
  // should start a real spoken conversation about it, not just drop a
  // text bubble. Chat.tsx's greeting screen switches into Voice mode and
  // passes the tapped topic's title down here — see the focus effect
  // below for what "starting the conversation with it" actually does.
  initialTopic?: string;
  // Fired once initialTopic has been consumed (sent as the opening turn)
  // so Chat.tsx can clear it — otherwise a later remount of this view
  // (e.g. toggling Text -> Voice again by hand) would replay the same
  // stale topic as a new turn.
  onInitialTopicHandled?: () => void;
}) => {
  const { t } = useTranslation(['message']);
  const theme = useTheme();
  const { theme: appTheme } = React.useContext(ThemeContext);
  const isDarkMode = appTheme === 'dark';

  // Real speak-to-interrupt (see the header comment above) is iOS-only for
  // now. isDuplexVoiceSupported() is just a Platform.OS check baked in at
  // module load, stable for the app's whole lifetime — safe to read as a
  // plain const rather than state.
  const duplexSupported = duplexVoiceService.isDuplexVoiceSupported();

  // Legacy pipeline — always constructed (rules of hooks require it), but
  // its start()/stop()/reset() are only ever actually invoked below when
  // !duplexSupported. On iOS this hook's internal state just sits unused.
  const stt = speechService.useSpeechToText();

  const [phase, setPhase] = React.useState<Phase>('idle');
  const [lastCoachLine, setLastCoachLine] = React.useState(
    t('message:voice_initial_line', {
      defaultValue: "I'm listening — talk to me whenever you're ready.",
    }),
  );
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const phaseRef = React.useRef<Phase>('idle');
  React.useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const silenceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = React.useRef(false);
  // Set right after the coach speaks a "want me to take you there?" offer;
  // checked (and always cleared) at the start of the very next turn.
  const pendingActionRef = React.useRef<SuggestedActionId | null>(null);
  // Bumped on every duplex speak (a normal reply, the intro, or a
  // pending-action confirmation) and on any interrupt (manual tap or auto
  // barge-in). speakDuplexFireAndForget's own failure handler checks this
  // before surfacing an error, so a genuinely-superseded call (the coach
  // got cut off on purpose) never reports a spurious "couldn't play that
  // out loud" for something that was deliberately stopped.
  const turnTokenRef = React.useRef(0);
  // Whether duplexVoiceService.start() has already been called for the
  // CURRENT foreground session. start() only ever needs to run once per
  // session — the engine + recognition then run continuously through
  // every turn, including while the coach is speaking (that's the whole
  // point) — reset to false on background/unmount so returning to the
  // screen (or the app) does a clean restart instead of assuming a
  // possibly-torn-down engine is still alive.
  const duplexStartedRef = React.useRef(false);
  // One-shot callback to run instead of the default "go back to
  // listening" once the coach finishes speaking (see the onSpeakingState
  // listener below) — used for the pending-action confirmation line,
  // where "finishes speaking" should navigate away rather than resume
  // listening on a screen that's about to be left.
  const postSpeechActionRef = React.useRef<(() => void) | null>(null);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  // --- Duplex-only transcript accumulation -----------------------------
  // DuplexVoiceEngine.swift's own recognition loop restarts a fresh
  // SFSpeechAudioBufferRecognitionRequest on every isFinal/error to keep
  // "always listening" alive across the recognizer's internal session
  // length limit (see that file's startRecognitionRequest comment) — each
  // new request's transcript starts over from empty. Naively replacing a
  // local `transcript` string with whatever the latest onTranscript event
  // carries would make the on-screen transcript, and the silence-based
  // turn-completion timer below (which keys off transcript CHANGING),
  // jump backward to nothing mid-sentence whenever that internal restart
  // happens — not just when the user's turn genuinely ends. duplexSegment
  // holds the CURRENT request's live text; duplexCommittedRef accumulates
  // every PRIOR segment of the current turn so it survives that restart.
  // The two are joined into a single `transcript` value below for
  // everything else in this screen to read, exactly like `stt.transcript`
  // was on the legacy path.
  const duplexCommittedRef = React.useRef('');
  const [duplexSegment, setDuplexSegment] = React.useState('');
  // DEV-ONLY, on-screen (not just console.warn) diagnostics for the
  // real-device report "still not capturing my voice at all" after the
  // duplex wiring landed. Metro/Xcode console logs aren't practical for
  // this project's actual debugging loop so far -- every real-device bug
  // in this whole DuplexVoiceEngine effort got diagnosed from a
  // screenshot, not a pasted log -- so this surfaces the same information
  // directly on the screen instead, gated by __DEV__ so it never ships.
  const [duplexEngineReady, setDuplexEngineReady] = React.useState(false);
  const [lastDuplexEvent, setLastDuplexEvent] = React.useState('none yet');

  const resetDuplexTranscript = React.useCallback(() => {
    duplexCommittedRef.current = '';
    setDuplexSegment('');
  }, []);

  React.useEffect(() => {
    if (!duplexSupported) return;
    // DIAGNOSTIC (product report: coach screen isn't picking up any speech
    // at all after the duplex engine was wired in, with no visible error —
    // same class of "silently nothing happens" report this codebase has
    // hit before, e.g. speechService.ts's own recentErrorTimestampsRef
    // history). This screen and src/dev/DuplexVoiceTestScreen.tsx run the
    // exact same duplexVoiceService calls, but the test screen is a
    // standalone route with nothing else mounted alongside it, while this
    // one lives embedded inside Chat.tsx's Voice/Text mode toggle — if
    // something about that embedding (a remount, a competing audio-session
    // user, etc.) is the actual difference, these logs are what will show
    // it on the next real-device test, instead of guessing blind again.
    if (__DEV__) console.warn('[VoiceCoachView] duplex listeners attached');
    const subs = [
      duplexVoiceService.addTranscriptListener(e => {
        if (__DEV__) {
          console.warn('[VoiceCoachView] onTranscript', JSON.stringify(e));
          setLastDuplexEvent(`transcript: "${e.text}" isFinal=${e.isFinal} @ ${new Date().toLocaleTimeString()}`);
        }
        setDuplexSegment(e.text);
        if (e.isFinal) {
          duplexCommittedRef.current = (duplexCommittedRef.current + ' ' + e.text).trim();
          setDuplexSegment('');
        }
      }),
      // Single source of truth for "the coach is done talking" — fires
      // reliably whether that's because the reply finished naturally OR
      // because stopSpeaking() cut it off (manual tap or auto barge-in).
      // See sendTurn's own comment on why nothing here is driven by
      // awaiting the speak() call's promise instead.
      duplexVoiceService.addSpeakingStateListener(e => {
        if (__DEV__) {
          console.warn('[VoiceCoachView] onSpeakingState', JSON.stringify(e), 'phase=', phaseRef.current);
          setLastDuplexEvent(`speakingState: ${e.speaking} (phase was ${phaseRef.current}) @ ${new Date().toLocaleTimeString()}`);
        }
        if (e.speaking) return;
        if (phaseRef.current !== 'speaking') return;
        const postAction = postSpeechActionRef.current;
        postSpeechActionRef.current = null;
        if (postAction) {
          postAction();
          return;
        }
        setPhase('listening');
      }),
      duplexVoiceService.addErrorListener(e => {
        if (__DEV__) {
          console.warn('[VoiceCoachView] onError', JSON.stringify(e));
          setLastDuplexEvent(`error [${e.context}]: ${e.message} @ ${new Date().toLocaleTimeString()}`);
        }
        if (isActiveRef.current) setErrorMsg(e.message);
      }),
    ];
    return () => subs.forEach(sub => sub?.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplexSupported]);

  const transcript = duplexSupported
    ? (duplexCommittedRef.current + ' ' + duplexSegment).trim()
    : stt.transcript;

  // Surfaces speechService's rapid-error-loop detector (legacy path
  // only — the duplex path has its own addErrorListener above, wired to
  // DuplexVoiceEngine's equivalent rapid-error-loop guard).
  React.useEffect(() => {
    if (duplexSupported) return;
    if (stt.error && isActiveRef.current) {
      setErrorMsg(stt.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.error, duplexSupported]);

  const startListening = React.useCallback(async () => {
    setErrorMsg(null);
    if (duplexSupported) {
      // The engine + recognition are already running continuously
      // (started once at mount / on foreground-return — see the focus and
      // AppState effects below) — "starting to listen" for a new turn is
      // just a UI-phase change here, not a new native call.
      setPhase('listening');
      return;
    }
    stt.reset();
    const ok = await stt.start();
    if (ok) {
      setPhase('listening');
    } else {
      setErrorMsg(
        stt.error ??
          i18n.t('message:voice_mic_error', { defaultValue: 'Could not start the microphone.' }),
      );
      setPhase('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplexSupported]);

  // Fires the real ElevenLabs-with-fallback voice through the duplex
  // engine WITHOUT awaiting it for control flow. This is deliberate, not
  // an oversight: DuplexVoiceEngine.stopSpeaking() (called by the
  // barge-in effect below, or by a manual tap via onInterrupt) bumps its
  // own internal generation counter, which permanently blocks the
  // ORIGINAL speak()/speakRemoteAudio() call's completion callback from
  // ever firing resolve() — so awaiting it here would mean an interrupted
  // call's caller never continues at all. The onSpeakingState listener
  // above is the single source of truth for "the coach is done talking"
  // instead, and drives whatever should happen next on its own; this
  // helper only needs to kick playback off and report a genuine total
  // failure (both the real voice AND the on-device fallback failing).
  const speakDuplexFireAndForget = React.useCallback((text: string) => {
    turnTokenRef.current += 1;
    const myToken = turnTokenRef.current;
    duplexVoiceService.speakWithFallback(text).catch(() => {
      if (myToken === turnTokenRef.current && isActiveRef.current) {
        setErrorMsg(
          i18n.t('message:voice_speak_failed', {
            defaultValue: "Couldn't play that out loud — the text reply above is still there.",
          }),
        );
      }
    });
  }, []);

  const sendTurn = React.useCallback(
    async (finalText: string) => {
      const trimmed = finalText.trim();
      if (!trimmed) {
        setPhase('listening');
        return;
      }
      // Consume the duplex transcript buffer right when a turn is taken
      // from it, regardless of call site (live silence-detection, the
      // initial topic, etc.) — so leftover words never bleed into the
      // NEXT turn or get mistaken for a barge-in the moment 'speaking'
      // starts below.
      if (duplexSupported) resetDuplexTranscript();

      // Resolve any pending "want me to take you there?" offer from the
      // previous turn before treating this as a fresh coaching question —
      // a plain yes here should navigate, not get sent to the LLM.
      const pendingAction = pendingActionRef.current;
      pendingActionRef.current = null;
      if (pendingAction) {
        if (isAffirmative(trimmed, i18n.language)) {
          const confirmLine = i18n.t('message:voice_action_confirm_line', {
            defaultValue: 'Great, taking you there now.',
          });
          setLastCoachLine(confirmLine);
          setPhase('speaking');
          if (duplexSupported) {
            postSpeechActionRef.current = () => {
              if (isActiveRef.current) onSuggestedAction?.(pendingAction);
            };
            speakDuplexFireAndForget(confirmLine);
            return;
          }
          await stt.stop();
          try {
            await speechService.speak(confirmLine);
          } catch {
            // best-effort
          }
          if (!isActiveRef.current) return;
          onSuggestedAction?.(pendingAction);
          return;
        }
        // Anything other than a clear yes falls through and is sent as a
        // normal turn below — treated as "no, but here's what I actually
        // wanted to say" rather than a dead end.
      }

      setPhase('thinking');
      let replyText = '';
      let suggestedAction: SuggestedActionId | undefined;
      try {
        const result = await coachService.sendVoiceMessage(trimmed, userContext);
        replyText = result.coachMessage.text;
        suggestedAction = result.coachMessage.suggestedAction;
      } catch (e: any) {
        replyText = i18n.t('message:voice_retry_line', {
          defaultValue: "Sorry, I didn't catch that — could you say it again?",
        });
        setErrorMsg(e?.message ?? null);
      }
      if (suggestedAction) {
        // Was a per-action hand-written full sentence (4 of them, hardcoded
        // here) — now one generic template naming the destination via the
        // shared registry's title, so a new action (see
        // services/suggestedActions.ts) never needs a new sentence written
        // here by hand.
        const offer = i18n.t('message:voice_action_offer_generic', {
          defaultValue: 'Want me to take you to {{title}}?',
          title: actionTitle(suggestedAction),
        });
        replyText = `${replyText} ${offer}`;
        pendingActionRef.current = suggestedAction;
      }
      if (!isActiveRef.current) return;
      setLastCoachLine(replyText);
      setPhase('speaking');

      if (duplexSupported) {
        // Mic never stopped — no restart needed. The onSpeakingState
        // listener above takes phase back to 'listening' on its own once
        // this genuinely finishes (or gets barged into).
        speakDuplexFireAndForget(replyText);
        return;
      }

      await stt.stop();
      let spokeFailed = false;
      try {
        await speechService.speak(replyText);
      } catch {
        // speak() already falls back to on-device TTS internally on a
        // remote failure -- reaching this catch means BOTH the real voice
        // AND the on-device fallback failed, i.e. genuinely nothing was
        // ever spoken out loud (product report: "the AI coach isn't
        // talking at all"). That used to be swallowed silently here, which
        // is exactly why it looked like nothing happened at all in Voice
        // mode -- lastCoachLine/displayLine above still updates with the
        // reply text regardless, but Voice mode is meant to be hands-free,
        // so a user not looking at the screen got no signal whatsoever
        // that anything had gone wrong. Surfacing it here at least makes
        // the failure visible (and gives us something concrete to go on
        // if it's reported again) instead of it just looking broken.
        spokeFailed = true;
        if (isActiveRef.current) {
          setErrorMsg(
            i18n.t('message:voice_speak_failed', {
              defaultValue: "Couldn't play that out loud — the text reply above is still there.",
            }),
          );
        }
      }
      if (!isActiveRef.current) return;
      if (spokeFailed) {
        // startListening() clears errorMsg as its very first line (correct
        // for a stale mic-start error) -- without this pause it would wipe
        // the message this catch block JUST set before it had any chance
        // to actually be seen, since the restart below fires immediately.
        // The mic isn't blocked from re-arming by this, it's just given a
        // moment to be readable first.
        await new Promise(resolve => setTimeout(resolve, 2500));
        if (!isActiveRef.current) return;
      }
      startListening();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userContext, onSuggestedAction, duplexSupported],
  );

  React.useEffect(() => {
    if (phase !== 'listening') return;
    clearSilenceTimer();
    if (!transcript.trim()) return;
    silenceTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== 'listening') return;
      const finalText = transcript;
      if (!duplexSupported) stt.reset();
      sendTurn(finalText);
    }, SILENCE_DEBOUNCE_MS);
    return clearSilenceTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, phase]);

  // Diagnostic nudge (product report: "it shows I'm listening, I say
  // something, and nothing happens" -- with no error shown, meaning
  // stt.start() itself succeeded and the mic never reported a failure). The
  // debounce effect above only ever fires sendTurn() once transcript (state,
  // not a live ref) has actually changed -- if the native speech recognizer
  // genuinely never delivers a result back for this session, transcript
  // just never changes and NOTHING in this screen ever tells the user
  // that. This doesn't fix that underlying capture issue (a JS-only fix
  // can't -- there's no signal to react to if the native side never calls
  // back at all), but it stops the screen from silently sitting there
  // forever with zero feedback: after a long stretch of "listening" with
  // nothing ever recognized, nudge the user rather than leaving them
  // wondering whether the app heard them at all.
  React.useEffect(() => {
    if (phase !== 'listening') return;
    const timer = setTimeout(() => {
      if (phaseRef.current === 'listening' && !transcript.trim()) {
        setErrorMsg(
          i18n.t('message:voice_no_speech_nudge', {
            defaultValue: "Still there? I'm not picking up anything — try tapping the orb, or check your mic.",
          }),
        );
      }
    }, 20000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const onInterrupt = React.useCallback(async () => {
    if (phaseRef.current !== 'speaking') return;
    if (duplexSupported) {
      turnTokenRef.current += 1; // supersede speakDuplexFireAndForget's own pending call
      setPhase('listening'); // optimistic, immediate UI feedback for a manual tap
      await duplexVoiceService.stopSpeaking().catch(() => {});
      return;
    }
    // BUG FIX (see speechService.stopSpeaking's own comment on this round's
    // fresh "captures fine in Mock Interview, never in Coach" report) —
    // stopSpeaking() is now a genuinely awaitable teardown instead of
    // fire-and-forget; awaiting it here means startListening()'s own 700ms
    // settle delay starts counting from a *confirmed* stop instead of
    // racing an in-flight one on top of it.
    await speechService.stopSpeaking();
    startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplexSupported]);

  // Real speak-to-interrupt: thanks to DuplexVoiceEngine's shared-engine
  // echo cancellation (confirmed on a real device — see this file's header
  // comment for the full three-attempt history), a transcript arriving
  // here WHILE the coach is talking is the user's own voice, not the
  // coach's own TTS being picked back up. Cut the coach off immediately
  // and hand the turn back — same effect as tapping the orb via
  // onInterrupt, just triggered by speech instead of a tap.
  React.useEffect(() => {
    if (!duplexSupported) return;
    if (phase !== 'speaking') return;
    const liveText = (duplexCommittedRef.current + ' ' + duplexSegment).trim();
    if (!liveText) return;
    turnTokenRef.current += 1; // supersede speakDuplexFireAndForget's own pending call
    setPhase('listening');
    duplexVoiceService.stopSpeaking().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplexSupported, phase, duplexSegment]);

  useFocusEffect(
    React.useCallback(() => {
      isActiveRef.current = true;
      if (__DEV__ && duplexSupported) console.warn('[VoiceCoachView] focus effect running (mount or re-focus)');
      (async () => {
        if (duplexSupported && !duplexStartedRef.current) {
          try {
            await duplexVoiceService.start();
            duplexStartedRef.current = true;
            if (__DEV__) {
              console.warn('[VoiceCoachView] duplexVoiceService.start() resolved');
              if (isActiveRef.current) {
                setDuplexEngineReady(true);
                setLastDuplexEvent(`start() resolved @ ${new Date().toLocaleTimeString()}`);
              }
            }
          } catch (e: any) {
            if (__DEV__) console.warn('[VoiceCoachView] duplexVoiceService.start() rejected', e?.message ?? e);
            if (isActiveRef.current) {
              setErrorMsg(
                e?.message ??
                  i18n.t('message:voice_mic_error', { defaultValue: 'Could not start the microphone.' }),
              );
              setPhase('idle');
              if (__DEV__) setLastDuplexEvent(`start() REJECTED: ${e?.message ?? e} @ ${new Date().toLocaleTimeString()}`);
            }
            return; // nothing else here can work without the engine
          }
        }
        // Product follow-up: a suggested topic tapped on the greeting
        // screen switches Chat.tsx into Voice mode and hands the topic's
        // title down as initialTopic — start the real live conversation
        // with it immediately (thinking -> a real spoken reply -> back to
        // listening, exactly like any other turn — see sendTurn below),
        // instead of the usual "wait for the user to speak first" open.
        // Skips the first-ever-visit intro entirely: sendTurn's own reply
        // already gives the user something spoken to react to, so a
        // separate generic greeting first would just be two lines of
        // speech back to back before the user gets to the thing they
        // actually tapped.
        if (initialTopic) {
          onInitialTopicHandled?.();
          if (isActiveRef.current) await sendTurn(initialTopic);
          return;
        }
        // BUG FIX (product report: "I want the AI coach to always
        // introduce itself for the first time the user is coming to the
        // app... the AI should introduce itself as Saveur") — Text mode
        // already shows this via coachService's greeting bubble; Voice
        // mode never spoke anything at all until the user said something
        // first. isFirstEverCoachVisit checks real persisted history (not
        // a per-screen-visit flag), so this only ever speaks once total —
        // it won't repeat on a later visit to Voice mode, including if the
        // user's very first coach interaction happened in Text mode
        // instead.
        let introSpeakFailed = false;
        // BUG FIX (real-device report: coach screen not picking up any
        // speech at all after the duplex engine was wired in). This used
        // to check `phaseRef.current !== 'speaking'` a few lines below to
        // decide whether an intro was just spoken -- but phaseRef only
        // gets updated by a SEPARATE effect (`phaseRef.current = phase`)
        // that runs on the NEXT render, not synchronously alongside the
        // `setPhase('speaking')` call right below. Since nothing in this
        // duplex branch awaits between that setPhase() call and the check
        // (speakDuplexFireAndForget is deliberately fire-and-forget, see
        // its own comment), phaseRef.current was still whatever it was
        // BEFORE this function ran (typically 'idle') at the time of that
        // check -- so it incorrectly looked like no intro had been spoken,
        // called startListening() immediately, and flipped phase straight
        // to 'listening' while the intro was still actually playing. A
        // plain local flag, set synchronously right here rather than read
        // from a ref that lags a render behind, is the fix.
        let firedDuplexIntro = false;
        try {
          const history = await coachService.getChatHistory();
          if (isActiveRef.current && coachService.isFirstEverCoachVisit(history)) {
            const intro = i18n.t('message:coach_voice_intro_line', {
              defaultValue:
                "Hi, I'm Saveur — your AI career coach. I'm listening whenever you're ready to talk.",
            });
            setLastCoachLine(intro);
            setPhase('speaking');
            if (duplexSupported) {
              firedDuplexIntro = true;
              speakDuplexFireAndForget(intro);
            } else {
              try {
                await speechService.speak(intro);
              } catch {
                // Both the remote voice and the on-device fallback failed --
                // same "genuinely nothing was spoken" case as sendTurn's own
                // speak() catch below, just for the very first greeting
                // instead of a reply. See that one's comment for the full
                // reasoning on why this is now surfaced instead of swallowed.
                introSpeakFailed = true;
                if (isActiveRef.current) {
                  setErrorMsg(
                    i18n.t('message:voice_speak_failed', {
                      defaultValue: "Couldn't play that out loud — the text reply above is still there.",
                    }),
                  );
                }
              }
            }
          }
        } catch {
          // best-effort — a failed history fetch shouldn't block listening
        }
        if (introSpeakFailed) {
          // Same reasoning as sendTurn's own pause -- startListening()
          // clears errorMsg immediately, which would otherwise wipe this
          // message before it was ever visible. Duplex path never sets
          // introSpeakFailed (speakDuplexFireAndForget doesn't throw
          // synchronously), so this pause is legacy-path-only.
          await new Promise(resolve => setTimeout(resolve, 2500));
        }
        if (duplexSupported) {
          // If the intro was just fired above, the onSpeakingState
          // listener owns the transition back to 'listening' once it
          // actually finishes -- calling startListening() here would
          // incorrectly flip the UI to "listening" while the intro is
          // still audibly playing (unlike the legacy branch just above,
          // which awaits speak() to genuinely finish first). If no intro
          // was spoken this visit, go ahead and start listening now. Uses
          // the local firedDuplexIntro flag, not phaseRef.current -- see
          // that flag's own comment for why the ref isn't safe to read
          // here yet.
          if (isActiveRef.current && !firedDuplexIntro) startListening();
          return;
        }
        if (isActiveRef.current) startListening();
      })();
      return () => {
        // DIAGNOSTIC: if this fires shortly after mount without the user
        // navigating away, that's a real remount/re-focus of this screen
        // tearing the engine down mid-conversation -- exactly the kind of
        // thing that would look like "not capturing my voice at all" with
        // no error ever shown (stop() doesn't set errorMsg). Distinct from
        // duplexVoiceService.start()/onTranscript/onSpeakingState/onError
        // logs above, which only cover the ENGINE's own lifecycle, not
        // whether something in Chat.tsx is remounting this component.
        if (__DEV__ && duplexSupported) console.warn('[VoiceCoachView] focus-effect cleanup running (unmount or re-focus)');
        isActiveRef.current = false;
        clearSilenceTimer();
        if (duplexSupported) {
          duplexStartedRef.current = false;
          duplexVoiceService.stop().catch(() => {});
        } else {
          stt.stop();
          speechService.stopSpeaking();
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Fixes "the phone locks and the AI coach is in session, stops and the
  // voice just changes to the default phone TTS voice": iOS reclaims/
  // interrupts the audio session the moment the screen locks, mid-listen or
  // mid-speech. Left alone, the app kept blindly trying to restart
  // listening against that broken session in the background (see
  // speechService.ts's canAutoRestart guard, which now stops that), and by
  // the time the phone was unlocked, the session was in a state where the
  // next speak() call's real ElevenLabs voice (speakRemote) failed and
  // silently fell back to the on-device "default" voice. The fix: proactively
  // stop everything cleanly the moment the app leaves the foreground, and do
  // a fresh, clean restart when it returns — rather than letting the OS
  // interruption corrupt an in-flight session. The duplex engine gets the
  // exact same treatment: full teardown on background (its own AVAudioEngine
  // is just as vulnerable to an OS-forced session interruption as the old
  // pipeline was), then a clean duplexVoiceService.start() on return.
  const wasBackgroundedRef = React.useRef(false);
  // BUG FIX ATTEMPT (real-device report: coach screen "still not capturing
  // my voice at all" after the duplex wiring landed, with no error ever
  // shown). iOS fires AppState 'inactive' for plenty of reasons that AREN'T
  // a real background -- Control Center, a system alert, even a brief
  // app-switcher gesture -- not just a genuine screen lock. The legacy
  // react-native-voice pipeline below tolerates reacting to every single
  // one of those instantly (Voice.stop()/start() is cheap, and this hook
  // has its own long history of races already hardened against -- see
  // speechService.ts). DuplexVoiceEngine's teardown/restart is a much
  // heavier operation -- a full AVAudioEngine + AVAudioSession teardown and
  // rebuild, not a lightweight module stop/start -- so reacting to a
  // spurious sub-second 'inactive' blip here is a real, plausible way to
  // silently wedge the engine: torn down and rebuilt in a rapid cycle with
  // no guaranteed settle time between the two, and nothing anywhere
  // surfaces an error either way (stop() never fails; a subsequent start()
  // against a not-yet-fully-released AVAudioSession can resolve "success"
  // while genuinely capturing nothing). Debouncing the duplex-path teardown
  // by 400ms means a REAL lock (which stays backgrounded far longer than
  // that) still tears down promptly, but a spurious blip that resolves
  // back to 'active' within the window never touches the engine at all.
  const duplexBackgroundTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (!isActiveRef.current) return;
      if (nextState === 'active') {
        if (duplexSupported && duplexBackgroundTimerRef.current) {
          // The debounced teardown below never actually fired -- this was
          // a spurious blip, not a real background. Nothing to restart.
          if (__DEV__) {
            console.warn('[VoiceCoachView] AppState blip absorbed — duplex engine was never torn down');
            setLastDuplexEvent(`AppState blip absorbed (no teardown) @ ${new Date().toLocaleTimeString()}`);
          }
          clearTimeout(duplexBackgroundTimerRef.current);
          duplexBackgroundTimerRef.current = null;
          wasBackgroundedRef.current = false;
          return;
        }
        if (wasBackgroundedRef.current) {
          wasBackgroundedRef.current = false;
          if (duplexSupported) {
            duplexStartedRef.current = false;
            (async () => {
              try {
                await duplexVoiceService.start();
                duplexStartedRef.current = true;
                if (isActiveRef.current) {
                  startListening();
                  if (__DEV__) setDuplexEngineReady(true);
                }
              } catch (e: any) {
                if (isActiveRef.current) {
                  setErrorMsg(
                    e?.message ??
                      i18n.t('message:voice_mic_error', { defaultValue: 'Could not start the microphone.' }),
                  );
                  setPhase('idle');
                }
              }
            })();
          } else {
            startListening();
          }
        }
        return;
      }
      // 'background' or 'inactive' — the screen just locked (or the app was
      // otherwise backgrounded) while a voice turn was in progress.
      wasBackgroundedRef.current = true;
      clearSilenceTimer();
      if (duplexSupported) {
        if (duplexBackgroundTimerRef.current) clearTimeout(duplexBackgroundTimerRef.current);
        duplexBackgroundTimerRef.current = setTimeout(() => {
          duplexBackgroundTimerRef.current = null;
          if (!isActiveRef.current || !wasBackgroundedRef.current) return;
          if (__DEV__) {
            console.warn('[VoiceCoachView] real background confirmed after 400ms — tearing down duplex engine');
            setLastDuplexEvent(`real backgrounding, tearing down @ ${new Date().toLocaleTimeString()}`);
            setDuplexEngineReady(false);
          }
          duplexStartedRef.current = false;
          duplexVoiceService.stop().catch(() => {});
        }, 400);
      } else {
        stt.stop();
        speechService.stopSpeaking();
      }
      setPhase('idle');
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startListening, duplexSupported]);

  // Same breathing-pulse approach as LiveInterviewSession's Voice-mode orb
  // — a touch more pronounced while the coach is actually speaking, like
  // that screen's isAiSpeaking case.
  const pulse = useSharedValue(0);
  React.useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * (phase === 'speaking' ? 0.09 : 0.05) }],
    opacity: 0.92 + pulse.value * 0.08,
  }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1.15 + pulse.value * 0.18 }],
    opacity: 0.35 - pulse.value * 0.2,
  }));

  // Product request: "the ripple animation that moves as the AI coach
  // talks... just like in other AI apps" — clarified (via direct follow-up)
  // to mean a general lively/active ripple effect while the coach is
  // speaking, NOT anything driven by the actual audio's pitch/amplitude —
  // react-native-nitro-sound's playback API exposes no amplitude/frequency
  // data at all (only duration/currentPosition), so real pitch-reactivity
  // isn't available without new native work; not needed given the
  // clarified ask. Two rings, each expanding outward and fading as it
  // grows, staggered so a new one kicks off while the previous is still
  // mid-fade — the standard "sonar ping" look most voice-assistant UIs use
  // for "I'm actively talking". Only driven (and only rendered — see the
  // JSX below) while phase === 'speaking'; reset to invisible otherwise so
  // there's nothing left over to flash when speaking starts again.
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  React.useEffect(() => {
    if (phase === 'speaking') {
      ripple1.value = 0;
      ripple2.value = 0;
      ripple1.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false);
      ripple2.value = withDelay(
        750,
        withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false),
      );
    } else {
      ripple1.value = 0;
      ripple2.value = 0;
    }
  }, [phase, ripple1, ripple2]);
  const rippleStyle1 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple1.value * 0.6 }],
    opacity: (1 - ripple1.value) * 0.55,
  }));
  const rippleStyle2 = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple2.value * 0.6 }],
    opacity: (1 - ripple2.value) * 0.55,
  }));

  const statusLabel =
    phase === 'listening'
      ? transcript
        ? t('message:voice_status_listening', { defaultValue: 'Listening…' })
        : t('message:voice_status_listening_prompt', { defaultValue: "I'm listening — go ahead" })
    : phase === 'thinking' ? t('message:voice_status_thinking', { defaultValue: 'Thinking…' })
    : phase === 'speaking' ? t('message:voice_status_speaking', { defaultValue: 'Speaking…' })
    : t('message:voice_status_starting', { defaultValue: 'Starting…' });

  const displayLine = phase === 'listening' && transcript ? transcript : lastCoachLine;

  return (
    <View style={styles.body}>
      <TouchableOpacity
        activeOpacity={phase === 'speaking' ? 0.8 : 1}
        onPress={onInterrupt}
        style={styles.orbWrap}>
        <Animated.View style={[styles.halo, haloStyle]}>
          {/* Product follow-up (screenshot): "change the background of this
              AI coach from blue to white" (see Chat.tsx's isVoiceMode
              comment for the full history) -- back to a blue-tinted glow in
              light mode (the ORIGINAL treatment, from before the
              screen-went-blue request that made a white glow necessary),
              since a white glow would now blend straight into the white
              page it sits on. Dark mode keeps a soft white glow -- Voice
              mode's background is a dark card surface there, so a white
              glow still reads as a halo the way it did against the old
              navy fill. */}
          <LinearGradient
            colors={isDarkMode
              ? ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.04)']
              : ['rgba(90,150,255,0.35)', 'rgba(90,150,255,0.05)']}
            style={styles.haloFill}
          />
        </Animated.View>
        {/* Ripple rings — only rendered while the coach is actually
            speaking (see rippleStyle1/2's own comment above for why); not
            conditioned on the shared values themselves since those get
            reset to 0 (not unmounted) when phase changes, which would
            otherwise leave a static ring visible at rest. */}
        {phase === 'speaking' ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.rippleRing,
                rippleStyle1,
                { borderColor: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(90,150,255,0.55)' },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.rippleRing,
                rippleStyle2,
                { borderColor: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(90,150,255,0.55)' },
              ]}
            />
          </>
        ) : null}
        {/* Redesign (explicit product request — "replace the pink circle
            design... with image 4"): was a two-layer purple/pink
            LinearGradient sphere (base gradient + a glossy highlight
            overlay, both simulating a 3D sphere out of flat color); now a
            real image of one (Images.voiceOrb — see assets/images/index.ts
            for the transparency/sizing notes), so no more hand-rolled
            highlight layer needed, the image already has that baked in. */}
        <Animated.View style={[styles.orb, orbStyle]}>
          <Image source={Images.voiceOrb} style={styles.orbImage} resizeMode="contain" />
        </Animated.View>
      </TouchableOpacity>

      {/* Product follow-up: "change the background of this AI coach from
          blue to white and its text to black" -- this view is only ever
          rendered on Chat.tsx's Voice-mode Container/TopNavigation
          background (see that file's isVoiceMode comment), which now
          matches the app's normal white-card/dark-ink pair instead of a
          solid blue fill, so text colors below follow the theme
          (text-basic-color/text-hint-color) instead of a literal
          hardcoded white/translucent-white. */}
      <Text category="h7" bold center mt={24} style={{ color: theme['text-basic-color'] }}>
        {statusLabel}
      </Text>

      <Text
        category="h9-s"
        center
        mt={10}
        maxWidth={300}
        numberOfLines={4}
        ellipsizeMode="tail"
        style={{ color: theme['text-hint-color'] }}>
        {displayLine}
      </Text>

      {errorMsg ? (
        <Text category="h10" center mt={16} maxWidth={280} style={{ color: theme['color-danger-500'] }}>
          {errorMsg}
        </Text>
      ) : null}

      {phase === 'speaking' ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onInterrupt}
          style={[styles.interruptPill, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,99,248,0.10)' }]}>
          <Text category="h10" bold style={{ color: theme['text-basic-color'] }}>
            {t('message:voice_tap_to_interrupt', { defaultValue: 'Tap to interrupt' })}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* DEV-ONLY diagnostics for the real-device report "not capturing my
          voice at all" -- see duplexEngineReady/lastDuplexEvent's own
          comment above. __DEV__-gated, never ships; screenshot this block
          instead of digging through Xcode/Metro console output. */}
      {__DEV__ && duplexSupported ? (
        <View style={styles.debugBox}>
          <Text category="h10" style={styles.debugText}>
            engine ready: {String(duplexEngineReady)} · phase: {phase}
          </Text>
          <Text category="h10" style={styles.debugText}>
            last event: {lastDuplexEvent}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

export default VoiceCoachView;

const styles = StyleSheet.create({
  // DEV-ONLY -- see the debug block's own comment above.
  debugBox: {
    marginTop: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    maxWidth: 320,
  },
  debugText: {
    color: '#888',
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
    alignItems: 'center',
    justifyContent: 'center',
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
  // Sized to HALO_SIZE (not ORB_SIZE) for the same reason `halo` above is —
  // an absolutely-positioned child this exact size as its HALO_SIZE parent
  // sits flush at (0,0) and is already centered with no manual top/left
  // math needed.
  rippleRing: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    borderWidth: 2,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
  },
  // No overflow/borderRadius clipping needed anymore — Images.voiceOrb is
  // already a circular image on a transparent background (was needed for
  // the old two-layer LinearGradient version, which was a flat rectangle
  // that had to be clipped into a circle).
  orbImage: {
    width: '100%',
    height: '100%',
  },
  // backgroundColor applied inline per isDarkMode at the JSX call site (see
  // that render's own comment) -- everything else about the pill's shape
  // stays here.
  interruptPill: {
    marginTop: 28,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 99,
  },
});
