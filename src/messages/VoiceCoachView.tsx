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
// Turn-taking model: services/speechService.ts's useSpeechToText() already
// auto-restarts listening on every pause (built for Voice-mode interview
// answers), which this reuses as-is for "always listening" rather than
// inventing a second speech pipeline. What's new here is *silence-based
// turn detection* on top of that continuous stream: whenever the
// recognized transcript changes, a short timer restarts; if nothing new
// comes in before it fires, that's treated as the end of the user's turn,
// and the accumulated transcript is sent to the coach.
//
// Interruption / barge-in: SECOND attempt at true "speak to interrupt" —
// per explicit product direction after the first attempt was reverted
// ("No i still want the speak to interupt thats the standard"). The first
// attempt kept the mic running through TTS playback (via speak()'s
// `preserveRecordingSession` option, the same trick LiveInterviewSession's
// Video mode uses for VisionCamera) but only ever touched the iOS
// AVAudioSession's CATEGORY (.playAndRecord + options) — never its MODE.
// On a real device that shipped with total silence AND a dead mic: no
// AVAudioSessionMode means no OS-level acoustic echo cancellation, and a
// raw category-only .playAndRecord session apparently couldn't reliably do
// either half of simultaneous record+playback, not just fail to filter out
// the echo.
//
// This attempt adds the missing piece natively instead of trying to
// approximate it in JS: patches/@dev-amirzubair+react-native-voice+
// 1.0.4.patch (applied via patch-package's postinstall hook) sets
// AVAudioSessionModeVoiceChat on the shared session inside
// @dev-amirzubair/react-native-voice's own setupAudioSession (ios/Voice/
// Voice.mm), with a matching reset in resetAudioSession. .voiceChat is
// Apple's own purpose-built mode for exactly this — it engages the
// system's Voice-Processing I/O audio unit (real-time echo cancellation +
// automatic gain control), the same signal path VoIP/voice-assistant apps
// use to listen and speak at once. This is a NATIVE file change: it needs
// a full rebuild (Xcode recompile at minimum), not just a JS/Metro reload,
// before it can do anything.
//
// With that in place, the mic is now started BEFORE speaking and kept
// running straight through it (every speak() call below passes
// `preserveRecordingSession: true`, and turns no longer call stt.stop()
// before speaking or stt.start() again after — the same recognition
// session just keeps going). "Real" barge-in — the user just starts
// talking, no tap needed — is detected by the effects below watching
// stt.transcript while phase is 'speaking': once the recognizer reports
// actual words (not just any volume; BARGE_IN_MIN_CHARS) after a short
// grace period (BARGE_IN_GRACE_MS, so the coach's own first syllable can't
// immediately trip it), interruptSpeaking() cuts the coach off and hands
// the turn back instantly — the same effect as tapping the orb/pill
// (onInterrupt below), just triggered by voice instead of a tap.
//
// Still can't be verified from this environment without a real-device
// test. If this also fails, the next step is native-side device debugging
// (Xcode console / Instruments during an actual barge-in attempt), not
// another blind JS-only iteration.
const SILENCE_DEBOUNCE_MS = 1300;
// Grace period after entering 'speaking' before barge-in detection arms —
// gives the coach's own opening syllable a moment to not immediately read
// as "the user is talking over me".
const BARGE_IN_GRACE_MS = 600;
// Minimum recognized-transcript length to count as a real barge-in, not
// recognizer noise — deliberately a transcript-length check (real words the
// recognizer is confident enough about to report), not a raw mic-volume
// check, which the coach's own voice bleeding into the mic could trip on
// its own even with echo cancellation engaged.
const BARGE_IN_MIN_CHARS = 3;

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
  // True the instant a barge-in (real speech, or a tap) cuts the coach off
  // mid-utterance; reset to false right before every new 'speaking' phase
  // begins. Checked by sendTurn/the intro greeting right after their own
  // `await speechService.speak(...)` resolves, so they know NOT to treat
  // that resolution as "the coach finished naturally" — see interruptSpeaking
  // below for what already happened by the time they check this.
  const interruptedRef = React.useRef(false);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  // Surfaces speechService's new rapid-error-loop detector (see
  // useSpeechToText's onSpeechError in services/speechService.ts): that
  // fires stt.error asynchronously, mid-session, well after startListening()
  // already read stt.error once and moved on -- without this effect,
  // nothing in this screen would ever notice a session that started fine
  // but then failed every restart in a tight loop. This is the diagnostic
  // for the "mock interview's mic works, the coach's doesn't at all" report:
  // if this ever shows a real native error/code instead of the generic
  // no-speech nudge, that's the concrete signal that was missing before.
  React.useEffect(() => {
    if (stt.error && isActiveRef.current) {
      setErrorMsg(stt.error);
    }
  }, [stt.error]);

  const startListening = React.useCallback(async () => {
    setErrorMsg(null);
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
  }, []);

  // Lighter-weight sibling of startListening() for the (now normal) case
  // where the mic was never actually stopped for speaking in the first
  // place — every speak() call below runs with `preserveRecordingSession:
  // true`, so by the time a turn finishes naturally the recognition session
  // is already running. Calling stt.start() again on top of an
  // already-active session is exactly the "already started!" native race
  // this codebase has fought hard to avoid elsewhere (see speechService.ts's
  // lastVoiceStartAtRef/guardedVoiceStart doc comments) — this just clears
  // stale error/transcript state and flips the UI back to 'listening'
  // without touching the native session at all.
  const resumeListening = React.useCallback(() => {
    setErrorMsg(null);
    stt.reset();
    setPhase('listening');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendTurn = React.useCallback(
    async (finalText: string) => {
      const trimmed = finalText.trim();
      if (!trimmed) {
        setPhase('listening');
        return;
      }

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
          interruptedRef.current = false;
          setPhase('speaking');
          try {
            await speechService.speak(confirmLine, undefined, { preserveRecordingSession: true });
          } catch {
            // best-effort
          }
          if (!isActiveRef.current) return;
          if (interruptedRef.current) {
            // Barge-in cut the confirmation off mid-sentence — the mic is
            // already listening (interruptSpeaking already flipped phase
            // back to 'listening'); let normal silence-based turn detection
            // pick up whatever the user is actually saying instead of
            // forcing the navigation through anyway.
            return;
          }
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
      interruptedRef.current = false;
      setPhase('speaking');
      let spokeFailed = false;
      try {
        await speechService.speak(replyText, undefined, { preserveRecordingSession: true });
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
      if (interruptedRef.current) {
        // Barge-in cut the coach off mid-reply — interruptSpeaking already
        // stopped playback and flipped phase back to 'listening' on its own
        // (mic never stopped, so there's no restart to do here); the
        // silence-debounce effect above will pick up whatever the user was
        // already saying once they pause. Skip resumeListening()/the
        // spokeFailed pause entirely — both are for the "finished normally"
        // path, and clearing the transcript here would throw away the
        // barge-in words that triggered this in the first place.
        return;
      }
      if (spokeFailed) {
        // resumeListening() clears errorMsg as its very first line (correct
        // for a stale mic-start error) -- without this pause it would wipe
        // the message this catch block JUST set before it had any chance
        // to actually be seen, since the resume below fires immediately.
        // The mic isn't blocked from re-arming by this, it's just given a
        // moment to be readable first.
        await new Promise(resolve => setTimeout(resolve, 2500));
        if (!isActiveRef.current) return;
      }
      resumeListening();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userContext, onSuggestedAction],
  );

  React.useEffect(() => {
    if (phase !== 'listening') return;
    clearSilenceTimer();
    if (!stt.transcript.trim()) return;
    silenceTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== 'listening') return;
      const finalText = stt.transcript;
      stt.reset();
      sendTurn(finalText);
    }, SILENCE_DEBOUNCE_MS);
    return clearSilenceTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.transcript, phase]);

  // Diagnostic nudge (product report: "it shows I'm listening, I say
  // something, and nothing happens" -- with no error shown, meaning
  // stt.start() itself succeeded and the mic never reported a failure). The
  // debounce effect above only ever fires sendTurn() once stt.transcript
  // (state, not the live ref) has actually changed -- if the native speech
  // recognizer genuinely never delivers a result back to onSpeechResults
  // for this session (a real possibility if something upstream leaves the
  // audio session unable to actually capture input despite Voice.start()
  // reporting success -- see speechService.ts's useSpeechToText doc
  // comments for the equivalent, already-documented issue on the OUTPUT
  // side), stt.transcript just never changes and NOTHING in this screen
  // ever tells the user that. This doesn't fix that underlying capture
  // issue (a JS-only fix can't -- there's no signal to react to if the
  // native side never calls back at all), but it stops the screen from
  // silently sitting there forever with zero feedback: after a long stretch
  // of "listening" with nothing ever recognized, nudge the user rather than
  // leaving them wondering whether the app heard them at all.
  React.useEffect(() => {
    if (phase !== 'listening') return;
    const timer = setTimeout(() => {
      if (phaseRef.current === 'listening' && !stt.transcript.trim()) {
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

  // Single source of truth for "the coach got cut off mid-utterance" —
  // used by both the manual tap (onInterrupt below) and the real-voice
  // barge-in detection effects further down. Deliberately NOT async/awaited:
  // the mic is never stopped for 'speaking' anymore (every speak() call runs
  // with preserveRecordingSession: true), so there's no restart to sequence
  // after the stop — the only thing that has to happen is killing the
  // audio and flipping the UI back, both of which should feel instant,
  // especially for a real barge-in where the user is already mid-sentence.
  const interruptSpeaking = React.useCallback(() => {
    interruptedRef.current = true;
    speechService.stopSpeaking();
    setErrorMsg(null);
    setPhase('listening');
  }, []);

  const onInterrupt = React.useCallback(() => {
    if (phaseRef.current !== 'speaking') return;
    interruptSpeaking();
  }, [interruptSpeaking]);

  // Arms real (no-tap) barge-in detection a short grace period after the
  // coach starts speaking — see BARGE_IN_GRACE_MS's own doc comment above
  // for why the delay matters.
  const bargeInArmedRef = React.useRef(false);
  React.useEffect(() => {
    bargeInArmedRef.current = false;
    if (phase !== 'speaking') return;
    const timer = setTimeout(() => {
      bargeInArmedRef.current = true;
    }, BARGE_IN_GRACE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // The actual barge-in: once armed, any real recognized speech while the
  // coach is still talking means the user started talking over it. This
  // only has anything to react to because the mic is now kept running
  // through TTS playback (see this file's header comment for the native
  // AVAudioSessionModeVoiceChat patch that's supposed to make that safe) —
  // previously the mic was fully stopped for the entire 'speaking' phase,
  // so there was nothing here to detect.
  React.useEffect(() => {
    if (phase !== 'speaking') return;
    if (!bargeInArmedRef.current) return;
    if (stt.transcript.trim().length < BARGE_IN_MIN_CHARS) return;
    interruptSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.transcript, phase]);

  useFocusEffect(
    React.useCallback(() => {
      isActiveRef.current = true;
      (async () => {
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
        let introSpoken = false;
        let introSpeakFailed = false;
        // Only meaningful when introSpoken is true — whether stt.start()
        // below actually succeeded, so the final branch knows whether the
        // mic is genuinely live (resumeListening() is safe) or never
        // actually started (needs a real startListening() instead, same as
        // the no-intro path — see that branch's own comment).
        let micStartedForIntro = false;
        try {
          const history = await coachService.getChatHistory();
          if (isActiveRef.current && coachService.isFirstEverCoachVisit(history)) {
            const intro = i18n.t('message:coach_voice_intro_line', {
              defaultValue:
                "Hi, I'm Saveur — your AI career coach. I'm listening whenever you're ready to talk.",
            });
            setLastCoachLine(intro);
            interruptedRef.current = false;
            setPhase('speaking');
            introSpoken = true;
            // Unlike every later turn (which enters 'speaking' already
            // listening, courtesy of the previous turn's still-running
            // session), nothing has started the mic yet on a fresh mount —
            // it has to be started here, BEFORE speaking, for barge-in to
            // have anything to detect during this very first utterance.
            if (isActiveRef.current) micStartedForIntro = await stt.start();
            try {
              await speechService.speak(intro, undefined, { preserveRecordingSession: true });
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
        } catch {
          // best-effort — a failed history fetch shouldn't block listening
        }
        if (introSpeakFailed) {
          // Same reasoning as sendTurn's own pause -- resumeListening()/
          // startListening() clear errorMsg immediately, which would
          // otherwise wipe this message before it was ever visible.
          await new Promise(resolve => setTimeout(resolve, 2500));
        }
        if (!isActiveRef.current) return;
        if (introSpoken) {
          if (interruptedRef.current) {
            // interruptSpeaking() already flipped phase to 'listening'
            // itself (and can only have fired from an actually-running mic
            // session or a tap) -- nothing left to do.
          } else if (micStartedForIntro) {
            // Mic is already running (started above) -- resumeListening(),
            // NOT startListening(), which would try to start a SECOND
            // concurrent recognition session on top of the one already
            // active for barge-in and fail with "already started".
            resumeListening();
          } else {
            // stt.start() failed for the intro (permission issue, or some
            // other startup failure) -- the coach still spoke (through the
            // speaker, just without barge-in this one turn), but the mic
            // was never actually live, so resumeListening() would falsely
            // show "listening" over a dead mic. Fall back to a real
            // startListening() so the user's first real turn gets an actual
            // attempt (and surfaces the error if it fails again), same as
            // the no-intro path below.
            startListening();
          }
        } else {
          // Returning user, no first-time greeting spoken -- mic was never
          // started at all yet, so this is the one case that still needs a
          // real startListening().
          startListening();
        }
      })();
      return () => {
        isActiveRef.current = false;
        clearSilenceTimer();
        stt.stop();
        speechService.stopSpeaking();
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
  // a fresh, clean restart of listening when it returns — rather than
  // letting the OS interruption corrupt an in-flight session.
  const wasBackgroundedRef = React.useRef(false);
  React.useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (!isActiveRef.current) return;
      if (nextState === 'active') {
        if (wasBackgroundedRef.current) {
          wasBackgroundedRef.current = false;
          startListening();
        }
        return;
      }
      // 'background' or 'inactive' — the screen just locked (or the app was
      // otherwise backgrounded) while a voice turn was in progress.
      wasBackgroundedRef.current = true;
      clearSilenceTimer();
      stt.stop();
      speechService.stopSpeaking();
      setPhase('idle');
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startListening]);

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
      ? stt.transcript
        ? t('message:voice_status_listening', { defaultValue: 'Listening…' })
        : t('message:voice_status_listening_prompt', { defaultValue: "I'm listening — go ahead" })
    : phase === 'thinking' ? t('message:voice_status_thinking', { defaultValue: 'Thinking…' })
    : phase === 'speaking' ? t('message:voice_status_speaking', { defaultValue: 'Speaking…' })
    : t('message:voice_status_starting', { defaultValue: 'Starting…' });

  const displayLine = phase === 'listening' && stt.transcript ? stt.transcript : lastCoachLine;

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
            {t('message:voice_tap_to_interrupt', { defaultValue: 'Tap, or just speak, to interrupt' })}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

export default VoiceCoachView;

const styles = StyleSheet.create({
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
