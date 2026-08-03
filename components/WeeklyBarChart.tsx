import React, { memo } from 'react';
import { View } from 'react-native';
import { StyleService, useStyleSheet, useTheme } from '@ui-kitten/components';

import Text from './Text';
import { tileColorAt } from 'styles/tileColors';

export interface WeeklyBarChartEntry {
  day: string;
  value: number;
}

export interface WeeklyBarChartProps {
  data: WeeklyBarChartEntry[];
  /** Index of the "current"/highlighted bar (e.g. today) — rendered solid
   * instead of pastel, same "one bar stands out" treatment the reference
   * layout uses. Omit to render every bar the same pastel weight. */
  highlightIndex?: number;
  height?: number;
}

// Colorful per-bar weekly chart (product request item, explicit layout
// reference: a light/clean fitness-app screenshot's "Activity this week"
// chart — each day's bar a different pastel color with its value labeled
// on top, rounded bar caps, one bar highlighted solid). Replaces
// react-native-chart-kit's <BarChart> on MyProgress.tsx specifically for
// this — that library renders every bar in the same single flat color
// (chartConfig has one color function for the whole dataset, not a
// per-bar override), so it couldn't produce this look no matter how it
// was configured. Built from plain Views instead: full control over each
// bar's color/height/label, and no extra dependency.
const WeeklyBarChart = memo(({ data, highlightIndex, height = 140 }: WeeklyBarChartProps) => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const maxValue = Math.max(1, ...data.map(d => d.value));

  return (
    // Product bug report ("the bar values are extending out of the box") —
    // this row is bottom-anchored (`alignItems: 'flex-end'`) so every
    // column's own intrinsic height (value label + track + day label) is
    // measured from the BOTTOM up; the old `height + 36` reserved slot was
    // a few px shorter than that real intrinsic height, so the value label
    // at the very top of each column got pushed above this row's own box
    // and clipped by the card around it. `+ 56` leaves real headroom for
    // the value label's actual line-height instead of a tight estimate.
    <View style={[styles.row, { height: height + 56 }]}>
      {data.map((entry, i) => {
        const tile = tileColorAt(i);
        const isHighlighted = highlightIndex === i;
        // Minimum visual height even at 0 so every bar still reads as a
        // real (empty) bar, not a missing one.
        const barHeight = Math.max(6, Math.round((entry.value / maxValue) * height));
        return (
          <View key={`${entry.day}-${i}`} style={styles.col}>
            <Text category="h10" bold center style={{ color: isHighlighted ? theme[tile.text] : theme['text-hint-color'] }}>
              {entry.value}
            </Text>
            <View style={[styles.track, { height }]}>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: isHighlighted ? theme[tile.text] : theme[tile.bg],
                  },
                ]}
              />
            </View>
            <Text category="h10" status="placeholder" center mt={6}>
              {entry.day}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

export default WeeklyBarChart;

const themedStyles = StyleService.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  track: {
    width: '70%',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  bar: {
    width: '100%',
    borderRadius: 10,
  },
});
