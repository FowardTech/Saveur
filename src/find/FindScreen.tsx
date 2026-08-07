import React, { memo } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import { DATA_INTERVIEW_TYPES } from 'constants/Data';
import { Interview_Type_Enum } from 'constants/Types';
import * as configService from 'services/configService';
import { getInterviewTypeLabel } from 'utils/interviewTypeLabels';
import ThemeContext from '../../ThemeContext';
import { tileColorAt } from 'styles/tileColors';

// "Practice" tab — the entry point for AI mock interviews. Lets a candidate
// jump straight into a category, or open the full setup wizard (mode /
// difficulty / timed). TODO: interview-type cards below are static; wire to
// real content packs & personalized recommendations later.
const FindScreen = memo(() => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const { t } = useTranslation(['find', 'common', 'more']);
  // Product follow-up ("leave the cards in this screen white background as
  // they are before but you can give them different colors in the dark
  // mode") — the Tools/Interview Types grids below stay plain white in
  // light mode (unchanged from before the reskin) but pick up the same
  // rotating pastel palette every other screen's stat tiles use once dark
  // mode is on, so this screen isn't a wall of identical dark-navy cards
  // while everywhere else in dark mode has color variety.
  const { theme: appTheme } = React.useContext(ThemeContext);
  const isDarkMode = appTheme === 'dark';

  const onStartSetup = (interviewType?: Interview_Type_Enum) => {
    navigate('MockInterviewSetup', { interviewType });
  };

  // eva outline icons (see constants/Data.ts's DATA_INTERVIEW_TYPES comment
  // for why — same reasoning applies here, this row used to mix the custom
  // "assets" pack's filled 'myPost' badge icon with thinner line-art ones).
  // Coding Practice tile removed (product request) — the underlying
  // feature is untouched, still reachable from MockInterviewSetup's own
  // "Coding" option; this was just an extra shortcut entry point here.
  const TOOLS = [
    { title: t('more:resume_builder', { defaultValue: 'Resume Builder' }), icon: 'file-text-outline', onPress: () => navigate('ResumeBuilder') },
    { title: t('more:jd_analyzer', { defaultValue: 'JD Analyzer' }), icon: 'search-outline', onPress: () => navigate('JDAnalyzer') },
    // Practical Scenarios (product request) — the hands-on equivalent of
    // Coding Practice for non-engineering tracks. Routes to a setup screen
    // (pick a field + role) rather than starting immediately, since it
    // needs that choice first.
    ...(configService.isFeatureEnabled('practical_scenarios')
      ? [{ title: t('find:practical_scenarios', { defaultValue: 'Practical Scenarios' }), icon: 'compass-outline', onPress: () => navigate('PracticalScenarioSetup') }]
      : []),
  ];

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('find:title')} />
      <Content contentContainerStyle={styles.content} padder>
        {/* Product bug report ("the gradient is very bad and ugly, it's
            hiding some of the text") — root cause was using LinearGradient
            itself as the padded, flex-direction:'column' content
            container. A LinearGradient sized only by `flex`/no explicit
            height doesn't reliably grow to wrap its own children's real
            intrinsic height on every layout pass (the exact same class of
            bug documented on HomeSrc.tsx's checkInCard history — "a
            full-size LinearGradient... doesn't reliably grow to wrap its
            own children's intrinsic height in every layout pass"), so the
            subtitle/button text was getting laid out past the gradient's
            measured box and clipped by `overflow:'hidden'`. Fixed the same
            way checkInCard already solves it: the gradient is now a
            `StyleSheet.absoluteFillObject` DECORATIVE layer sized by its
            plain-View parent, with the real text content in an ordinary
            View sibling that sizes normally. Also dropped the extra corner
            "accent" wash (it was fighting the main fill for attention,
            part of why it read as messy) in favor of one clean, richer
            two-stop gradient — light mode uses the same brand blue family
            (color-primary-200/700) but with more real contrast between the
            stops so it reads as an intentional gradient rather than a
            washed-out near-flat fill; dark mode gets its own subtle two-
            tone dark-navy gradient (two adjacent background-basic-color
            tokens) instead of a flat single shade, so it still looks
            "designed" without ever being blue. */}
        {/* <TouchableOpacity activeOpacity={0.9} onPress={() => onStartSetup()}>
          <View style={styles.hero}>
            <View style={styles.heroInner}>
              <LinearGradient
                colors={isDarkMode ? [theme['background-basic-color-2'], theme['background-basic-color-2']] : [theme['color-primary-500'], theme['color-primary-500']]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text
                category="h3"
                bold
                mb={8}
                style={{ color: isDarkMode ? theme['color-badge-info-text'] : '#fff' }}>
                {t('find:start_mock_interview')}
              </Text>
              <Text
                category="h8-s"
                mb={16}
                style={{ color: isDarkMode ? theme['color-badge-info-text'] : 'rgba(255,255,255,0.9)' }}>
                {t('find:start_mock_interview_description')}
              </Text>
              <View style={styles.heroButton}>
                <Text
                  style={{ color: isDarkMode ? theme['color-badge-info-text'] : '#fff' }}
                  category="h8"
                  bold>
                  {t('find:choose_type_mode')}
                </Text>
                <Icon
                  pack="assets"
                  name="arrowRight"
                  style={[globalStyle.icon16, { tintColor: isDarkMode ? theme['color-badge-info-text'] : theme['text-control-color'] }]}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity> */}
{/* 
        <Text category="h6" bold mt={32} mb={16}>
          {t('find:tools')}
        </Text> */}
        {/* Product request — drop the Coding Practice tile (still reachable
            from MockInterviewSetup's own Coding option) and restack the
            remaining tiles as full-width rows instead of a 3-wide square
            grid, per explicit reference. */}
        <View style={{marginTop: 10,}}>
          {TOOLS.map((tool, i) => {
            const tile = tileColorAt(i);
            const bg = isDarkMode ? theme[tile.bg] : theme['background-basic-color-2'];
            const fg = isDarkMode ? theme[tile.text] : theme['text-basic-color'];
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={tool.onPress}
                style={[styles.toolRow, { backgroundColor: bg }]}>
                <View style={[styles.toolIconWrap, { backgroundColor: isDarkMode ? theme['transparent'] : theme['background-basic-color-1'] }]}>
                  <Icon
                    pack="eva"
                    name={tool.icon}
                    style={[globalStyle.icon20, { tintColor: fg }]}
                  />
                </View>
                <Text category="h9" bold numberOfLines={1} style={[styles.toolLabel, { color: fg }]}>
                  {tool.title}
                </Text>
                <Icon
                  pack="eva"
                  name="arrow-forward-outline"
                  style={[globalStyle.icon16, { tintColor: fg }]}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text category="h6" bold mt={40} mb={16}>
          {t('find:interview_types')}
        </Text>
        <View style={styles.typesGrid}>
          {DATA_INTERVIEW_TYPES.map((item, i) => {
            const tile = tileColorAt(i);
            const bg = isDarkMode ? theme[tile.bg] : theme['background-basic-color-2'];
            const fg = isDarkMode ? theme[tile.text] : theme['text-basic-color'];
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => onStartSetup(item.type)}
                style={[styles.typeCard, { backgroundColor: bg }]}>
                <Icon
                  pack="eva"
                  name={item.icon}
                  style={[globalStyle.icon24, { tintColor: fg }]}
                />
                <Text category="h9" mt={12} bold numberOfLines={2} style={{ color: fg }}>
                  {getInterviewTypeLabel(item.type, t)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Content>
    </Container>
  );
});

export default FindScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  // Purely a shadow-casting shell — the real fill lives on heroInner's
  // absolute-positioned LinearGradient (see the JSX comment). Static
  // backgroundColor here is just an opaque Android shadow fallback (see
  // globalStyle.card's own comment on why that needs a real color); it's
  // always fully covered by the gradient, so its exact value doesn't
  // matter.
  hero: {
    ...globalStyle.card,
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: 'color-primary-500',
  },
  // Plain View, NOT a LinearGradient — the gradient is a decorative
  // absoluteFillObject layer behind this box's normal-flow text content
  // instead (see the JSX comment for why that matters for correct
  // sizing).
  heroInner: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    padding: 24,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Full-width stacked rows (product request — was a 3-wide square tile
  // grid, now each tool "covers full length width" and stacks on top of
  // each other instead).
  toolRow: {
    ...globalStyle.card,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'background-basic-color-2',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  toolIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    flex: 1,
    marginLeft: 12,
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  typeCard: {
    ...globalStyle.card,
    width: '48%',
    borderRadius: 14,
    // Redesign v2 (full reskin): opaque fill again so `card`'s shadow
    // renders correctly on Android (was 'transparent').
    backgroundColor: 'background-basic-color-2',
    padding: 16,
    marginBottom: 16,
  },
});
