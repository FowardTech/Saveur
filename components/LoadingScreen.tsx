import React, {memo} from 'react';
import {StyleSheet, useWindowDimensions, View, Image} from 'react-native';
import {
  TopNavigation,
  useTheme,
  StyleService,
  useStyleSheet,
} from '@ui-kitten/components';
import {useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import AnimatedLottieView from 'lottie-react-native';
import {Images} from 'assets/images';

const LoadingScreen = memo(() => {
  const {goBack} = useNavigation();
  const {height, width, top, bottom} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  return (
    <View style={styles.container}>
      <AnimatedLottieView
        source={Images.loading}
        autoPlay
        speed={1}
        style={styles.animated}
        loop
      />
    </View>
  );
});

export default LoadingScreen;

const themedStyles = StyleService.create({
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animated: {
    width: 200,
    height: 200,
  },
});
