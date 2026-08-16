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
import { getSignupOnboardingImage, SignupOnboardingImagesConfig } from 'services/configService';
import OnboardingIconArt from './OnboardingIconArt';

/** Admin-uploaded override photo for one signup-carousel slide (Admin >
 * Content > Onboarding > Signup Carousel), if one exists — see DATA's own
 * REDESIGN comment in the component below for how this is now used
 * (only ever shown in place of the new default icon-cluster art, not in
 * place of the old bundled phone-mockup asset, which no longer renders by
 * default at all). */
function overrideImageUri(key: keyof SignupOnboardingImagesConfig): string | null {
  return getSignupOnboardingImage(key);
}

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
  // get free ones online that looks very good and modern") went through two
  // sourced-online passes (unDraw, both times) that the product owner
  // rejected as not matching the polish of a reference screenshot they
  // shared — a phone-mockup hero with floating drop-shadowed cards, a warm
  // gradient backdrop, and flat-but-colorful characters. Rather than keep
  // hunting for a free pack that happens to match that exact reference
  // (DrawKit, ManyPixels, Humaaans, Open Doodles, and the full 1,263-
  // illustration unDraw catalog were all evaluated first — see
  // assets/images/index.ts's comment for the full trail), these 5 are
  // original artwork, hand-built in code to match the reference's design
  // system: floating rounded cards with soft colored (never flat-black)
  // blurred drop shadows and a slight rotation, plus scattered decorative
  // sparkle/dot/plus/ring accents.
  //
  // TWO FOLLOW-UP FIXES after the first custom-artwork pass:
  // 1) "I need a human like illustration... the one you created is like a
  // cartoon" — the first pass drew each character as a circle head sitting
  // directly on a dome-shaped torso (no neck/shoulders/limbs), which reads
  // as an avatar icon, not a person. Rebuilt as a properly-proportioned
  // seated figure instead — real neck, hourglass torso (shoulders wider
  // than waist), two-segment arms with visible hands, and crossed legs —
  // matching the reference's actual human anatomy rather than a mascot.
  // 2) "why are you always giving the illustrations a square background...
  // they have to be transparent" — the canvas used to have an opaque
  // corner-to-corner gradient fill; it's a transparent PNG now (only the
  // two soft blurred color blobs paint anything, as real per-pixel alpha,
  // so they blend into this screen's own background instead of showing a
  // hard rectangle edge).
  //
  // "you are placing them at the left of the screen where they are
  // touching the edge" was actually a separate, unrelated layout bug in
  // this file, not the artwork — see the `alignSelf: 'center'` fix and
  // comment on `styles.image` below.
  //
  // SIXTH PASS — the product owner found and uploaded 5 finished
  // illustrations that already match the reference exactly (real human
  // characters, gradient-shaded floating phone-mockup + drop-shadowed
  // cards, warm gradient backdrop): "Now i got the perfect ones". These
  // replace the hand-built design-kit artwork above, which is no longer
  // used by this screen (kept for history in the comment, not deleted from
  // git log). A first attempt at processing these (converting from the
  // uploaded SVGs through a local SVG renderer) lost real fidelity —
  // missing font caused visible headline text-overflow, and the renderer
  // flattened each file's transparent background — so the product owner
  // re-uploaded the original full-resolution PNG exports directly
  // ("Sorry this are the real illustrations use these ones") and this
  // pass processes those source files instead.
  //
  // Each source file is a full "hero" composition — headline (and on some
  // slides a subtitle) text baked into the image as pixels, above the same
  // phone-mockup + floating-card illustration. That baked headline/
  // subtitle text was cropped out for two real reasons, not just a style
  // preference: (1) it isn't translatable, and this screen's whole reason
  // for the top-right language picker is that onboarding copy has to
  // switch with `i18n`'s SUPPORTED_LANGUAGES — baked pixel text can't;
  // (2) it duplicates this screen's own `i.title`/`i.subtitle` <Text>
  // above, which already renders that same copy in the app's real font.
  // Text baked *inside* the phone-mockup screen itself (e.g. "Hi, Alex!",
  // "Overall Match", "Explore insights") was kept — that's illustrated
  // fake-app-UI content, the same category as a stock photo of someone
  // using an app, not a competing copy of this screen's own text. Each
  // source PNG's transparent background (real alpha, not a flattened
  // rectangle) was preserved as-is, so no card/box reads behind the
  // artwork. `aspect` below is each cropped PNG's own measured ratio —
  // they genuinely differ per slide (interview/job_alert/resume_scan/
  // learning are close to square-ish landscape, feedback is closer to
  // portrait) because each source composition is a different shape, not a
  // bug.
  //
  // interview's asset was swapped once more in this same pass: this
  // screen's rough rectangular crop (of the SVG-derived, then PNG-derived,
  // source) was replaced with a tighter crop the product owner supplied
  // directly, trimmed to the illustration's own content bounds rather than
  // an eyeballed rectangle — same content (no headline, transparent
  // background), just a cleaner edge.
  // Product request: "implement the ability to upload the app onboarding
  // images i.e the one at signup. Admin should be able to upload the
  // images for it... single image upload for the [5] onboarding screen
  // that is in the signup part" — each slide still prefers an admin-
  // uploaded override (Admin > Content > Onboarding > Signup Carousel) over
  // its own default art, checked via `configKey` + getSignupOnboardingImage()
  // at the render call site below. No per-language variant here (unlike the
  // Job Alerts/Learning Courses onboarding banners) — this carousel's
  // headline/subtitle text was deliberately cropped OUT of each source
  // image and rebuilt as the translatable <Text> above, so the illustration
  // itself has nothing baked in that needs localizing.
  //
  // REDESIGN (product request: "In the app onboarding I want you to replace
  // those illustrations with the appropriate icons from this [icon pack —
  // 36 real icons8 PNGs the product owner downloaded and uploaded as a
  // zip]... or even a combination of icons just to illustrate
  // appropriately") — the bundled `Images.onboardingX` phone-mockup PNGs
  // (see this file's own long module comment above for that illustration's
  // full history) are no longer each slide's DEFAULT art; each slide now
  // instead pairs a `primaryIcon` (the main idea) with a smaller `accentIcon`
  // badge (a second, related idea) via OnboardingIconArt.tsx, only falling
  // back to the old bundled asset for a slide if an admin has ALSO
  // separately uploaded a real replacement photo for it (see the render
  // call site's `overrideUri` check) — that admin-upload feature still
  // works exactly as before, it just no longer competes with a bundled
  // "default" hero photo that doesn't exist anymore.
  // Per-slide icon reasoning:
  //  1. Interview practice with an AI coach -- discussion bubbles (the
  //     interview conversation itself) + an AI-sparkle badge (the "AI
  //     coach" half of the sentence).
  //  2. Instant feedback on confidence/clarity/skills -- a lightbulb-in-a-
  //     head icon (clarity/insight) + a checkmark badge (the actual
  //     feedback verdict).
  //  3. First-hand Job Alert -- a megaphone (the alert itself) + a
  //     briefcase-and-gear badge (the job it's alerting about).
  //  4. Get past the resume scanners -- an agenda/document icon (the
  //     résumé) + a shield-with-checkmark badge (passing the ATS check --
  //     the most literal icon-to-copy match in this whole set).
  //  5. Learn one course at a time -- an open book (learning itself) + a
  //     graduation cap badge (reusing HomeSrc.tsx's Career Toolkit "Courses"
  //     icon, same idea in both places).
  // `tintColor` is each backdrop circle's soft brand tint, one distinct hue
  // per slide so the carousel doesn't read as five identical gray circles.
  const DATA = [
    {
      id: 0,
      title: t('intro:title_1'),
      subtitle: t('intro:subtitle_1'),
      configKey: 'interview' as const,
      fallbackImage: Images.onboardingInterview,
      aspect: 1600 / 1537,
      primaryIcon: Images.iconDiscussionBubbles,
      accentIcon: Images.iconAiStars,
      tintColor: 'rgba(0,99,248,0.10)',
    },
    {
      id: 1,
      title: t('intro:title_2'),
      subtitle: t('intro:subtitle_2'),
      configKey: 'feedback' as const,
      fallbackImage: Images.onboardingFeedback,
      aspect: 1600 / 1530,
      primaryIcon: Images.iconLightbulbHead,
      accentIcon: Images.iconCheck,
      tintColor: 'rgba(245,158,11,0.12)',
    },
    {
      id: 2,
      title: t('intro:title_3'),
      subtitle: t('intro:subtitle_3'),
      configKey: 'job_alert' as const,
      fallbackImage: Images.onboardingJobAlert,
      aspect: 1600 / 1211,
      primaryIcon: Images.iconMegaphone,
      accentIcon: Images.iconBriefcaseGear,
      tintColor: 'rgba(249,115,22,0.12)',
    },
    {
      id: 3,
      title: t('intro:title_4'),
      subtitle: t('intro:subtitle_4'),
      configKey: 'resume_scan' as const,
      fallbackImage: Images.onboardingResumeScan,
      aspect: 1600 / 1217,
      primaryIcon: Images.iconAgendaDocument,
      accentIcon: Images.iconShieldCheck,
      tintColor: 'rgba(124,58,237,0.10)',
    },
    {
      id: 4,
      title: t('intro:title_5'),
      subtitle: t('intro:subtitle_5'),
      configKey: 'learning' as const,
      fallbackImage: Images.onboardingLearning,
      aspect: 1600 / 1369,
      primaryIcon: Images.iconOpenBook,
      accentIcon: Images.iconGraduationCap,
      tintColor: 'rgba(13,148,136,0.10)',
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
              const overrideUri = overrideImageUri(i.configKey);
              return (
                <Animated.View key={index} style={style}>
                  {/* Product follow-up history: "why did you reduce the size
                      of the onboarding header text it should be an H2 or
                      H3" -- was bumped to an explicit 34px/lineHeight 42 on
                      top of category="h2" (30px default). Immediate
                      follow-up: "I think the onboarding header text is too
                      big give it an h5" -- category swapped to "h5"
                      (constants/theme/mapping.json's
                      text-heading-5-font-size, 25px) and the explicit
                      fontSize/lineHeight override removed from
                      styles.title so the h5 mapping's own size/line-height
                      (25/30, see Text.tsx's getLineHeight) actually takes
                      effect instead of being overridden by a leftover
                      bigger value. */}
                  <Text category="h5" bold mh={24} style={styles.title}>
                    {i.title}
                  </Text>
                  <Text category="h8" status="placeholder" mh={24} mt={8} style={styles.subtitle}>
                    {i.subtitle}
                  </Text>
                  {/* Bug reports (legacy, applies only to the admin-override
                      path below): "Why are you placing the illustrations in
                      a gray card and also the illustrations are not at the
                      center." Both came from the same root cause — a fixed
                      1:0.72 box didn't match any of these illustrations'
                      own real aspect ratio (they range 1.16-1.43), so
                      resizeMode="contain" left uneven empty margin on top/
                      bottom vs. left/right per image, and that box's
                      background-basic-color-3 fill showed through the gap
                      as a visible gray card behind the artwork. Sizing the
                      box to each image's own measured aspect ratio instead
                      (DATA's `aspect`, no backgroundColor) means the image
                      fills its box edge-to-edge with no letterboxing gap
                      and nothing behind it to read as a "card".
                      REDESIGN (see DATA's own comment above) — this now
                      only renders that old full-image box when an admin has
                      uploaded a real replacement photo for this specific
                      slide; otherwise it renders the new icon-cluster
                      illustration instead. */}
                  {overrideUri ? (
                    <View style={[styles.image, { width: width * 0.86, height: (width * 0.86) / i.aspect }]}>
                      <Image
                        source={{ uri: overrideUri }}
                        resizeMode="contain"
                        style={{ width: '100%', height: '100%' }}
                      />
                    </View>
                  ) : (
                    <View style={styles.iconArtWrap}>
                      <OnboardingIconArt
                        primaryIcon={i.primaryIcon}
                        accentIcon={i.accentIcon}
                        tintColor={i.tintColor}
                        size={Math.min(width * 0.46, 200)}
                        pageBackgroundColor={theme[isDarkMode ? 'background-basic-color-1' : 'background-basic-color-2']}
                      />
                    </View>
                  )}
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
  // See the render call site's own comment -- was an explicit
  // fontSize:34/lineHeight:42 override on top of category="h2"; product
  // follow-up ("too big, give it an h5") swapped the category to "h5" and
  // removed the override entirely so the h5 mapping's own smaller default
  // (25px/lineHeight 30) actually applies instead of being overridden.
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
    // BUG FIX (report: "you are placing them at the left of the screen
    // where they are touching the edge"): this box is only 86% of the
    // slide's width (`width * 0.86` at the call site), sitting inside a
    // full-width Animated.View. Without an explicit alignSelf, a child
    // with its own fixed width defaults to the flex-start edge — flush
    // left, not centered — which is exactly what left that 14% margin
    // entirely on the right and none on the left. alignItems/
    // justifyContent below only ever centered the <Image> *inside* this
    // box; they never centered the box itself within its parent.
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    // Report: "stop wrapping the illustrations in a box" — this never had
    // a backgroundColor, but borderRadius + overflow:hidden still gave it
    // a rounded clipping boundary, which combined with the image's own
    // faint edge (even fully transparent PNGs get *some* anti-aliasing at
    // their outer bounds) was enough to read as a "box" around the
    // artwork. Neither is needed — the box is always sized to the image's
    // own aspect ratio, so there's nothing to clip.
  },
  // REDESIGN — wraps OnboardingIconArt (see DATA's own comment above).
  // Centered the same way `image` is above; OnboardingIconArt sizes its own
  // content internally (its `size` prop), this wrapper just needs to be a
  // centered flex container with matching vertical breathing room.
  iconArtWrap: {
    marginVertical: 24,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
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
    // Google-style furnishing pass (see src/home/QuickActionGrid.tsx's own
    // comment / styles/globalStyle.ts's `card`) -- 14 -> 20.
    borderRadius: 20,
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
