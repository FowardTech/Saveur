import React, { memo } from 'react';
import { KeyboardAvoidingView, Modal, Platform, TouchableOpacity, View } from 'react-native';
import { Icon, Input, useTheme } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from './Text';
import CtaButton from 'components/CtaButton';
import { globalStyle } from 'styles/globalStyle';
import * as speechService from 'services/speechService';

interface Props {
  visible: boolean;
  title: string;
  subtitle: string;
  placeholder: string;
  onSubmit: (text: string) => Promise<void>;
  onDismiss: () => void;
}

// Shared "regular check-in" pop-up (product request items: "always check up
// on the user regularly to know how they are doing at the new role until
// the first 90 days are over" for What's Next, and "check up on [students]
// too regularly until their graduation date" for verified students) —
// deliberately a generic, copy-parameterized sibling of
// components/DailyCheckInSheet.tsx rather than a third bespoke modal:
// same centered-dialog-not-a-true-bottom-sheet shape, same
// KeyboardAvoidingView fix for the keyboard-covers-the-submit-button bug,
// same type-or-speak input via speechService.useSpeechToText(). Kept as its
// own component (not a third `mode` added to DailyCheckInSheet) since these
// two check-ins aren't part of that daily goal/reflection flow at all —
// different backend models, different triggers, different cadence — reusing
// the visual shell here is about not rebuilding the same modal chrome a
// third time, not about these being the same feature.
const PeriodicCheckInSheet = memo(({ visible, title, subtitle, placeholder, onSubmit, onDismiss }: Props) => {
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
      stt.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  React.useEffect(() => {
    if (!stt.isListening) return;
    const combined = textBeforeListeningRef.current
      ? `${textBeforeListeningRef.current} ${stt.transcript}`.trim()
      : stt.transcript;
    setText(combined);
  }, [stt.transcript, stt.isListening]);

  // See components/DailyCheckInSheet.tsx's finalizeListening for the exact
  // bug this pattern fixes ("speak to the mic and click submit, nothing
  // happens") — stop() returns the fully-committed transcript directly,
  // which is what actually has the last word said before stopping in it.
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

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
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

export default PeriodicCheckInSheet;

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
    borderRadius: 8,
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
