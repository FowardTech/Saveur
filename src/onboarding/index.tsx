import React, { memo } from 'react';
import { Image, Modal, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import {
  Button,
  Icon,
  Layout,
  StyleService,
  useTheme,
  useStyleSheet,
} from '@ui-kitten/components';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import CtaButton from 'components/CtaButton';
import ThemeContext from '../../ThemeContext';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Dots from './Dots';
import Flex from 'components/Flex';
import OnboardingCluster, { CLUSTER_COLORS } from 'components/OnboardingCluster';
import { RootStackParamList } from 'navigation/types';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { globalStyle } from 'styles/globalStyle';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, getLanguageLabel } from 'constants/languages';
import { EKeyAsyncStorage } from 'constants/Types';
import { getSignupOnboardingImage, SignupOnboardingImagesConfig } from 'services/configService';

/** Admin-uploaded override photo for one signup-carousel slide (Admin >
 * Content > Onboarding > Signup Carousel), if one exists — still checked
 * first (see DATA's own SYMPHONY REDESIGN comment below), same as every
 * prior version of this screen. Only when an admin hasn't uploaded
 * anything for a slide does it fall back to this pass's own default real
 * photo. */
function overrideImageUri(key: keyof SignupOnboardingImagesConfig): string | null {
  return getSignupOnboardingImage(key);
}

