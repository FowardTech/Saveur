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
              style={styles.tab}>
              <Text
                category="h9"
                bold={isActive}
                style={{ color: isActive ? theme['text-basic-color'] : theme['text-hint-color'] }}>
                {tab}
              </Text>
              <View
                style={[
                  styles.underline,
                  { backgroundColor: isActive ? theme['color-primary-500'] : 'transparent' },
                ]}
              />
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
    borderBottomWidth: 1,
    borderBottomColor: 'border-basic-color-3',
  },
  row: {
    flexDirection: 'row',
  },
  tab: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
    marginRight: 6,
  },
  underline: {
    height: 3,
    borderRadius: 2,
    alignSelf: 'stretch',
    marginTop: 8,
  },
});
