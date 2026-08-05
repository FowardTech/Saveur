import React, { memo } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTheme, Icon, Layout } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from './Text';
import Flex from './Flex';
import useLayout from 'hooks/useLayout';

interface TourStep {
  icon: string;
  titleKey: string;
  titleDefault: string;
  bodyKey: string;
  bodyDefault: string;
  // Product request: "app tour should always show with the illustrated
  // design" — was one flat neutral-gray icon circle for every step (see
  // the superseded iconWrap style below), which read as a bare placeholder
  // rather than a designed tour. Each step now gets its own accent color
  // (drawn from tokens that already exist elsewhere in this app's theme —
  // primary blue, the tile orange/mint/rose accents, danger/warning — so
  // this doesn't invent a new one-off palette) applied as a soft tinted
  // background behind a larger icon, which is what actually makes a plain
  // icon read as "illustrated" rather than a bare glyph.
  accent: string;
  accentBg: string;
}

// A short, one-time "how this app works" walkthrough — new users land on a
// pretty crowded Home screen (job matches, streak, leaderboard, goal tip)
// with no explanation of any of it, and the app's other core features
// (Practice interviews, the AI Coach, Learning Courses, Applications
// tracker) aren't discoverable at all from Home. Shown once automatically
// (see HomeSrc.tsx, gated on EKeyAsyncStorage.appTourSeen) and replayable
// any time from More -> Show app tour (MoreSrc.tsx).
//
// Deliberately a simple full-screen step carousel rather than a
// spotlight-the-actual-button overlay: this app's screens live across
// several independent stack navigators (Home/Practice/Coach/Interviews/
// Profile tabs), so a single walkthrough can't point at live elements
// spread across all of them without navigating the user around mid-tour,
// which is a much bigger, riskier undertaking than the actual ask here —
// this gets a new user oriented on what exists and where, which is the
// core value of a tour, without that complexity.
const STEPS: TourStep[] = [
  {
    icon: 'home-outline',
    titleKey: 'tour_welcome_title',
    titleDefault: 'Welcome to Saveur',
    bodyKey: 'tour_welcome_body',
    bodyDefault: "Your career coach, job search, and interview prep — all in one app. Here's a quick look at what you can do.",
    accent: 'color-primary-500',
    accentBg: 'color-primary-transparent-200',
  },
  {
    icon: 'briefcase-outline',
    titleKey: 'tour_jobs_title',
    titleDefault: 'Daily job matches',
    bodyKey: 'tour_jobs_body',
    bodyDefault: 'Home shows job alerts matched to your desired roles and countries every day, plus a goal tip to keep you moving forward.',
    accent: 'color-tile-orange-text',
    accentBg: 'color-tile-orange-bg',
  },
  {
    icon: 'mic-outline',
    titleKey: 'tour_practice_title',
    titleDefault: 'Practice interviews',
    bodyKey: 'tour_practice_body',
    bodyDefault: 'Run realistic mock interviews (text or voice) in the Practice tab and get real AI feedback on your answers afterward.',
    accent: 'color-tile-rose-text',
    accentBg: 'color-tile-rose-bg',
  },
  {
    icon: 'message-circle-outline',
    titleKey: 'tour_coach_title',
    titleDefault: 'Talk to your AI Coach',
    bodyKey: 'tour_coach_body',
    bodyDefault: "The Coach tab is a real conversation — by text or live voice — that knows your goals, progress, and history so its advice actually fits you.",
    accent: 'color-badge-info-text',
    accentBg: 'color-badge-info-bg',
  },
  {
    icon: 'book-open-outline',
    titleKey: 'tour_courses_title',
    titleDefault: 'Learn a new skill',
    bodyKey: 'tour_courses_body',
    bodyDefault: 'Learning Courses (under More) builds a real Basic → Intermediate → Advanced course on any career path you pick, with a badge when you finish.',
    accent: 'color-tile-mint-text',
    accentBg: 'color-tile-mint-bg',
  },
  {
    icon: 'award-outline',
    titleKey: 'tour_gamification_title',
    titleDefault: 'Streaks & leaderboard',
    bodyKey: 'tour_gamification_body',
    bodyDefault: "Practicing daily earns XP and builds a streak. You'll show up on the leaderboard under a fun generated username — never your real name.",
    accent: 'color-success-500',
    accentBg: 'color-success-transparent-200',
  },
  {
    icon: 'checkmark-square-2-outline',
    titleKey: 'tour_applications_title',
    titleDefault: 'Track your applications',
    bodyKey: 'tour_applications_body',
    bodyDefault: "Keep every job you've applied to in one place, with status updates, so nothing falls through the cracks.",
    accent: 'color-primary-500',
    accentBg: 'color-primary-transparent-200',
  },
];

