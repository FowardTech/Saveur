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
// BACKGROUND ILLUSTRATIONS -- round 5 (product follow-up history: "add
// illustrations" -> "it looks crowded and not professional" (screenshot
// showed one illustration rendered OUTSIDE its own tile's rounded bounds)
// -> "add the illustrations back but... give the 3 cards spacing from
// each other" -> "remove the illustration from the other 2 cards and
// leave [it] on the third one because the card title is covering the
// illustration of the dream company dashboard card" -> "put back the
// illustrations of the other 2 cards and... make [them] subtle and
// transparent the way you made them before" -> "place those illustrations
// at the bottom right corner the way you did them before"). All three
// tiles carry an `art` again, absolutely positioned in the tile's own
// bottom-right corner (`artWrap`/`artWrapTall` below) -- back to the exact
// mechanism from two rounds ago, per this round's explicit request.
//
// The corner-overlay version is what caused the real "title covering the
// illustration" bug on Dream Company Dashboard's longer title (title
// spanned the tile's full width above a corner-pinned illustration, and
// the wrapped text painted straight over it). Rather than shrinking the
// title's own width to dodge that (risks truncating longer titles instead
// -- tried and discarded in an earlier round), `tile`/`tallTile` now
// reserve extra `paddingBottom` on any tile carrying `art` (see
// `tileArtBottom` below), so the title's own normal-flow text block ends
// with real vertical clearance above the illustration's own corner
// instead of the two zones overlapping. `overflow:'hidden'` (already on
// `tile`) plus a non-negative `right`/`bottom` on the illustration itself
// still keeps it fully inside the tile's own rounded bounds, the fix for
// the earlier separate "illustration renders outside the tile" bug.
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
  // Optional small illustration, rendered in this tile's bottom-right
  // corner -- see the module comment above.
  art?: React.FC<{ size: number }>;
  // Product follow-up: "give the career coach card the default blue
  // background and the text in it white" -- an opt-in per-tile override
  // that flips this ONE tile from the Material tonal look (pale `tint`
  // wash + dark text) every other tile uses back to a solid `tint` fill +
  // white title, closer to this app's original saturated-hero-card
  // treatment. See Tile's own comment for what else changes with it (icon
  // badge, illustration).
  solid?: boolean;
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
//
// `solid` (product follow-up: "give the career coach card the default
// blue background and the text in it white") -- three things flip
// together when this is on, all necessary for the tile to stay legible:
// (1) the tile's own fill goes from the pale `${tint}17` wash to a full-
// strength `tint`; (2) the icon badge, which is normally a solid `tint`
// circle with a white glyph, would go invisible against a same-color
// tile, so it becomes a translucent-white circle instead (the same
// "frosted accent against a saturated fill" treatment this app's very
// first hero cards used); (3) the title switches to white.
//
// `art` DOES still render in solid mode (product follow-up correction:
// "you forgot the illustration in the career coach card... its not
// visible" -- an earlier pass suppressed it here on the assumption the
// solid-`tint`-colored shapes every other illustration uses would be
// invisible against a same-color tile, which is true, but the fix is to
// retint that ONE illustration, not drop it -- see HomeHeroArt.tsx's own
// comment on ArtCareerCoach's third retint back to translucent-white
// shapes, the same "frosted accent" construction the icon badge above
// uses). Solid tiles use `artWrapSolid` (opacity 1) instead of `artWrap`
// (opacity 0.22) -- that lower opacity was tuned for solid `tint` shapes
// sitting on a near-white pale tile, and would fade an already-
// translucent white illustration to near invisibility on a saturated
// tile; the SVG's own internal rgba alphas already provide the subtlety
// here.
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
      style={[
        styles.tile,
        styles.tileVertical,
        style,
        Art ? styles.tileArtBottom : null,
        { backgroundColor: item.solid ? item.tint : `${item.tint}17` },
      ]}
      onPress={item.onPress}>
      {Art ? (
        <View style={item.solid ? styles.artWrapSolid : styles.artWrap} pointerEvents="none">
          <Art size={58} />
        </View>
      ) : null}
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: item.solid ? 'rgba(255,255,255,0.24)' : item.tint },
        ]}>
        <Icon pack="eva" name={item.icon} style={[globalStyle.icon24, styles.icon]} />
      </View>
      <Text
        category="h8"
        bold
        numberOfLines={2}
        style={[styles.titleVertical, item.solid ? styles.titleSolid : null]}>
        {item.title}
      </Text>
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
  // Product follow-up: "place those illustrations at the bottom right
  // corner the way you did them before" -- reserves extra room below the
  // title (paddingBottom 30 -> 64, `tile`'s own paddingVertical still
  // covers the top) so a worst-case 2-line title has real vertical
  // clearance above `artWrap`'s corner instead of the two overlapping,
  // the actual cause of the earlier "title covering the illustration" bug
  // (see the module comment). Only applied to tiles that actually carry
  // `art`, so tiles without one keep the shorter, tighter height.
  tileArtBottom: {
    paddingBottom: 64,
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
  // `solid` tiles only (see Tile's own comment) -- white title against a
  // full-strength `tint` fill, since the default title color comes from
  // the theme's dark body-text token, which would be unreadable there.
  titleSolid: {
    color: '#fff',
  },
  tallTitle: {
    lineHeight: 24,
  },
  // Illustration accent -- pinned flush to the tile's own bottom-right
  // corner (`right`/`bottom: 0`, never a negative bleed-past-the-edge
  // offset -- the fix for the earlier "illustration renders outside the
  // tile" bug), faded to a subtle, low-contrast fade (product request:
  // "subtle and transparent the way you made them before") rather than a
  // second focal point competing with the icon/title. Painted before the
  // icon/title in the component above (so it sits underneath) and
  // `pointerEvents:'none'` so it never intercepts the tile's own tap.
  // `tile`'s own `overflow:'hidden'` plus `tileArtBottom`'s extra bottom
  // clearance (see that style's own comment) are what keep this from
  // overlapping the title above it.
  artWrap: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    opacity: 0.22,
  },
  // `solid` tiles only (see Tile's own comment) -- full opacity, since
  // ArtCareerCoach (the only illustration currently paired with a `solid`
  // tile) is already built from translucent-white/rgba shapes with their
  // own baked-in subtlety, unlike the solid-`tint`-colored shapes the
  // pale tonal tiles' illustrations use.
  artWrapSolid: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    opacity: 1,
  },
  artWrapTall: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    opacity: 0.28,
  },
});
