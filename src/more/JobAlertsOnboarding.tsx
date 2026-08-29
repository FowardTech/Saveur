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

interface JobAlertsOnboardingProps {
  onGetStarted(): void;
}

// SYMPHONY REDESIGN (explicit product request: "for the onboarding screens
// of the job alert and learning course i dont want photos... design their
// onboarding screens like the main app onboarding" — read together with the
// earlier icon-cluster pass this replaces, the intent is: unlike the main
// signup carousel (src/onboarding/index.tsx), which now leads with a real
// photo of a person, THESE two feature-intro banners should show a plain
// mock preview of the feature's own dashboard UI instead — a user reaching
// this screen is already signed in and about to open a specific feature,
// so "here's a preview of what you're about to see" is the more useful
// hero than a stock photo of an unrelated person. Replaces the earlier
// icon-cluster default (OnboardingIconArt's megaphone+briefcase pairing).
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
  const theme = useTheme();
  // The bundled illustration has text baked into the pixels, so it can't be
  // auto-translated like the rest of this app's content — an admin can
  // upload a localized version per language from Admin > Content >
  // Onboarding (see services/onboardingImageService.ts). Falls back to the
  // new default dashboard-preview mock below for English or any language
  // with no upload of its own.
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

  const MOCK_JOBS = [
    { company: 'Northwind Labs', role: 'Product Designer', isNew: true },
    { company: 'Bluepeak Digital', role: 'Frontend Engineer', isNew: false },
    { company: 'Harbor & Co.', role: 'Marketing Manager', isNew: false },
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
          {/* Dashboard-style mock — a plain card the shape/size of the real
              Job Alerts list, with 3 placeholder rows, so this reads as "a
              preview of the actual feature" rather than a decorative
              illustration. No real data is faked as if it were live —
              company/role names are obviously generic placeholders, not
              presented as real alerts. */}
          <View style={styles.mockCard}>
            <View style={styles.mockCardHeader}>
              <Icon pack="eva" name="bell-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-100'] }]} />
              <Text category="h9" bold ml={8}>
                {t('more:job_alerts', { defaultValue: 'Job Alerts' })}
              </Text>
            </View>
            {MOCK_JOBS.map((job, i) => (
              <View key={i} style={[styles.mockRow, i === MOCK_JOBS.length - 1 && styles.mockRowLast]}>
                <View style={styles.mockRowIcon}>
                  <Icon pack="eva" name="briefcase-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-100'] }]} />
                </View>
                <View style={globalStyle.flexOne}>
                  <Text category="h9" bold numberOfLines={1}>
                    {job.company}
                  </Text>
                  <Text category="h10" status="placeholder" numberOfLines={1} mt={2}>
                    {job.role}
                  </Text>
                </View>
                {job.isNew ? (
                  <View style={styles.mockNewBadge}>
                    <Text category="h10" bold style={{ color: theme['text-control-color'] }}>
                      {t('more:job_alerts_onboarding_new_badge', { defaultValue: 'New' })}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
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
  mockRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: 'color-primary-transparent-100',
  },
  mockNewBadge: {
    backgroundColor: 'color-primary-100',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
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