interface AppTourProps {
  visible: boolean;
  onClose(): void;
}

const AppTour = memo(({ visible, onClose }: AppTourProps) => {
  const theme = useTheme();
  const { width, height } = useLayout();
  const { t } = useTranslation('more');
  const [stepIndex, setStepIndex] = React.useState(0);

  // Reset to the first step every time the tour is (re)opened — matters for
  // the "Show app tour" replay entry, which reuses this same component
  // instance rather than remounting it.
  React.useEffect(() => {
    if (visible) setStepIndex(0);
  }, [visible]);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const onNext = () => {
    if (isLast) {
      onClose();
    } else {
      setStepIndex(i => i + 1);
    }
  };

  const onBack = () => setStepIndex(i => Math.max(0, i - 1));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={e => e.stopPropagation()}>
          <Layout
            level="1"
            style={{
              width: width - 48,
              maxWidth: 420,
              borderRadius: 16,
              padding: 28,
            }}
          >
            <Flex justify="flex-end">
              <Text
                category="h10"
                status="placeholder"
                onPress={onClose}
                style={{ padding: 4 }}
              >
                {t('tour_skip', { defaultValue: 'Skip' })}
              </Text>
            </Flex>

            {/* Outer soft ring + inner solid-tinted circle -- two layered
                circles read as a small illustration rather than a bare
                icon-in-a-box, without needing an actual image asset. */}
            <View style={[styles.iconWrapOuter, { backgroundColor: theme[step.accentBg] }]}>
              <View style={[styles.iconWrap, { backgroundColor: theme[step.accentBg] }]}>
                <Icon
                  pack="eva"
                  name={step.icon}
                  style={{ width: 36, height: 36, tintColor: theme[step.accent] }}
                />
              </View>
            </View>

            <Text category="h6" bold center mt={20}>
              {t(step.titleKey, { defaultValue: step.titleDefault })}
            </Text>
            <Text category="h9-s" status="placeholder" center mt={10}>
              {t(step.bodyKey, { defaultValue: step.bodyDefault })}
            </Text>

            <Flex justify="center" itemsCenter mt={20} mb={4}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i === stepIndex
                        ? theme['color-primary-500']
                        : theme['background-basic-color-3'],
                    },
                  ]}
                />
              ))}
            </Flex>

            <Flex justify="space-between" itemsCenter mt={16}>
              <Text
                category="h9"
                status={stepIndex === 0 ? 'placeholder' : 'basic'}
                onPress={stepIndex === 0 ? undefined : onBack}
                style={{ padding: 8, opacity: stepIndex === 0 ? 0.4 : 1 }}
              >
                {t('tour_back', { defaultValue: 'Back' })}
              </Text>
              <Text
                category="h9"
                bold
                status="link"
                onPress={onNext}
                style={{ padding: 8 }}
              >
                {isLast
                  ? t('tour_get_started', { defaultValue: 'Get started' })
                  : t('tour_next', { defaultValue: 'Next' })}
              </Text>
            </Flex>
          </Layout>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

export default AppTour;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 31, 32, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Larger, lower-opacity outer ring behind the solid inner circle -- gives
  // the icon a soft "glow" halo instead of a single flat chip, the same
  // layered-circle trick behind most illustrated onboarding/tour designs.
  iconWrapOuter: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    opacity: 0.5,
  },
  iconWrap: {
    position: 'absolute',
    // (96 outer - 72 inner) / 2 -- RN positions absolute children relative
    // to the parent's top-left by default (no parent align/justify applied
    // to absolutely-positioned children), so this has to be centered
    // manually rather than inheriting iconWrapOuter's alignItems/
    // justifyContent.
    top: 12,
    left: 12,
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
});
