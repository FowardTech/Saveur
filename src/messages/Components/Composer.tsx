import React from "react";
import { View, TouchableOpacity, ViewStyle, StyleProp } from "react-native";
import { useStyleSheet, StyleService, Icon } from "@ui-kitten/components";
import { globalStyle } from "styles/globalStyle";
import useKeyboard from "hooks/useKeyboard";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Flex from "components/Flex";
interface ComposerProps {
  style?: StyleProp<ViewStyle>;
  onShowAction(): void;
}

const Composer = ({ style, onShowAction }: ComposerProps) => {
  const styles = useStyleSheet(themedStyles);
  const { keyboardShow } = useKeyboard();
  const animatedAction = useDerivedValue(() => {
    if (keyboardShow) {
      return withTiming(1, {
        duration: 500,
        easing: Easing.bezier(0.1, 0.3, 0.5, 1),
      });
    } else {
      return withSpring(0);
    }
  }, [keyboardShow]);

  const styleAni = useAnimatedStyle(() => {
    const width = interpolate(animatedAction.value, [0, 0.5, 1], [40, 20, 0]);
    const opacity = interpolate(animatedAction.value, [0, 0.9, 1], [1, 0, 0]);
    return {
      width: width,
      opacity: opacity,
    };
  });
  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <TouchableOpacity activeOpacity={0.54} onPress={onShowAction}>
          <Icon pack="assets" name="addMore" style={styles.icon} />
        </TouchableOpacity>
        <Animated.View style={styleAni}>
          <Flex>
            <TouchableOpacity>
              <Icon pack="assets" name="camera" style={styles.icon} />
            </TouchableOpacity>
            <TouchableOpacity>
              <Icon pack="assets" name="photoLibrary" style={styles.icon} />
            </TouchableOpacity>
          </Flex>
        </Animated.View>
      </View>
    </View>
  );
};

export default Composer;

const themedStyles = StyleService.create({
  container: {
    ...globalStyle.flexDirection,
  },
  content: {
    flexDirection: "row",
    marginRight: 8,
    alignItems: "center",
  },
  icon: {
    tintColor: "button-basic-color",
    ...globalStyle.icon24,
    marginLeft: 16,
  },
});
