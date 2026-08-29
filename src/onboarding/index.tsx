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

  // SYMPHONY REDESIGN (explicit product request, with Symphony reference
  // screenshots: "there are real photos like avatars used there do the
  // same you can pick photos from online"). This carousel has been through
  // several illustration approaches (see git history — hand-built design-
  // kit artwork, product-supplied hero-composition PNGs, then a bundled
  // icon-cluster pairing via OnboardingIconArt.tsx, all now retired). This
  // pass replaces all of that with real photographs — one per slide,
  // matching the actual idea each slide's title/subtitle communicates —
  // sourced from Unsplash (free-to-use license, no attribution required),
  // instead of any illustrated/iconographic art. Every URL below was
  // fetched and confirmed to be a genuinely free (non-Unsplash+) licensed
  // photo before being used here.
  //
  // Each photo is requested pre-cropped server-side to a consistent 4:5
  // portrait (`w`/`h`/`fit=crop&crop=faces` query params — Unsplash's own
  // imgix-based CDN) so every slide's photo card is the same shape
  // regardless of the source photo's own original aspect ratio, and so the
  // face/subject of the photo is what the crop keeps centered rather than
  // an arbitrary corner.
  //
  // The admin-upload override mechanism (Admin > Content > Onboarding >
  // Signup Carousel) is UNCHANGED — see overrideImageUri above and its
  // render call site below — an admin-uploaded photo for a slide still
  // wins over this default every time; only the DEFAULT changed.
  //
  // Per-slide photo reasoning (same 5 ideas the old icon pairing used,
  // see git history for that mapping):
  //  1. Interview practice with an AI coach -- a woman mid video-call,
  //     talking and gesturing (the live conversation itself).
  //  2. Instant feedback -- someone smiling at their own screen (the
  //     moment of seeing positive, useful feedback).
  //  3. First-hand Job Alert -- someone smiling at their phone (the
  //     alert notification landing).
  //  4. Get past the resume scanners -- a close hand-and-notebook/laptop
  //     shot (working on the actual document).
  //  5. Learn one course at a time -- two people studying together at a
  //     laptop (the learning itself).
  const PHOTO_QUERY = 'auto=format&fit=crop&crop=faces&w=1000&h=1250&q=80';
  const DATA = [
    {
      id: 0,
      title: t('intro:title_1'),
      subtitle: t('intro:subtitle_1'),
      configKey: 'interview' as const,
      photoUri: `https://images.unsplash.com/photo-1752650733337-cb0189176fb9?${PHOTO_QUERY}`,
    },
    {
      id: 1,
      title: t('intro:title_2'),
      subtitle: t('intro:subtitle_2'),
      configKey: 'feedback' as const,
      photoUri: `https://images.unsplash.com/photo-1758598304525-a1b42e0f1701?${PHOTO_QUERY}`,
    },
    {
      id: 2,
      title: t('intro:title_3'),
      subtitle: t('intro:subtitle_3'),
      configKey: 'job_alert' as const,
      photoUri: `https://images.unsplash.com/photo-1758874383904-c3c409aeb32d?${PHOTO_QUERY}`,
    },
    {
      id: 3,
      title: t('intro:title_4'),
      subtitle: t('intro:subtitle_4'),
      configKey: 'resume_scan' as const,
      photoUri: `https://images.unsplash.com/photo-1724985284026-dd2451e4857a?${PHOTO_QUERY}`,
    },
    {
      id: 4,
      title: t('intro:title_5'),
      subtitle: t('intro:subtitle_5'),
      configKey: 'learning' as const,
      photoUri: `https://images.unsplash.com/photo-1760351561007-526f5353cc76?${PHOTO_QUERY}`,
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
              const photoWidth = width * 0.7;
              return (
                <Animated.View key={index} style={style}>
                  <View style={[styles.photoWrap, { width: photoWidth, height: photoWidth * 1.25 }]}>
                    <Image
                      source={{ uri: overrideUri || i.photoUri }}
                      resizeMode="cover"
                      style={{ width: '100%', height: '100%' }}
                    />
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
  // SYMPHONY REDESIGN — the real photo card each slide now leads with,
  // replacing both the old admin-override full-image box and the
  // OnboardingIconArt icon-cluster default (see DATA's own comment above).
  // A fixed 4:5 portrait (matches the `w`/`h` crop params baked into every
  // photoUri above) with the same moderate rounded-corner radius the rest
  // of this redesign uses everywhere else — no border (Symphony's own "no
  // borders" rule), no drop shadow (a real photo already reads as content
  // on its own, unlike a flat icon that needed a card fill/shadow to not
  // look like it's floating in empty space).
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
