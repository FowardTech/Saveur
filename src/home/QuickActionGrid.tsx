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
// BENTO LAYOUT (product follow-up, corrected): an earlier pass read "the
// height of the third card on the right should cover the space left by
// the fourth card that was removed earlier" as "make the third (Dream
// Company Dashboard) tile span the full row width" -- product corrected
// that: "I did not mean the dream company dashboard card. I meant the
// practice card should span vertically covering the space left by the
// fourth card." That's a different shape, not just a different tile: a
// single `tall` tile stretched to match the combined height of the other
// tiles stacked in a left column, not a tile stretched to full row width.
// `wide` is gone; `tall` (see HomeSrc.tsx's quickActions -- now set on
// Practice) drives this two-column bento layout below instead.
//
// BACKGROUND ILLUSTRATIONS -- round 2 (product follow-up: first "add
// illustrations", then, on seeing them, "it looks crowded and not
// professional" with a screenshot showing one illustration rendered
// OUTSIDE its own tile's rounded bounds, then "add the illustrations back
// but... give the 3 cards spacing from each other"). Two things changed
// from the reverted first attempt (see git history for that version):
// (1) `art` is now positioned fully INSIDE each tile's own box (`right: 0,
// bottom: 0`, no negative bleed-past-the-edge offset) so it can never
// visually escape even if `overflow:'hidden'` fails to clip an absolutely-
// positioned sibling on some RN/platform combination the way it silently
// did last time -- containment no longer depends on that clip actually
// working. (2) smaller + lower opacity than the first attempt, so it reads
// as a faint corner texture instead of a second competing scene.
export interface QuickAction {
  key: string;
  title: string;
  icon: string;
  // Single accent hex, e.g. '#0063f8' -- used at low opacity for the
  // tile's own pale container fill and at full strength for the icon
  // badge.
  tint: string;
  onPress: () => void;
  // When true, this tile becomes a single right-hand column stretched to
  // match the combined height of the other (non-tall) tiles stacked in a
  // left column -- see the module comment above.
  tall?: boolean;
  // Optional small illustration, rendered as a faded corner accent fully
  // inside this tile's own bounds -- see the module comment above.
  art?: React.FC<{ size: number }>;
}

