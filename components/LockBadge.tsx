import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Icon } from '@ui-kitten/components';

import { PRO_GOLD_FROM, PRO_GOLD_TO, PRO_GOLD_TEXT } from 'components/ProBadge';
import { globalStyle } from 'styles/globalStyle';

// Extracted from two identical copies (src/practice/MockInterviewSetup.tsx
// and src/practice/ScheduleInterview.tsx both had their own `lockBadge`
// style — same 20x20 circle, same plain gray `background-basic-color-3`
// fill, same lock-outline glyph) into one shared component while giving it
// the new gold "this needs Pro" treatment, same gradient ProBadge.tsx uses,
// instead of a neutral gray dot that didn't visually connect to Pro/Premium
// at all. Absolute-positioned top-right by default (both call sites used
// it that way, overlaid on a card) — pass `style` to reposition.
export interface LockBadgeProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const LockBadge: React.FC<LockBadgeProps> = ({ size = 20, style }) => {
  return (
    <View style={[styles.outer, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <LinearGradient
        colors={[PRO_GOLD_FROM, PRO_GOLD_TO]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.inner, { borderRadius: size / 2 }]}>
        <Icon pack="eva" name="lock-outline" style={{ width: size * 0.6, height: size * 0.6, tintColor: PRO_GOLD_TEXT }} />
      </LinearGradient>
    </View>
  );
};

export default LockBadge;

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    top: 8,
    right: 8,
    ...globalStyle.shadowFade,
  },
  inner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
