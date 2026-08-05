import React, { memo } from 'react';
import { AppState, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@ui-kitten/components';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import Text from 'components/Text';
import { Images } from 'assets/images';
import * as coachService from 'services/coachService';
import { CoachUserContext } from 'services/coachService';
import * as speechService from 'services/speechService';

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
// Interruption / barge-in: while the AI's reply is being spoken (TTS), the
// mic is deliberately NOT listening — the reply audio itself would
// otherwise very likely get picked back up as "user speech" (no on-device
// echo cancellation has been verified for this app's audio session
// configuration; see speechService.ts's notes on iOS audio-session
// category switching between TTS and STT). Real, low-risk interruption is
// instead a visible tap (the orb itself, or the "Interrupt" pill below it)
// — tapping either immediately stops playback and hands the mic back.
const SILENCE_DEBOUNCE_MS = 1300;

type Phase = 'listening' | 'thinking' | 'speaking' | 'idle';
type SuggestedAction = 'mock_interview' | 'daily_challenge';

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
}: {
  userContext?: CoachUserContext;
  // Fired once the user affirms the coach's spoken offer — Chat.tsx passes
  // down the same handler its "Learn more about X"-style chip uses in Text
  // mode (onRunSuggestedAction), so both modes navigate identically.
  onSuggestedAction?: (action: SuggestedAction) => void;
}) => {
  const theme = useTheme();
  const { t } = useTranslation(['message']);
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
  const pendingActionRef = React.useRef<SuggestedAction | null>(null);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

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
          setPhase('speaking');
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
      let suggestedAction: SuggestedAction | undefined;
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
        const offerKey = suggestedAction === 'mock_interview'
          ? 'message:voice_action_offer_mock_interview'
          : 'message:voice_action_offer_daily_challenge';
        const offerDefault = suggestedAction === 'mock_interview'
          ? 'Want me to start a mock interview for you now?'
          : "Want me to take you to today's Daily Challenge?";
        replyText = `${replyText} ${i18n.t(offerKey, { defaultValue: offerDefault })}`;
        pendingActionRef.current = suggestedAction;
      }
      if (!isActiveRef.current) return;
      setLastCoachLine(replyText);
      setPhase('speaking');
      await stt.stop();
      try {
        await speechService.speak(replyText);
      } catch {
        // speak() already falls back internally.
      }
      if (!isActiveRef.current) return;
      startListening();
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

  const onInterrupt = () => {
    if (phase !== 'speaking') return;
    speechService.stopSpeaking();
    startListening();
  };

  useFocusEffect(
    React.useCallback(() => {
      isActiveRef.current = true;
      (async () => {
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
        try {
          const history = await coachService.getChatHistory();
          if (isActiveRef.current && coachService.isFirstEverCoachVisit(history)) {
            const intro = i18n.t('message:coach_voice_intro_line', {
              defaultValue:
                "Hi, I'm Saveur — your AI career coach. I'm listening whenever you're ready to talk.",
            });
            setLastCoachLine(intro);
            setPhase('speaking');
            try {
              await speechService.speak(intro);
            } catch {
              // best-effort — a TTS hiccup shouldn't block the conversation
            }
          }
        } catch {
          // best-effort — a failed history fetch shouldn't block listening
        }
        if (isActiveRef.current) startListening();
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
          <LinearGradient
            colors={['rgba(90,150,255,0.35)', 'rgba(90,150,255,0.05)']}
            style={styles.haloFill}
          />
        </Animated.View>
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
        style={{ color: theme['text-placeholder-color'] }}>
        {displayLine}
      </Text>

      {errorMsg ? (
        <Text category="h10" status="danger" center mt={16} maxWidth={280}>
          {errorMsg}
        </Text>
      ) : null}

      {phase === 'speaking' ? (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onInterrupt}
          style={[styles.interruptPill, { backgroundColor: theme['background-basic-color-2'] }]}>
          <Text category="h10" bold status="basic">
            {t('message:voice_tap_to_interrupt', { defaultValue: 'Tap to interrupt' })}
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
  interruptPill: {
    marginTop: 28,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 99,
  },
});
