import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Layout, useTheme } from '@ui-kitten/components';

import Text from 'components/Text';
import ProgressBar from 'components/ProgressBar';
import Flex from './Flex';

interface Props {
  tabs: string[];
  level?: string;
  style?: ViewStyle;
  activeIndex: number;
  onChange(index: number): void;
}

const BasicTabBar = ({ style, activeIndex, onChange, tabs }: Props) => {
  const theme = useTheme();
  const changeIndex = React.useCallback(
    (i: number) => {
      return onChange(i);
    },
    [activeIndex],
  );

  return (
    <Flex style={[styles.container, style]}>
      {tabs.map((item, i) => {
        const RenderProgress = React.useCallback(() => {
          return (
            <ProgressBar
              didDone={activeIndex + 1}
              total={activeIndex + 1}
              style={[styles.line]}
              minimumTrackTintColor={
                activeIndex === i ? theme['text-link-color'] : 'transparent'
              }
              maximumTrackTintColor="transparent"
            />
          );
        }, [activeIndex]);
        return (
          <TouchableOpacity
            onLayout={event => event.nativeEvent.layout.width}
            key={i}
            onPress={() => changeIndex(i)}
            activeOpacity={0.54}
          >
            <Text
              mb={8}
              mh={12}
              category="h8"
              status={activeIndex === i ? 'link' : 'placeholder'}
              uppercase
              bold
            >
              {item}
            </Text>
            <Layout />
            <RenderProgress />
          </TouchableOpacity>
        );
      })}
    </Flex>
  );
};

export default BasicTabBar;

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    overflow: 'hidden',
    maxHeight: 32,
    flex: 1,
  },
  boxAni: {
    height: 2,
    position: 'absolute',
    bottom: 0,
  },

  line: {
    width: 32,
    alignSelf: 'center',
    height: 2,
  },
});
