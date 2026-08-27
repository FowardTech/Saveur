import React from 'react';
import { View } from 'react-native';
import { StyleService, useStyleSheet } from '@ui-kitten/components';

import Text from 'components/Text';

// STRUCTURED DASHBOARD REDESIGN (product ask: "search dribbble/behance,
// structure the app like top-rated 2026 apps" -- research landed on
// fintech/SaaS dashboard patterns: a clearly separated "data zone" you
// read, above an "actions zone" you act on, rather than one big
// illustrated hero card mixing both). This is the data zone -- a row of
// flat, hairline-bordered tiles (label + value only, no icon fill, no
// progress bar, no illustration) that reads fast, the same restraint
// principle behind that whole design direction. Generic and reusable
// (label/value strings only, no hardcoded copy) so any screen that wants
// this "quick stats strip" look can reuse it, same reasoning as
// MissionHeroCard/StatMiniCard/CoachPromptCard from the prior pass.
export interface StatStripItem {
  label: string;
  value: string;
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
});
