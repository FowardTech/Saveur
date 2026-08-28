import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
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
  /** Optional, index-matched to `tabs` — a positive count renders a small
   * pill badge next to that tab's label (product request: "the Career
   * event should have a count badge to indicate new event that just came
   * in"). Omit entirely (existing call sites do) for the original
   * plain-label look; a `0`/`undefined` entry at a given index just means
   * that tab has no badge. */
  badgeCounts?: (number | undefined)[];
}

const BasicTabBar = ({ style, activeIndex, onChange, tabs, badgeCounts }: Props) => {
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
            {/* Active tab label was status="link" (theme blue) — per
                explicit follow-up ("The hover color on the tab buttons
                texts should be black not blue") this is now the app's own
                near-black text-basic-color instead, via an explicit style
                override (status stays 'placeholder'/'basic' for the base
                color/weight, the override wins since it's applied after —
                see components/Text.tsx). The underline/progress indicator
                below keeps its accent color; only the label text itself
                changed, per the literal ask. */}
            <Flex itemsCenter mh={12} mb={8}>
              <Text
                category="h8"
                status="placeholder"
                style={activeIndex === i ? {color: theme['text-basic-color']} : undefined}
                uppercase
                bold
              >
                {item}
              </Text>
              {badgeCounts?.[i] ? (
                <View style={[styles.badge, {backgroundColor: theme['color-danger-500']}]}>
                  <Text category="h10" status="control" bold fontSize={10} lineHeight={12}>
                    {badgeCounts[i]! > 9 ? '9+' : badgeCounts[i]}
                  </Text>
                </View>
              ) : null}
            </Flex>
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
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
