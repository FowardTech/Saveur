import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';

import Text from 'components/Text';
import GradientIconBadge from 'components/GradientIconBadge';
import { globalStyle } from 'styles/globalStyle';

// HOME REDESIGN (product reference — an "AI Earning Coach" card: bot
// avatar, title/subtitle, a row of tappable suggested-question chips, and
// a circular send button). Adapted for Saveur's own Coach feature — the
// suggested prompts are real conversation starters (see HomeSrc.tsx for
// the exact list and why each one), each one deep-links straight into
// Chat.tsx with that text as `initialPrompt` (see navigation/types.tsx's
// MessagesStackParamList.Chat — this param already existed, unused by any
// live call site until now) so tapping a chip actually starts that exact
// conversation instead of just opening a blank thread.
export interface CoachPromptCardProps {
  title: string;
  subtitle: string;
  prompts: string[];
  onPressPrompt: (prompt: string) => void;
  onPressSend: () => void;
}

const CoachPromptCard: React.FC<CoachPromptCardProps> = ({ title, subtitle, prompts, onPressPrompt, onPressSend }) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        {/* Product report ("the AI career coach card chat icon in the
            homescreen, the one after the daily challenge card... the chat
            icon background should be gray and the icon black") -- was a
            solid brand-blue badge (shade=-8) with a white glyph.
            BUG FIX (follow-up product report, screenshot: "this chat icon
            is looking bad in dark mode") -- the original fix for the ask
            above hardcoded the flat light gray as a literal #F0F0F0 hex,
            which doesn't flip for dark mode the way a theme token does; the
            icon tint (`text-basic-color`) DOES flip to near-white in dark
            mode, so the combo became a barely-visible white-on-light-gray
            badge. `background-basic-color-3` is this same theme's own
            "flat gray chip" token (already used a few lines down for the
            prompt chips) -- it resolves to a light gray in light mode
            (same look as before) and a proper dark gray in dark mode, so
            the white icon tint actually reads against it. */}
        <GradientIconBadge color={theme['background-basic-color-3']} size={44} radius={16} shade={0}>
          <Icon pack="eva" name="message-circle-outline" style={{ width: 22, height: 22, tintColor: theme['text-basic-color'] }} />
        </GradientIconBadge>
        <View style={[globalStyle.flexOne, styles.headerText]}>
          <Text category="h9" bold numberOfLines={1}>
            {title}
          </Text>
          <Text category="h10" status="placeholder" numberOfLines={1} mt={2}>
            {subtitle}
          </Text>
        </View>
        <TouchableOpacity activeOpacity={0.8} style={styles.sendButton} onPress={onPressSend}>
          <Icon pack="eva" name="arrow-forward-outline" style={{ width: 18, height: 18, tintColor: '#fff' }} />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.promptRow}>
        {prompts.map((prompt, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            style={[styles.promptChip, i === prompts.length - 1 ? undefined : styles.promptChipGap]}
            onPress={() => onPressPrompt(prompt)}>
            <Text category="h10" numberOfLines={2} style={{ color: theme['text-basic-color'] }}>
              {prompt}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default CoachPromptCard;

const themedStyles = StyleService.create({
  // STRUCTURED DASHBOARD REDESIGN (see StatStrip.tsx/ActionCard.tsx's own
  // comments) -- flat hairline-bordered card instead of globalStyle.card's
  // floating shadow, matching those two new components' restraint so the
  // whole actions zone reads as one consistent flat system rather than
  // mixing shadow-cards and flat-cards on the same screen.
  card: {
    padding: 16,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
    backgroundColor: 'background-basic-color-2',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 12,
    marginRight: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'color-primary-500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptRow: {
    marginTop: 14,
  },
  promptChip: {
    width: 150,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'background-basic-color-3',
  },
  promptChipGap: {
    marginRight: 10,
  },
});
