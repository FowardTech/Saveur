import React from 'react';
import Text from 'components/Text';
import CircleSlider from 'components/CircleSlider';
import {
  ColorValue,
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';

interface ProgressCardProps extends ViewProps {
  title: string;
  progress: number;
  stokeColor: string | ColorValue;
  progressStokeColor: string | ColorValue;
  d?: number;
  strokeWidth: number;
  style?: StyleProp<ViewStyle>;
  // Redesign v2 (full reskin) — see CircleSlider.tsx's own comment; optional
  // and additive, existing call sites that only pass progressStokeColor are
  // unaffected.
  progressGradientFrom?: string;
  progressGradientTo?: string;
}

const ProgressCard = ({
  title,
  progress,
  progressStokeColor,
  stokeColor,
  d = 84,
  strokeWidth = 4,
  style,
  progressGradientFrom,
  progressGradientTo,
  ...rest
}: ProgressCardProps) => {
  return (
    <View style={[styles.container, style]} {...rest}>
      <CircleSlider
        value={progress}
        d={d}
        strokeWidth={strokeWidth}
        progressStokeColor={progressStokeColor}
        stokeColor={stokeColor}
        progressGradientFrom={progressGradientFrom}
        progressGradientTo={progressGradientTo}
      />
      <Text mt={12} category="h9" numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
};

export default ProgressCard;
const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
});
