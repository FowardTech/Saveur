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
//
// REDESIGN (product request: "you use any of the icons or combination of
// them in the job alert and learning course onboarding" — the same real
// icons8 PNGs already used to rebuild the signup carousel, see
// src/onboarding/index.tsx and OnboardingIconArt.tsx) — the bundled
// `Images.jobAlertsOnboarding` full illustration (real people/phone-mockup
// artwork with its headline baked into the pixels — see above) is no
// longer the DEFAULT. Default now reuses the exact same icon pairing the
// signup carousel's own "First hand Job Alert" slide uses — a megaphone
// (the alert) badged with a briefcase-and-gear (the job it's alerting
// about) — plus a real, translatable title/subtitle instead of baked pixel
// text (the original baked headline, "Saveur brings jobs to you / Based on
// your desired role", is reused verbatim as the new translatable copy so
// the actual message doesn't change, just how it's rendered).
// The admin-uploaded per-language override (below, `remoteImage`) is fully
// preserved and takes priority over this new default exactly like before —
// this only changes what shows when no admin override exists.
const JobAlertsOnboarding = memo(({ onGetStarted }: JobAlertsOnboardingProps) => {
  const { t } = useTranslation(['more', 'common']);
  const { width, height, bottom } = useLayout();
  // The bundled illustration has text baked into the pixels, so it can't be
  // auto-translated like the rest of this app's content — an admin can
  // upload a localized version per language from Admin > Content >
  // Onboarding (see services/onboardingImageService.ts). Falls back to the
  // new default icon-cluster art below for English or any language with no
  // upload of its own, exactly like it fell back to the bundled asset
  // before this REDESIGN.
  const [remoteImage, setRemoteImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getOnboardingImage('job_alerts').then(url => {
        if (!cancelled) setRemoteImage(url);
      });
    };
    load();
    // BUG FIX (pre-launch i18n staleness audit) — same fix as the identical
    // pattern in LearningCoursesOnboarding.tsx, see that file's own comment.
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
            primaryIcon={Images.iconMegaphone}
            accentIcon={Images.iconBriefcaseGear}
            tintColor="rgba(20,184,166,0.14)"
            size={Math.min(width * 0.5, 210)}
            pageBackgroundColor="#EAF0F9"
          />
          <Text category="h2" bold center mh={32} mt={28} style={styles.heroTitle}>
            {t('more:job_alerts_onboarding_title', { defaultValue: 'Saveur brings jobs to you' })}
          </Text>
          <Text category="h8" status="placeholder" center mh={32} mt={10}>
            {t('more:job_alerts_onboarding_subtitle', {
              defaultValue: 'Based on your desired role — get notified the moment a matching job goes live.',
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

export default JobAlertsOnboarding;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    // Opaque fallback fill behind the image (matches the source image's
    // own pale blue-gray background) so there's never a flash of the
    // screen behind while the image asset decodes. Also the icon-cluster
    // default's own backdrop color now (see iconHeroWrap below) -- kept
    // the same hex so switching between the two (admin override vs.
    // default) never shows a color flash either.
    backgroundColor: '#EAF0F9',
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
  ctaWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 0,
  },
});
