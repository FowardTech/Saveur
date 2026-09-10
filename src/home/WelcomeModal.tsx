import React, { memo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme, Icon, Layout } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Flex from 'components/Flex';
import CtaButton from 'components/CtaButton';
import GradientCard from 'components/GradientCard';
import useLayout from 'hooks/useLayout';
import { globalStyle } from 'styles/globalStyle';

interface WelcomeModalProps {
  visible: boolean;
  onDismiss(): void;
}

interface Section {
  icon: string;
  labelKey: string;
  labelDefault: string;
  bullets: { key: string; defaultValue: string }[];
}

const SECTIONS: Section[] = [
  {
    icon: 'checkmark-circle-2-outline',
    labelKey: 'welcome_modal_section_1_title',
    labelDefault: 'What you get',
    bullets: [
      {
        key: 'welcome_modal_section_1_bullet_1',
        defaultValue: 'Realistic AI mock interviews with instant feedback',
      },
      {
        key: 'welcome_modal_section_1_bullet_2',
        defaultValue: 'A personalized career roadmap built around your goals',
      },
      {
        key: 'welcome_modal_section_1_bullet_3',
        defaultValue: 'Resume, cover letter, and LinkedIn tools in one place',
      },
    ],
  },
  {
    icon: 'briefcase-outline',
    labelKey: 'welcome_modal_section_2_title',
    labelDefault: 'Built for your search',
    bullets: [
      {
        key: 'welcome_modal_section_2_bullet_1',
        defaultValue: 'Daily job alerts matched to your desired roles',
      },
      {
        key: 'welcome_modal_section_2_bullet_2',
        defaultValue: 'Coding practice and real-world scenario drills',
      },
      {
        key: 'welcome_modal_section_2_bullet_3',
        defaultValue: 'Guided learning courses to close skill gaps',
      },
    ],
  },
];

