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
// BACKGROUND ILLUSTRATIONS -- round 3 (product follow-up: first "add
// illustrations", then "it looks crowded and not professional" with a
// screenshot showing one illustration rendered OUTSIDE its own tile's
// rounded bounds, then "add the illustrations back but... give the 3
// cards spacing from each other", then "remove the illustration from the
// other 2 cards and leave the illustration on the third one because the
// card title is covering the illustration of the dream company dashboard
// card... make it look better so the illustration will be more visible
// and the dream company dashboard text can be fully visible"). Only Dream
// Company Dashboard carries an `art` now (see HomeSrc.tsx's quickActions).
//
// The "title covering the illustration" bug was a real text-paints-over-
// art overlap: `art` used to be absolutely positioned behind the icon/
// title, pinned to the tile's bottom-right corner, with the title spanning
// the tile's FULL width above it -- on a narrow ~48%-width tile, "Dream
// Company Dashboard" wrapped across two lines tall/wide enough to paint
// straight over that corner. Rather than trying to reserve just-enough
// pixels for the art with padding (fragile -- the exact right number
// depends on the tile's actual on-device width, which varies by screen
// size, and guessing wrong either re-creates the overlap or squeezes the
// title so narrow it truncates), `art` is now rendered in normal document
// flow, stacked AFTER the title instead of positioned behind it. That
// makes the overlap structurally impossible on any screen size -- the
// title gets the tile's full width to wrap in exactly like every other
// tile's title, and the illustration simply sits in its own space below
// it, right-aligned. With nothing left to hide it behind, it's also drawn
// larger and at full opacity now ("make the illustration more visible")
// instead of the faint, semi-transparent corner texture the two earlier
// rounds used.
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
  // Optional small illustration, rendered below this tile's title -- see
  // the module comment above.
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

// Normal (non-tall) tile -- icon pinned top-left, title below it, then an
// optional illustration below THAT (see module comment). Shared between
// the plain-grid fallback above and the bento layout's left-hand stacked
// column.
//
// REDESIGN (product follow-up: "increase the height of the other 2 cards
// on the left, move their icons a little bit to the top left so that the
// card titles can be visible") -- was a horizontal row (icon left, title
// vertically centered to its right); switched to the same icon-on-top/
// title-below vertical block TallTile already uses (styles.tileVertical/
// titleVertical below), which does two things at once: the icon sits at
// the tile's actual top-left corner as asked, and stacking icon above
// title (rather than centering them side by side) is what actually makes
// the tile taller -- a bigger paddingVertical alone was tried in the
// previous pass and wasn't enough on its own.
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
      style={[styles.tile, styles.tileVertical, style, { backgroundColor: `${item.tint}17` }]}
      onPress={item.onPress}>
      <View style={[styles.iconWrap, { backgroundColor: item.tint }]}>
        <Icon pack="eva" name={item.icon} style={[globalStyle.icon24, styles.icon]} />
      </View>
      <Text category="h8" bold numberOfLines={2} style={styles.titleVertical}>
        {item.title}
      </Text>
      {Art ? (
        <View style={styles.artRow} pointerEvents="none">
          <Art size={64} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

// Tall tile -- the bento layout's right-hand column (see module comment).
// Stretched via `flex:1`/`alignSelf:'stretch'` (bentoRow's own
// `alignItems: 'stretch'`, the default) to match the left column's
// combined stacked height. Same icon-on-top/title-below vertical block
// Tile above now uses too, just bigger (see `tallIconWrap`/`tallTitle`).
const TallTile = ({ item, styles }: { item: QuickAction; styles: ReturnType<typeof useStyleSheet> }) => {
  const Art = item.art;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[styles.tile, styles.tallTile, { backgroundColor: `${item.tint}17` }]}
      onPress={item.onPress}>
      <View style={[styles.tallIconWrap, { backgroundColor: item.tint }]}>
        <Icon pack="eva" name={item.icon} style={[globalStyle.icon28, styles.icon]} />
      </View>
      <Text category="h7" bold numberOfLines={2} style={styles.tallTitle}>
        {item.title}
      </Text>
      {Art ? (
        <View style={styles.artRowTall} pointerEvents="none">
          <Art size={92} />
        </View>
      ) : null}
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
  //
  // Height follow-up, round 2 (product request: "increase the height of
  // the other 2 cards on the left... so that the card titles can be
  // visible") -- paddingVertical 28 -> 30, on top of the layout switch to
  // `tileVertical` below (icon stacked above title, not beside it -- see
  // Tile's own comment for why that's what actually drives most of the
  // height increase). The tall tile (Practice) still picks this up
  // automatically since it's stretched to match the stacked column's
  // combined height rather than having its own fixed size.
  tile: {
    marginBottom: 16,
    borderRadius: 24,
    paddingVertical: 30,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  // Overrides `tile`'s (now baseline-less) layout for the two stacked
  // tiles -- icon pinned to the top-left corner, title below it, matching
  // TallTile's own vertical block below (see Tile's own comment).
  tileVertical: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
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
  // marginBottom (not marginRight) now that Tile is a vertical block, icon
  // above title, rather than a horizontal row.
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    marginBottom: 12,
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
  // `alignSelf: 'stretch'` (rather than `flex: 1`, which only matters in a
  // row) is what makes this Text wrap against the tile's actual width in
  // its vertical layout, instead of shrink-wrapping to its own unwrapped
  // content width the way a plain flex-start column child would. Gets the
  // tile's FULL width to wrap in -- see the module comment on why an
  // illustration no longer sits behind/competes with this.
  titleVertical: {
    alignSelf: 'stretch',
    lineHeight: 22,
  },
  tallTitle: {
    lineHeight: 24,
  },
  // Illustration accent, in normal document flow AFTER the title (see the
  // module comment on why this replaced the earlier absolutely-positioned
  // corner version) -- `alignSelf:'flex-end'` right-aligns it within the
  // tile's own column instead of stretching, `marginTop` gives it a clean
  // gap below the title rather than touching it, and `pointerEvents:'none'`
  // keeps it from intercepting the tile's own tap. No opacity fade here
  // (unlike the reverted version) -- with the overlap risk gone, it's
  // meant to read as a real, fully visible illustration, not a faint
  // texture.
  artRow: {
    alignSelf: 'flex-end',
    marginTop: 10,
  },
  artRowTall: {
    alignSelf: 'flex-end',
    marginTop: 14,
  },
});
