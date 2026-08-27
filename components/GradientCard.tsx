import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { globalStyle } from 'styles/globalStyle';

// Reusable "hero" card (full reskin, product request item — "screenshot 3"
// reference: "big rounded gradient cards"). Wraps react-native-linear-
// gradient (already a dependency — see src/practice/LiveInterviewSession.tsx
// / src/messages/VoiceCoachView.tsx for existing usage) with the same soft
// shadow globalStyle.card uses elsewhere, so a gradient card sits at the
// same visual "weight" as every plain card on screen instead of looking
// like a one-off.
//
// Two-layer split, same reasoning as HomeSrc.tsx's homeBannerCard/
// homeBannerCardInner: the outer View casts the shadow against an opaque
// fallback background; the inner LinearGradient clips to the rounded
// corners via overflow:'hidden' (a single view can't cast a shadow and
// clip its own content at the same time).
//
// Defaults to Saveur's own brand-blue gradient (color-primary-100 →
// color-primary-200, both from constants/theme/appTheme.json) — NOT pink,
// per the explicit "that's not our primary color" product direction for
// this reskin. Pass `colors` to override for a specific card (e.g. a
// warning/success-tinted variant).
export interface GradientCardProps {
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
  children?: React.ReactNode;
}

const DEFAULT_COLORS = ['#0063f8', '#1DA1F2'];

const GradientCard: React.FC<GradientCardProps> = ({
  colors = DEFAULT_COLORS,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  style,
  contentStyle,
  borderRadius = 20,
  children,
}) => {
  return (
    <View style={[styles.outer, { borderRadius, backgroundColor: colors[0] }, style]}>
      <LinearGradient
        colors={colors}
        start={start}
        end={end}
        style={[styles.inner, { borderRadius }, contentStyle]}>
        {children}
      </LinearGradient>
    </View>
  );
};

export default GradientCard;

const styles = StyleSheet.create({
  outer: {
    ...globalStyle.card,
    // BUG FIX (product report, with screenshot: "the inner gradient is
    // cutting off the svg icons on the right ... expand the width of the
    // inner gradient card") — `width: '100%'` is a PERCENTAGE, resolved
    // against this view's own parent (a plain, unsized TouchableOpacity
    // relying on the default column stretch to get its width in the
    // first place). Nesting a percentage inside a size that itself only
    // exists because of stretch is exactly the kind of chain Yoga (RN's
    // layout engine) doesn't always resolve identically on every pass —
    // on some devices/timings `inner` below (a second, INDEPENDENT
    // percentage-of-outer's-own-content-box) would end up a few px
    // narrower than `outer`'s actual rendered shape, so the SVG
    // illustration anchored to the right edge (heroArtWrap in
    // src/home/HomeSrc.tsx) rendered past `inner`'s true boundary and got
    // sliced off by `inner`'s own `overflow: 'hidden'`, while `outer`'s
    // same-color rounded shape kept going a little further right,
    // underneath — invisible, but leaving no room for the icon.
    // `alignSelf: 'stretch'` instead asks Yoga to directly match this
    // view's cross-axis size to its parent's, with no percentage
    // arithmetic involved, which is the robust fix for this whole class
    // of bug (same reasoning applied to `inner` below).
    alignSelf: 'stretch',
  },
  inner: {
    overflow: 'hidden',
    // See `outer`'s comment above — `inner` has no `width` at all now.
    // It's the sole child of `outer` (a plain View, which stretches its
    // children to its own full content-box width by default), so it
    // already fills `outer` exactly with zero arithmetic, guaranteeing
    // the two always match pixel-for-pixel instead of relying on two
    // separately-resolved percentages staying in sync.
  },
});
