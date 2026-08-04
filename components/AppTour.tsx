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
  },
  {
    icon: 'briefcase-outline',
    titleKey: 'tour_jobs_title',
    titleDefault: 'Daily job matches',
    bodyKey: 'tour_jobs_body',
    bodyDefault: 'Home shows job alerts matched to your desired roles and countries every day, plus a goal tip to keep you moving forward.',
  },
  {
    icon: 'mic-outline',
    titleKey: 'tour_practice_title',
    titleDefault: 'Practice interviews',
    bodyKey: 'tour_practice_body',
    bodyDefault: 'Run realistic mock interviews (text or voice) in the Practice tab and get real AI feedback on your answers afterward.',
  },
  {
    icon: 'message-circle-outline',
    titleKey: 'tour_coach_title',
    titleDefault: 'Talk to your AI Coach',
    bodyKey: 'tour_coach_body',
    bodyDefault: "The Coach tab is a real conversation — by text or live voice — that knows your goals, progress, and history so its advice actually fits you.",
  },
  {
    icon: 'book-open-outline',
    titleKey: 'tour_courses_title',
    titleDefault: 'Learn a new skill',
    bodyKey: 'tour_courses_body',
    bodyDefault: 'Learning Courses (under More) builds a real Basic → Intermediate → Advanced course on any career path you pick, with a badge when you finish.',
  },
  {
    icon: 'award-outline',
    titleKey: 'tour_gamification_title',
    titleDefault: 'Streaks & leaderboard',
    bodyKey: 'tour_gamification_body',
    bodyDefault: "Practicing daily earns XP and builds a streak. You'll show up on the leaderboard under a fun generated username — never your real name.",
  },
  {
    icon: 'checkmark-square-2-outline',
    titleKey: 'tour_applications_title',
    titleDefault: 'Track your applications',
    bodyKey: 'tour_applications_body',
    bodyDefault: "Keep every job you've applied to in one place, with status updates, so nothing falls through the cracks.",
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

            <View style={[styles.iconWrap, { backgroundColor: theme['background-basic-color-2'] }]}>
              <Icon
                pack="eva"
                name={step.icon}
                style={{ width: 32, height: 32, tintColor: theme['text-basic-color'] }}
              />
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
  iconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
});
