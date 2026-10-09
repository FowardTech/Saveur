import React, { memo } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme, Icon, Layout } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Flex from 'components/Flex';
import CtaButton from 'components/CtaButton';
import useLayout from 'hooks/useLayout';
import { globalStyle } from 'styles/globalStyle';
import { CoachReadiness } from 'hooks/useCoachReadiness';

// One-time first-login prompt: "the first thing you should do". Shown once
// per account (HomeSrc.tsx's overlay queue, after the welcome card and app
// tour) while an essential coach-setup step is still missing — see
// hooks/useCoachReadiness.ts. The persistent Home card
// (CoachReadinessCard.tsx) stays afterwards. Mirrors the web app's
// components/dashboard/CoachSetupPrompt.tsx.
interface Props {
  visible: boolean;
  readiness: CoachReadiness;
  onStart(): void;
  onLater(): void;
}

const CoachSetupModal = memo(({ visible, readiness, onStart, onLater }: Props) => {
  const theme = useTheme();
  const { width } = useLayout();
  const { t } = useTranslation(['home', 'common']);
  const { next, steps, total, doneCount } = readiness;

  return (
    <Modal visible={visible && !!next} transparent animationType="fade" onRequestClose={onLater}>
      <Pressable style={styles.backdrop} onPress={onLater}>
        <Pressable onPress={e => e.stopPropagation()}>
          <Layout level="1" style={[styles.card, { width: width - 32, maxWidth: 420 }]}>
            <View style={[styles.badge, { backgroundColor: theme['color-badge-info-bg'] }]}>
              <Icon pack="eva" name="flash-outline" style={{ width: 24, height: 24, tintColor: theme['color-badge-info-text'] }} />
            </View>
            <Text category="h6" bold mt={14}>
              {t('home:coach_readiness_prompt_title', { defaultValue: 'One thing to do first' })}
            </Text>
            <Text category="h9-s" status="placeholder" mt={8}>
              {t('home:coach_readiness_prompt_body', {
                defaultValue:
                  'Your AI coach is only as good as what it knows about you. Finish these {{count}} quick steps so it can give you the most accurate, personal help.',
                count: total - doneCount,
              })}
            </Text>

            <View style={styles.list}>
              {steps.map(s => (
                <Flex key={s.key} justify="flex-start" itemsCenter style={styles.row}>
                  <Icon
                    pack="eva"
                    name={s.done ? 'checkmark-circle-2' : 'radio-button-off-outline'}
                    style={{
                      width: 18,
                      height: 18,
                      tintColor: s.done ? theme['color-success-500'] : theme['text-hint-color'],
                    }}
                  />
                  <Text
                    category="h9"
                    bold={!s.done}
                    status={s.done ? 'placeholder' : undefined}
                    ml={10}
                    style={[globalStyle.flexOne, s.done ? styles.struck : undefined]}
                  >
                    {s.label}
                  </Text>
                </Flex>
              ))}
            </View>

            <CtaButton style={[globalStyle.shadowBtn, styles.cta]} onPress={onStart}>
              {t('home:coach_readiness_prompt_cta', { defaultValue: 'Start: {{step}}', step: next?.label ?? '' })}
            </CtaButton>
            <Pressable onPress={onLater} style={styles.later}>
              <Text category="h9" bold status="placeholder">
                {t('home:coach_readiness_prompt_later', { defaultValue: "I'll do it later" })}
              </Text>
            </Pressable>
          </Layout>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

export default CoachSetupModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 31, 32, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: { borderRadius: 20, padding: 22, overflow: 'hidden' },
  badge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  list: { marginTop: 16 },
  row: { marginTop: 8 },
  struck: { textDecorationLine: 'line-through' },
  cta: { marginTop: 22 },
  later: { alignItems: 'center', paddingVertical: 14 },
});
