import React from 'react';
import {
  ColorValue,
  ImageBackground,
  StyleProp,
  TouchableOpacity,
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
    switch (status) {
      case 'basic':
        return theme['text-primary-color'];
      case 'danger':
        return theme['text-primary-color'];
      case 'placeholder':
        return theme['text-primary-color'];
      case 'success':
        return theme['text-primary-color'];
      case 'facebook':
        return theme['text-primary-color'];
      case 'twitter':
        return theme['text-primary-color'];
      case 'twitter-3':
        return theme['text-primary-color'];
      case 'warning':
        return theme['text-primary-color'];
      case 'white':
        return theme['text-primary-color'];
      case 'transparent':
        return theme['text-primary-color'];
      case 'neutral':
        return theme['text-primary-color'];
      case 'green':
        return theme['text-primary-color'];
      case 'white-blue':
        return theme['text-link-color'];
      default:
        return theme['text-primary-color'];
    }
  };
  return (
    <ImageBackground
      source={Images.fillActive}
      imageStyle={{
        width: getSize(size),
        height: getSize(size),
        tintColor: backgroundColor ? backgroundColor : getColor(status),
      }}
      style={[
        styles.container,
        {
          width: getSize(size),
          height: getSize(size),
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
};

export default ButtonFill;

const themedStyles = StyleService.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    ...globalStyle.shadow,
  },
  icon: {
    tintColor: 'text-primary-color',
  },
});
