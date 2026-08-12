import React, { memo } from 'react';
import { KeyboardAvoidingView, Modal, Platform, TouchableOpacity, View } from 'react-native';
import { Icon, Input, useTheme } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from './Text';
import CtaButton from 'components/CtaButton';
import { globalStyle } from 'styles/globalStyle';
import * as speechService from 'services/speechService';

export type DailyCheckInMode = 'goal' | 'reflection';

interface Props {
  visible: boolean;
  mode: DailyCheckInMode;
  onSubmit: (text: string) => Promise<void>;
  onDismiss: () => void;
}

// Daily career-goal check-in (product request item): on login, "what's your
// career goal for today?" (mode="goal"); later, from the "How did your day
// go?" push, "how did it go?" (mode="reflection") — same sheet, same
// type-or-speak input, different copy and same CtaButton/dismiss pattern as
// AppRatingModal.tsx (centered dialog, not a true bottom sheet — matches
// this app's other single-focus prompt modals).
//
// Voice input reuses speechService.useSpeechToText() (the same hook backing
// Voice-mode mock interviews and the AI coach's Voice mode) rather than a
// new speech pipeline — tapping the mic starts/stops one-shot dictation
// into the text field, which stays fully editable before submitting, so a
// misheard word can just be typed over rather than forcing a re-record.
const DailyCheckInSheet = memo(({ visible, mode, onSubmit, onDismiss }: Props) => {
  const theme = useTheme();
  const { t } = useTranslation(['home', 'common']);
  const stt = speechService.useSpeechToText();
  const [text, setText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const textBeforeListeningRef = React.useRef('');

  React.useEffect(() => {
    if (visible) {
      setText('');
      stt.reset();
    } else {
      // Sheet closed (submitted or dismissed) while still listening —
      // don't leave the mic hot in the background.
      stt.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Live-updates the field with whatever's been recognized so far while
  // listening, prefixed with whatever was already typed/dictated before
  // this listening session started (so tapping the mic a second time
  // appends rather than overwrites).
  React.useEffect(() => {
    if (!stt.isListening) return;
    const combined = textBeforeListeningRef.current
      ? `${textBeforeListeningRef.current} ${stt.transcript}`.trim()
      : stt.transcript;
    setText(combined);
  }, [stt.transcript, stt.isListening]);

  // BUG FIX (product report: "speak to the mic and click submit, nothing
  // happens"): speechService.useSpeechToText()'s stop() sets isListening
  // to false BEFORE it commits the final recognized transcript (it has to
  // await Voice.stop() first) — so by the time the final transcript
  // actually lands in stt.transcript, the live-sync effect above has
  // already bailed out on its `if (!stt.isListening) return` guard, and
  // the last thing the user said right before stopping never reaches
  // `text` at all. stop() already returns the fully-committed transcript
  // directly (transcriptRef.current, not the possibly-stale state) for
  // exactly this reason — using that return value instead of relying on
  // the reactive effect is what actually fixes it.
  const finalizeListening = async (): Promise<string> => {
    const finalTranscript = await stt.stop();
    const combined = textBeforeListeningRef.current
      ? `${textBeforeListeningRef.current} ${finalTranscript}`.trim()
      : finalTranscript.trim();
    setText(combined);
    return combined;
  };

  const onToggleMic = async () => {
    if (stt.isListening) {
      await finalizeListening();
      return;
    }
    textBeforeListeningRef.current = text;
    stt.reset();
    await stt.start();
  };

  const onPressSubmit = async () => {
    // Also fixes: tapping Submit immediately after speaking (no natural
    // pause long enough for a mid-session commit) used to read `text`
    // BEFORE stopping the mic at all — while still listening, `text` can
    // genuinely still be '' (see useSpeechToText's own comment: the
    // transcript state only updates at session-end/pause boundaries, not
    // per word), so this silently no-op'd on `if (!trimmed) return`
    // whenever a check-in was answered as one continuous sentence. Stop
    // and finalize FIRST, then decide whether there's anything to submit.
    const finalText = stt.isListening ? await finalizeListening() : text;
    const trimmed = finalText.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isGoal = mode === 'goal';
  const title = isGoal
    ? t('home:daily_checkin_goal_title', { defaultValue: "What's your career goal for today?" })
    : t('home:daily_checkin_reflection_title', { defaultValue: 'How did your day go?' });
  const subtitle = isGoal
    ? t('home:daily_checkin_goal_subtitle', {
        defaultValue: 'One concrete thing you want to get done today — the coach will keep it in mind.',
      })
    : t('home:daily_checkin_reflection_subtitle', {
        defaultValue: "Tell us how today's goal actually went — it helps personalize tomorrow.",
      });
  const placeholder = isGoal
    ? t('home:daily_checkin_goal_placeholder', { defaultValue: 'e.g. Apply to 3 roles, or practice for my interview...' })
    : t('home:daily_checkin_reflection_placeholder', { defaultValue: 'e.g. Got through 2 applications, ran out of time for the third...' });

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      {/* BUG FIX (product report: "the touch pad [keyboard] is blocking the
          submit button"): this card is vertically centered with no keyboard
          awareness at all — the moment the multiline Input actually gets
          focus (tapping into it directly, or just from the cursor landing
          there after voice-to-text fills it in) the on-screen keyboard
          covers the bottom of the screen including the Submit button below
          it, with nothing to push the card up out from under it.
          KeyboardAvoidingView's 'padding' (iOS) / 'height' (Android)
          behavior shrinks this view's available height by the keyboard's
          height, and since the backdrop still centers its content within
          whatever height it has, the whole card re-centers higher up,
          clearing the keyboard instead of sitting underneath it. */}
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.card, { backgroundColor: theme['background-basic-color-1'] }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onDismiss}
            disabled={isSubmitting}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon
              pack="eva"
              name="close-outline"
              style={[globalStyle.icon24, { tintColor: theme['text-hint-color'] }]}
            />
          </TouchableOpacity>

          <Text category="h6" bold center mb={8}>
            {title}
          </Text>
          <Text category="h9-s" status="placeholder" center mb={20}>
            {subtitle}
          </Text>

          <View style={styles.inputRow}>
            <Input
              multiline
              placeholder={placeholder}
              value={text}
              onChangeText={setText}
              style={styles.textInput}
              textStyle={styles.textInputInner}
            />
            <TouchableOpacity
              onPress={onToggleMic}
              style={[
                styles.micButton,
                {
                  backgroundColor: stt.isListening
                    ? theme['color-danger-500']
                    : theme['background-basic-color-2'],
                },
              ]}>
              <Icon
                pack="eva"
                name={stt.isListening ? 'mic-off-outline' : 'mic-outline'}
                style={[
                  globalStyle.icon20,
                  { tintColor: stt.isListening ? theme['text-control-color'] : theme['text-basic-color'] },
                ]}
              />
            </TouchableOpacity>
          </View>
          {stt.isListening ? (
            <Text category="h10" status="danger" center mt={8}>
              {t('home:daily_checkin_listening', { defaultValue: 'Listening… tap the mic again to stop.' })}
            </Text>
          ) : null}
          {stt.error ? (
            <Text category="h10" status="danger" center mt={8}>
              {stt.error}
            </Text>
          ) : null}

          <CtaButton
            style={{ marginTop: 20 }}
            // Was `!text.trim()` unconditionally — while actively
            // listening, `text` can genuinely still be empty (see
            // useSpeechToText's own comment: transcript state only
            // updates at session-end/pause boundaries, not per word), so
            // this disabled the button entirely for anyone who spoke one
            // continuous sentence and tapped Submit without a mid-answer
            // pause first — the tap never even reached onPressSubmit. The
            // real emptiness check now happens inside onPressSubmit AFTER
            // finalizing the mic, using the actual final transcript.
            disabled={(!stt.isListening && !text.trim()) || isSubmitting}
            loading={isSubmitting}
            onPress={onPressSubmit}>
            {t('common:submit', { defaultValue: 'Submit' })}
          </CtaButton>
          <TouchableOpacity onPress={onDismiss} disabled={isSubmitting} style={{ marginTop: 12 }}>
            <Text category="h9-s" status="placeholder" center>
              {t('home:daily_checkin_later', { defaultValue: 'Maybe later' })}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

export default DailyCheckInSheet;

const styles = {
  backdrop: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%' as const,
    // Google-style furnishing pass (see styles/globalStyle.ts's `card`) --
    // 14 -> 20.
    borderRadius: 20,
    padding: 24,
  },
  closeButton: {
    alignSelf: 'flex-end' as const,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
  },
  textInput: {
    flex: 1,
    borderRadius: 12,
    minHeight: 90,
    marginRight: 10,
  },
  textInputInner: {
    minHeight: 70,
    textAlignVertical: 'top' as const,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};
