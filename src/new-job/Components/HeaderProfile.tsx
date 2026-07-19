import React, {memo} from 'react';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
} from '@ui-kitten/components';
import useLayout from 'hooks/useLayout';

import Animated, {
  Extrapolate,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import ButtonFill from 'components/ButtonFill';
import {globalStyle} from 'styles/globalStyle';
import {View} from 'react-native';

interface HeaderProfileProps {
  animationValue: SharedValue<number>;
  _onOption?(): void;
  _onBack?(): void;
  userName: string;
}

const HeaderProfile = memo(
  ({animationValue, _onOption, _onBack, userName}: HeaderProfileProps) => {
    const {height, top} = useLayout();
    const styles = useStyleSheet(themedStyles);
    const styleHeader = useAnimatedStyle(() => {
      const input = [0, height * 0.5, height * 0.6, height * 0.7];
      const heightHeader = interpolate(
        animationValue.value,
        input,
        [0, 0, 52, 60],
        Extrapolate.CLAMP,
      );
      const opacity = interpolate(
        animationValue.value,
        input,
        [0, 0, 0, 1],
        Extrapolate.CLAMP,
      );
      const inTop = interpolate(
        animationValue.value,
        input,
        [0, 0, 0, top + 8],
        Extrapolate.CLAMP,
      );
      return {
        height: heightHeader,
        opacity: opacity,
        marginTop: inTop,
      };
    });
    const style = useAnimatedStyle(() => {
      const input = [0, height * 0.3, height * 0.35, height * 0.45];
      const topHeader = interpolate(
        animationValue.value,
        input,
        [top + 16, top - 16, -top, -top * 2],
        Extrapolate.CLAMP,
      );
      return {
        position: 'absolute',
        left: 0,
        right: 0,
        top: topHeader,
        zIndex: 100,
      };
    });

    return (
      <View style={{marginTop: -top - 16}}>
        <Animated.View style={[styleHeader, styles.topNav]}>
          <TopNavigation
            appearance={'control'}
            accessoryLeft={<NavigationAction icon="back" onPress={_onBack} />}
            title={userName}
            accessoryRight={
              <Flex justify="flex-end" itemsCenter>
                <NavigationAction
                  icon={'option'}
                  onPress={_onOption}
                  marginLeft={16}
                />
              </Flex>
            }
          />
        </Animated.View>
        <Animated.View style={style}>
          <Flex mh={24} mt={8}>
            <ButtonFill icon="back" status="transparent" onPress={_onBack} />
            <Flex>
              <ButtonFill
                status="transparent"
                icon="option"
                onPress={_onOption}
              />
            </Flex>
          </Flex>
        </Animated.View>
      </View>
    );
  },
);

export default HeaderProfile;

const themedStyles = StyleService.create({
  tabBar: {
    paddingHorizontal: 12,
  },
  buttonLike: {
    marginRight: 24,
  },
  topNav: {
    backgroundColor: 'background-basic-color-2',
  },
});
