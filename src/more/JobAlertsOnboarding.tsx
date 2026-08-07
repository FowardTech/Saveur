import React, { memo, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import CtaButton from 'components/CtaButton';
import useLayout from 'hooks/useLayout';
import { Images } from 'assets/images';
import { globalStyle } from 'styles/globalStyle';
import { getOnboardingImage } from 'services/onboardingImageService';

interface JobAlertsOnboardingProps {
  onGetStarted(): void;
}

// Product request: "I also want an onboarding illustration for Job alerts
// the same way you did for the learning course. The image is image 4" —
// same first-time full-screen banner pattern as
// src/more/LearningCoursesOnboarding.tsx, this time using the product
// owner's own supplied "Saveur brings jobs to you / Based on your desired
// role" marketing illustration (assets/images/index.ts's
// jobAlertsOnboarding — cropped to drop the black pillarbox bars the
// original file had on either side).
//
// Rendered by JobAlerts.tsx in place of its real content the first time
// this screen mounts, gated on EKeyAsyncStorage.jobAlertsOnboardingSeen —
// set the moment "Get Started" is tapped, so this never shows again for
// that device. Same as the learning-course banner, this shows before the
// ProLockGate premium check, not after — it introduces the feature to
// every user regardless of plan, and a non-Premium user still taps through
// to the real upsell screen right after.
const JobAlertsOnboarding = memo(({ onGetStarted }: JobAlertsOnboardingProps) => {
  const { t } = useTranslation(['more', 'common']);
  const { width, height, bottom } = useLayout();
  // The bundled illustration has text baked into the pixels, so it can't be
  // auto-translated like the rest of this app's content — an admin can
  // upload a localized version per language from Admin > Content >
  // Onboarding (see services/onboardingImageService.ts). Falls back to the
  // bundled asset below for English or any language with no upload of its
  // own, exactly like before this existed.
  const [remoteImage, setRemoteImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOnboardingImage('job_alerts').then(url => {
      if (!cancelled) setRemoteImage(url);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={[styles.container, { width, height }]}>
      <Image
        source={remoteImage ? { uri: remoteImage } : Images.jobAlertsOnboarding}
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

export default JobAlertsOnboarding;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    // Opaque fallback fill behind the image (matches the source image's
    // own pale blue-gray background) so there's never a flash of the
    // screen behind while the image asset decodes.
    backgroundColor: '#EAF0F9',
    zIndex: 100,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
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
