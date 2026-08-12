import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, useTheme } from '@ui-kitten/components';

import Text from 'components/Text';

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
//
// WHITE CARDS, pre-launch polish pass (product request: "turning the 4
// cards to white background" + "give the app background gray instead of
// the subtle blue background") -- the Material tonal wash (pale `tint`
// fill) and the one-off `solid` full-strength-fill tile (Career Coach,
// see git history) are both gone. All four tiles are now the same plain
// white card (`background-basic-color-2`, matching every other card in
// the app) sitting on Container.tsx's gray page body -- the tint accent
// now lives ONLY in the icon badge and the illustration, not the tile
// fill itself.
//
// `solid` REINTRODUCED (immediate product follow-up: "give the career
// [coach] card the default blue background") -- the white-card look
// above stays as the default for every tile, but Career Coach opts back
// into a full-strength `tint` fill via this one flag, same mechanism/
// reasoning as the original `solid` implementation (see git history):
// white title, translucent-white icon badge, and full-opacity
// illustration instead of the faded corner accent every white tile uses
// (HomeHeroArt.tsx's ArtCareerCoach is retinted back to translucent-
// white-on-blue to match). Practice/Dream Company Dashboard/Learning
// Courses are untouched, still plain white.
// 3D ICON BADGES (product follow-up: "give the 4 cards the 3D icons i
// talked about the last time") -- `icon` used to be an Eva icon-pack glyph
// name rendered inside a flat solid-`tint` circle (see git history). It's
// now a whole custom SVG component (see QuickActionIcons.tsx) that IS the
// badge -- its own gradient fill, glossy highlight, and ground shadow --
// with no separate circle wrapper needed. `iconWrap`/`tallIconWrap` below
// now just reserve spacing, not a colored circle.
export interface QuickAction {
  key: string;
  title: string;
  icon: React.FC<{ size: number }>;
  // Single accent hex, e.g. '#0063f8' -- used for the illustration's shapes
  // (see HomeHeroArt.tsx) and as the tile's own fill on a `solid` tile. No
  // longer drives the icon badge's color -- see `icon`'s own comment.
  tint: string;
  onPress: () => void;
  // When true, this tile becomes a single right-hand column stretched to
  // match the combined height of the other (non-tall) tiles stacked in a
  // left column -- see the module comment above.
  tall?: boolean;
  // Optional small illustration, rendered in this tile's bottom-right
  // corner -- see the module comment above.
  art?: React.FC<{ size: number }>;
  // Product follow-up: "give the career [coach] card the default blue
  // background" -- opts this one tile out of the white-card default back
  // into a full-strength `tint` fill. See Tile's own comment for what
  // else changes with it (icon badge, title color, illustration).
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
  const Icon3D = item.icon;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[
        styles.tile,
        styles.tileVertical,
        style,
        Art ? styles.tileArtBottom : null,
        item.solid ? { backgroundColor: item.tint } : null,
      ]}
      onPress={item.onPress}>
      {Art ? (
        <View style={item.solid ? styles.artWrapSolid : styles.artWrap} pointerEvents="none">
          <Art size={58} />
        </View>
      ) : null}
      <View style={styles.iconWrap}>
        <Icon3D size={60} />
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
  const Icon3D = item.icon;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={[styles.tile, styles.tallTile]}
      onPress={item.onPress}>
      {Art ? (
        <View style={styles.artWrapTall} pointerEvents="none">
          <Art size={104} />
        </View>
      ) : null}
      <View style={styles.tallIconWrap}>
        <Icon3D size={72} />
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
  // Height follow-up, round 2 (product request: "increase the height of
  // the other 2 cards on the left... so that the card titles can be
  // visible") -- paddingVertical 28 -> 30, on top of the layout switch to
  // `tileVertical` below (icon stacked above title, not beside it -- see
  // Tile's own comment for why that's what actually drives most of the
  // height increase). The tall tile (Practice) still picks this up
  // automatically since it's stretched to match the stacked column's
  // combined height rather than having its own fixed size.
  //
  // WHITE CARDS (see module comment) -- was a flat pale `tint` wash set
  // inline per item (Material 3's own tonal-surface look); now a plain
  // `background-basic-color-2` white fill, the exact same token/level
  // every other card in the app uses, so these tiles read as consistent
  // "cards" rather than a one-off Home-only treatment. No shadow/
  // elevation, same as every other card -- separation from the page comes
  // from real color contrast against Container.tsx's gray page body, not
  // a shadow (globalStyle.card's own comment already established this
  // convention app-wide). Radius 24 (vs. this app's usual 20px) stays --
  // Material You's larger, softer corner language on this one screen's
  // tiles specifically, per an earlier explicit follow-up.
  tile: {
    marginBottom: 16,
    borderRadius: 24,
    paddingVertical: 30,
    paddingHorizontal: 18,
    overflow: 'hidden',
    backgroundColor: 'background-basic-color-2',
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
  // Just spacing now (product follow-up: "give the 4 cards the 3D icons" --
  // see QuickActionGrid.tsx's own top comment and QuickActionIcons.tsx).
  // Used to be a fixed-size solid-`tint` circle wrapping a flat Eva glyph;
  // each icon is now a complete standalone SVG badge with its own size/
  // shape/fill, so this wrapper only needs to reserve the same vertical gap
  // before the title that the old circle badge used to take up. Icon's own
  // `size` prop (48/56 -> 60/72, see Tile/TallTile above) is what actually
  // drives the badge's on-screen size now, per follow-up "make the 3D icons
  // bigger" -- this wrapper's own dimensions were already just spacing, not
  // a hard clip/crop box, so nothing here needed to change to let that grow.
  iconWrap: {
    marginBottom: 12,
    flexShrink: 0,
  },
  tallIconWrap: {
    marginBottom: 16,
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
  // `solid` tiles only (see Tile's own comment). Was opacity 1 (full
  // strength) on the reasoning that ArtCareerCoach's own translucent-white/
  // rgba shapes already carried enough built-in subtlety on their own --
  // product follow-up ("make the chat illustration on the career coach
  // card subtle and transparent") said otherwise, so this now fades to the
  // same low-contrast level `artWrap` above uses for the other three
  // tiles' illustrations, for one consistent "subtle corner accent" look
  // across all four cards regardless of tile color.
  artWrapSolid: {
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
