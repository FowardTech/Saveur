// Small color-math helper (full reskin support) — used to derive a
// lighter "from" stop for a two-tone gradient ring from whatever single
// base color a screen already resolves via theme (e.g.
// theme['color-success-500']), instead of hand-picking a disconnected
// light hex per semantic color that could drift out of sync with the base
// tone. Mixes the given hex toward white by `amount` (0-1).
//
// Falls back to returning the input unchanged if it isn't a parseable
// #rgb/#rrggbb hex (e.g. an rgba() string or an unresolved theme key) —
// callers using this for a gradient "from" stop degrade to a same-color
// (invisible) gradient rather than crashing, which is an acceptable
// fallback for a purely decorative highlight.
export function lightenColor(hex: string, amount = 0.4): string {
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex?.trim() ?? '');
  if (!match) return hex;
  let normalized = match[1];
  if (normalized.length === 3) {
    normalized = normalized.split('').map(c => c + c).join('');
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}
