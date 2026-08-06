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
import { Images } from 'assets/images';

const Onboarding = memo(() => {
  const { width, top } = useLayout();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const { t } = useTranslation(['intro', 'auth']);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  // Product request ("redesign onboarding like this reference — round
  // glossy ball graphic, headline, subtext, Sign In/Sign Up — but use the
  // Saveur logo instead of the ball, and make the background white instead
  // of gray"). Container's default gray page level ('3' in light mode,
  // see components/Container.tsx) exists so white cards pop against it
  // elsewhere in the app, but this screen has no cards — just a full-bleed
  // background behind the logo/copy — so it explicitly overrides to level
  // '2' (light.json's true white) in light mode. Dark mode already renders
  // level '1' by default, which is correct as-is, so it's left alone.
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
  // a signed-in user changes their language later.
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
  // Product request ("I want us to use the perfect illustrations... Just
  // get free ones online that looks very good and modern" — icons8/
  // iconscout/streamline referenced) — replaces the earlier real-photo
  // approach (5 hotlinked Pexels stock photos) with proper flat-style
  // illustrations, one per slide topic: a handshake/interview scene for
  // "practice interviews", a charts/analytics dashboard for "instant
  // feedback", a magnifying glass surfacing a candidate for "job alert",
  // resumes getting a green approval check for "resume scanners", and
  // someone studying at a desk for "learn one course at a time". See
  // assets/images/index.ts's own comment on these 5 assets for sourcing/
  // licensing (unDraw, free/no attribution) and why they're bundled PNGs
  // rather than requiring a live network fetch the way the old Pexels URLs
  // did.
  const DATA = [
    {
      id: 0,
      title: t('intro:title_1'),
      subtitle: t('intro:subtitle_1'),
      image: Images.onboardingInterview,
    },
    {
      id: 1,
      title: t('intro:title_2'),
      subtitle: t('intro:subtitle_2'),
      image: Images.onboardingFeedback,
    },
    {
      id: 2,
      title: t('intro:title_3'),
      subtitle: t('intro:subtitle_3'),
      image: Images.onboardingJobAlert,
    },
    {
      id: 3,
      title: t('intro:title_4'),
      subtitle: t('intro:subtitle_4'),
      image: Images.onboardingResumeScan,
    },
    {
      id: 4,
      title: t('intro:title_5'),
      subtitle: t('intro:subtitle_5'),
      image: Images.onboardingLearning,
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
  const onGetHere = React.useCallback(() => {}, []);
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
              return (
                <Animated.View key={index} style={style}>
                  <Text category="h2" bold mh={24} style={styles.title}>
                    {i.title}
                  </Text>
                  <Text category="h8" status="placeholder" mh={24} mt={8} style={styles.subtitle}>
                    {i.subtitle}
                  </Text>
                  {/* Illustrations are landscape (~1.4:1, unlike the old
                      portrait-cropped photos) and shouldn't be cropped the
                      way a photo can be — resizeMode "contain" inside a
                      shorter, wider frame instead of "cover" inside a tall
                      one. */}
                  <View style={[styles.image, { width: width * 0.86, height: width * 0.86 * 0.72, backgroundColor: theme['background-basic-color-3'] }]}>
                    <Image
                      source={i.image}
                      resizeMode="contain"
                      style={{ width: '100%', height: '100%' }}
                    />
                  </View>
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
      {/* <Flex center mb={16}>
        <Text category="h8" status={'placeholder'}>
          {t('intro:find_a_job')}{' '}
        </Text>
        <TouchableOpacity onPress={onGetHere} activeOpacity={0.54}>
          <Text status={'link'} category="h8">
            {t('intro:get_here')}
          </Text>
        </TouchableOpacity>
      </Flex> */}
    </Container>
  );
});

export default Onboarding;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  // BUG FIX (custom fonts not rendering on Android): this used to set
  // `fontWeight: '800'` here to "nudge" the title bolder — since this style
  // object is last in Text's merge order, it won, overriding Text.tsx's own
  // (now-fixed) `fontWeight: 'normal'` back to a numeric weight. On Android,
  // pairing ANY numeric/bold fontWeight with a bundled custom fontFamily
  // (here `bold` already selects the real PlusJakartaSans-Bold.ttf file)
  // makes the font resolver look for a nonexistent suffixed file
  // ("PlusJakartaSans-Bold_bold.ttf") and silently fall back to the system
  // font — so this "nudge" was actually the thing breaking the custom font
  // on this screen. The real bold PlusJakartaSans-Bold.ttf file already
  // provides all the weight available; there's no heavier cut to nudge to.
  title: {},
  subtitle: {
    lineHeight: 20,
  },
  content: {
    marginTop: 56,
    alignItems: 'center',
    flexGrow: 1,
  },
  image: {
    marginVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    overflow: 'hidden',
  },
  login: {
    flex: 1,
    marginRight: 16,
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
    borderRadius: 14,
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
