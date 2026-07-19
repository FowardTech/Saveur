import React, {memo} from 'react';
import {View, StyleSheet} from 'react-native';
import Svg, {Circle, Defs, LinearGradient, Stop} from 'react-native-svg';

import Text from 'components/Text';

// Replaces the leftover "Care.n" raster wordmark (assets/images/logo.png,
// a caregiver-template asset) with the Saveur brand — a small gradient orb
// mark (matching the AI-coach orb used on the onboarding art and the live
// interview session screen) plus the "Saveur" name, drawn live instead of
// baked into a PNG so it can't drift out of sync with the rest of the
// brand's blue -> purple gradient (#6E8CFF -> #C58BFF).
interface BrandWordmarkProps {
  size?: number;
  markOnly?: boolean;
  color?: string;
}

const BrandWordmark: React.FC<BrandWordmarkProps> = memo(
  ({size = 40, markOnly = false, color = '#272755'}) => {
    return (
      <View style={styles.row}>
        <Svg width={size} height={size} viewBox="0 0 40 40">
          <Defs>
            <LinearGradient id="wordmarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#6E8CFF" />
              <Stop offset="100%" stopColor="#C58BFF" />
            </LinearGradient>
          </Defs>
          <Circle cx="20" cy="20" r="19" fill="url(#wordmarkGrad)" />
          <Circle cx="14" cy="14" r="5" fill="#FFFFFF" opacity="0.35" />
        </Svg>
        {!markOnly ? (
          <Text
            category="h3"
            bold
            style={[
              styles.name,
              {color, fontSize: size * 0.6, marginLeft: size * 0.22},
            ]}>
            Saveur
          </Text>
        ) : null}
      </View>
    );
  },
);

export default BrandWordmark;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    letterSpacing: 0.3,
  },
});
