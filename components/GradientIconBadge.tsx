import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';

// iOS-Settings-style icon badge -- a colored rounded-square chip behind
// each icon glyph. Used everywhere an icon needs this treatment: Menu/More
// rows' ButtonOptional icons + the logout row, Home's Career Toolkit
// icons, Today's Career Focus's mic icon, the Practice tab's schedule
// card, Career Diary/Dream Companies' "add" triggers, Recent Activity's
// per-type icons, and more.
//
// REDESIGN (product follow-up: "this icon's background color is divided
// into 2 halves. The upper part is light and the lower part is darker...
// make the darker part light as the upper part so that the background is
// just one color") -- this used to be a diagonal two-tone LinearGradient
// (a lighter tint on one corner, a genuinely darker shade on the other,
// meant to read as "glossy") plus a separate white sheen overlay on the
// top half on top of that. Both of those are gone now -- just one flat
// fill, so every badge in the app reads as a single uniform color instead
// of a two-tone split.
//
// RETINTED (product follow-up: "The colors are too bright make them a
// little darker... I dont want this app to look like a children's app")
// -- was shaded +22 (lighter than the caller's own color, on top of
// several already-vivid base hexes like MoreSrc.tsx's STATUS_COLORS),
// which read as pastel/candy-colored at app-wide scale. Shaded -8 for one
// pass (moderately darker than the caller's true color).
//
// RETINTED AGAIN, immediate follow-up ("Now you know what just make them
// a little more lighter or even just make them subtle versions of that
// same color except the ones in the continue & upcoming card") -- -8 read
// as a bit too dark/heavy the other way. Default shade is +16 now (a
// gentle, "subtle" lift off the caller's true color -- lighter than -8,
// but nowhere near the original +22 "too bright" complaint). The default
// applies to every badge EXCEPT the ones explicitly excluded per the
// same ask: ContinueLearningCard.tsx and NextLessonHomeCard.tsx (the
// "Continue & Upcoming" row's own icon badges) pass their own explicit
// `shade={-8}` to keep the darker look from the previous pass, since
// those two are the one place asked to stay as-is.
//
// Takes a single `color` (the same hex any caller used to pass straight to
// `backgroundColor` before) rather than an explicit two-color array --
// callers don't need to hand-pick anything, so every existing
// per-row/per-action color (MoreSrc.tsx's STATUS_COLORS, the per-icon
// hexes in HomeSrc.tsx's Career Toolkit) keeps working unchanged, just
// passed through as `color` instead of `backgroundColor`. `shade` is the
// one thing individual callers can now override away from the shared
// default, for exactly this kind of "everywhere except one place" ask.
function shadeColor(hex: string, percent: number): string {
  const normalized = hex.replace('#', '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map(c => c + c)
          .join('')
      : normalized;
  const num = parseInt(expanded, 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

interface GradientIconBadgeProps {
  color: string;
  size: number;
  // Defaults to ~28% of the badge's side length, the same squircle
  // proportion the iOS Settings reference screenshot's own app icons use
  // (see ButtonOptional.tsx's iconWrap history -- 9/32 there).
  radius?: number;
  // How far to shade `color` before filling the badge with it -- positive
  // lightens, negative darkens. Defaults to +16 (see this file's own
  // RETINTED AGAIN comment above); ContinueLearningCard.tsx/
  // NextLessonHomeCard.tsx pass -8 to opt out of that default and keep
  // their own darker look.
  shade?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const GradientIconBadge: React.FC<GradientIconBadgeProps> = ({
  color,
  size,
  radius,
  shade = 16,
  style,
  children,
}) => {
  const borderRadius = radius ?? size * 0.28;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: shadeColor(color, shade),
        },
        style,
      ]}>
      {children}
    </View>
  );
};

export default GradientIconBadge;
