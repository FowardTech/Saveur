import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme, Layout } from '@ui-kitten/components';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';

import Text from 'components/Text';

interface Props {
  style?: ViewStyle;
  disabled?: boolean;
  selectedIndex: number;
  onChange(index: number): void;
  tabs: string[];
  height?: number;
  width?: number;
}

const TabBar = ({
  style,
  selectedIndex,
  disabled,
  onChange,
  tabs,
  height,
  width,
}: Props) => {
  const theme = useTheme();
  const transX = useSharedValue(0);

  const [widthItem, setWidthItem] = React.useState(0);

  React.useEffect(() => {
    transX.value = widthItem * selectedIndex;
  }, [selectedIndex, transX, widthItem]);

  const animatedStyles = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      transX.value,
      [0, widthItem * 1],
      [theme['button-basic-color'], theme['button-basic-color']],
    );

    return {
      transform: [
        {
          translateX: withSpring(transX.value, {
            stiffness: 100,
            damping: 15,
          }),
        },
      ],
      backgroundColor: backgroundColor,
    };
  });

  return (
    <Layout
      level="3"
      style={[
        styles.container,
        { height: height ? height : 40, width: width },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.boxAni,
          animatedStyles,
          { width: `${100 / tabs.length}%`, height: height ? height : 40 },
        ]}
        onLayout={({ nativeEvent }) => setWidthItem(nativeEvent.layout.width)}
      />
      {tabs.map((item, index) => {
        return (
          <TouchableOpacity
            style={styles.btn}
            key={index}
            disabled={disabled}
            onPress={() => onChange(index)}
          >
            <Text
              capitalize
              bold
              category="h8"
              status={selectedIndex === index ? 'primary' : 'placeholder'}
            >
              {item}
            </Text>
          </TouchableOpacity>
        );
      })}
    </Layout>
  );
};

export default TabBar;

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  boxAni: {
    position: 'absolute',
    borderRadius: 8,
  },
  btn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
