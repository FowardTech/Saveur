// Shared accent palette (product follow-up: "the color style and blend is
// not consistent throughout the app... you should also use it in certain
// other places too") — the same pastel-icon-badge hues Home/AI Coach
// already use (see home/RecentActivityList.tsx's COLOR_BY_TYPE and
// home/QuickActionGrid.tsx's "3D icon badges"), pulled out here so other
// screens (Job Alerts, Dream Companies, Resume Builder import cards, Goals)
// can reuse the exact same colors instead of each screen inventing its own.
export const ACCENT_PALETTE = [
  '#0063f8', // blue (default brand blue)
  '#8B5CF6', // purple
  '#D85A30', // orange
  '#1D9E75', // teal
  '#F59E0B', // amber
  '#EC4899', // pink
  '#6366F1', // indigo
  '#10B981', // green
] as const;

/** Cycles through ACCENT_PALETTE by position — use for a list where item
 * order is stable enough that "row 3 is always indigo" reads fine (e.g. a
 * short, rarely-reordered list). */
export function accentColorForIndex(index: number): string {
  return ACCENT_PALETTE[index % ACCENT_PALETTE.length];
}

/** Hashes a string (company name, source, category, etc.) to a stable
 * palette color — use when the SAME identity should always get the SAME
 * color even as a list re-sorts/re-filters/paginates (e.g. Job Alerts,
 * where "Google" should stay the same color across every screen visit,
 * not shift because a newer alert bumped it to a different row index). */
export function accentColorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length];
}

/** The light rgba-tinted circular background used behind an icon on top of
 * an ACCENT_PALETTE color (same ~12% alpha RecentActivityList.tsx's
 * iconWrap uses) — pass a hex color from this palette. */
export function accentTintBg(color: string): string {
  return `${color}1F`;
}
