import React, {memo} from 'react';
import {StyleSheet, TouchableOpacity, View, StyleProp, ViewStyle} from 'react-native';
import {StyleService, useStyleSheet, useTheme, Icon} from '@ui-kitten/components';
import LinearGradient from 'react-native-linear-gradient';

import Text from 'components/Text';

// Product follow-up ("This button is not look nice. Make it look better") --
// the original "Discuss this interview with your coach" button was a plain
// UI-Kitten `status="basic"` Button, which in this app's theme renders as a
// solid saturated blue fill (constants/theme/light.json's
// button-basic-color). At this label's full length that wrapped to two
// centered lines with the accessoryLeft icon sitting above them instead of
// inline -- UI-Kitten's Button icon+text layout isn't built for long,
// wrapping labels.
//
// Rebuilt here as its own row, matching the same "subtle tint + colored
// border + icon in a gradient circle" card language this app's SYMPHONY
// REDESIGN already uses everywhere else (see ActionCard.tsx's
// accentColor/iconGradientColors variant, used for the Home screen's
// Practice/Explore cards) -- left-aligned icon badge, left-aligned text
// that wraps naturally onto as many lines as it needs, chevron on the
// right. Shared by both InterviewFeedback.tsx and InterviewReplay.tsx so
// the two "Discuss this interview with your coach" buttons stay visually
// identical.
export interface DiscussCoachButtonProps {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

// Same blue pair as HomeSrc.tsx's Explore card icon badge
// (ActionCard's iconGradientColors) -- this button's whole point is "go
// talk to the coach", so it borrows that card's blue rather than
// introducing a new accent color just for this one row.
const ICON_GRADIENT: [string, string] = ['#2d76db', '#3B9DFF'];

const DiscussCoachButton: React.FC<DiscussCoachButtonProps> = memo(({label, onPress, style}) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.row, style]}>
      <View style={styles.iconWrap}>
        <LinearGradient colors={ICON_GRADIENT} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={StyleSheet.absoluteFillObject} />
        <Icon pack="eva" name="message-circle-outline" style={styles.icon} />
      </View>
      <Text category="h8" bold style={styles.label}>
        {label}
      </Text>
      <Icon pack="eva" name="chevron-right-outline" style={[styles.chevron, {tintColor: theme['color-basic-400']}]} />
    </TouchableOpacity>
  );
});

export default DiscussCoachButton;

const themedStyles = StyleService.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'color-primary-500',
    backgroundColor: 'color-primary-transparent-100',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  icon: {
    width: 18,
    height: 18,
    tintColor: '#FFFFFF',
  },
  label: {
    flex: 1,
  },
  chevron: {
    width: 18,
    height: 18,
    marginLeft: 6,
  },
});
