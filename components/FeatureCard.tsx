import React, {memo} from 'react';
import {StyleSheet, TouchableOpacity, View, StyleProp, ViewStyle} from 'react-native';
import {Icon, useTheme} from '@ui-kitten/components';

import Text from 'components/Text';

// Home's main cards, Indeed-style (product request: "I love how clean and not
// too much color in these Indeed mobile app UI... I want more Indeed UI"):
// a plain white card on the gray page -- a small neutral icon tile, an
// optional light-blue "Recommended"-style label, a bold dark title, gray
// subtitle and a chevron. The old App Store "Today" look (a full-color
// backdrop per card with a dark scrim and big white text) is gone; the
// `backdrop` and `icons` props are still accepted so existing callers keep
// compiling, but they no longer affect the card.
export interface FeatureCardProps {
  heroIcon: string; // eva icon name, shown in the neutral icon tile
  backdrop?: string; // unused (kept for API compatibility)
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icons?: string[]; // unused (kept for API compatibility)
  onPress: () => void;
  height?: number; // unused
  style?: StyleProp<ViewStyle>;
}

const FeatureCard: React.FC<FeatureCardProps> = memo(({heroIcon, eyebrow, title, subtitle, onPress, style}) => {
  const theme = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.wrap, {backgroundColor: theme['background-basic-color-2']}, style]}>
      <View style={styles.row}>
        <View style={[styles.iconTile, {backgroundColor: theme['background-basic-color-3']}]}>
          <Icon pack="eva" name={heroIcon} style={[styles.icon, {tintColor: theme['text-basic-color']}]} />
        </View>
        <View style={styles.texts}>
          {eyebrow ? (
            <View style={[styles.chip, {backgroundColor: 'rgba(0,99,248,0.10)'}]}>
              <Text category="h10-s" bold style={{color: theme['color-primary-100']}} numberOfLines={1}>
                {eyebrow}
              </Text>
            </View>
          ) : null}
          <Text category="h7" bold style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text category="h9-s" status="placeholder" style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Icon pack="eva" name="chevron-right-outline" style={[styles.chevron, {tintColor: theme['text-hint-color']}]} />
      </View>
    </TouchableOpacity>
  );
});

export default FeatureCard;

const styles = StyleSheet.create({
  wrap: {borderRadius: 16, marginBottom: 12, padding: 16},
  // flex-start so the icon tile's top lines up with the top of the pill/title
  // block (product request) instead of floating at the card's vertical
  // middle; the chevron stays centered via its own alignSelf.
  row: {flexDirection: 'row', alignItems: 'flex-start'},
  iconTile: {width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  icon: {width: 24, height: 24},
  texts: {flex: 1, marginHorizontal: 14},
  chip: {alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6},
  title: {fontSize: 15, lineHeight: 20},
  subtitle: {marginTop: 2},
  chevron: {width: 22, height: 22, alignSelf: 'center'},
});
