import React from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '@ui-kitten/components';

import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';

interface DotsProps<T> {
  translationValue: SharedValue<number>;
  data: Array<T>;
  widthInterpolate?: number;
  widthDot?: number;
  heightDot?: number;
  style?: StyleProp<ViewStyle>;
}
function Dots<T>({
  data,
  translationValue,
  widthInterpolate = 8,
  widthDot = 8,
  heightDot = 8,
  style,
}: DotsProps<T>) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  return (
    <View style={[styles.container, style]}>
      {data.map((_, i) => {
        const dotColor = useDerivedValue(() => {
          return interpolateColor(
            translationValue.value,
            [(i - 1) * width, i * width, (i + 1) * width],
            [
              theme['color-primary-400'],
              theme['color-primary-100'],
              theme['color-primary-400'],
            ],
          );
        });

        const dotWidth = useDerivedValue(() => {
          return interpolate(
            translationValue.value,
            [(i - 1) * width, i * width, (i + 1) * width],
            [widthDot, widthInterpolate, widthDot],
            Extrapolation.CLAMP,
          );
        });

        const dotStyle = useAnimatedStyle(() => {
          return {
            backgroundColor: dotColor.value,
            width: dotWidth.value,
            height: heightDot,
          };
        });

        return (
          <Animated.View key={i.toString()} style={[styles.dot, dotStyle]} />
        );
      })}
    </View>
  );
}

export default Dots;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    marginHorizontal: 4,
  },
});
