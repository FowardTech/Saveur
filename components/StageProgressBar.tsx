import React from 'react';
import {View, StyleSheet} from 'react-native';
import {useTheme} from '@ui-kitten/components';

import Text from './Text';

interface Props {
  /** 1-based current stage/module. */
  current: number;
  total: number;
  label?: string;
}

// Segmented progress bar pinned under the top navigation: completed and
// current stages are filled purple, upcoming stages are muted.
const StageProgressBar = ({current, total, label}: Props) => {
  const theme = useTheme();
  const count = Math.max(1, Math.round(total));
  const done = Math.min(Math.max(current, 0), count);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {Array.from({length: count}).map((_, i) => (
          <View
            key={i}
            style={[
              styles.seg,
              {backgroundColor: i < done ? '#7C5CFF' : theme['background-basic-color-3']},
            ]}
          />
        ))}
      </View>
      {label ? (
        <Text category="h10" bold status="placeholder" mt={6}>
          {label}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8},
  row: {flexDirection: 'row', gap: 4},
  seg: {flex: 1, height: 6, borderRadius: 3},
});

export default StageProgressBar;
