import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, Icon } from '@ui-kitten/components';

import Text from 'components/Text';
import { globalStyle } from 'styles/globalStyle';

// Home redesign (product request: "restructure the homescreen UI... to be
// like the layout in the screenshots" -- reference screenshots showed a
// greeting header, a grid of square quick-action tiles, a recent-activity
// list, and a floating center nav button; user confirmed "layout only, keep
// light theme" -- adopt the STRUCTURE, not the reference app's own dark
// theme or copy). This replaces the four full-width stacked cards (Career
// Coach, Practice, Dream Company Dashboard, Refer & Earn) HomeSrc.tsx used
// to render one after another -- same destinations, same icons, same
// copy/i18n keys, just laid out as a 2-column grid of compact square tiles
// instead of a long vertical stack of tall cards, matching the reference
// layout's "grid of things you can do" read. See HomeSrc.tsx for the actual
// item list.
export interface QuickAction {
  key: string;
  title: string;
  icon: string;
  // Icon glyph tint + the tile's own soft icon-circle fill -- e.g. Career
  // Coach keeps its existing brand blue, Practice its neutral gray, Dream
  // Company its blue, Refer & Earn its purple, matching each card's
  // previous accent color 1:1 so the redesign doesn't quietly change which
  // feature reads as "the primary one."
  tint: string;
  onPress: () => void;
}

const QuickActionGrid = memo(({ items }: { items: QuickAction[] }) => {
  const styles = useStyleSheet(themedStyles);
  if (items.length === 0) return null;
  return (
    <View style={styles.grid}>
      {items.map(item => (
        <TouchableOpacity
          key={item.key}
          activeOpacity={0.85}
          style={styles.tile}
          onPress={item.onPress}>
          <View style={[styles.iconWrap, { backgroundColor: `${item.tint}1A` }]}>
            <Icon pack="eva" name={item.icon} style={[globalStyle.icon20, { tintColor: item.tint }]} />
          </View>
          <Text category="h9" bold numberOfLines={2} mt={10}>
            {item.title}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});

export default QuickActionGrid;

const themedStyles = StyleService.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // `justifyContent: 'space-between'` + a fixed sub-100% tile width is
    // the safe cross-RN-version way to lay out an even 2-column wrapping
    // grid -- unlike `gap`, it doesn't depend on the Yoga version actually
    // honoring `gap` inside a `flexWrap` container (topCardsRow's own
    // `gap: 10` above is a plain non-wrapping row, a narrower case that
    // works even on older Yoga builds this one shouldn't assume).
    justifyContent: 'space-between',
    marginTop: 16,
  },
  tile: {
    ...globalStyle.card,
    width: '48%',
    marginBottom: 12,
    paddingVertical: 18,
    paddingHorizontal: 14,
    backgroundColor: 'background-basic-color-1',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
