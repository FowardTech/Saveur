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
// theme or copy). See HomeSrc.tsx for the actual item list.
//
// PRODUCT FOLLOW-UP #1 ("main cards should be colorful") -- flat white
// tiles became solid-color fills, then real two-tone gradients (see git
// history), reusing GradientCard the same way this app's original
// full-width hero cards did.
//
// PRODUCT FOLLOW-UP #2 (with report: "the inner color gradient padding is
// covering the captions... I can't even see the texts") -- the first
// gradient pass stacked a 46px icon ABOVE a 2-line title inside a
// `minHeight`-constrained column, which left too little guaranteed room
// for the caption at this tile's actual small size. Rebuilt as a ROW
// (icon on the left, title on the right, vertically centered) -- the
// exact same layout shape this app's original working hero cards already
// used successfully with GradientCard (icon/text on the left, illustration
// on the right) -- with no `minHeight` at all, so the tile always sizes
// itself to whatever the icon + up to 2 lines of title actually need
// instead of relying on a guessed fixed height.
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
            borderRadius={18}
            contentStyle={styles.tile}>
            <View style={styles.iconWrap}>
              <Icon pack="eva" name={item.icon} style={[globalStyle.icon20, styles.icon]} />
            </View>
            <Text
              category="h9"
              bold
              numberOfLines={2}
              style={styles.title}>
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
    // honoring `gap` inside a `flexWrap` container.
    justifyContent: 'space-between',
    marginTop: 18,
  },
  tileWrap: {
    width: '48%',
    marginBottom: 14,
  },
  // Row layout (icon left, title right) -- see this file's module comment
  // for why this replaced the earlier stacked column. No `minHeight`: the
  // tile sizes itself to the icon + text content, guaranteeing the
  // caption always has the room it actually needs.
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    marginRight: 10,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  icon: {
    tintColor: '#fff',
  },
  title: {
    flex: 1,
    flexShrink: 1,
    color: '#fff',
    lineHeight: 18,
  },
});
