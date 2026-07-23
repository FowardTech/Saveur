import React, {memo} from 'react';
import {View, StyleSheet, Image} from 'react-native';
import {useTheme} from '@ui-kitten/components';

import Text from 'components/Text';
import {Images} from 'assets/images';

// Replaces the leftover "Care.n" raster wordmark (assets/images/logo.png,
// a caregiver-template asset) with the Saveur brand. Was a hand-drawn
// gradient orb (a plain blue->purple circle with a highlight dot) standing
// in for the mark before the real logo existed — now uses the actual Saveur
// badge artwork (assets/images/logo_square.png, the same asset used for the
// app icon/splash/avatar) so the wordmark shows the real logo instead of a
// generic placeholder circle.
interface BrandWordmarkProps {
  size?: number;
  markOnly?: boolean;
  color?: string;
}

const BrandWordmark: React.FC<BrandWordmarkProps> = memo(
  ({size = 40, markOnly = false, color}) => {
    const theme = useTheme();
    // Was hardcoded to '#272755' (a fixed dark navy) — fine in light mode,
    // but on the Login screen (the only caller that renders the text, not
    // just the mark) that's a dark color on a dark background in dark mode,
    // reading as invisible. `text-basic-color` is Eva's own themed "primary
    // text" token and flips automatically with light/dark, same as every
    // other themed Text in the app. No caller currently passes an explicit
    // `color`, but the prop stays available for anyone who needs a fixed
    // color regardless of theme (e.g. white text on a permanently-colored
    // background).
    const resolvedColor = color ?? theme['text-basic-color'];
    return (
      <View style={styles.row}>
        <Image
          source={Images.logoBadge}
          style={{
            width: size,
            height: size,
            borderRadius: size * 0.22,
          }}
        />
        {!markOnly ? (
          <Text
            category="h3"
            bold
            style={[
              styles.name,
              // Real Montserrat Alternates Black — assets/fonts/
              // MontserratAlternates-Black.ttf, wired into both platforms
              // (ios/caren_family/Info.plist's UIAppFonts + Xcode's Copy
              // Bundle Resources, and android/app/src/main/res/font/
              // montserratalternates_black.ttf). `bold` above still applies
              // via Text's own category styling as a fallback for any
              // platform/build where the custom font isn't loaded yet.
              {fontFamily: 'MontserratAlternates-Black'},
              {color: resolvedColor, fontSize: size * 0.6, marginLeft: size * 0.22},
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
