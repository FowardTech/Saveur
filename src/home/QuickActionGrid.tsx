import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';

import Text from 'components/Text';
import { globalStyle } from 'styles/globalStyle';

// Home redesign (product request: "restructure the homescreen UI... to be
// like the layout in the screenshots" -- reference screenshots showed a
// greeting header, a grid of square quick-action tiles, a recent-activity
// list, and a floating center nav button). See HomeSrc.tsx for the actual
// item list.
//
// "Google-style" pass (product request: "try the Google-style pass...
// furnish the whole UI to look more like google UI" -- Material 3/Material
// You's own tonal-surface language: a pale wash of a single accent color
// as the container fill, a solid "on-container" accent badge for the
// icon, and neutral dark body text, instead of a saturated gradient with
// white text -- see git history for the earlier gradient version this
// replaced).
//
// PRODUCT FOLLOW-UP: "make the cards a little bigger and the height of
// the third card on the right should cover the space left by the fourth
// card that was removed earlier." Bigger icon/padding/type throughout,
// and a `wide` flag (set on Dream Company Dashboard, the third/last tile
// -- see HomeSrc.tsx's quickActions) makes that one tile span the FULL
// row width instead of sitting alone at half-width with dead space next
// to it where Refer & Earn used to be -- the standard "bento grid" fix
// for an odd tile count (2-up row, then a full-width row), which reads as
// an intentional layout rather than a gap.
export interface QuickAction {
  key: string;
  title: string;
  icon: string;
  // Single accent hex, e.g. '#0063f8' -- used at low opacity for the
  // tile's own pale container fill and at full strength for the icon
  // badge.
  tint: string;
  onPress: () => void;
  // When true, spans the full grid width instead of sharing a row with a
  // sibling -- see the module comment above.
  wide?: boolean;
}

const QuickActionGrid = memo(({ items }: { items: QuickAction[] }) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={styles.grid}>
      {items.map(item => (
        <TouchableOpacity
          key={item.key}
          activeOpacity={0.75}
          style={[
            styles.tile,
            item.wide ? styles.tileWide : styles.tileHalf,
            { backgroundColor: `${item.tint}17` },
          ]}
          onPress={item.onPress}>
          <View style={[styles.iconWrap, { backgroundColor: item.tint }]}>
            <Icon pack="eva" name={item.icon} style={[globalStyle.icon24, styles.icon]} />
          </View>
          <Text category="h8" bold numberOfLines={2} style={styles.title}>
            {item.title}
          </Text>
          {item.wide ? (
            <Icon
              pack="eva"
              name="arrow-forward-outline"
              style={[globalStyle.icon20, { tintColor: theme['text-hint-color'] }]}
            />
          ) : null}
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
  // Material 3-style tonal tile: flat pale fill (set inline per item, see
  // render above), no shadow/elevation -- separation from the page comes
  // purely from the container's own tint against the white page
  // background, the same "color contrast, not a shadow" convention
  // globalStyle.card's own comment already established for this app's
  // plain white cards. Radius 24 (vs. this app's usual 14px) and roomier
  // padding than the first pass -- Material You's own larger, softer
  // corner language, made a little bigger again per explicit follow-up.
  tile: {
    marginBottom: 14,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 18,
  },
  tileHalf: {
    width: '48%',
  },
  // See this file's module comment -- absorbs the space the removed
  // fourth (Refer & Earn) tile left behind instead of sitting alone at
  // half-width.
  tileWide: {
    width: '100%',
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    marginRight: 14,
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
    lineHeight: 22,
  },
});
