import React, { memo, useEffect, useState } from 'react';
import { Image, ImageStyle, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';

import Text from 'components/Text';
import CtaButton from 'components/CtaButton';
import useLayout from 'hooks/useLayout';
import { globalStyle } from 'styles/globalStyle';
import { getOnboardingImage } from 'services/onboardingImageService';

interface LearningCoursesOnboardingProps {
  onGetStarted(): void;
}

// SYMPHONY REDESIGN (explicit product request: "for the onboarding screens
// of the job alert and learning course i dont want photos... design their
// onboarding screens like the main app onboarding" — same reasoning as the
// identical rebuild in JobAlertsOnboarding.tsx, see that file's comment for
// the full context). Replaces the earlier icon-cluster default (open book +
// graduation cap) with a plain mock preview of the feature's own course
// list — a stylized "here's what you're about to see" dashboard preview
// instead of a decorative illustration or stock photo.
//
// Rendered by LearningCourses.tsx in place of its real content the first
// time this screen mounts, gated on
// EKeyAsyncStorage.learningCoursesOnboardingSeen — set the moment "Get
// Started" is tapped, so this never shows again for that device. Shows
// before the ProLockGate premium check, not after — it introduces the
// feature to every user regardless of plan, and a non-Premium user still
// taps through to the real upsell screen right after.
//
// The admin-uploaded per-language override (below, `remoteImage`) is fully
// preserved and takes priority over this new default exactly like before —
// this only changes what shows when no admin override exists.
const LearningCoursesOnboarding = memo(({ onGetStarted }: LearningCoursesOnboardingProps) => {
  const { t } = useTranslation(['more', 'common']);
  const { width, height, bottom } = useLayout();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const [remoteImage, setRemoteImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getOnboardingImage('learning_courses').then(url => {
        if (!cancelled) setRemoteImage(url);
      });
    };
    load();
    // BUG FIX (pre-launch i18n staleness audit): this per-language admin
    // override was only ever fetched once at mount — switching language
    // while this onboarding screen happens to still be mounted left the
    // old language's image up. Low practical odds (this is a one-time
    // interstitial dismissed by "Get Started"), but the fix is cheap and
    // matches every other dynamic-content screen's convention.
    i18n.on('languageChanged', load);
    return () => {
      cancelled = true;
      i18n.off('languageChanged', load);
    };
  }, []);

  const MOCK_COURSES = [
    { title: 'Ace the Behavioral Interview', progress: 0.7 },
    { title: 'Resume Writing Fundamentals', progress: 0.35 },
    { title: 'Salary Negotiation Basics', progress: 0 },
  ];

  return (
    <View style={[styles.container, { width, height }]}>
      {remoteImage ? (
        <Image
          source={{ uri: remoteImage }}
          resizeMode="cover"
          style={[styles.image as ImageStyle, { width, height }]}
        />
      ) : (
        <View style={[styles.heroWrap, { width, height }]}>
          {/* Dashboard-style mock — a plain card shaped like the real
              Learning Courses list, with 3 placeholder course rows and
              progress bars, so this reads as "a preview of the actual
              feature" rather than a decorative illustration. Titles/
              progress are obviously generic placeholders, not presented as
              real course data. */}
          <View style={styles.mockCard}>
            <View style={styles.mockCardHeader}>
              <Icon pack="eva" name="book-open-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-100'] }]} />
              <Text category="h9" bold ml={8}>
                {t('more:learning_courses', { defaultValue: 'My Courses' })}
              </Text>
            </View>
            {MOCK_COURSES.map((course, i) => (
              <View key={i} style={[styles.mockRow, i === MOCK_COURSES.length - 1 && styles.mockRowLast]}>
                <View style={globalStyle.flexOne}>
                  <Text category="h9" bold numberOfLines={1}>
                    {course.title}
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(course.progress * 100)}%` }]} />
                  </View>
                </View>
                {course.progress >= 1 ? (
                  <Icon pack="eva" name="checkmark-circle-2" style={[globalStyle.icon16, { tintColor: theme['color-primary-100'] }]} />
                ) : (
                  <Text category="h10" status="placeholder" ml={10}>
                    {Math.round(course.progress * 100)}%
                  </Text>
                )}
              </View>
            ))}
          </View>
          <Text category="h2" bold center mh={32} mt={28} style={styles.heroTitle}>
            {t('more:learning_onboarding_title', { defaultValue: 'Flavour your career with short courses' })}
          </Text>
          <Text category="h8" status="placeholder" center mh={32} mt={10}>
            {t('more:learning_onboarding_subtitle', {
              defaultValue: 'Build skills, gain clarity, and grow — one bite-sized lesson at a time.',
            })}
          </Text>
        </View>
      )}
      <View style={[styles.ctaWrap, { paddingBottom: bottom + 24 }]}>
        <CtaButton style={globalStyle.shadowBtn} onPress={onGetStarted}>
          {t('common:continue', { defaultValue: 'Continue' })}
        </CtaButton>
      </View>
    </View>
  );
});

export default LearningCoursesOnboarding;

const themedStyles = StyleService.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    // SYMPHONY REDESIGN: the app's real gray page background token, not a
    // one-off pastel hex — matches every other screen this pass touched.
    backgroundColor: 'background-page-body',
    zIndex: 100,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  heroWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 140,
  },
  // SYMPHONY REDESIGN — a plain white/dark card, no border (Symphony's own
  // "no borders" rule), moderate rounded corners matching every other card
  // this pass introduced.
  mockCard: {
    ...globalStyle.card,
    width: 280,
    padding: 16,
    backgroundColor: 'background-basic-color-2',
  },
  mockCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.12)',
  },
  mockRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.16)',
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'color-primary-100',
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 38,
  },
  ctaWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 0,
  },
});
