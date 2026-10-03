import React, {memo} from 'react';
import {Image, ImageSourcePropType, StyleSheet, TouchableOpacity, View, StyleProp, ViewStyle} from 'react-native';
import {Icon, useTheme} from '@ui-kitten/components';

import Text from 'components/Text';

// Illustrated "feature" card: an illustration shown whole (resizeMode
// "contain") on a soft panel, then eyebrow, bold title, one-line subtitle
// and a row of small icon tiles. Illustrations are unDraw artwork
// (open license) recolored to the Saveur blue so every card shares one
// palette — see assets/images/home/.
export interface FeatureCardProps {
  image: ImageSourcePropType;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icons?: string[]; // eva icon names shown as small tiles
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

const FeatureCard: React.FC<FeatureCardProps> = memo(({image, eyebrow, title, subtitle, icons = [], onPress, style}) => {
  const theme = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.wrap,
        {backgroundColor: theme['background-basic-color-2'], borderColor: theme['border-card-default']},
        style,
      ]}>
      <View style={styles.art}>
        <Image source={image} style={styles.artImage} resizeMode="contain" />
      </View>
      <View style={styles.content}>
        {eyebrow ? (
          <Text category="h10" bold status="placeholder" style={styles.eyebrow} numberOfLines={1}>
            {eyebrow.toUpperCase()}
          </Text>
        ) : null}
        <Text category="h5" bold numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text category="h9-s" status="placeholder" mt={4} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {icons.length ? (
          <View style={styles.iconRow}>
            {icons.map((name, i) => (
              <View key={`${name}-${i}`} style={[styles.iconTile, {backgroundColor: theme['background-basic-color-3'], borderColor: theme['border-card-default']}]}>
                <Icon pack="eva" name={name} style={[styles.icon, {tintColor: theme['text-basic-color']}]} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

export default FeatureCard;

const styles = StyleSheet.create({
  wrap: {borderRadius: 22, overflow: 'hidden', marginBottom: 16, borderWidth: 1},
  // Fixed light panel in both themes: the artwork has dark outlines that
  // would vanish on a dark card.
  art: {backgroundColor: '#F4F7FF', height: 170, padding: 12},
  artImage: {width: '100%', height: '100%'},
  content: {padding: 16},
  eyebrow: {letterSpacing: 0.8, marginBottom: 4},
  iconRow: {flexDirection: 'row', marginTop: 12},
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  icon: {width: 20, height: 20},
});
