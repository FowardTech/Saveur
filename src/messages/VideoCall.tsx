import React, {memo} from 'react';
import {View, Image, ImageBackground} from 'react-native';
import {StyleService, useStyleSheet} from '@ui-kitten/components';
import {useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Container from 'components/Container';
import LoadingIndicator from 'components/LoadingIndicator';
import {Images} from 'assets/images';
import useToggle from 'hooks/useToggle';
import Flex from 'components/Flex';
import ButtonFill from 'components/ButtonFill';

const VideoCall = memo(() => {
  const {goBack} = useNavigation();
  const {height, width, top, bottom} = useLayout();
  const styles = useStyleSheet(themedStyles);

  const [loading, setLoading] = useToggle(true);
  React.useEffect(() => {
    if (loading) {
      setTimeout(() => {
        return setLoading();
      }, 3000);
      clearTimeout(1);
    }
  }, [loading]);

  const [isMute, setIsMute] = useToggle(false);
  const [cameraOff, setCameraOff] = useToggle(false);
  const onVideo = React.useCallback(() => {
    setCameraOff();
  }, []);
  const onCallOff = React.useCallback(() => {
    goBack();
  }, []);
  const onMicrophone = React.useCallback(() => {
    setIsMute();
  }, []);
  return (
    <Container style={styles.container} useSafeArea={false}>
      <ImageBackground
        source={Images.videoCall}
        style={{}}
        imageStyle={{width: width, height: height}}>
        {loading ? (
          <LoadingIndicator
            size={'giant'}
            style={{
              position: 'absolute',
              zIndex: 10,
              top: 0,
              left: 0,
              right: 0,
              width: width,
              bottom: 0,
              backgroundColor: 'rgba(30, 31, 32, 0.86)',
              height: height,
            }}
          />
        ) : (
          <View
            style={{
              width: width,
              height: height,
              justifyContent: 'space-between',
            }}>
            <Image
              source={Images.cameraCall}
              /* @ts-ignore */
              style={[styles.camera, {marginTop: top + 16}]}
            />
            <Flex
              style={[styles.bottomField, {marginBottom: bottom + 16}]}
              itemsCenter>
              <ButtonFill
                icon={!cameraOff ? 'videoOff' : 'videoOn'}
                size="medium"
                status="twitter"
                onPress={onVideo}
              />
              <ButtonFill
                icon="callOff"
                size="large"
                status="danger"
                onPress={onCallOff}
              />
              <ButtonFill
                icon={!isMute ? 'mute' : 'interview'}
                size="medium"
                status="placeholder"
                onPress={onMicrophone}
              />
            </Flex>
          </View>
        )}
      </ImageBackground>
    </Container>
  );
});

export default VideoCall;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {},
  camera: {
    alignSelf: 'flex-end',
    marginRight: 24,
  },
  bottomField: {
    marginHorizontal: 24,
  },
});
