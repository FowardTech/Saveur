import React from 'react';
import { View } from 'react-native';
import { StyleService, useStyleSheet, Icon } from '@ui-kitten/components';
import LinearGradient from 'react-native-linear-gradient';

import Text from 'components/Text';

// STRUCTURED DASHBOARD REDESIGN (product ask: "search dribbble/behance,
// structure the app like top-rated 2026 apps" -- research landed on
// fintech/SaaS dashboard patterns: a clearly separated "data zone" you
// read, above an "actions zone" you act on, rather than one big
// illustrated hero card mixing both). This is the data zone -- a row of
// flat, hairline-bordered tiles that read fast, the same restraint
// principle behind that whole design direction. Generic and reusable
// (label/value strings only, no hardcoded copy) so any screen that wants
// this "quick stats strip" look can reuse it, same reasoning as
// MissionHeroCard/StatMiniCard/CoachPromptCard from the prior pass.
//
// Product follow-up: "give this guys some illustration icons and give
// them linear gradient backgrounds" -- each tile now leads with a small
// icon badge (a tintable `pack="assets"` glyph, white on a two-color
// LinearGradient chip) above the label/value, same "icon chip + text"
// shape GradientIconBadge/CoachPromptCard already use elsewhere, just
// with a real gradient fill instead of one flat shaded color. `icon`/
// `gradientColors` are both optional so any existing/future caller that
// only wants the plain label+value tile (no badge) keeps working
// unchanged.
export interface StatStripItem {
  label: string;
  value: string;
  icon?: string; // pack="assets" icon name
  gradientColors?: [string, string];
}

export interface StatStripProps {
  items: StatStripItem[];
}

const StatStrip: React.FC<StatStripProps> = ({ items }) => {
  const styles = useStyleSheet(themedStyles);

  return (
    <View style={styles.row}>
      {items.map((item, i) => (
        <View
          key={i}
          style={[styles.tile, i < items.length - 1 ? styles.tileGap : undefined]}>
          {item.icon ? (
            <LinearGradient
              colors={item.gradientColors ?? ['#1F7BFF', '#0052D9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconBadge}>
              <Icon pack="assets" name={item.icon} style={{ width: 16, height: 16, tintColor: '#FFFFFF' }} />
            </LinearGradient>
          ) : null}
          <Text category="h10" status="placeholder" numberOfLines={1}>
            {item.label}
          </Text>
          <Text category="h8" bold mt={4} numberOfLines={1}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
};

export default StatStrip;

const themedStyles = StyleService.create({
  row: {
    flexDirection: 'row',
    marginTop: 16,
  },
  tile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
    backgroundColor: 'background-basic-color-2',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tileGap: {
    marginRight: 10,
  },
  // See the JSX comment above -- 32px rounded-square gradient chip, same
  // squircle proportion GradientIconBadge's own icon badges use elsewhere.
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});
