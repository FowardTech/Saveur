import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, Icon } from '@ui-kitten/components';

import Text from 'components/Text';
import { globalStyle } from 'styles/globalStyle';

// Home redesign (product request: "restructure the homescreen UI... to be
// like the layout in the screenshots" -- reference screenshots showed a
// greeting header, a grid of square quick-action tiles, a recent-activity
// list, and a floating center nav button). See HomeSrc.tsx for the actual
// item list.
//
// EXPERIMENTAL "Google-style" pass (product request: "try the Google-
// style pass and let's see if it's not good we can revert back" -- asked
// after being asked directly whether this screen read as "modern Google
// UI" and answering honestly that vivid multi-hue gradients are actually
// the OPPOSITE instinct from Google's own Material 3/Material You
// language, which leans on TONAL surfaces -- a pale wash of a single
// accent color as the container fill, a solid "on-container" accent badge
// for the icon, and neutral dark body text -- rather than a saturated
// gradient fill with white text). This replaces the previous two-stop-
// gradient tiles (see git history -- easy to revert to if this doesn't
// land well) with exactly that: a flat, pale tonal card per tile (each
// still its own distinct hue, matching Material's own "primary/secondary/
// tertiary container" pattern of using a few different tonal families
// side by side, not literally ONE color for everything) with a solid-
// color icon badge and this app's normal dark title text -- no gradient,
// no LinearGradient dependency for these tiles at all anymore.
export interface QuickAction {
  key: string;
  title: string;
  icon: string;
  // Single accent hex, e.g. '#0063f8' -- used at low opacity for the
  // tile's own pale container fill and at full strength for the icon
  // badge. See the per-item definitions in HomeSrc.tsx's quickActions
  // useMemo.
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
          activeOpacity={0.75}
          style={[styles.tile, { backgroundColor: `${item.tint}17` }]}
          onPress={item.onPress}>
          <View style={[styles.iconWrap, { backgroundColor: item.tint }]}>
            <Icon pack="eva" name={item.icon} style={[globalStyle.icon20, styles.icon]} />
          </View>
          <Text category="h9" bold numberOfLines={2} style={styles.title}>
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
    // honoring `gap` inside a `flexWrap` container.
    justifyContent: 'space-between',
    marginTop: 20,
  },
  // Material 3-style tonal tile: flat pale fill (set inline per item,
  // see render above), no shadow/elevation at all -- separation from the
  // page comes purely from the container's own tint against the white
  // page background, the same "color contrast, not a shadow" convention
  // globalStyle.card's own comment already established for this app's
  // plain white cards. Larger 24px radius (vs. this app's usual 14-20px)
  // and roomier padding -- Material You's own larger, softer corner
  // language.
  tile: {
    width: '48%',
    marginBottom: 14,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    marginRight: 10,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    tintColor: '#fff',
  },
  title: {
    flex: 1,
    flexShrink: 1,
    lineHeight: 18,
  },
});
