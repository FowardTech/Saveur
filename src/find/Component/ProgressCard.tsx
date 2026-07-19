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
}

const ProgressCard = ({
  title,
  progress,
  progressStokeColor,
  stokeColor,
  d = 84,
  strokeWidth = 4,
  style,
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
