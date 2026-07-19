import React, {memo} from 'react';
import {Image} from 'react-native';
import {StyleService, useStyleSheet, Layout} from '@ui-kitten/components';
import {useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Container from 'components/Container';
import Carousel from 'react-native-snap-carousel';
import {DATA_COVER} from './CaregiverProfile';
import keyExtractor from 'utils/keyExtractor';
import ButtonFill from 'components/ButtonFill';

const ProfileGallery = memo(() => {
  const {goBack} = useNavigation();
  const {height, width, top, bottom} = useLayout();
  const styles = useStyleSheet(themedStyles);

  const [index, setIndex] = React.useState(0);
  const refCarousel = React.useRef(null);
  return (
    <Container style={styles.container} useSafeArea={false}>
      <ButtonFill
        icon="close"
        style={[styles.top, {top: top + 8}]}
        status="transparent"
        onPress={goBack}
      />
      {/* <Carousel
        ref={refCarousel}
        data={DATA_COVER}
        itemWidth={width}
        itemHeight={height}
        enableSnap
        loop
        autoplay
        autoplayDelay={0.1}
        inactiveSlideScale={1}
        sliderWidth={width}
        firstItem={index}
        inactiveSlideOpacity={0.5}
        onSnapToItem={e => {
          setIndex(e);
        }}
        renderItem={({item}) => {
          return <Image source={item} style={{width: width, height: height}} />;
        }}
        keyExtractor={keyExtractor}
      /> */}
      <Layout style={[styles.text, {bottom: bottom + 8}]} level="6">
        <Text category="h10" mh={10} mv={2} status="primary" center>
          {index + 1}/{DATA_COVER.length}
        </Text>
      </Layout>
    </Container>
  );
});

export default ProfileGallery;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  text: {
    borderRadius: 12,
    position: 'absolute',
  },
  top: {
    position: 'absolute',
    zIndex: 100,
    left: 16,
  },
});
