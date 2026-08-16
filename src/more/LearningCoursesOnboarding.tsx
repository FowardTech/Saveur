import React, { memo, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';

import Text from 'components/Text';
import CtaButton from 'components/CtaButton';
import useLayout from 'hooks/useLayout';
import { Images } from 'assets/images';
import { globalStyle } from 'styles/globalStyle';
import { getOnboardingImage } from 'services/onboardingImageService';
import OnboardingIconArt from 'src/onboarding/OnboardingIconArt';

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
// REDESIGN (product request: "you use any of the icons or combination of
// them in the job alert and learning course onboarding" — the same real
// icons8 PNGs already used to rebuild the signup carousel, see
// src/onboarding/index.tsx and OnboardingIconArt.tsx) — the bundled
// `Images.learningOnboarding` full illustration (real people/phone-mockup
// artwork with its headline baked into the pixels) is no longer the
// DEFAULT. Default now reuses the exact same icon pairing the signup
// carousel's own "Learn what you need, one course at a time" slide uses —
// an open book (learning itself) badged with a graduation cap — plus a
// real, translatable title/subtitle instead of baked pixel text (the
// original baked headline, "Flavour your career with our short courses",
// is reused verbatim as the new translatable copy so the actual message
// doesn't change, just how it's rendered).
// The admin-uploaded per-language override (below, `remoteImage`) is fully
// preserved and takes priority over this new default exactly like before —
// this only changes what shows when no admin override exists.
const LearningCoursesOnboarding = memo(({ onGetStarted }: LearningCoursesOnboardingProps) => {
  const { t } = useTranslation(['more', 'common']);
  const { width, height, bottom } = useLayout();
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

  return (
    <View style={[styles.container, { width, height }]}>
      {remoteImage ? (
        <Image
          source={{ uri: remoteImage }}
          resizeMode="cover"
          style={[styles.image, { width, height }]}
        />
      ) : (
        <View style={[styles.iconHeroWrap, { width, height }]}>
          <OnboardingIconArt
            primaryIcon={Images.iconOpenBook}
            accentIcon={Images.iconGraduationCap}
            tintColor="rgba(245,158,11,0.14)"
            size={Math.min(width * 0.5, 210)}
            pageBackgroundColor="#FDF6E8"
          />
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

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    // Opaque fallback fill behind the image (matches the source image's own
    // pale-cream top edge) so there's never a flash of the screen behind
    // while the image asset decodes. Also the icon-cluster default's own
    // backdrop color now (see iconHeroWrap below) -- kept the same hex so
    // switching between the two (admin override vs. default) never shows a
    // color flash either.
    backgroundColor: '#FDF6E8',
    zIndex: 100,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  // REDESIGN -- centers OnboardingIconArt + title/subtitle in the space the
  // old full-bleed photo used to fill. paddingBottom reserves room above
  // ctaWrap (an absolutely-positioned sibling, so this can't just rely on
  // flex to avoid overlapping it).
  iconHeroWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 140,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 38,
  },
  // Bottom quarter of the old source image was a plain soft-pink gradient
  // with no illustration content — the real Get Started button sat
  // directly on top of it rather than needing its own opaque card/backdrop.
  // Still true of the new default: the plain #FDF6E8 fill behind
  // iconHeroWrap needs no separate backdrop for the button either.
  ctaWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 0,
  },
});
