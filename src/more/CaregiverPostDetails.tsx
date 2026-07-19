import React, {memo} from 'react';
import {Image, View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Layout,
  Avatar,
  Button,
} from '@ui-kitten/components';
import {useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {Images} from 'assets/images';
import NavigationAction from 'components/NavigationAction';
import Flex from 'components/Flex';
import ButtonFill from 'components/ButtonFill';
import {globalStyle} from 'styles/globalStyle';
import {DATA_CURRENT_APPLICATION} from 'constants/Data';
import OnlStatus from 'components/OnlStatus';
import Personal from 'src/find/Component/Personal';
import dayjs from 'dayjs';
import Weekdays from 'components/Weekdays';
import Description from 'src/requests/Applications/Description';

const CaregiverPostDetails = memo(() => {
  const {goBack} = useNavigation();
  const {height, width, top, bottom} = useLayout();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'common']);

  const animationValue = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler(event => {
    animationValue.value = event.contentOffset.y;
  });
  const styleHeader = useAnimatedStyle(() => {
    const input = [0, height * 0.5, height * 0.6, height * 0.7];
    const heightHeader = interpolate(
      animationValue.value,
      input,
      [0, 0, 60, 60 + 52],
      Extrapolate.CLAMP,
    );
    const opacity = interpolate(
      animationValue.value,
      input,
      [0, 0, 0, 1],
      Extrapolate.CLAMP,
    );
    const marginTop = interpolate(
      animationValue.value,
      input,
      [0, 0, 0, top],
      Extrapolate.CLAMP,
    );
    return {
      height: heightHeader,
      opacity: opacity,
      marginTop: marginTop,
    };
  });
  const style = useAnimatedStyle(() => {
    const input = [0, height * 0.3, height * 0.35, height * 0.45];
    const topHeader = interpolate(
      animationValue.value,
      input,
      [top, top, -top, -top * 2],
      Extrapolate.CLAMP,
    );
    return {
      position: 'absolute',
      left: 0,
      right: 0,
      top: topHeader,
      zIndex: 100,
    };
  });
  const styleImg = useAnimatedStyle(() => {
    const input = [0, height * 0.3, height * 0.35, height * 0.45];
    const heightImg = interpolate(
      animationValue.value,
      input,
      [height / 1.5, height / 3, -height, -height * 2],
      Extrapolate.CLAMP,
    );
    return {
      height: heightImg,
      width: '100%',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    };
  });

  const [data, setData] = React.useState(DATA_CURRENT_APPLICATION[0]);

  const _onOption = () => {};
  return (
    <Container style={styles.container} useSafeArea={false}>
      <Animated.View style={[styleHeader, styles.topNav]}>
        <TopNavigation
          appearance={'control'}
          accessoryLeft={<NavigationAction icon="back" />}
          accessoryRight={
            <NavigationAction
              icon={'option'}
              onPress={_onOption}
              marginLeft={16}
            />
          }
        />
      </Animated.View>
      <Animated.View style={[style]}>
        <Flex mh={24} mt={8}>
          <ButtonFill icon="back" status="transparent" onPress={goBack} />
          <ButtonFill status="transparent" icon="option" onPress={_onOption} />
        </Flex>
      </Animated.View>
      <Animated.Image source={Images.cover} style={styleImg} />
      <Animated.ScrollView
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: 260 * (height / 812),
          },
        ]}
        bounces={false}>
        <Layout style={styles.layout}>
          <View style={styles.avatar}>
            <Avatar shape="rounded" source={data.user.avatar} size="giant" />
            <OnlStatus status={data.user.onlineState} />
          </View>
          <Personal user={data.user} trustedFamily={true} carePro={true} />
          <Text category="h2" bold mb={16}>
            {data.jobDescription}
          </Text>
          <Text mb={16}>1 Children - John - Dogs</Text>
          <Flex>
            <View style={styles.startTime}>
              <Text category="h8" status={'placeholder'} bold>
                Start
              </Text>
              <Text category="h6" status={'basic'} bold>
                {dayjs(data.startTime).format('ddd, MMM DD')}
              </Text>
            </View>
            <View>
              <Text category="h8" status={'placeholder'} bold>
                Hours
              </Text>
              <Text category="h6" status={'basic'} bold>
                {data.meetingTime}
              </Text>
            </View>
          </Flex>
          <Flex mt={24}>
            <View style={styles.tag}>
              <Text category="h8-s" bold center status={'primary'}>
                {t('common:regularly')}
              </Text>
            </View>
            <Weekdays data={data.dayInWeek} status="primary" size="large" />
          </Flex>
          <Text mt={32} mb={16}>
            Rochester, NY
          </Text>
          <Image
            source={Images.map}
            style={{
              width: width,
              height: 200 * (height / 812),
              marginBottom: 56,
            }}
          />
          <Description
            tagQualifications={TAG_QUALIFICATIONS}
            tagResponsibilities={TAG_RESPONSIBILITIES}
          />
        </Layout>
      </Animated.ScrollView>
      <Layout style={[styles.bottom, {paddingBottom: bottom + 8}]}>
        <View>
          <Text category="h3" bold>
            {data.price}
          </Text>
          <Text category="h8">(215 reviews)</Text>
        </View>
        <Button
          children={t('more:edit-post')}
          style={styles.btnEdit}
          size="giant"
        />
      </Layout>
    </Container>
  );
});

export default CaregiverPostDetails;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  topNav: {
    backgroundColor: 'background-basic-color-1',
  },
  layout: {
    ...globalStyle.topBorder24,
    paddingHorizontal: 24,
  },
  avatar: {
    marginTop: -48,
    alignItems: 'center',
    alignSelf: 'center',
  },
  startTime: {
    width: 124,
  },
  tag: {
    backgroundColor: 'color-primary-300',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 16,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    ...globalStyle.shadowFade,
    paddingHorizontal: 24,
    ...globalStyle.topBorder24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  btnEdit: {
    paddingHorizontal: 24,
    borderRadius: 16,
  },
});
const TAG_QUALIFICATIONS = [
  'Has a car',
  'Comfortable with pets',
  'Will provide sick care',
  'None Smoking',
  'College educated',
  'Background Check',
];
const TAG_RESPONSIBILITIES = [
  'Driving the kids',
  'Prepares food',
  'Sleep training',
  'Potty Training',
  'Will provide sick care',
];
