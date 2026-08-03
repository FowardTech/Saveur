// Shared rotating pastel tile palette (product request item: "make
// everything consistent throughout the app" — every screen that colors a
// grid of stat/nav tiles was hand-rolling its own copy of this same 4-color
// array, risking drift between screens over time). Every consumer
// (FindScreen.tsx's Tools/Interview Types grids, MyProgress.tsx's stat
// cards + weekly bar chart, WeeklyCareerReport.tsx's stat cards,
// CareerDna.tsx's risk/blind-spot cards, HomeSrc.tsx's Upcoming Session
// card) should import THIS instead of redefining its own list, so the same
// 4 colors always appear in the same order everywhere.
//
// Each entry names a real theme token pair (constants/theme/appTheme.json
// for the light-mode value, constants/theme/dark.json for the dark-mode
// override) — never a literal hex — so every consumer gets a correct color
// in both themes for free just by reading `theme[tile.bg]`/`theme[tile.text]`.
export interface TileColor {
  bg: string;
  text: string;
}

export const TILE_COLORS: readonly TileColor[] = [
  { bg: 'color-badge-info-bg', text: 'color-badge-info-text' },
  { bg: 'color-tile-mint-bg', text: 'color-tile-mint-text' },
  { bg: 'color-tile-orange-bg', text: 'color-tile-orange-text' },
  { bg: 'color-tile-rose-bg', text: 'color-tile-rose-text' },
] as const;

export function tileColorAt(index: number): TileColor {
  return TILE_COLORS[index % TILE_COLORS.length];
}
