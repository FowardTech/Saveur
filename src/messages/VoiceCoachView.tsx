import React, { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
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
// Visuals deliberately reuse the exact same pulsing gradient orb used by
// the mock-interview Voice mode (src/practice/LiveInterviewSession.tsx) —
// same ORB_SIZE/HALO_SIZE, same gradient colors, same reanimated pulse
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

const ORB_SIZE = 176;
const HALO_SIZE = ORB_SIZE * 1.5;

const VoiceCoachView = memo(({ userContext }: { userContext?: CoachUserContext }) => {
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
      setPhase('thinking');
      let replyText = '';
      try {
        const result = await coachService.sendVoiceMessage(trimmed, userContext);
        replyText = result.coachMessage.text;
      } catch (e: any) {
        replyText = i18n.t('message:voice_retry_line', {
          defaultValue: "Sorry, I didn't catch that — could you say it again?",
        });
        setErrorMsg(e?.message ?? null);
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
    [userContext],
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
      startListening();
      return () => {
        isActiveRef.current = false;
        clearSilenceTimer();
        stt.stop();
        speechService.stopSpeaking();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

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
    borderRadius: ORB_SIZE / 2,
    overflow: 'hidden',
  },
  orbFill: {
    ...StyleSheet.absoluteFillObject,
  },
  orbHighlight: {
    ...StyleSheet.absoluteFillObject,
  },
  interruptPill: {
    marginTop: 28,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 99,
  },
});
