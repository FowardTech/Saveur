import React, {memo} from 'react';
import {StyleSheet, TouchableOpacity, View, StyleProp, ViewStyle} from 'react-native';
import {Icon} from '@ui-kitten/components';
import LinearGradient from 'react-native-linear-gradient';

import Text from 'components/Text';

// "Feature" card (App Store "Today" style): plain solid-color backdrop with a
// large white line icon, a dark scrim at the bottom, then eyebrow label, big
// bold title, one-line subtitle and a row of small icon tiles. Used for
// Home's main cards.
export interface FeatureCardProps {
  heroIcon: string; // eva icon name, shown large in white on the backdrop
  backdrop: string; // solid backdrop color
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icons?: string[]; // eva icon names shown as small tiles
  onPress: () => void;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

const FeatureCard: React.FC<FeatureCardProps> = memo(
  ({heroIcon, backdrop, eyebrow, title, subtitle, icons = [], onPress, height = 360, style}) => (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.wrap, {minHeight: height, backgroundColor: backdrop}, style]}>
      <View style={styles.artTile}>
        <Icon pack="eva" name={heroIcon} style={styles.artIcon} />
      </View>
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.62)']}
        locations={[0, 0.38, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        {eyebrow ? (
          <Text category="h9-s" bold style={styles.eyebrow} numberOfLines={1}>
            {eyebrow.toUpperCase()}
          </Text>
        ) : null}
        <Text category="h3" bold style={styles.title} numberOfLines={3}>
          {title}
        </Text>
        {subtitle ? (
          <Text category="h8-s" style={styles.subtitle} numberOfLines={2}>
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
  wrap: {borderRadius: 28, overflow: 'hidden', marginBottom: 20, backgroundColor: '#27272A'},
  artTile: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artIcon: {width: 40, height: 40, tintColor: '#FFFFFF'},
  content: {flex: 1, justifyContent: 'flex-end', padding: 20, paddingTop: 200},
  eyebrow: {color: 'rgba(255,255,255,0.9)', letterSpacing: 0.8, marginBottom: 6},
  title: {color: '#FFFFFF', fontSize: 32, lineHeight: 37, letterSpacing: -0.5},
  subtitle: {color: 'rgba(255,255,255,0.9)', marginTop: 6},
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
