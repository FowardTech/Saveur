import React from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Animated, {
  useDerivedValue,
  useAnimatedStyle,
  Easing,
  withTiming,
} from 'react-native-reanimated';
import { useTheme, Layout } from '@ui-kitten/components';

interface ProgressBarProps {
  style?: StyleProp<ViewStyle>;
  didDone: number;
  total: number;
  styleBar?: StyleProp<ViewStyle>;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
}

const ProgressBar = ({
  style,
  didDone,
  total,
  styleBar,
  minimumTrackTintColor,
  maximumTrackTintColor,
}: ProgressBarProps) => {
  const theme = useTheme();
  const [width, setWidth] = React.useState<number>(1);

  const progress = didDone / total;

  const progressValue = React.useMemo(() => {
    return progress * width;
  }, [width, progress]);

  const slider = useDerivedValue(() => {
    return progress * width;
  });

  const styleSlider = useAnimatedStyle(() => {
    return {
      width: withTiming(slider.value, {
        duration: 1000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
    };
  });

  const onLayout = React.useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    setWidth(prev => {
      if (prev !== nativeEvent.layout.width) {
        return nativeEvent.layout.width;
      }
      return prev;
    });
  }, []);

  return (
    <Layout
      level="4"
      style={[
        styles.container,
        style,
        {
          backgroundColor: maximumTrackTintColor
            ? maximumTrackTintColor
            : theme['background-basic-color-4'],
        },
      ]}
      onLayout={onLayout}
    >
      <Animated.View
        style={[
          {
            height: 4,
            backgroundColor: minimumTrackTintColor
              ? minimumTrackTintColor
              : theme['color-success-200'],
            width: progressValue,
            borderRadius: 4,
          },
          styleBar,
          styleSlider,
        ]}
      />
    </Layout>
  );
};

export default ProgressBar;

const styles = StyleSheet.create({
  container: {
    height: 4,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
});
