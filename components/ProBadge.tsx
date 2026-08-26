import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Icon } from '@ui-kitten/components';

import Text from 'components/Text';
import { globalStyle } from 'styles/globalStyle';

// FULL RESKIN (reference: "PRO" gold pill badges on the paywall/plan-picker
// screens) — Saveur had no dedicated Pro/Premium badge component before
// this; every screen that needed one either left the crown icon bare
// (MoreSrc.tsx's Add-ons/Subscription rows) or drew a plain gray circle
// (the duplicated `lockBadge` in MockInterviewSetup.tsx/ScheduleInterview.tsx
// — see LockBadge below). This is the one shared "this is a premium thing"
// visual the whole app now reuses, so a gold treatment introduced here
// cascades everywhere instead of needing a per-screen re-skin later.
//
// Solid gold->amber gradient rather than a flat fill (same two-layer
// shadow-casts-outside/gradient-clips-inside split GradientCard.tsx already
// established for this exact "shadow + rounded gradient" combination) —
// gold has no existing token in constants/theme/{light,dark}.json (this is
// the app's first use of it), so the two hex stops are literal here rather
// than theme-referenced, same convention MyProgress.tsx's bronze medal
// color already uses for a one-off accent with no home in the shared
// palette.
export const PRO_GOLD_FROM = '#F6C453';
export const PRO_GOLD_TO = '#E8A227';
// Dark, warm brown-gold rather than pure white/black — reads correctly on
// top of the gold fill in both themes without needing a separate dark-mode
// variant (this badge doesn't participate in theme['...'] tokens at all,
// same reasoning as the two gold hexes above).
export const PRO_GOLD_TEXT = '#5C3A0A';

export interface ProBadgeProps {
  /** Compact = icon-only circle (for inline row use). Full = pill with "PRO" label. */
  variant?: 'full' | 'compact';
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const ProBadge: React.FC<ProBadgeProps> = ({ variant = 'full', size = 20, style }) => {
  if (variant === 'compact') {
    return (
      <View style={[styles.compactOuter, { width: size, height: size, borderRadius: size / 2 }, style]}>
        <LinearGradient
          colors={[PRO_GOLD_FROM, PRO_GOLD_TO]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.compactInner, { borderRadius: size / 2 }]}>
          <Icon pack="assets" name="premiumAcc" style={{ width: size * 0.55, height: size * 0.55, tintColor: PRO_GOLD_TEXT }} />
        </LinearGradient>
      </View>
    );
  }
  return (
    <View style={[styles.fullOuter, style]}>
      <LinearGradient
        colors={[PRO_GOLD_FROM, PRO_GOLD_TO]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fullInner}>
        <Icon pack="assets" name="premiumAcc" style={{ width: 12, height: 12, tintColor: PRO_GOLD_TEXT, marginRight: 4 }} />
        <Text category="h10" bold style={{ color: PRO_GOLD_TEXT }}>
          PRO
        </Text>
      </LinearGradient>
    </View>
  );
};

export default ProBadge;

const styles = StyleSheet.create({
  compactOuter: {
    ...globalStyle.shadowFade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullOuter: {
    ...globalStyle.pill,
    ...globalStyle.shadowFade,
    alignSelf: 'flex-start',
  },
  fullInner: {
    ...globalStyle.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
});
