import React, {memo} from 'react';
import {StyleSheet, useWindowDimensions, View, Image} from 'react-native';
import {
  TopNavigation,
  useTheme,
  StyleService,
  useStyleSheet,
  Button,
  Icon,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import ProgressCard from '../Component/ProgressCard';
import Flex from 'components/Flex';
import ReviewTitle from '../Component/ReviewTitle';
import {RootStackParamList} from 'navigation/types';
import ReviewItem, {ReviewItemProps} from './ReviewItem';
import {Images} from 'assets/images';
import {MY_RECOMMENDED} from 'constants/Data';

const Reviews = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const {height, width, top, bottom} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['find', 'common']);

  const DATA_PROGRESS = [
    {
      id: '1',
      name: t('find:would_rehire'),
      progress: 96,
      progressStokeColor: '#FE9870',
    },
    {
      id: '1',
      name: t('find:punctual'),
      progress: 92,
      progressStokeColor: '#53D0EC',
    },
    {
      id: '1',
      name: t('find:dependable'),
      progress: 95,
      progressStokeColor: '#0EAD69',
    },
  ];
  const DATA_REVIEWS: ReviewItemProps[] = [
    {
      id: '1',
      user: MY_RECOMMENDED[0],
      date: new Date('2019-11-18'),
      rate: 4.85,
      liked: false,
      comment:
        "She was very warm and sweet with our 18 month old. Our daughter didn't cry when I left which was a great sign. She seemed happy and relaxed when I came home. We will definitely use again!",
    },
    {
      id: '2',
      user: MY_RECOMMENDED[1],
      date: new Date('2019-11-10'),
      rate: 5,
      liked: false,
      comment:
        "She was very warm and sweet with our 18 month old. Our daughter didn't cry when I left which was a great sign. She seemed happy and relaxed when I came home. We will definitely use again!",
    },
  ];

  const _onWriteReview = () => navigate('WriteReview');
  return (
    <View style={styles.container}>
      {/* Top Content */}
      <Flex mh={24} style={styles.progressContent}>
        {DATA_PROGRESS.map((item, i) => {
          return (
            <ProgressCard
              stokeColor={`${item.progressStokeColor}50`}
              title={item.name}
              progress={item.progress}
              progressStokeColor={item.progressStokeColor}
              d={84}
              strokeWidth={4}
              key={i}
            />
          );
        })}
      </Flex>
      {/* Center */}
      <Flex style={styles.reviewTitle} mh={24} mt={40} mb={32}>
        <View>
          <Text category="h3" bold mb={12}>
            {t('find:reviews')}
          </Text>
          <ReviewTitle rate={4.85} reviews={215} />
        </View>
        <Button
          status={'warning'}
          children={t('find:write_a_review')}
          size={'tiny'}
          onPress={_onWriteReview}
          accessoryLeft={<Icon pack="assets" name="edit_full" />}
        />
      </Flex>
      {DATA_REVIEWS.map((item, i) => {
        return (
          <ReviewItem
            date={item.date}
            comment={item.comment}
            user={item.user}
            rate={item.rate}
            key={i}
            id={item.id}
            liked={item.liked}
          />
        );
      })}
    </View>
  );
});

export default Reviews;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  progressContent: {
    borderBottomWidth: 1,
    borderColor: 'background-basic-color-3',
    paddingBottom: 32,
  },
  button: {
    height: 30,
  },
  reviewTitle: {
    alignItems: 'flex-end',
  },
});
