import React from 'react';
import {View, ImageBackground} from 'react-native';
import {useTheme, StyleService, useStyleSheet} from '@ui-kitten/components';
import {useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import {Images} from 'assets/images';

export interface ExpItemProp {
  title: string;
  age: string;
  exp: string;
}

const ExpItem = ({title, age, exp}: ExpItemProp) => {
  const {goBack} = useNavigation();
  const {height, width, top, bottom} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  return (
    <View style={styles.container}>
      <ImageBackground
        source={Images.fill}
        style={styles.img}
        /* @ts-ignore */
        imageStyle={styles.img}>
        <Text category="h6" status="primary" bold center mt={14}>
          {exp}
        </Text>
      </ImageBackground>
      <Text category="h7" mt={12}>
        {title}
      </Text>
      <Text category="h10" status={'placeholder'}>
        {age}
      </Text>
    </View>
  );
};

export default ExpItem;

const themedStyles = StyleService.create({
  container: {
    alignItems: 'center',
  },
  img: {
    width: 56,
    height: 56,
    tintColor: 'color-primary-300',
  },
});
