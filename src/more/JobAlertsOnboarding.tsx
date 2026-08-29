import React, { memo, useEffect, useState } from 'react';
import { Image, ImageStyle, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { StyleService, useStyleSheet } from '@ui-kitten/components';

import Text from 'components/Text';
import CtaButton from 'components/CtaButton';
import useLayout from 'hooks/useLayout';
import { globalStyle } from 'styles/globalStyle';
import { getOnboardingImage } from 'services/onboardingImageService';
import OnboardingCluster, { CLUSTER_COLORS } from 'components/OnboardingCluster';

interface JobAlertsOnboardingProps {
  onGetStarted(): void;
}

const AVATAR_QUERY = 'auto=format&fit=crop&crop=faces&w=200&h=200&q=80';
const AVATAR_URIS: [string, string] = [
  `https://images.unsplash.com/photo-1758874383904-c3c409aeb32d?${AVATAR_QUERY}`,
  `https://images.unsplash.com/photo-1752650733337-cb0189176fb9?${AVATAR_QUERY}`,
];
const BADGES: [{ icon: string; bg: string }, { icon: string; bg: string }, { icon: string; bg: string }] = [
  { icon: 'bell-outline', bg: CLUSTER_COLORS.pink },
  { icon: 'briefcase-outline', bg: CLUSTER_COLORS.blue },
  { icon: 'search-outline', bg: CLUSTER_COLORS.green },
];

// SYMPHONY REDESIGN follow-up (explicit product correction, with 2
// Symphony reference screenshots: "Cant you see the onboarding of symphony
// that it has photos like avatars and then it has icons that represents
// what the app it doing... Thats what i asked you to do in all the
// onboardings i asked you to work on including the job alert and the
// learning course"). Replaces BOTH the earlier icon-cluster default
// (OnboardingIconArt's megaphone+briefcase pairing) AND the "dashboard
// preview mock" this screen was rebuilt with just one pass ago (a
// misreading of the same original request) — now uses the exact same
// avatar+icon cluster component the main signup carousel uses (see
// components/OnboardingCluster.tsx), so all 3 onboarding surfaces share
// one visual language.
//
// Rendered by JobAlerts.tsx in place of its real content the first time
// this screen mounts, gated on EKeyAsyncStorage.jobAlertsOnboardingSeen —
// set the moment "Get Started" is tapped, so this never shows again for
// that device. Same as the learning-course banner, this shows before the
// ProLockGate premium check, not after — it introduces the feature to
// every user regardless of plan, and a non-Premium user still taps through
// to the real upsell screen right after.
//
// The admin-uploaded per-language override (below, `remoteImage`) is fully
// preserved and takes priority over this new default exactly like before —
// this only changes what shows when no admin override exists.
const JobAlertsOnboarding = memo(({ onGetStarted }: JobAlertsOnboardingProps) => {
  const { t } = useTranslation(['more', 'common']);
  const { width, height, bottom } = useLayout();
  const styles = useStyleSheet(themedStyles);
  // The bundled illustration has text baked into the pixels, so it can't be
  // auto-translated like the rest of this app's content — an admin can
  // upload a localized version per language from Admin > Content >
  // Onboarding (see services/onboardingImageService.ts). Falls back to the
  // new default cluster below for English or any language with no upload
  // of its own.
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

  const clusterSize = Math.min(width * 0.78, 300);

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
          <OnboardingCluster
            avatarUris={AVATAR_URIS}
            badges={BADGES}
            accentColor={CLUSTER_COLORS.orange}
            size={clusterSize}
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