// First-login "Welcome to Saveur" modal (product reference screenshot) —
// shown exactly once per account, automatically, the first time a user
// lands on Home after signing in/up. Follows the same one-time-overlay
// convention as components/AppTour.tsx (see HomeSrc.tsx's `OVERLAY_PRIORITY`
// queue and EKeyAsyncStorage.welcomeModalSeen, scoped to the account's uid
// via accountScopedKey the same way appTourSeen/jobAlertsOnboardingSeen/
// learningCoursesOnboardingSeen already are — see constants/Types.tsx's own
// comment on why per-account scoping, not a flat device-wide flag, is
// required here). Deliberately a separate component from AppTour: this is a
// single static "what is Saveur" pitch card matching the reference design
// exactly (hero illustration, two feature-bullet sections, one CTA),
// AppTour is a distinct multi-step "how do I use this app" carousel that
// still runs right after this is dismissed.
const WelcomeModal = memo(({ visible, onDismiss }: WelcomeModalProps) => {
  const theme = useTheme();
  const { width, height } = useLayout();
  const { t } = useTranslation(['home', 'common']);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable onPress={e => e.stopPropagation()}>
          <Layout
            level="1"
            style={[
              styles.card,
              {
                width: width - 32,
                maxWidth: 440,
                maxHeight: height * 0.86,
              },
            ]}
          >
            <Flex justify="space-between" itemsCenter style={styles.header}>
              <Flex itemsCenter style={globalStyle.flexOne} justify="flex-start">
                <View style={[styles.badge, { backgroundColor: theme['color-tile-mint-bg'] }]}>
                  <Icon
                    pack="eva"
                    name="compass-outline"
                    style={{ width: 18, height: 18, tintColor: theme['color-tile-mint-text'] }}
                  />
                </View>
                <Text category="h7" bold ml={10} style={globalStyle.flexOne} numberOfLines={1}>
                  {t('home:welcome_modal_title', { defaultValue: 'Welcome to Saveur' })}
                </Text>
              </Flex>
              <Pressable onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.closeBtn}>
                <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, { tintColor: theme['text-basic-color'] }]} />
              </Pressable>
            </Flex>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <GradientCard
                colors={[theme['color-accent-purple-bg'], theme['background-basic-color-1']]}
                borderRadius={16}
                style={styles.heroOuter}
                contentStyle={styles.heroInner}
              >
                <View style={[styles.illustrationCard, { backgroundColor: theme['background-basic-color-1'] }]}>
                  <View style={[styles.bar, { backgroundColor: theme['color-primary-100'], width: '80%' }]} />
                  <View style={[styles.bar, { backgroundColor: theme['color-primary-200'], width: '60%' }]} />
                  <View style={[styles.bar, { backgroundColor: theme['color-primary-300'], width: '42%' }]} />
                </View>
                <View style={[styles.illustrationCircle, { backgroundColor: theme['color-accent-purple'] }]} />
              </GradientCard>

              <Text category="h6" bold mt={20}>
                {t('home:welcome_modal_headline', {
                  defaultValue: 'Your AI-powered co-pilot for landing the next role',
                })}
              </Text>
              <Text category="h9-s" status="placeholder" mt={10}>
                {t('home:welcome_modal_body', {
                  defaultValue:
                    'Saveur pairs an AI coach with practical tools — interviews, resumes, roadmaps, and job matching — so every step of your search is backed by data, not guesswork.',
                })}
              </Text>

              {SECTIONS.map(section => (
                <View key={section.labelKey} style={styles.section}>
                  <Flex justify="flex-start" itemsCenter>
                    <View style={[styles.sectionIconWrap, { backgroundColor: theme['color-badge-info-bg'] }]}>
                      <Icon
                        pack="eva"
                        name={section.icon}
                        style={{ width: 14, height: 14, tintColor: theme['color-badge-info-text'] }}
                      />
                    </View>
                    <Text category="h9" bold ml={8}>
                      {t(section.labelKey, { defaultValue: section.labelDefault })}
                    </Text>
                  </Flex>
                  {section.bullets.map(bullet => (
                    <Flex key={bullet.key} justify="flex-start" style={styles.bulletRow}>
                      <Icon
                        pack="eva"
                        name="checkmark-circle-2"
                        style={{ width: 16, height: 16, marginTop: 2, tintColor: theme['color-success-500'] }}
                      />
                      <Text category="h9-s" ml={10} style={globalStyle.flexOne}>
                        {t(bullet.key, { defaultValue: bullet.defaultValue })}
                      </Text>
                    </Flex>
                  ))}
                </View>
              ))}
            </ScrollView>

            <View style={styles.footer}>
              <CtaButton style={globalStyle.shadowBtn} onPress={onDismiss}>
                {t('home:welcome_modal_cta', { defaultValue: "Let's get started" })}
              </CtaButton>
            </View>
          </Layout>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

export default WelcomeModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 31, 32, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  header: {
    marginBottom: 12,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    padding: 4,
    marginLeft: 8,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  heroOuter: {
    marginTop: 4,
  },
  heroInner: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationCard: {
    width: '62%',
    padding: 14,
    // Same reasoning as components/GradientCard.tsx's own `outer`/`inner`
    // shadow split -- an opaque fill is needed for the shadow to render
    // correctly (esp. Android elevation), and this sits on top of a
    // gradient rather than the plain page background every other `card`
    // usage assumes. Spread first so its own borderRadius (20, meant for
    // full-size cards) is overridden by the smaller, illustration-scaled
    // radius below rather than the other way round.
    ...globalStyle.card,
    borderRadius: 12,
  },
  bar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  illustrationCircle: {
    position: 'absolute',
    top: 14,
    right: 20,
    width: 26,
    height: 26,
    borderRadius: 13,
    opacity: 0.85,
  },
  section: {
    marginTop: 22,
  },
  sectionIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletRow: {
    marginTop: 10,
    paddingLeft: 30,
  },
  footer: {
    marginTop: 16,
  },
});
