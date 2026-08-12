import React, { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
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
import Flex from 'components/Flex';
import BrandWordmark from 'components/BrandWordmark';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as coachService from 'services/coachService';
import { SuggestedTopic } from 'services/coachService';
import { AuthContext } from '../../AuthContext';
import * as configService from 'services/configService';
import ThemeContext from '../../ThemeContext';

// Reference-redesign follow-up chip palette for the Suggested Topics grid
// below — same small pastel-tint system Home's own "More for you" rows
// use (see src/home/HomeSrc.tsx), cycled by index since a topic is just
// dynamic AI-generated text with no icon/category of its own.
const TOPIC_CHIP_STYLES: { bg: string; icon: string; iconColor: string }[] = [
  { bg: 'rgba(139, 92, 246, 0.08)', icon: 'message-square-outline', iconColor: '#8B5CF6' },
  { bg: 'rgba(126, 168, 226, 0.12)', icon: 'trending-up-outline', iconColor: '#7EA8E2' },
  { bg: 'rgba(216, 90, 48, 0.08)', icon: 'bulb-outline', iconColor: '#D85A30' },
  { bg: 'rgba(29, 158, 117, 0.08)', icon: 'briefcase-outline', iconColor: '#1D9E75' },
];

// "Coach" tab — the AI career coach is a single persistent contact, not a
// caregiver-style inbox. Tapping the hero card or any suggested topic opens
// the same Chat thread. Suggested topics are now real — see
// services/coachService.ts's getSuggestedTopics (backend-first, falls back
// to topics generated from the user's own signup goals/desiredRoles rather
// than a fixed list, so this no longer shows the same 3 topics to everyone).
const MessagesScreen = memo(() => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['message', 'common']);
  const { profile } = React.useContext(AuthContext);
  const { theme: appTheme } = React.useContext(ThemeContext);
  const isDarkMode = appTheme === 'dark';

  const onOpenChat = React.useCallback(() => {
    navigate('MessagesStack', { screen: 'Chat' });
  }, [navigate]);

  // Tapping a specific suggested topic used to open the exact same blank
  // Chat thread as every other topic and the hero card — the topic itself
  // was decorative. Now it opens Chat with that topic's own text as the
  // opening question, auto-sent to the real coach backend (see
  // Chat.tsx's initialPrompt handling).
  const onOpenTopic = React.useCallback((prompt: string) => {
    navigate('MessagesStack', { screen: 'Chat', params: { initialPrompt: prompt } });
  }, [navigate]);

  const [topics, setTopics] = React.useState<SuggestedTopic[]>([]);
  React.useEffect(() => {
    coachService
      .getSuggestedTopics({ goals: profile?.goals, desiredRoles: profile?.desiredRoles })
      .then(setTopics)
      .catch(() => { });
  }, [profile?.goals, profile?.desiredRoles]);

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('message:title').toString()} />
      <Content contentContainerStyle={styles.content} padder>
        {/* Product bug report ("you did not touch the second [card]" — this
            hero, the "AI Career Coach" card on the Coach tab, is a
            different card than the ones already fixed on Home/Practice; it
            had never been given a gradient or a dark-mode design at all,
            just a flat `button-basic-color` fill. Same fix pattern as
            those cards: the gradient is a decorative
            StyleSheet.absoluteFillObject layer behind Flex's own normal-
            flow row content (Flex already renders a plain TouchableOpacity,
            so — unlike a LinearGradient used as the container itself —
            this sizes/pads correctly with no clipping risk). Light mode
            gets a real two-stop brand-blue gradient (color-primary-200/
            700); dark mode gets its own two-tone dark-navy gradient
            (background-basic-color-2/3) instead of inheriting the light
            mode's blue. */}
        <Flex
          style={styles.hero}
          justify="flex-start"
          itemsCenter
          onPress={onOpenChat}>
          <LinearGradient
            colors={
              isDarkMode
                ? [theme['background-basic-color-2'], theme['background-basic-color-2']]
                : ['#9DBFEF', '#7EA8E2']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.heroAvatar}>
            {/* Product request — strip the logo's baked-in white/gray
                badge background and render just the "S" shape as a white
                line mark so it blends into the gradient instead of
                floating on its own light badge (see BrandWordmark's
                markColor prop comment). Same isDarkMode text-color pattern
                already used for this card's title/subtitle/arrow so the
                mark stays visually consistent with the rest of the card
                in both themes. */}
            <BrandWordmark
              markOnly
              size={40}
              markColor={isDarkMode ? theme['color-badge-info-text'] : '#fff'}
            />
          </View>
          <View style={globalStyle.flexOne}>
            <Text
              category="h6"
              bold
              style={{ color: isDarkMode ? theme['color-badge-info-text'] : '#fff' }}>
              {t('message:ai_coach_name', { defaultValue: 'AI Career Coach' })}
            </Text>
            <Text
              category="h9-s"
              mt={4}
              numberOfLines={2}
              style={{ color: isDarkMode ? theme['color-badge-info-text'] : 'rgba(255,255,255,0.9)' }}>
              {t('message:ai_coach_subtitle', {
                defaultValue: 'Ask me anything about your job search — I’m here to help.',
              })}
            </Text>
          </View>
          <Icon
            pack="assets"
            name="arrowRight"
            style={[globalStyle.icon16, { tintColor: isDarkMode ? theme['color-badge-info-text'] : '#fff' }]}
          />
        </Flex>

        {configService.isFeatureEnabled('salary_negotiation') && (
          <Flex
            style={styles.negotiationCard}
            justify="flex-start"
            itemsCenter
            onPress={() => navigate('SalaryNegotiation')}>
            <View style={globalStyle.flexOne}>
              <Text category="h7" bold>
                {t('message:salary_negotiation_title', { defaultValue: 'Salary Negotiation Simulator' })}
              </Text>
              <Text category="h9-s" status="placeholder" mt={4}>
                {t('message:salary_negotiation_description', {
                  defaultValue: 'Practice countering a mock offer over a few rounds.',
                })}
              </Text>
            </View>
            {/* BUG FIX: this Lucide-backed icon defaults to near-black when
                unstyled (see assets/lucideIcon.tsx) — invisible in dark
                mode. Same fix as HomeSrc.tsx's "upcoming session" card. */}
            <Icon pack="assets" name="arrowRight" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
          </Flex>
        )}

        <Text category="h6" bold mt={32} mb={16}>
          {t('message:suggested_topics', { defaultValue: 'Suggested Topics' })}
        </Text>
        {/* Reference-redesign follow-up ("the suggested topics should be
            in the AI coach screen... leave salary negotiation simulator
            card alone") — was a plain text-row list (see git history);
            now a 2-up chip grid, each cycling through the same small
            pastel-tint palette Home's own "More for you" rows use, so a
            topic reads as a pickable suggestion chip instead of an inbox
            row. Topics are dynamic AI-generated text with no icon of their
            own (services/coachService.ts's SuggestedTopic is just
            {id, title}), so the icon/tint cycles through a small fixed set
            by index rather than trying to infer one per topic. */}
        <View style={styles.topicGrid}>
          {topics.map((item, i) => {
            const chipStyle = TOPIC_CHIP_STYLES[i % TOPIC_CHIP_STYLES.length];
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                onPress={() => onOpenTopic(item.title)}
                style={[styles.topicChip, { backgroundColor: chipStyle.bg }]}>
                <View style={[styles.topicChipIconWrap, { backgroundColor: '#fff' }]}>
                  <Icon pack="eva" name={chipStyle.icon} style={[globalStyle.icon16, { tintColor: chipStyle.iconColor }]} />
                </View>
                <Text category="h10" bold numberOfLines={2} mt={8}>
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

export default MessagesScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  // Radius bumped 14 -> 20 (Google-style furnishing pass, extended from
  // Home/Practice to this screen -- see src/home/QuickActionGrid.tsx's own
  // comment on the design language).
  hero: {
    marginTop: 16,
    padding: 20,
    borderRadius: 20,
    overflow: 'hidden',
    // Opaque Android shadow fallback only — always fully covered by the
    // absolute-fill gradient rendered as this Flex's first child (see the
    // JSX comment). Flex renders a plain TouchableOpacity/View, so the
    // gradient sits behind its real normal-flow content instead of being
    // the sizing container itself.
    backgroundColor: 'color-primary-500',
    ...globalStyle.shadowBtn,
  },
  heroAvatar: {
    marginRight: 16,
  },
  negotiationCard: {
    ...globalStyle.card,
    borderRadius: 20,
    marginTop: 16,
    padding: 20,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill to render correctly on Android (was
    // 'transparent') — this renders on a plain `<Flex>` with no `level`
    // prop, so the fill has to live here.
    backgroundColor: 'background-basic-color-2',
  },
  // Suggested Topics chip grid (reference-redesign follow-up, see the
  // module-scope TOPIC_CHIP_STYLES/JSX comment above) — replaces the old
  // divider-separated topicRow list.
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  topicChip: {
    width: '48%',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  topicChipIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
