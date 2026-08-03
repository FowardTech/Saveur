import React, { memo } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import { DATA_INTERVIEW_TYPES } from 'constants/Data';
import { Difficulty_Enum, Interview_Type_Enum, Practice_Mode_Enum } from 'constants/Types';
import * as interviewService from 'services/interviewService';
import * as configService from 'services/configService';
import { getSessionEntitlement } from 'services/entitlementsService';
import { getInterviewTypeLabel } from 'utils/interviewTypeLabels';
import { AuthContext } from '../../AuthContext';
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
  const { subscription } = React.useContext(AuthContext);
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

  // Starts a real session (same as MockInterviewSetup does for a Coding
  // pick) so this shortcut actually shows up in Practice History instead of
  // silently skipping session tracking. Was previously a bare, unguarded
  // await with no try/catch and no busy-state — a free user past their
  // session cap (or anyone hitting a network blip) tapped this and saw
  // nothing happen at all: no error, no upgrade prompt, no spinner, and
  // rapid re-taps could fire duplicate session-creation calls. Now mirrors
  // MockInterviewSetup.tsx's onStart exactly: pre-checks entitlement so a
  // capped free user gets the real upgrade prompt instead of a raw backend
  // error, guards against double-taps, and surfaces any failure.
  const [isStartingCoding, setIsStartingCoding] = React.useState(false);
  const onStartCodingPractice = async () => {
    if (isStartingCoding) return;
    setIsStartingCoding(true);
    try {
      const entitlement = await getSessionEntitlement(subscription);
      if (!entitlement.canStart) {
        Alert.alert(
          t('find:free_limit_reached_title', { defaultValue: "You've used your free sessions" }),
          t('find:free_limit_reached_body', {
            limit: entitlement.sessionsLimit ?? 5,
            defaultValue: `Free plans include ${entitlement.sessionsLimit ?? 5} practice sessions a month. Upgrade to Pro for unlimited practice.`,
          }),
          [
            { text: t('common:cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
            {
              text: t('find:upgrade_to_pro', { defaultValue: 'Upgrade to Pro' }),
              onPress: () => navigate('Subscription'),
            },
          ],
        );
        return;
      }
      const { sessionId } = await interviewService.startSession({
        interviewType: Interview_Type_Enum.Coding,
        mode: Practice_Mode_Enum.Text,
        difficulty: Difficulty_Enum.Intermediate,
        timed: true,
      });
      navigate('CodingInterview', { sessionId, interviewType: Interview_Type_Enum.Coding });
    } catch (e: any) {
      // See MockInterviewSetup.tsx's identical branch for why llm_unavailable
      // gets its own copy instead of just showing e.message.
      const body = e?.error === 'llm_unavailable'
        ? t('find:interview_unavailable_body', {
            defaultValue: 'Video, voice, and text interviews are temporarily unavailable. Please try again later.',
          })
        : e?.message ?? t('common:something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' });
      Alert.alert(
        t('find:start_interview_failed', { defaultValue: 'Could not start interview' }),
        body,
      );
    } finally {
      setIsStartingCoding(false);
    }
  };

  // eva outline icons (see constants/Data.ts's DATA_INTERVIEW_TYPES comment
  // for why — same reasoning applies here, this row used to mix the custom
  // "assets" pack's filled 'myPost' badge icon with thinner line-art ones).
  const TOOLS = [
    { title: t('more:resume_builder', { defaultValue: 'Resume Builder' }), icon: 'file-text-outline', onPress: () => navigate('ResumeBuilder'), loading: false },
    { title: t('more:jd_analyzer', { defaultValue: 'JD Analyzer' }), icon: 'search-outline', onPress: () => navigate('JDAnalyzer'), loading: false },
    // Admin-configurable — see the Feature Flags page / services/configService.ts.
    ...(configService.isFeatureEnabled('coding_practice')
      ? [{ title: t('more:coding_practice', { defaultValue: 'Coding Practice' }), icon: 'code-outline', onPress: onStartCodingPractice, loading: isStartingCoding }]
      : []),
    // Practical Scenarios (product request) — the hands-on equivalent of
    // Coding Practice for non-engineering tracks. Routes to a setup screen
    // (pick a field + role) rather than starting immediately like Coding
    // Practice does, since it needs that choice first.
    ...(configService.isFeatureEnabled('practical_scenarios')
      ? [{ title: t('find:practical_scenarios', { defaultValue: 'Practical Scenarios' }), icon: 'compass-outline', onPress: () => navigate('PracticalScenarioSetup'), loading: false }]
      : []),
  ];

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('find:title')} />
      <Content contentContainerStyle={styles.content} padder>
        {/* Product bug report ("the cards ... should not be blue in dark
            mode, they should be well designed to blend well with the dark
            mode") — was a flat solid-blue fill in BOTH themes. Now the same
            recipe as Home's checkInCard/homeBannerFallback: theme-aware
            surface (solid brand blue in light mode, 'background-basic-
            color-2' dark-navy surface in dark mode) with a soft blue
            gradient wash in the corner so the brand color still reads
            without ever being a flat saturated block on a near-black
            screen. Outer/inner split so the accent + overflow:'hidden'
            clip to the rounded corners without also clipping the card's
            shadow (a View can't cast a shadow and clip its own content at
            the same time — see checkInCard's own comment for the same
            reasoning). */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => onStartSetup()}>
          <View style={[styles.hero, isDarkMode && { backgroundColor: theme['background-basic-color-2'] }]}>
            <View style={styles.heroInner}>
              <LinearGradient
                pointerEvents="none"
                colors={isDarkMode ? ['rgba(0, 99, 248, 0.22)', 'rgba(29, 161, 242, 0.04)'] : ['transparent', 'transparent']}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.15, y: 0.9 }}
                style={styles.heroAccent}
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
                style={{ color: isDarkMode ? theme['color-badge-info-text'] : 'rgba(255,255,255,0.85)' }}>
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
        </TouchableOpacity>

        <Text category="h6" bold mt={32} mb={16}>
          {t('find:tools')}
        </Text>
        <Flex justify="space-between" wrap>
          {TOOLS.map((tool, i) => {
            const tile = tileColorAt(i);
            const bg = isDarkMode ? theme[tile.bg] : theme['background-basic-color-2'];
            const fg = isDarkMode ? theme[tile.text] : theme['text-basic-color'];
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={tool.onPress}
                disabled={tool.loading}
                style={[styles.toolCard, { backgroundColor: bg }]}>
                {tool.loading ? (
                  <Spinner size="small" />
                ) : (
                  <Icon
                    pack="eva"
                    name={tool.icon}
                    style={[globalStyle.icon24, { tintColor: fg }]}
                  />
                )}
                <Text category="h9" center mt={8} bold numberOfLines={2} style={{ color: fg }}>
                  {tool.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Flex>

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
  // Solid brand blue in light mode; dark mode overrides to
  // 'background-basic-color-2' inline (see JSX comment above).
  hero: {
    ...globalStyle.card,
    marginTop: 16,
    borderRadius: 24,
    backgroundColor: 'color-primary-500',
  },
  heroInner: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    padding: 24,
  },
  heroAccent: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolCard: {
    ...globalStyle.card,
    width: '30%',
    aspectRatio: 1,
    borderRadius: 20,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill to render correctly on Android (was
    // 'transparent' for the earlier border-only direction).
    backgroundColor: 'background-basic-color-2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    // Was 0 — with no horizontal breathing room, longer labels like
    // "Resume Builder" wrapped right up against the card's rounded edges.
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  typeCard: {
    ...globalStyle.card,
    width: '48%',
    borderRadius: 20,
    // Redesign v2 (full reskin): opaque fill again so `card`'s shadow
    // renders correctly on Android (was 'transparent').
    backgroundColor: 'background-basic-color-2',
    padding: 16,
    marginBottom: 16,
  },
});
