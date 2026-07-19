import React, {memo} from 'react';
import {View, Image} from 'react-native';
import {
  useTheme,
  StyleService,
  useStyleSheet,
  Layout,
  Avatar,
  Input,
  Button,
  Icon,
} from '@ui-kitten/components';
import {
  NavigationAction,
  NavigationProp,
  useNavigation,
} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import FocusAwareStatusBar from 'components/FocusAwareStatusBar';
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {Images} from 'assets/images';
import Personal from 'src/find/Component/Personal';
import HeaderProfile from './Components/HeaderProfile';
import OnlStatus from 'components/OnlStatus';
import {Controller, useForm} from 'react-hook-form';
import Flex from 'components/Flex';
import Weekdays from 'components/Weekdays';
import {globalStyle} from 'styles/globalStyle';
import Tag from 'src/find/Component/Tag';
import {DATA_QUALIFICATION} from './Qualifications';
import {DATA_RES} from './SelectResponsibilities';
import {RootStackParamList} from 'navigation/types';
import {MY_FAVORITES} from 'constants/Data';
const CreatePostDetails = memo(() => {
  const {navigate, goBack} =
    useNavigation<NavigationProp<RootStackParamList>>();
  const {height, width, top, bottom} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['creat_job', 'common']);

  const translationY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler(event => {
    translationY.value = event.contentOffset.y;
  });
  const styleCover = useAnimatedStyle(() => {
    const heightAnim = interpolate(
      translationY.value,
      [height / 2, 0],
      [0, height / 2.4 + 120],
      Extrapolate.CLAMP,
    );
    return {
      position: 'absolute',
      left: 0,
      width: width,
      resizeMode: 'cover',
      height: heightAnim,
      top: 0,
    };
  });

  const {
    control,
    handleSubmit,
    getValues,
    formState: {errors},
  } = useForm({
    defaultValues: {
      title: '',
      description: '',
    },
  });
  const _onOption = () => {};
  const _postNow = () => {
    navigate('MainBottomTab');
  };
  return (
    <Container style={styles.container}>
      <FocusAwareStatusBar barStyle="dark-content" />
      <Animated.Image source={Images.cover} style={styleCover} />
      <HeaderProfile
        animationValue={translationY}
        userName={'Marian Ramsey'}
        _onBack={goBack}
        _onOption={_onOption}
      />
      <Animated.ScrollView
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        contentContainerStyle={styles.containerStyle}
        style={[
          styles.content,
          {
            paddingTop: 280 * (height / 812),
          },
        ]}>
        <Layout level={'1'} style={globalStyle.topBorder24}>
          <Layout style={styles.layout}>
            <View style={styles.topContent}>
              <Avatar
                source={Images.avatar10}
                shape="rounded"
                /* @ts-ignore */
                style={styles.avatar}
                size="giant"
              />
              <OnlStatus />
            </View>
            <Personal
              user={MY_FAVORITES[4]}
              trustedFamily={true}
              carePro={true}
            />
          </Layout>
          <Layout style={styles.input} level="1">
            <Controller
              control={control}
              name="title"
              render={({field: {onChange, onBlur, value}}) => (
                <Input
                  status={errors.title ? 'warning' : 'basic'}
                  style={styles.title}
                  placeholder={t('creat_job:add-job-title')}
                  value={value}
                  onTouchStart={handleSubmit(() => {})}
                  onTouchEnd={handleSubmit(() => {})}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  size="composer"
                  autoCorrect={false}
                  appearance="arena"
                  autoFocus
                  keyboardType="email-address"
                  caption={errors.title?.message}
                />
              )}
            />
            <Text right mt={16} status="placeholder" category="h8">
              {getValues('title').length}/500
            </Text>
          </Layout>
          {/* Content */}
          <Text mt={24} mh={24}>
            1 Children - John - Dogs
          </Text>
          {/* Time start, Hours */}
          <Flex mt={16}>
            <Flex vertical mh={24}>
              <Text category="h8" uppercase bold status={'placeholder'}>
                {t('common:start')}
              </Text>
              <Text category="h6" bold mt={8}>
                Tue, Otc 14
              </Text>
            </Flex>
            <Flex vertical justify="flex-start" mh={24}>
              <Text category="h8" uppercase bold status={'placeholder'}>
                {t('common:hours')}
              </Text>
              <Text category="h6" bold mt={8}>
                08:00 - 12:00
              </Text>
            </Flex>
          </Flex>
          {/* Regularly,Date */}
          <Flex itemsCenter mt={24} mh={24}>
            <Layout level={'8'} style={styles.status}>
              <Text category="h9" status={'primary'} bold>
                {t('common:regularly')}
              </Text>
            </Layout>
            <Weekdays data={DAY_IN_WEEK} status="primary" size="large" />
          </Flex>
          {/* Map */}
          <Text mt={32} mb={16} ml={24}>
            Rochester, NY
          </Text>
          <Image source={Images.map} />
          <Text category="h3" bold mt={56} ml={24} mb={24}>
            {t('creat_job:description')}
          </Text>
          <Icon
            pack="assets"
            name="quote"
            style={{tintColor: theme['color-basic-400'], marginLeft: 24}}
          />
          <Controller
            control={control}
            name="description"
            render={({field: {onChange, onBlur, value}}) => (
              <Input
                style={styles.description}
                value={value}
                onTouchStart={handleSubmit(() => {})}
                onTouchEnd={handleSubmit(() => {})}
                onChangeText={text => {
                  onChange(text);
                }}
                placeholder={t('creat_job:des-pl-input')}
                onBlur={onBlur}
                keyboardType="email-address"
                maxLength={500}
                multiline
                appearance="arena"
                size="large"
                textStyle={styles.textStyle}
              />
            )}
          />
          <Text right mt={16} mr={24} status="placeholder" category="h8">
            {getValues('description').length}/500
          </Text>
          <View style={styles.underline}>
            <Text category="h3" bold mb={24} mt={56}>
              {t('creat_job:qualifications')}
            </Text>
            {DATA_QUALIFICATION.map((item, i) => {
              if (item.checked) {
                return <Tag title={item.title} key={i} />;
              } else return null;
            })}
          </View>
          <View style={styles.underline}>
            <Text category="h3" bold mb={24}>
              {t('creat_job:qualifications')}
            </Text>
            {DATA_RES.map((item, i) => {
              if (item.checked) {
                return <Tag title={item.title} key={i} />;
              } else return null;
            })}
          </View>
        </Layout>
      </Animated.ScrollView>
      <Layout style={[styles.bottom, {paddingBottom: bottom + 8}]} level="2">
        <Flex itemsCenter>
          <Text category="h3" bold>
            $15-$20/hr
          </Text>
          <Button
            children={t('creat_job:post-now')}
            size="large"
            onPress={_postNow}
            disabled={
              getValues('title').length === 0 &&
              getValues('description').length === 0
            }
          />
        </Flex>
      </Layout>
    </Container>
  );
});

