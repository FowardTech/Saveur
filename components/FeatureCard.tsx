import React, {memo} from 'react';
import {Image, StyleSheet, TouchableOpacity, View, StyleProp, ViewStyle} from 'react-native';
import {Icon} from '@ui-kitten/components';
import LinearGradient from 'react-native-linear-gradient';

import Text from 'components/Text';

// Illustrated "feature" card (App Store "Today" style): full-bleed photo,
// dark scrim, then eyebrow label, bold title, one-line subtitle and a row
// of small icon tiles along the bottom. Used for Home's main cards.
export interface FeatureCardProps {
  imageUri: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icons?: string[]; // eva icon names shown as small tiles
  onPress: () => void;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

const FeatureCard: React.FC<FeatureCardProps> = memo(
  ({imageUri, eyebrow, title, subtitle, icons = [], onPress, height = 230, style}) => (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.wrap, {minHeight: height}, style]}>
      <Image source={{uri: imageUri}} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        {eyebrow ? (
          <Text category="h10" bold style={styles.eyebrow} numberOfLines={1}>
            {eyebrow.toUpperCase()}
          </Text>
        ) : null}
        <Text category="h5" bold style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text category="h9-s" style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {icons.length ? (
          <View style={styles.iconRow}>
            {icons.map((name, i) => (
              <View key={`${name}-${i}`} style={styles.iconTile}>
                <Icon pack="eva" name={name} style={styles.icon} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  ),
);

export default FeatureCard;

const styles = StyleSheet.create({
  wrap: {borderRadius: 22, overflow: 'hidden', marginBottom: 16, backgroundColor: '#27272A'},
  content: {flex: 1, justifyContent: 'flex-end', padding: 16, paddingTop: 80},
  eyebrow: {color: 'rgba(255,255,255,0.85)', letterSpacing: 0.8, marginBottom: 4},
  title: {color: '#FFFFFF'},
  subtitle: {color: 'rgba(255,255,255,0.85)', marginTop: 4},
  iconRow: {flexDirection: 'row', marginTop: 12},
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  icon: {width: 20, height: 20, tintColor: '#18181B'},
});
