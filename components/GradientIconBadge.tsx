import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

// iOS-Settings-style icon badge (product reference screenshot + follow-up:
// "The icon background in screenshot i showed you are glossy gradient. So
// you need to check that") -- every icon badge in the app (Menu/More rows'
// ButtonOptional icons + the logout row, Home's Career Toolkit icons, and
// Today's Career Focus's mic icon) previously used a single flat
// `backgroundColor`, which read as matte/flat next to the reference
// screenshot's own glossy two-tone badges. One shared component so all of
// those converge on the exact same effect instead of three separate
// hand-rolled copies: a diagonal two-tone LinearGradient (derived from one
// base color -- lighter toward the top-left corner, darker toward the
// bottom-right, the same "light source from upper-left" convention real
// iOS icon gloss uses) plus a soft semi-transparent white sheen across the
// badge's top half for the actual glossy highlight, not just a plain flat
// gradient fill.
//
// Takes a single `color` (the same hex any caller used to pass straight to
// `backgroundColor` before) rather than an explicit two-color array --
// callers don't need to hand-pick a matching light/dark pair, so every
// existing per-row/per-action color (MoreSrc.tsx's STATUS_COLORS, the
// per-icon hexes in HomeSrc.tsx's Career Toolkit) keeps working unchanged,
// just passed through as `color` instead of `backgroundColor`.
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
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const GradientIconBadge: React.FC<GradientIconBadgeProps> = ({
  color,
  size,
  radius,
  style,
  children,
}) => {
  const borderRadius = radius ?? size * 0.28;
  return (
    <View
      style={[
        { width: size, height: size, borderRadius, overflow: 'hidden' },
        style,
      ]}>
      {/* Product follow-up, round 2: "remove the darker color of the icons
          linear gradient" -- round 1 dropped the artificially darkened end
          (shadeColor(color, -22)) but kept the caller's true base color as
          the other stop, which still read as "the darker one" next to the
          lighter tint beside it. Neither stop is the true base color now --
          both are light tints of it (shadeColor at +34/+14), so the
          gradient is a subtle light-to-lighter sheen instead of ever
          landing on (or going past) the color's own real saturation. */}
      <LinearGradient
        colors={[shadeColor(color, 34), shadeColor(color, 14)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Gloss sheen -- a translucent white wash over just the top half,
          the piece a plain two-tone gradient alone doesn't give you. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '50%',
          backgroundColor: 'rgba(255,255,255,0.25)',
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
        }}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GradientIconBadge;