export default CreatePostDetails;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    backgroundColor: 'background-basic-color-1',
    paddingBottom: 0,
  },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  containerStyle: {
    paddingBottom: 380,
  },
  topContent: {
    alignSelf: 'center',
  },
  layout: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  avatar: {
    marginTop: -48,
    alignSelf: 'center',
    zIndex: 100,
  },
  title: {
    borderBottomWidth: 2,
  },
  input: {
    borderTopWidth: 2,
    borderColor: 'background-basic-color-3',
    marginHorizontal: 24,
    paddingTop: 32,
  },
  status: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 8,
  },
  textStyle: {
    fontFamily: 'GothamPro',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
  },
  description: {
    marginHorizontal: 24,
  },
  underline: {
    borderBottomWidth: 2,
    borderColor: 'background-basic-color-3',
    marginHorizontal: 24,
    paddingBottom: 24,
    marginBottom: 56,
  },
  bottom: {
    ...globalStyle.topBorder24,
    paddingHorizontal: 24,
    paddingVertical: 16,
    ...globalStyle.shadowFade,
  },
});
const DAY_IN_WEEK = [
  {
    title: 'Sun',
    isActive: false,
  },
  {
    title: 'Mon',
    isActive: false,
  },
  {
    title: 'Tue',
    isActive: true,
  },
  {
    title: 'Wed',
    isActive: true,
  },
  {
    title: 'Thu',
    isActive: true,
  },
  {
    title: 'Fri',
    isActive: false,
  },
  {
    title: 'Sat',
    isActive: false,
  },
];