const Onboarding = memo(() => {
  const { width, top } = useLayout();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const { t } = useTranslation(['intro', 'auth']);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  // SYMPHONY REDESIGN: Container's page level override (was the earlier
  // "round glossy ball" reference's own reasoning for forcing true white in
  // light mode — that reasoning still holds under this pass too, this
  // screen has no cards of its own to contrast against a gray page).
  const { theme: appTheme } = React.useContext(ThemeContext);
  const isDarkMode = appTheme === 'dark';

  // Language must be set here, first — before signup even starts — per
  // explicit request: a top-right dropdown on the onboarding slides rather
  // than the picker that used to live on SignupFirstStep.tsx (removed).
  // i18n.changeLanguage() below updates the slide text on this screen
  // immediately; the AsyncStorage write is what makes that choice survive a
  // cold restart before the user has an account for it to live on (see
  // i18n/config.ts's bootstrap restore + the comment on
  // EKeyAsyncStorage.preferredLocale). Settings → Language
  // (src/home/MyFavorites/SelectLanguage.tsx) is untouched and stays the way
  // a signed-in user changes their language later. UNCHANGED by this pass.
  const [locale, setLocaleState] = React.useState(i18n.language);
  const [showLanguageMenu, setShowLanguageMenu] = React.useState(false);
  const onSelectLocale = React.useCallback((code: string) => {
    setLocaleState(code);
    i18n.changeLanguage(code);
    AsyncStorage.setItem(EKeyAsyncStorage.preferredLocale, code).catch(() => {});
    setShowLanguageMenu(false);
  }, []);

  const translationX = useSharedValue(0);
  const scrollRef = useAnimatedRef<ScrollView>();
  const scrollHandler = useAnimatedScrollHandler(event => {
    translationX.value = event.contentOffset.x;
  });

  // SYMPHONY REDESIGN follow-up (explicit product correction, with 2
  // Symphony reference screenshots: "Cant you see the onboarding of
  // symphony that it has photos like avatars and then it has icons that
  // represents what the app it doing... it has 3 real images all in small
  // avatars and then 2 icons in different color background... Do exactly
  // how the symphony did theirs"). The previous pass (one full-bleed photo
  // per slide) was a misread of that original request — the actual
  // reference is a scattered cluster of small circular real-photo avatars
  // mixed with colored icon badges (see components/OnboardingCluster.tsx
  // for the shared composition, now also reused by JobAlertsOnboarding.tsx
  // and LearningCoursesOnboarding.tsx so all 3 onboarding surfaces share
  // one visual language). Each slide gets its own pair of avatar photos
  // (rotating through the same 5 license-verified Unsplash photos so every
  // one of them appears twice across the 5 slides) and 3 icons chosen to
  // represent that slide's specific feature.
  //
  // Photos still sourced from Unsplash (free-to-use license, no
  // attribution required, verified non-Unsplash+ before use) — only the
  // crop changed, from a 4:5 portrait to a square (avatars are circular),
  // via the same imgix query-param convention.
  //
  // The admin-upload override mechanism (Admin > Content > Onboarding >
  // Signup Carousel) is UNCHANGED in spirit but simplified in effect: an
  // admin-uploaded photo for a slide still wins over this default every
  // time (see overrideImageUri above and its render call site below), just
  // rendered as a single full photo card instead of a cluster when present
  // — asking an admin to upload multiple avatar photos plus icon choices
  // through that same one-image-per-slide upload flow isn't realistic, so
  // an override intentionally falls back to the older single-photo layout
  // rather than trying to force it into this multi-piece composition.
  const AVATAR_QUERY = 'auto=format&fit=crop&crop=faces&w=200&h=200&q=80';
  const PHOTOS = [
    `https://images.unsplash.com/photo-1752650733337-cb0189176fb9?${AVATAR_QUERY}`,
    `https://images.unsplash.com/photo-1758598304525-a1b42e0f1701?${AVATAR_QUERY}`,
    `https://images.unsplash.com/photo-1758874383904-c3c409aeb32d?${AVATAR_QUERY}`,
    `https://images.unsplash.com/photo-1724985284026-dd2451e4857a?${AVATAR_QUERY}`,
    `https://images.unsplash.com/photo-1760351561007-526f5353cc76?${AVATAR_QUERY}`,
  ];
  const DATA: Array<{
    id: number;
    title: string;
    subtitle: string;
    configKey: keyof SignupOnboardingImagesConfig;
    avatarUris: [string, string];
    badges: [{ icon: string; bg: string }, { icon: string; bg: string }, { icon: string; bg: string }];
    accentColor: string;
  }> = [
    {
      id: 0,
      title: t('intro:title_1').toString(),
      subtitle: t('intro:subtitle_1').toString(),
      configKey: 'interview',
      avatarUris: [PHOTOS[0], PHOTOS[1]],
      badges: [
        { icon: 'mic-outline', bg: CLUSTER_COLORS.blue },
        { icon: 'message-circle-outline', bg: CLUSTER_COLORS.pink },
        { icon: 'checkmark-circle-2', bg: CLUSTER_COLORS.green },
      ],
      accentColor: CLUSTER_COLORS.orange,
    },
    {
      id: 1,
      title: t('intro:title_2').toString(),
      subtitle: t('intro:subtitle_2').toString(),
      configKey: 'feedback',
      avatarUris: [PHOTOS[1], PHOTOS[2]],
      badges: [
        { icon: 'trending-up-outline', bg: CLUSTER_COLORS.green },
        { icon: 'star-outline', bg: CLUSTER_COLORS.blue },
        { icon: 'bar-chart-outline', bg: CLUSTER_COLORS.orange },
      ],
      accentColor: CLUSTER_COLORS.pink,
    },
    {
      id: 2,
      title: t('intro:title_3').toString(),
      subtitle: t('intro:subtitle_3').toString(),
      configKey: 'job_alert',
      avatarUris: [PHOTOS[2], PHOTOS[3]],
      badges: [
        { icon: 'bell-outline', bg: CLUSTER_COLORS.pink },
        { icon: 'briefcase-outline', bg: CLUSTER_COLORS.blue },
        { icon: 'search-outline', bg: CLUSTER_COLORS.green },
      ],
      accentColor: CLUSTER_COLORS.orange,
    },
    {
      id: 3,
      title: t('intro:title_4').toString(),
      subtitle: t('intro:subtitle_4').toString(),
      configKey: 'resume_scan',
      avatarUris: [PHOTOS[3], PHOTOS[4]],
      badges: [
        { icon: 'file-text-outline', bg: CLUSTER_COLORS.blue },
        { icon: 'edit-2-outline', bg: CLUSTER_COLORS.orange },
        { icon: 'checkmark-circle-2', bg: CLUSTER_COLORS.green },
      ],
      accentColor: CLUSTER_COLORS.pink,
    },
    {
      id: 4,
      title: t('intro:title_5').toString(),
      subtitle: t('intro:subtitle_5').toString(),
      configKey: 'learning',
      avatarUris: [PHOTOS[4], PHOTOS[0]],
      badges: [
        { icon: 'book-open-outline', bg: CLUSTER_COLORS.orange },
        { icon: 'award-outline', bg: CLUSTER_COLORS.pink },
        { icon: 'trending-up-outline', bg: CLUSTER_COLORS.blue },
      ],
      accentColor: CLUSTER_COLORS.green,
    },
  ];

  const onLogin = React.useCallback(
    () => navigate('AuthStack', { screen: 'Login' }),
    [],
  );
  const onSignup = React.useCallback(
    () => navigate('AuthStack', { screen: 'SignupFirstStep' }),
    [],
  );
  return (
    <Container style={styles.container} level={isDarkMode ? '1' : '2'}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setShowLanguageMenu(true)}
        style={[styles.languageButton, { top: top + 8 }]}
      >
        <Icon
          pack="eva"
          name="globe-2-outline"
          style={{ width: 18, height: 18, tintColor: theme['text-basic-color'] }}
        />
        <Text category="h9" bold ml={6}>
          {getLanguageLabel(locale)}
        </Text>
        <Icon
          pack="eva"
          name="chevron-down-outline"
          style={{ width: 16, height: 16, marginLeft: 2, tintColor: theme['text-basic-color'] }}
        />
      </TouchableOpacity>
      <Modal visible={showLanguageMenu} transparent animationType="fade">
        <Pressable style={styles.menuBackdrop} onPress={() => setShowLanguageMenu(false)}>
          <Layout level="1" style={[styles.menuCard, { top: top + 52 }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {SUPPORTED_LANGUAGES.map(lang => {
                const selected = lang.code === locale;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    activeOpacity={0.7}
                    onPress={() => onSelectLocale(lang.code)}
                    style={styles.menuRow}
                  >
                    <Text category="h8" bold={selected} status={selected ? 'link' : 'basic'}>
                      {lang.nativeLabel}
                    </Text>
                    {selected ? (
                      <Icon
                        pack="eva"
                        name="checkmark-outline"
                        style={{ width: 18, height: 18, tintColor: theme['text-basic-color'] }}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Layout>
        </Pressable>
      </Modal>
      <Content contentContainerStyle={styles.content}>
        <View style={{ flex: 1 }}>
          <Animated.ScrollView
            ref={scrollRef as any}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            horizontal
            snapToInterval={width}
            bounces={false}
            pagingEnabled={false}
            decelerationRate="fast"
            onScroll={scrollHandler}
            style={{ width: width }}
            contentContainerStyle={{
              width: width * DATA.length,
              justifyContent: 'center',
            }}
          >
            {DATA.map((i, index) => {
              let id = i.id;
              const input = [(id - 1) * width, id * width, (id + 1) * width];
              const style = useAnimatedStyle(() => {
                const translateX = interpolate(
                  translationX.value,
                  input,
                  [-width / 3, 0, width / 3],
                  Extrapolation.CLAMP,
                );
                const scale = interpolate(
                  translationX.value,
                  input,
                  [0.61, 1, 0.61],
                  Extrapolation.CLAMP,
                );
                const opacity = interpolate(
                  translationX.value,
                  input,
                  [-0.6, 1, -0.6],
                );

                return {
                  opacity: opacity,
                  transform: [{ translateX: translateX }, { scale: scale }],
                  width: width,
                };
              });
              const overrideUri = overrideImageUri(i.configKey);
              const clusterSize = Math.min(width * 0.78, 300);
              return (
                <Animated.View key={index} style={style}>
                  <View style={styles.heroWrap}>
                    {overrideUri ? (
                      // Admin-uploaded override — falls back to the older
                      // single full-photo card (see DATA's own comment on
                      // why this doesn't try to force an override into the
                      // cluster layout).
                      <View style={[styles.photoWrap, { width: clusterSize * 0.75, height: clusterSize * 0.94 }]}>
                        <Image
                          source={{ uri: overrideUri }}
                          resizeMode="cover"
                          style={{ width: '100%', height: '100%' }}
                        />
                      </View>
                    ) : (
                      <OnboardingCluster
                        avatarUris={i.avatarUris}
                        badges={i.badges}
                        accentColor={i.accentColor}
                        size={clusterSize}
                      />
                    )}
                  </View>
                  <Text category="h4" bold mh={24} mt={28} style={styles.title}>
                    {i.title}
                  </Text>
                  <Text category="h8" status="placeholder" mh={24} mt={8} style={styles.subtitle}>
                    {i.subtitle}
                  </Text>
                </Animated.View>
              );
            })}
          </Animated.ScrollView>
        </View>
        <Dots translationValue={translationX} data={DATA} />
        <Flex padder pv={48}>
          <Button style={styles.login} status="outline" onPress={onLogin}>
            {t('auth:login')}
          </Button>
          <CtaButton style={styles.signup} onPress={onSignup}>
            {t('auth:sign_up').toString()}
          </CtaButton>
        </Flex>
      </Content>
    </Container>
  );
});

export default Onboarding;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  title: {},
  subtitle: {
    lineHeight: 20,
  },
  content: {
    marginTop: 40,
    alignItems: 'center',
    flexGrow: 1,
  },
  // Centers whichever hero the slide renders (OnboardingCluster, or the
  // single-photo admin-override fallback) in the same fixed space every
  // slide reserves, so the title/subtitle below always start at the same
  // vertical position regardless of which one is showing.
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Admin-override fallback only now (see DATA's own comment) — the
  // default hero is components/OnboardingCluster.tsx instead. Same
  // moderate rounded-corner radius the rest of this redesign uses
  // everywhere else — no border (Symphony's own "no borders" rule), no
  // drop shadow (a real photo already reads as content on its own).
  photoWrap: {
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'background-basic-color-3',
  },
  // SYMPHONY REDESIGN follow-up (explicit product request: "all the
  // buttons I see still has 50% rounded borders" — applies app-wide). Was
  // a local `borderRadius: 999` override matching CtaButton's own former
  // full-pill shape; both now use the same 14px moderate radius (see
  // components/CtaButton.tsx and constants/theme/mapping.json's Button
  // "filled" size variants for the other half of this change) so Login/
  // Sign Up sit on the same row with matching corners again.
  login: {
    flex: 1,
    marginRight: 16,
    borderRadius: 14,
  },
  signup: {
    flex: 1,
  },
  languageButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 99,
    backgroundColor: 'background-basic-color-2',
  },
  menuBackdrop: {
    flex: 1,
  },
  menuCard: {
    position: 'absolute',
    right: 20,
    width: 200,
    maxHeight: 320,
    borderRadius: 16,
    paddingVertical: 8,
    ...globalStyle.shadowBtn,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
});
