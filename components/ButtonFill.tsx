import React from 'react';
import {
  ColorValue,
  ImageBackground,
  StyleProp,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import {
  useStyleSheet,
  StyleService,
  Icon,
  useTheme,
} from '@ui-kitten/components';
import {Images} from 'assets/images';
import {globalStyle} from 'styles/globalStyle';
interface ButtonFillProps {
  icon: string;
  size?: 'large' | 'medium' | 'small' | 'tiny';
  onPress?(): void;
  style?: StyleProp<ViewStyle>;
  iconColor?: string | ColorValue;
  // Overrides the status-derived circle color with an exact value (e.g. the
  // More screen's icon rows, which now use one flat brand blue across the
  // board instead of the varied per-row status colors — see MoreSrc.tsx).
  // `status` is still accepted/used for the icon glyph's own tint fallback.
  backgroundColor?: string | ColorValue;
  // Draws a thin ring of this color around the icon shape (Settings/More
  // list rows, per explicit "subtle blue background, dark blue border"
  // request). `Images.fillActive` is a soft rounded-square (squircle) PNG,
  // not a plain rect, so a normal View borderWidth/borderRadius wouldn't
  // hug its curve — it'd draw a rectangle around the squircle's transparent
  // corners instead. Rendering a second, slightly larger copy of the same
  // tinted swatch BEHIND the real one (see the render below) produces a
  // clean border that follows the actual shape.
  borderColor?: string | ColorValue;
  status?:
    | 'basic'
    | 'danger'
    | 'placeholder'
    | 'success'
    | 'facebook'
    | 'warning'
    | 'twitter'
    | 'white'
    | 'neutral'
    | 'twitter-3'
    | 'green'
    | 'transparent'
    | 'white-blue';
}

const ButtonFill = ({
  icon = 'back',
  size = 'medium',
  status = 'basic',
  onPress,
  iconColor,
  backgroundColor,
  borderColor,
  style,
}: ButtonFillProps) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const getSize = (size: 'large' | 'medium' | 'small' | 'tiny'): number => {
    switch (size) {
      case 'large':
        return 56;
      case 'medium':
        return 40;
      case 'small':
        return 32;
      case 'tiny':
        return 24;
      default:
        return 40;
    }
  };
  const getSizeIcon = (size: 'large' | 'medium' | 'small' | 'tiny'): number => {
    switch (size) {
      case 'large':
        return 24;
      case 'medium':
        return 24;
      case 'small':
        return 24;
      case 'tiny':
        return 12;
      default:
        return 24;
    }
  };
  const getColor = (
    status:
      | 'danger'
      | 'placeholder'
      | 'success'
      | 'facebook'
      | 'basic'
      | 'warning'
      | 'twitter'
      | 'green'
      | 'white'
      | 'transparent'
      | 'twitter-3'
      | 'neutral'
      | 'white-blue',
  ): string => {
    switch (status) {
      case 'basic':
        return theme['button-basic-color'];
      case 'danger':
        return theme['color-danger-100'];
      case 'placeholder':
        return theme['text-placeholder-color'];
      case 'success':
        return theme['color-success-100'];
      case 'facebook':
        return theme['color-facebook-100'];
      case 'twitter':
        return theme['color-twitter-100'];
      case 'twitter-3':
        return theme['color-primary-300'];
      case 'warning':
        return theme['color-warning-100'];
      case 'white':
        return theme['background-basic-color-2'];
      case 'transparent':
        return theme['color-basic-700'];
      case 'neutral':
        return theme['color-basic-500'];
      case 'green':
        return theme['color-success-200'];
      case 'white-blue':
        return theme['background-basic-color-2'];
      default:
        return theme['button-basic-color'];
    }
  };
  const getTintColor = (
    status:
      | 'danger'
      | 'placeholder'
      | 'success'
      | 'facebook'
      | 'basic'
      | 'warning'
      | 'twitter'
      | 'green'
      | 'white'
      | 'transparent'
      | 'twitter-3'
      | 'neutral'
      | 'white-blue',
  ): string => {
    // BUG FIX (product report: "check the whole app" for the same
    // text-primary-color regression already found elsewhere) -- every
    // case here except 'white'/'white-blue' puts this icon on a solid,
    // OPAQUE colored circle (getColor() above: button-basic-color,
    // color-danger-100, color-success-100, etc.) and was always meant to
    // be a white icon on that circle. text-primary-color now resolves to
    // blue (see light.json), which for 'basic' is the exact same hex as
    // its own circle (#0063f8 on #0063f8 -- fully invisible) and just low-
    // contrast/wrong for the others. text-control-color is this app's
    // real "always white on a colored surface" token.
    // 'white' and 'white-blue' are left as-is -- getColor() gives BOTH of
    // those a white/near-white circle (background-basic-color-2), so a
    // blue icon there is the correct, intentional look, not a regression.
    switch (status) {
      case 'basic':
        return theme['text-control-color'];
      case 'danger':
        return theme['text-control-color'];
      case 'placeholder':
        return theme['text-control-color'];
      case 'success':
        return theme['text-control-color'];
      case 'facebook':
        return theme['text-control-color'];
      case 'twitter':
        return theme['text-control-color'];
      case 'twitter-3':
        return theme['text-control-color'];
      case 'warning':
        return theme['text-control-color'];
      case 'white':
        return theme['text-primary-color'];
      case 'transparent':
        return theme['text-control-color'];
      case 'neutral':
        return theme['text-control-color'];
      case 'green':
        return theme['text-control-color'];
      case 'white-blue':
        return theme['text-link-color'];
      default:
        return theme['text-control-color'];
    }
  };
  const sizePx = getSize(size);
  const BORDER_RING = 2;

  const fillColor = backgroundColor ? backgroundColor : getColor(status);
  const fill = (
    <ImageBackground
      source={Images.fillActive}
      imageStyle={{
        width: sizePx,
        height: sizePx,
        tintColor: fillColor,
      }}
      style={[
        styles.container,
        {
          width: sizePx,
          height: sizePx,
          // Bug fix (Android elevation-needs-an-opaque-background — see
          // globalStyle.ts's own comment): this View's own visible fill
          // came entirely from the squircle PNG's tintColor, not a real
          // `backgroundColor` on the View itself, which Android's shadow
          // renderer needs to compute a soft, correctly-shaped shadow —
          // without it these small icon circles got the same heavy gray
          // block as the bigger cards. Same color as the image tint (plus
          // a matching round borderRadius so nothing peeks past the
          // squircle's rounded corners) so nothing looks different, just
          // renders correctly.
          backgroundColor: fillColor,
          borderRadius: sizePx / 2,
        },
        style,
      ]}>
      <TouchableOpacity
        activeOpacity={0.54}
        onPress={onPress}
        style={styles.container}>
        <Icon
          pack="assets"
          name={icon ? icon : 'back'}
          style={[
            styles.icon,
            {
              width: getSizeIcon(size),
              height: getSizeIcon(size),
              tintColor: iconColor ? iconColor : getTintColor(status),
            },
          ]}
        />
      </TouchableOpacity>
    </ImageBackground>
  );

  if (!borderColor) {
    return fill;
  }

  return (
    <View
      style={{
        width: sizePx + BORDER_RING * 2,
        height: sizePx + BORDER_RING * 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <ImageBackground
        source={Images.fillActive}
        imageStyle={{
          width: sizePx + BORDER_RING * 2,
          height: sizePx + BORDER_RING * 2,
          tintColor: borderColor,
        }}
        style={{
          position: 'absolute',
          width: sizePx + BORDER_RING * 2,
          height: sizePx + BORDER_RING * 2,
        }}
      />
      {fill}
    </View>
  );
};

export default ButtonFill;

const themedStyles = StyleService.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    ...globalStyle.shadow,
  },
  icon: {
    // Always overridden by the inline tintColor from getTintColor() above
    // -- kept in sync with that function's new default (text-control-color)
    // purely for hygiene/consistency, not because this has any visible effect.
    tintColor: 'text-control-color',
  },
});
