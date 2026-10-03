import React, {memo} from 'react';
import {Image, StyleSheet, View, StyleProp, ViewStyle} from 'react-native';

import {ICON3D, Icon3DName} from 'utils/icon3d';

// 3D icon on a plain solid-color rounded tile. Used for nav, settings rows
// and other key spots so icons match the 3D illustrations on Home.
interface Icon3DProps {
  name: Icon3DName;
  size?: number;
  radius?: number;
  color?: string; // override the default backdrop
  round?: boolean;
  style?: StyleProp<ViewStyle>;
}

const Icon3D: React.FC<Icon3DProps> = memo(({name, size = 40, radius, color, round, style}) => {
  const def = ICON3D[name];
  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: round ? size / 2 : radius ?? Math.round(size * 0.3),
          backgroundColor: color ?? def.color,
        },
        style,
      ]}>
      <Image source={def.src} style={{width: size * 0.72, height: size * 0.72}} resizeMode="contain" />
    </View>
  );
});

export default Icon3D;

const styles = StyleSheet.create({
  tile: {alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
});
