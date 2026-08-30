import React, {memo} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import i18n from 'i18next';
import Text from 'components/Text';
import NavigationAction from 'components/NavigationAction';
import {
  TopNavigation,
  StyleService,
  useTheme,
  useStyleSheet,
  Icon,
} from '@ui-kitten/components';
import Container from 'components/Container';
import Content from 'components/Content';
import useLayout from 'hooks/useLayout';
import {globalStyle} from 'styles/globalStyle';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {AuthStackParamList} from 'navigation/types';
import {CAREER_GOALS} from 'utils/careerGoalLabels';

const SignupFirstStep = memo(() => {
  const {navigate} = useNavigation<NavigationProp<AuthStackParamList>>();
  const {t} = useTranslation(['auth', 'common']);
  const {width} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);

  // Preferred language is now set earlier, on the onboarding carousel's
  // top-right dropdown (src/onboarding/index.tsx), before the user ever
  // reaches signup — i18n.language already reflects that choice (and
  // persists across a cold restart via AsyncStorage, see
  // EKeyAsyncStorage.preferredLocale / i18n/config.ts's bootstrap restore).
  // Just read it directly rather than re-picking it here; still forwarded
  // via the same route-param chain (SignupSecondStep → SignupThirdStep) into
  // signUp()/updateProfile() as UserProfileProps.locale, unchanged.
  const locale = i18n.language;

  // BUG FIX -- was a locally-duplicated list of the same 10 goals kept "in
  // sync by hand" with src/more/ChangeCareType/index.tsx (the "change it
  // later" equivalent). Deduped onto the shared CAREER_GOALS list
  // (utils/careerGoalLabels.ts), which also fixes the actual bug: `title`
  // used to be forwarded to navigate()/updateProfile() as-is (see onChoose
  // below), permanently baking in whatever language was active at signup
  // and never re-translating on a later language change -- see that file's
  // own top comment for the full story.
  const DATA = React.useMemo(
    () => CAREER_GOALS.map((g, id) => ({id, defaultValue: g.defaultValue, title: t(g.titleKey, {defaultValue: g.defaultValue}), icon: g.icon})),
    [t],
  );
  const [isChoose, setChoose] = React.useState<number>();
  // Product report ("This UI and its layout is bad the cards are arrange
  // irregularly. Maybe you should make them grids of 3 or 4") applied here
  // too, kept in sync with src/more/ChangeCareType/index.tsx's identical
  // fix (same 10-item goal list, see that file's own comment for the full
  // reasoning): was a 120px-scaled 2-column layout using a hand-rolled
  // `marginLeft` parity trick instead of a real grid gap, which is what
  // produced the uneven look. Now a flat 84x84 chip (matching
  // ChangeCareType's own size-reduction pass, which this screen had missed)
  // laid out in 3 fixed-width columns via `content`'s columnGap/rowGap
  // below.
  const sizeBG = 84;
  const onChoose = React.useCallback(
    (i: number) => () => {
      setChoose(i);
      setTimeout(() => {
        // BUG FIX -- was DATA[i].title (the resolved display string); now
        // the stable English defaultValue, same id getCareerGoalLabel
        // expects on the read side (GoalsScreen.tsx). Nothing between here
        // and updateProfile (SignupSecondStep -> SignupThirdStep) ever
        // renders `goal` as visible text, so this is safe to change.
        navigate('SignupSecondStep', {goal: DATA[i].defaultValue, locale});
      }, 1000);
    },
    [navigate, DATA, locale],
  );
  return (
    <Container>
      <TopNavigation accessoryLeft={<NavigationAction />} />
      <Content padder>
        <Text mt={16}>{t('auth:heading_signup_1')}</Text>
        {/* BUG FIX (custom fonts not rendering on Android): see Text.tsx's
            comment — an explicit numeric fontWeight fighting a weight-named
            custom fontFamily breaks Android's font file lookup. Removed. */}
        {/* <Text mt={8} mb={24} category="h2" bold>
          {t('auth:title_signup_1')}
        </Text> */}

        <Text mt={24} mb={16} category="h7" bold>
          {t('auth:title_signup_1')}
        </Text>
        <View style={styles.content}>
          {DATA.map((item, i) => {
            return (
              <TouchableOpacity
                key={i}
                style={{
                  // 3 fixed-width columns — see `content`'s columnGap/rowGap
                  // below and this screen's own comment above sizeBG for
                  // the full "irregular grid" fix. Content's `padder` prop
                  // adds 24px horizontal padding each side (48 total),
                  // matching ChangeCareType's identical formula.
                  width: (width - 48 - 24 * 2) / 3,
                  alignItems: 'center',
                }}
                onPress={onChoose(i)}
                activeOpacity={0.54}>
                <View>
                  {/* Was an ImageBackground over assets/images/img_fill.png /
                      img_fillActive.png — flat PNGs with the "unselected"
                      one baked in as light gray, which never adapted to
                      dark mode (a hardcoded light-mode card behind the icon
                      regardless of theme). A plain themed View reproduces
                      the same rounded-square "chip" using the app's theme
                      tokens directly, so it actually flips with the theme. */}
                  <View
                    style={{
                      // Product report: "these cards don't have box shadow.
                      // They should. How does users know they are cards?"
                      // -- this chip only ever got a shadow (shadowBtn, a
                      // colored blue glow meant for primary CTA buttons)
                      // while selected; every unselected chip had none at
                      // all. globalStyle.card's own shadow spread here
                      // instead, unconditionally, on the same View as the
                      // fill/radius below (not the old outer wrapper) so
                      // Android's elevation computes a correctly-rounded
                      // shadow off this View's own opaque backgroundColor.
                      ...globalStyle.card,
                      width: sizeBG,
                      height: sizeBG,
                      // App-wide card standardization (product request:
                      // "all cards in this app has a border radius of 13 or
                      // 14") — was a formula-derived squircle radius, same
                      // fix as ChangeCareType/index.tsx's identical chip.
                      // Google-style furnishing pass (see styles/
                      // globalStyle.ts's `card`) -- 14 -> 20, matching that
                      // same chip's own update.
                      borderRadius: 16,
                      backgroundColor:
                        isChoose === i
                          ? theme['color-primary-500']
                          : theme['background-basic-color-2'],
                      ...globalStyle.center,
                    }}>
                    <Icon
                      pack="eva"
                      name={item.icon}
                      style={{
                        // Matches ChangeCareType/index.tsx's icon-size
                        // reduction alongside the smaller 84x84 chip above
                        // (was 48x48 on a 120px-scaled chip).
                        width: 26,
                        height: 26,
                        tintColor:
                          isChoose === i
                            ? theme['text-control-color']
                            : theme['text-placeholder-color'],
                        zIndex: 10,
                        alignSelf: 'center',
                      }}
                    />
                  </View>
                </View>
                <Text
                  center
                  category="h8"
                  mt={16}
                  status={isChoose === i ? 'link' : 'placeholder'}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Content>
    </Container>
  );
});
export default SignupFirstStep;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Product report: "the cards are arrange irregularly... make them
    // grids of 3 or 4" — was `space-between` with a hand-rolled
    // marginLeft parity trick standing in for real column gaps, which is
    // what made a short last row look uneven. flex-start + explicit gaps
    // (matching ChangeCareType/index.tsx's identical fix) lays every row
    // out identically regardless of how many cards land in it.
    justifyContent: 'flex-start',
    // BUG FIX, kept in sync with src/more/ChangeCareType/index.tsx's
    // identical fix (same 10-item goal grid, see that file's own comment
    // for the full root cause): with no alignItems set, flexbox's default
    // "stretch" cross-axis behavior stretched every card in a row to match
    // its tallest sibling (2-line labels like "Internship / Grad Job" vs
    // 1-line ones like "Promotion"), and each card's own centered content
    // then drifted to different heights -- the "zig-zag" look. flex-start
    // keeps every card at its own natural height so all icon chips align
    // on the same top edge in every row.
    alignItems: 'flex-start',
    rowGap: 24,
    columnGap: 20,
  },
});
