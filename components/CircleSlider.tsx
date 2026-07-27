import React from 'react';
import { ColorValue, StyleSheet, View } from 'react-native';
import Animated, {
  useDerivedValue,
  useSharedValue,
  withTiming,
  useAnimatedProps,
  Easing,
} from 'react-native-reanimated';
import { ReText } from 'react-native-redash';
import Svg, { Circle } from 'react-native-svg';
import Flex from './Flex';
import Text from './Text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
interface CircleProps {
  value: number;
  stokeColor: string | ColorValue;
  progressStokeColor: string | ColorValue;
  d: number;
  strokeWidth: number;
}
export default function CircleProgressBar({
  value,
  progressStokeColor,
  stokeColor,
  d,
  strokeWidth = 4,
}: CircleProps) {
  const progress = useSharedValue(0);
  // Keep the stroke fully inside the d x d SVG canvas: R must leave room for
  // half the strokeWidth on every side, otherwise the ring's outer edge
  // extends past the canvas and gets clipped by the SVG's own bounds (this
  // was the "edges of the circle are cut off" bug — the previous R
  // calculation let the stroke overflow the canvas by a few px on every
  // side).
  const R = (d - strokeWidth) / 2;
  const CIRCLE_LENGTH = 2 * Math.PI * R;
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCLE_LENGTH * (1 - progress.value),
  }));

  React.useEffect(() => {
    progress.value = withTiming(value / 100 > 0 ? value / 100 : 0, {
      duration: 3000,
      easing: Easing.bezier(0.1, 0.3, 0.5, 1),
    });
  }, [progress, value]);

  const progressText = useDerivedValue(() => {
    return `${Math.floor(progress.value * 100)}`;
  }, [value, progress.value]);
  return (
    <View style={[styles.container, { width: d, height: d }]}>
      <Svg
        style={[
          styles.svg,
          // Rotate just the SVG (not the whole view + text) -90deg so the
          // ring starts at 12 o'clock instead of SVG's default 3 o'clock.
          // The old version rotated the outer View -88deg and then
          // counter-rotated the text +88deg to compensate — rotating only
          // the SVG is simpler and doesn't risk the text/layout box drifting.
          { width: d, height: d, transform: [{ rotateZ: '-90deg' }] },
        ]}
      >
        <Circle
          cx={d / 2}
          cy={d / 2}
          r={R}
          stroke={stokeColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={d / 2}
          cy={d / 2}
          r={R}
          stroke={progressStokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={CIRCLE_LENGTH}
          animatedProps={animatedProps}
          strokeLinecap={'round'}
          fill="none"
        />
      </Svg>
      <Flex itemsCenter>
        <ReText style={styles.progressText} text={progressText} />
        <Text category="h8" mt={2} ml={1}>
          %
        </Text>
      </Flex>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  progressText: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'Roboto-Medium',
    color: '#272755',
  },
});
