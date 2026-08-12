import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, Icon } from '@ui-kitten/components';

import Text from 'components/Text';
import GradientCard from 'components/GradientCard';
import { globalStyle } from 'styles/globalStyle';

// Home redesign (product request: "restructure the homescreen UI... to be
// like the layout in the screenshots" -- reference screenshots showed a
// greeting header, a grid of square quick-action tiles, a recent-activity
// list, and a floating center nav button; user confirmed "layout only, keep
// light theme" -- adopt the STRUCTURE, not the reference app's own dark
// theme or copy). This replaces the four full-width stacked cards (Career
// Coach, Practice, Dream Company Dashboard, Refer & Earn) HomeSrc.tsx used
// to render one after another -- same destinations/icons/copy, just laid
// out as a 2-column grid of compact square tiles. See HomeSrc.tsx for the
// actual item list.
//
// PRODUCT FOLLOW-UP #1 (with screenshot: "main cards should be... colorful
// like the second screenshot") -- flat white tiles with a small tinted
// icon circle became a solid-color fill per tile instead (see git history).
//
// PRODUCT FOLLOW-UP #2 ("make it look the best of the best" after being
// asked directly whether this read as modern) -- flat solid fills read
// closer to old-school Material Design than a current, premium AI-product
// feel, and two of the four tiles (Career Coach, Dream Company) reused the
// exact same blue, which undercut the "colorful, scannable grid" goal in
// the first place. Each tile is now a real two-tone diagonal gradient (via
// the same GradientCard component this app's original hero cards already
// used, not a new dependency) with FOUR genuinely distinct hues -- blue-
// violet, emerald-teal, amber-orange, and pink-purple -- so every tile
// reads as its own destination at a glance, matching the gradient-tile
// language most current AI-product home screens use instead of flat fills.
export interface QuickAction {
  key: string;
  title: string;
  icon: string;
  // Two-stop diagonal gradient, e.g. ['#0063f8', '#7C3AED'] -- see the
  // per-item definitions in HomeSrc.tsx's quickActions useMemo.
  gradient: [string, string];
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
          activeOpacity={0.88}
          style={styles.tileWrap}
          onPress={item.onPress}>
          <GradientCard
            colors={item.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            borderRadius={20}
            contentStyle={styles.tile}>
            <View style={styles.iconWrap}>
              <Icon pack="eva" name={item.icon} style={[globalStyle.icon24, styles.icon]} />
            </View>
            <Text category="h9" bold numberOfLines={2} mt={12} style={styles.title}>
              {item.title}
            </Text>
          </GradientCard>
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
    marginTop: 18,
  },
  // GradientCard already supplies its own shadow/rounded-corner/fill
  // mechanics (see components/GradientCard.tsx) -- this just sizes/spaces
  // the tile within the grid.
  tileWrap: {
    width: '48%',
    marginBottom: 14,
  },
  tile: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    minHeight: 118,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  icon: {
    tintColor: '#fff',
  },
  title: {
    color: '#fff',
  },
});
