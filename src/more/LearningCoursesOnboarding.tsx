import React, { memo, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import CtaButton from 'components/CtaButton';
import useLayout from 'hooks/useLayout';
import { Images } from 'assets/images';
import { globalStyle } from 'styles/globalStyle';
import { getOnboardingImage } from 'services/onboardingImageService';

interface LearningCoursesOnboardingProps {
  onGetStarted(): void;
}

// Product request: "when user comes to the learning course screen for the
// first time, a full screen banner should appear first and then users can
// click on the get started button to now enter the learning course screen
// and begin learning. Its like saying that its an onboarding for the
// learning course feature. So the image i want you to use for the
// onboarding is image 3" — the product owner's own supplied hero image
// (assets/images/index.ts's learningOnboarding, already sized 9:16 for a
// full-bleed phone screen, no cropping needed).
//
// Rendered by LearningCourses.tsx in place of its real content (same early-
// return pattern that screen already uses for its ProLockGate premium
// check) the first time this screen mounts, gated on
// EKeyAsyncStorage.learningCoursesOnboardingSeen — set the moment "Get
// Started" is tapped, so this never shows again for that device. Unlike
// this screen's own gate, this banner shows to EVERY user regardless of
// plan — it's introducing the feature, not paywalling it; a non-Premium
// user taps through to the real ProLockGate upsell screen right after.
//
// The image itself has a headline baked into the pixels, so it can't be
// auto-translated like the rest of this app's content — an admin can now
// upload a localized version per language from Admin > Content > Onboarding
// (see services/onboardingImageService.ts), and this screen shows that
// override for the user's current app language if one exists, falling back
// to the bundled asset above for English or any language with no upload of
// its own. The "Get Started" action itself is a real translatable native
// button, not baked into the image either way.
const LearningCoursesOnboarding = memo(({ onGetStarted }: LearningCoursesOnboardingProps) => {
  const { t } = useTranslation(['more', 'common']);
  const { width, height, bottom } = useLayout();
  const [remoteImage, setRemoteImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOnboardingImage('learning_courses').then(url => {
      if (!cancelled) setRemoteImage(url);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={[styles.container, { width, height }]}>
      <Image
        source={remoteImage ? { uri: remoteImage } : Images.learningOnboarding}
        resizeMode="cover"
        style={[styles.image, { width, height }]}
      />
      <View style={[styles.ctaWrap, { paddingBottom: bottom + 24 }]}>
        <CtaButton style={globalStyle.shadowBtn} onPress={onGetStarted}>
          {t('common:continue', { defaultValue: 'Continue' })}
        </CtaButton>
        <Text
          category="h10"
          status="placeholder"
          center
          mt={12}
          onPress={onGetStarted}
          style={styles.skipText}>
          {t('more:onboarding_skip_for_now', { defaultValue: 'Skip for now' })}
        </Text>
      </View>
    </View>
  );
});

export default LearningCoursesOnboarding;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    // Opaque fallback fill behind the image (matches the source image's own
    // pale-cream top edge) so there's never a flash of the screen behind
    // while the image asset decodes.
    backgroundColor: '#FDF6E8',
    zIndex: 100,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  // Bottom quarter of the source image is a plain soft-pink gradient with
  // no illustration content — the real Get Started button sits directly on
  // top of it rather than needing its own opaque card/backdrop.
  ctaWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 0,
  },
  skipText: {
    textDecorationLine: 'underline',
  },
});
