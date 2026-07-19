import React, {memo} from 'react';
import {Image} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Layout,
  Button,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import {RootStackParamList} from 'navigation/types';
import NavigationAction from 'components/NavigationAction';
import IRecommended from 'components/IRecommended';
import {MY_FAVORITES} from 'constants/Data';
import Flex from 'components/Flex';
import Weekdays from 'components/Weekdays';
import {Images} from 'assets/images';

const ReviewRequestBooking = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();

  const styles = useStyleSheet(themedStyles);

  const {t} = useTranslation(['request', 'common']);

  const _onSendRequest = React.useCallback(() => {
    navigate('SuccessScr', {
      successScr: {
        title: t('request:request-sent'),
        description: t('request:request-done'),
        children: [
          {
            title: t('request:go-dashboard'),
            onPress: () => navigate('MainBottomTab'),
            status: 'basic',
          },
        ],
        buttonsViewStyle: {marginHorizontal: 32},
      },
    });
  }, []);

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('request:review')}
        accessoryLeft={<NavigationAction />}
      />

      <Content contentContainerStyle={styles.content}>
        <Layout style={styles.padder}>
          <Text category="h6" bold mb={24}>
            {t('request:bookingWith')}
          </Text>
          <IRecommended item={MY_FAVORITES[4]} />
          <Text category="h6" bold mb={16}>
            {t('request:when')}
          </Text>
          <Text mb={8}>Tue, Otc 14</Text>
          <Text mb={16}>08:00 - 12:00</Text>
          {/* Regularly,Date */}
          <Flex itemsCenter mt={24} mb={40}>
            <Layout level={'8'} style={styles.status}>
              <Text category="h9" status={'primary'} bold>
                {t('common:regularly')}
              </Text>
            </Layout>
            <Weekdays data={DAY_IN_WEEK} status="primary" size="large" />
          </Flex>
        </Layout>
        {/* Location/Map */}
        <Text category="h6" bold ml={24} mb={16}>
          {t('request:where')}
        </Text>
        <Text mb={16} ml={24}>
          Rochester, NY
        </Text>
        <Image source={Images.map} />
        {/* Details */}
        <Layout style={styles.padder}>
          <Text bold category="h6" mb={16}>
            {t('request:details')}
          </Text>
          <Text>1 Children - John - Dogs</Text>
          <Text mv={8}>{t('request:hourly-rate')}: $15/hr</Text>
          <Text mb={40}>{t('request:payment-method')}: Credit Card</Text>
          <Text category="h6" bold mb={16}>
            {t('request:additional')}
          </Text>
          <Text>{t('request:additional-description')}</Text>
        </Layout>
      </Content>
      <Layout style={styles.bottom}>
        <Button children={t('request:send-request')} onPress={_onSendRequest} />
      </Layout>
    </Container>
  );
});

export default ReviewRequestBooking;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  padder: {
    paddingHorizontal: 24,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  status: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: 8,
  },
  content: {
    paddingBottom: 60,
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
