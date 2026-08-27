import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, Icon, useTheme } from '@ui-kitten/components';

import Text from 'components/Text';
import { globalStyle } from 'styles/globalStyle';

// STRUCTURED DASHBOARD REDESIGN (product ask: "search dribbble/behance,
// structure the app like top-rated 2026 apps" -- see StatStrip.tsx's own
// comment for the full "data zone above, actions zone below" reasoning
// this pairs with). This is the actions zone's primary item -- a single,
// restrained row card (small tinted icon, title, subtitle, trailing
// chevron) instead of the previous pass's big illustrated hero
// (MissionHeroCard, still on disk, unused now -- kept as a rollback
// point rather than deleted, same as every prior redesign pass in this
// app). One accent color only, no progress bar/meta row duplicating what
// StatStrip above already shows -- the "one clear next action" pattern
// Betterment/Noom-style coaching apps and fintech dashboards both use.
// Generic and reusable, same as every other Home v2/v3 component.
export interface ActionCardProps {
  icon: string; // eva icon pack name
  title: string;
  subtitle: string;
  onPress: () => void;
  accentColor?: string;
}

const ActionCard: React.FC<ActionCardProps> = ({ icon, title, subtitle, onPress, accentColor = 'color-primary-500' }) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const resolvedAccent = theme[accentColor] ?? accentColor;

  return (
    <TouchableOpacity activeOpacity={0.8} style={styles.card} onPress={onPress}>
      <View style={[styles.iconWrap, { backgroundColor: `${resolvedAccent}1A` }]}>
        <Icon pack="eva" name={icon} style={{ width: 20, height: 20, tintColor: resolvedAccent }} />
      </View>
      <View style={[globalStyle.flexOne, styles.textCol]}>
        <Text category="h9" bold numberOfLines={1}>
          {title}
        </Text>
        <Text category="h10" status="placeholder" numberOfLines={1} mt={2}>
          {subtitle}
        </Text>
      </View>
      <Icon pack="eva" name="chevron-right-outline" style={[globalStyle.icon20, { tintColor: theme['text-hint-color'] }]} />
    </TouchableOpacity>
  );
};

export default ActionCard;

const themedStyles = StyleService.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
    backgroundColor: 'background-basic-color-2',
    padding: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    marginLeft: 12,
    marginRight: 8,
  },
});
