import React, { memo } from 'react';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
} from '@ui-kitten/components';
import useLayout from 'hooks/useLayout';

import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import BasicTabBar from 'components/BasicTabBar';
import ButtonFill from 'components/ButtonFill';
import { globalStyle } from 'styles/globalStyle';
import { TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { UserProps } from 'constants/Types';
import Text from 'components/Text';

interface AnimationHeaderProps {
  animationValue: SharedValue<number>;
  selectedTab: number;
  setSelectedTab(index: number): void;
  _onOption?(): void;
  tabs: string[];
  user: UserProps;
}

const AnimationHeader = memo(
  ({
    animationValue,
    selectedTab,
    setSelectedTab,
    _onOption,
    user,
    tabs,
  }: AnimationHeaderProps) => {
    const { height, top } = useLayout();
    const styles = useStyleSheet(themedStyles);
    const theme = useTheme();
    const styleHeader = useAnimatedStyle(() => {
      'worklet';
      const input = [0, height * 0.35, height * 0.45, height * 0.55];
      const opacity = interpolate(
        animationValue.value,
        input,
        [0, 0, 0, 1],
        Extrapolation.CLAMP,
      );
      const transY = interpolate(
        animationValue.value,
        input,
        [-120, -50, -15, 0],
        Extrapolation.CLAMP,
      );

      return {
        paddingTop: top,
        height: top + 112,
        opacity: opacity,
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        zIndex: 100,
        transform: [{ translateY: transY }],
        backgroundColor: theme['background-basic-color-1'],
      };
    }, [height, top, animationValue]);
    const style = useAnimatedStyle(() => {
      'worklet';
      const input = [0, height * 0.2, height * 0.25, height * 0.3];
      const topHeader = interpolate(
        animationValue.value,
        input,
        [0, 8, -top, -top * 2],
        Extrapolation.CLAMP,
      );
      return {
        position: 'absolute',
        left: 0,
        right: 0,
        top: topHeader,
        zIndex: 100,
        paddingTop: top,
      };
    }, [height, top, animationValue]);

    const [liked, setLiked] = React.useState(false);
    const _onLike = () => setLiked(!liked);
    const { goBack } = useNavigation();
    return (
      <>
        <Animated.View style={[styleHeader, styles.topNav]}>
          <TopNavigation
            appearance={'control'}
            accessoryLeft={() => <NavigationAction icon="back" />}
            accessoryRight={() => (
              <Flex justify="flex-end" itemsCenter>
                <Text
                  category="h6"
                  bold
                  maxWidth={160}
                  numberOfLines={1}
                  mr={24}
                >
                  {user.name}
                </Text>
                <TouchableOpacity activeOpacity={0.54} onPress={_onLike}>
                  <Icon
                    pack="assets"
                    name={!liked ? 'like_comment' : 'like_comment_active'}
                  />
                </TouchableOpacity>
                <NavigationAction
                  icon={'option'}
                  onPress={_onOption}
                  marginLeft={16}
                />
              </Flex>
            )}
          />
          <BasicTabBar
            style={styles.tabBar}
            onChange={setSelectedTab}
            activeIndex={selectedTab}
            tabs={tabs}
          />
        </Animated.View>
        <Animated.View style={style}>
          <Flex mh={24} mt={8}>
            <ButtonFill icon="back" status="transparent" onPress={goBack} />
            <Flex>
              <ButtonFill
                status="transparent"
                icon={liked ? 'like_comment_active' : 'like_comment'}
                style={styles.buttonLike}
                onPress={_onLike}
                iconColor={liked ? theme['text-danger-color'] : undefined}
              />
              <ButtonFill
                status="transparent"
                icon="option"
                onPress={_onOption}
              />
            </Flex>
          </Flex>
        </Animated.View>
      </>
    );
  },
);

export default AnimationHeader;

const themedStyles = StyleService.create({
  tabBar: {
    marginTop: 16,
    paddingHorizontal: 12,
    ...globalStyle.shadow,
  },
  buttonLike: {
    marginRight: 24,
  },
  topNav: {
    backgroundColor: 'background-basic-color-2',
    ...globalStyle.shadow,
  },
});