const QuickActionGrid = memo(({ items }: { items: QuickAction[] }) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  if (items.length === 0) return null;

  const tallItems = items.filter(item => item.tall);
  const stackedItems = items.filter(item => !item.tall);

  // No `tall` item -- plain wrapping 2-up grid, so this component still
  // works for any list shape rather than assuming "exactly one tall tile."
  if (tallItems.length === 0) {
    return (
      <View style={styles.grid}>
        {stackedItems.map(item => (
          <Tile key={item.key} item={item} style={styles.tileHalf} styles={styles} theme={theme} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.bentoRow}>
      <View style={styles.bentoColumn}>
        {stackedItems.map((item, i) => (
          <Tile
            key={item.key}
            item={item}
            style={i < stackedItems.length - 1 ? styles.stackedTileGap : undefined}
            styles={styles}
            theme={theme}
          />
        ))}
      </View>
      {tallItems.map(item => (
        <TallTile key={item.key} item={item} styles={styles} />
      ))}
    </View>
  );
});

export default QuickActionGrid;

// Normal (non-tall) tile -- icon left, title right, same row shape this
// grid has always used. Shared between the plain-grid fallback above and
// the bento layout's left-hand stacked column.
const Tile = ({
  item,
  style,
  styles,
  theme,
}: {
  item: QuickAction;
  style?: object;
  styles: ReturnType<typeof useStyleSheet>;
  theme: ReturnType<typeof useTheme>;
}) => {
  const Art = item.art;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[styles.tile, style, { backgroundColor: `${item.tint}17` }]}
      onPress={item.onPress}>
      {Art ? (
        <View style={styles.artWrap} pointerEvents="none">
          <Art size={58} />
        </View>
      ) : null}
      <View style={[styles.iconWrap, { backgroundColor: item.tint }]}>
        <Icon pack="eva" name={item.icon} style={[globalStyle.icon24, styles.icon]} />
      </View>
      <Text category="h8" bold numberOfLines={2} style={styles.title}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
};

// Tall tile -- the bento layout's right-hand column (see module comment).
// Stretched via `flex:1`/`alignSelf:'stretch'` (bentoRow's own
// `alignItems: 'stretch'`, the default) to match the left column's
// combined stacked height, so its content is laid out as a vertical block
// (icon, then title below it) rather than the horizontal icon-left/
// title-right row the smaller tiles use -- a wide-but-short row would sit
// awkwardly stranded inside a tall container.
const TallTile = ({ item, styles }: { item: QuickAction; styles: ReturnType<typeof useStyleSheet> }) => {
  const Art = item.art;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[styles.tile, styles.tallTile, { backgroundColor: `${item.tint}17` }]}
      onPress={item.onPress}>
      {Art ? (
        <View style={styles.artWrapTall} pointerEvents="none">
          <Art size={104} />
        </View>
      ) : null}
      <View style={[styles.tallIconWrap, { backgroundColor: item.tint }]}>
        <Icon pack="eva" name={item.icon} style={[globalStyle.icon28, styles.icon]} />
      </View>
      <Text category="h7" bold numberOfLines={2} style={styles.tallTitle}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
};

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
  // Bento layout container (see module comment) -- a plain two-column flex
  // row. `alignItems: 'stretch'` is the RN/Yoga default for a row and is
  // exactly what makes `tallTile` below match `bentoColumn`'s natural
  // (content-driven) height without either side needing a hardcoded pixel
  // height: Yoga measures each column's own natural size first, then
  // stretches any child that doesn't set its own height/alignSelf to the
  // tallest sibling's size.
  //
  // Spacing follow-up (product request: "give the 3 cards spacing from
  // each other") -- switched from `justifyContent:'space-between'` +
  // percentage widths (whose gap shrinks/grows with screen width and read
  // as too tight) to `bentoColumn`'s own fixed-pixel `marginRight`, so the
  // gap between the left column and the tall right tile is the same
  // explicit 16px as `stackedTileGap` between the two stacked tiles below
  // -- one consistent gap value on every side of every tile instead of two
  // different, width-dependent ones.
  bentoRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  bentoColumn: {
    flex: 1,
    marginRight: 16,
  },
  // Bumped 14 -> 16 (same spacing follow-up) to match bentoColumn's own
  // gap above.
  stackedTileGap: {
    marginBottom: 16,
  },
  // Material 3-style tonal tile: flat pale fill (set inline per item, see
  // render above), no shadow/elevation -- separation from the page comes
  // purely from the container's own tint against the white page
  // background, the same "color contrast, not a shadow" convention
  // globalStyle.card's own comment already established for this app's
  // plain white cards. Radius 24 (vs. this app's usual 14px) and roomier
  // padding than the first pass -- Material You's own larger, softer
  // corner language, made a little bigger again per explicit follow-up.
  // `overflow:'hidden'` keeps each tile's optional background
  // illustration's own corners tucked under the tile's rounded shape --
  // `art`/`artWrap` below no longer *depend* on this clip actually
  // working (see the module comment on why), but it's kept as a belt-and-
  // suspenders second layer of containment.
  //
  // Height follow-up (product request: "make the 2 horizontal cards have
  // a little more height") -- paddingVertical 22 -> 28 on the two stacked
  // tiles (Coach/Dream Company Dashboard); the tall tile (Practice) picks
  // this up automatically since it's stretched to match their new,
  // slightly taller combined height rather than having its own fixed size.
  tile: {
    marginBottom: 16,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  tileHalf: {
    width: '48%',
  },
  // Bento layout's right-hand tall tile (see module comment) -- `flex: 1`
  // makes it a full column sibling of `bentoColumn` rather than a
  // width-percentage tile; content stacks vertically instead of the
  // normal row shape (see TallTile above), with roomier padding to match
  // its bigger footprint.
  tallTile: {
    flex: 1,
    marginBottom: 0,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingVertical: 24,
    paddingHorizontal: 20,
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
  tallIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    marginBottom: 16,
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
  tallTitle: {
    lineHeight: 24,
  },
  // Background illustration accent -- pinned flush to the tile's own
  // bottom-right corner (NOT bled past it -- see the module comment on why
  // that changed from the first, reverted attempt), faded so it reads as a
  // soft texture rather than a second focal point competing with the
  // icon/title. Painted before the icon/title (so it sits underneath) and
  // `pointerEvents:'none'` so it never intercepts the tile's own tap.
  artWrap: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    opacity: 0.22,
  },
  artWrapTall: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    opacity: 0.28,
  },
});
