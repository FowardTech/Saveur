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

interface LearningCoursesOnboardingProps {
  onGetStarted(): void;
}

const AVATAR_QUERY = 'auto=format&fit=crop&crop=faces&w=200&h=200&q=80';
const AVATAR_URIS: [string, string] = [
  `https://images.unsplash.com/photo-1760351561007-526f5353cc76?${AVATAR_QUERY}`,
  `https://images.unsplash.com/photo-1758598304525-a1b42e0f1701?${AVATAR_QUERY}`,
];
const BADGES: [{ icon: string; bg: string }, { icon: string; bg: string }, { icon: string; bg: string }] = [
  { icon: 'book-open-outline', bg: CLUSTER_COLORS.orange },
  { icon: 'award-outline', bg: CLUSTER_COLORS.pink },
  { icon: 'trending-up-outline', bg: CLUSTER_COLORS.blue },
];

// SYMPHONY REDESIGN follow-up (explicit product correction, with 2
// Symphony reference screenshots — same context/reasoning as
// JobAlertsOnboarding.tsx's own comment, see that file). Replaces BOTH the
// earlier icon-cluster default (open book + graduation cap) AND the
// "dashboard preview mock" this screen was rebuilt with just one pass ago
// (a misreading of the same original request) — now uses the exact same
// avatar+icon cluster component the main signup carousel uses (see
// components/OnboardingCluster.tsx), so all 3 onboarding surfaces share
// one visual language.
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
            accentColor={CLUSTER_COLORS.green}
            size={clusterSize}
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
