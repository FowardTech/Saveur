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
    // Explicit per-call override — was a declared field on
    // SuccessScreenType that this component never actually read (every
    // caller either got the generic Images.success checkmark or, with
    // `logo: true`, the Saveur logo). Now used by the payment-success
    // screen specifically (see Images.paymentSuccessCheck's own comment)
    // to show a different icon without touching the shared `logo` branch
    // every other SuccessScr caller (signup, student verification) also
    // relies on.
    image,
  }: SuccessScreenType) => {
    const {width, height} = useLayout();
    // BUG FIX (product report, with screenshot: "Interview Complete" --
    // the checkmark is too big, reduce it to a moderate size) -- 160 was
    // this component's original full-hero-graphic sizing; 120 is closer to
    // logoSize's (112) proportion below, still clearly the focal graphic
    // but no longer dominating the whole top of the screen.
    const sizeIMG = 120 * (width / 375);
    // Medium, not the old oversized 160-wide block the placeholder gradient
    // circle used to render at (and squashed non-square, 160x142, since
    // that placeholder wasn't actually meant to be a logo). This is a true
    // square badge (Images.logoSuccess is now the real app icon artwork —
    // see assets/images/index.ts) sized down and gently rounded so it reads
    // as a logo mark, not a hero graphic.
    const logoSize = 112 * (width / 375);

    return (
      <Container style={styles.container}>
        <View style={styles.top}>
          <View>
            {/* Was Images.successBg — scattered pastel polka-dot/confetti
                shapes behind the logo/checkmark. Kept as a plain, empty
                spacer (same reserved height) rather than removed outright,
                since the logo/checkmark image below is positioned
                absolutely within this box and relies on it for layout. */}
            <View
              style={{
                width: width,
                marginTop: 36,
                height: 294 * (height / 812),
              }}
            />
            {image ? (
              <Image
                style={{
                  width: logoSize,
                  height: logoSize,
                  position: 'absolute',
                  bottom: 30,
                  alignSelf: 'center',
                }}
                source={image}
              />
            ) : logo === undefined ? (
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
                  width: logoSize,
                  height: logoSize,
                  borderRadius: logoSize * 0.22,
                  overflow: 'hidden',
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
