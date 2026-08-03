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

const DEFAULT_COLORS = ['#047857', '#059669'];

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
    // Explicit, not left to implicit flex-stretch — react-native-linear-
    // gradient's LinearGradient (below) is a native-backed view with no
    // content of its own to derive an intrinsic size from, unlike a plain
    // View; being explicit here removes any ambiguity about whether it
    // actually receives the parent's full width in every layout context
    // this card gets used in (defensive fix — see checkInCard's own
    // recurring width/clipping bug history in src/home/HomeSrc.tsx).
    width: '100%',
  },
  inner: {
    overflow: 'hidden',
    width: '100%',
  },
});
