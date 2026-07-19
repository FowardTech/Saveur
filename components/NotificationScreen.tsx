import React, {memo} from 'react';
import {StyleSheet, Image, View} from 'react-native';
import {Button} from '@ui-kitten/components';

import Text from './Text';
import Container from './Container';

import {SuccessScreenType} from 'constants/Types';
import {Images} from 'assets/images';
import useLayout from 'hooks/useLayout';
import {globalStyle} from 'styles/globalStyle';

const NotificationScreen = memo(
  ({
    title,
    description,
    children,
    buttonsViewStyle,
    logo,
  }: SuccessScreenType) => {
    const {width, height} = useLayout();
    const sizeIMG = 160 * (width / 375);

    return (
      <Container style={styles.container}>
        <View style={styles.top}>
          <View>
            <Image
              style={{
                width: width,
                marginTop: 36,
                height: 294 * (height / 812),
              }}
              source={Images.successBg}
            />
            {logo === undefined ? (
              <Image
                style={{
                  width: sizeIMG,
                  height: sizeIMG,
                  position: 'absolute',
                  bottom: 30,
                  alignSelf: 'center',
                }}
                source={Images.success}
              />
            ) : (
              <Image
                style={{
                  width: sizeIMG,
                  height: 142 * (width / 375),
                  position: 'absolute',
                  bottom: 30,
                  alignSelf: 'center',
                }}
                source={Images.logoSuccess}
              />
            )}
          </View>
          <Text center category="h2" mb={8} mt={56} bold>
            {title}
          </Text>
          <Text category="h8-s" center mb={44} mh={24} >
            {description}
          </Text>
          {children?.map((item, i) => {
            return (
              <Button
                key={i}
                style={[
                  item.status === 'basic' ? globalStyle.shadowBtn : undefined,
                  {alignItems: 'center', marginBottom: 16},
                  buttonsViewStyle,
                ]}
                children={item?.title}
                status={item?.status}
                onPress={item?.onPress}
              />
            );
          })}
        </View>
      </Container>
    );
  },
);

export default NotificationScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image: {
    width: 160,
    height: 160,
    alignSelf: 'center',
  },
  top: {
    flex: 1,
  },
  bottom: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 24,
    paddingHorizontal: 86,
  },
});
