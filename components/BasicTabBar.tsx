import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '@ui-kitten/components';

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
                changed, per the literal ask.

                BUG FIX (product report: "the active tab background and
                color is not nice in dark mode and in light mode it just
                changes to black background") — the active tab previously
                had no deliberate background treatment at all; the only
                thing painting a background near it was a stray, unstyled
                `<Layout />` sitting between this Flex and the underline
                below (removed here). That bare Layout defaults to
                UI Kitten's level="1" background (background-basic-color-1
                -- a real, if faint, painted color, not "no color"),
                identically for every tab regardless of active state, so it
                wasn't even the thing distinguishing the active tab -- it
                was just unrelated dead weight. The active tab now gets its
                own explicit, deliberate pill: a subtle brand-blue tint
                (color-primary-transparent-100, a low-opacity overlay that
                reads correctly against both light.json's and dark.json's
                background colors, unlike a flat theme color that can
                clash with one theme or the other) behind just its own
                label, so switching tabs shows a clear, theme-consistent
                highlight instead of an incidental background block. */}
            <Flex
              itemsCenter
              mh={12}
              mb={8}
              ph={activeIndex === i ? 10 : 0}
              pv={activeIndex === i ? 4 : 0}
              border={activeIndex === i ? 8 : 0}
              style={activeIndex === i ? {backgroundColor: theme['color-primary-transparent-100']} : undefined}
            >
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
    // Was 32 -- the active tab's new pill background (see the render
    // block's own comment) adds a few px of vertical padding around its
    // label that 32 was clipping the bottom of via this container's own
    // overflow:'hidden'.
    maxHeight: 40,
    // BUG FIX (product report: "the Network Assistant title header
    // container is covering the tabs" -- the tab bar wasn't showing up
    // AT ALL, even after a clean rebuild ruled out a stale bundle) --
    // `flex: 1` here doesn't do what it looks like it does. This
    // component (a Flex/TouchableOpacity) sits directly inside a plain
    // `<Layout>` wrapper (NetworkingAssistant.tsx's tabBarWrap,
    // RequestsSrc.tsx's ListHeaderComponent) that has no fixed height of
    // its own -- it sizes to its content, the default column-flex
    // behavior. Give a child `flex: 1` (flex-grow: 1, flex-basis: 0%) in
    // that situation and Yoga has no defined "extra space" to grow into,
    // so it resolves the child's height to 0 -- not "shows past its
    // content", literally zero, hence the tab bar rendering as if it
    // didn't exist at all, with the screen's content appearing to butt
    // right up against the header above it. This was never actually
    // needed for `justifyContent: 'space-between'` to spread the tabs
    // across the full width either -- RN's default `alignItems: 'stretch'`
    // on the parent Layout already gives this element 100% width with no
    // `flex` needed; `flex: 1` was only ever fighting itself here.
    flex: undefined,
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
