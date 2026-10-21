import React, { memo } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, useTheme } from '@ui-kitten/components';

import Text from './Text';

interface Props {
  tabs: string[];
  activeIndex: number;
  onChange: (index: number) => void;
}

// Reusable top segmented-tab bar (product reference — a fitness app's
// "Overview | Calories | Nutrients | Macros | Weight" row above a screen's
// content: plain text labels in one row, the active one bold with a colored
// underline, the rest muted, a hairline under the whole row). Task #64 —
// "restyle all tab screens to match this reference". Deliberately a flat
// text-tab bar (not pills/segmented-control chips) to match that reference
// exactly, distinct from other tab-like UI already in this app (e.g. the
// bottom tab bar in navigation/MainBottomTab.tsx, which is a different,
// already-polished pattern this task explicitly isn't touching).
//
// Scrollable rather than fixed-flex: MyProgress.tsx (the first consumer)
// has 3 tabs today but this needs to hold up if a future screen has more
// labels than comfortably fit one row on a small phone.
const SegmentedTabBar = memo(({ tabs, activeIndex, onChange }: Props) => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  // Indeed-style filter pills (product request: "make the mobile app also
  // have this kind of UI"): the active one is a solid dark pill with white
  // text, the rest are white pills with a hairline border -- replaces the
  // old plain-text tabs with an underline.
  return (
    <View style={styles.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {tabs.map((tab, i) => {
          const isActive = i === activeIndex;
          return (
            <TouchableOpacity
              key={tab}
              activeOpacity={0.7}
              onPress={() => onChange(i)}
              style={[
                styles.pill,
                {
                  backgroundColor: isActive ? theme['text-basic-color'] : theme['background-basic-color-2'],
                  borderColor: isActive ? theme['text-basic-color'] : theme['border-card-default'],
                },
              ]}>
              <Text
                category="h9"
                bold={isActive}
                style={{ color: isActive ? theme['background-basic-color-2'] : theme['text-basic-color'] }}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

export default SegmentedTabBar;

const themedStyles = StyleService.create({
  wrapper: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
});
