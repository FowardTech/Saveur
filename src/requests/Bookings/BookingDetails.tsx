import React, {memo} from 'react';
import {View, Image} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Icon,
  Layout,
  Button,
} from '@ui-kitten/components';
import {
  NavigationProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {
  BookingDetailsScreenNavigationProp,
  RootStackParamList,
} from 'navigation/types';
import NavigationAction from 'components/NavigationAction';
import {Images} from 'assets/images';
import Flex from 'components/Flex';
import dayjs from 'utils/dayjs';
import {globalStyle} from 'styles/globalStyle';
import {Request_Status_Type_Enum} from 'constants/Types';
import Weekdays from 'components/Weekdays';
import IRecommended from 'components/IRecommended';
import {MY_FAVORITES} from 'constants/Data';

const BookingDetails = memo(() => {
  const {navigate, goBack} =
    useNavigation<NavigationProp<RootStackParamList>>();
  const {width, bottom} = useLayout();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'common']);
  const route = useRoute<BookingDetailsScreenNavigationProp>();
  const statusRequest = route.params.type;

  const onSendMessage = () => {};
  const onAddToCalendar = () => {};
  const onConfirmHour = () => {
    navigate('RequestStack', {screen: 'ConfirmHour'});
  };
  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('request:requestDetails').toString()}
        accessoryLeft={<NavigationAction />}
      />
      <Text
        center
        category="h8"
        bold
        status={
          statusRequest === 'Completed'
            ? 'completed'
            : statusRequest === 'Accepted'
            ? 'info'
            : 'warning'
        }
        mb={8}>
        {statusRequest}
      </Text>
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h6" mv={24} bold>
          {t('request:bookingWith')}
        </Text>
        <IRecommended item={MY_FAVORITES[4]} />
        {/* When */}
        <Text category="h6" bold>
          {t('request:when')}
        </Text>
        <Flex itemsCenter mt={16}>
          <Text category="para-m">
            {dayjs(new Date()).format('ddd, MM DD')}
          </Text>
          {statusRequest === 'Accepted' ? (
            <Flex justify="flex-start" itemsCenter onPress={onAddToCalendar}>
              <Icon
                pack="assets"
                name="calendarRequest"
                style={styles.iconCalendar}
              />
              <Text status={'link'} category="h8">
                {t('request:addToCalendar')}
              </Text>
            </Flex>
          ) : null}
        </Flex>
        <Text category="para-m" mt={8}>
          08:00 - 12:00
        </Text>
        {statusRequest === 'Completed' ? (
          <Text mb={8} status="danger" mt={8}>
            Caregiver confirmed: 07:00 - 12:00
          </Text>
        ) : null}
        <Flex itemsCenter mb={40}>
          <Layout style={styles.tag}>
            <Text category="h9" status={'primary'} mh={20} mv={8}>
              {t('common:regularly')}
            </Text>
          </Layout>
          <Weekdays data={DATA} size="large" status="primary" />
        </Flex>
        {/* Map */}
        <Text category="h6" bold>
          {t('request:where')}
        </Text>
        <Text category="para-m" mt={16} mb={8}>
          Rochester, NY
        </Text>

        <Image
          source={Images.map}
          style={{
            width: width,
            marginLeft: -24,
          }}
        />
        {/* Details */}
        <View style={styles.details}>
          <Text category="h6" bold>
            {t('common:details')}
          </Text>
          <Text category="para-m" mt={16} mb={8}>
            2 Children - Infrant, Toddler - Dogs
          </Text>
          <Text category="para-m" mb={8}>
            {t('request:hourly-rate')}: $15/hr
          </Text>
          <Text category="para-m">
            {t('request:payment-method')}: Credit Card
          </Text>
        </View>
        <View style={styles.additional}>
          <Text category="h6" bold>
            {t('request:additional')}
          </Text>
          <Text category="para-m" mt={16}>
            {t('request:additional-description')}
          </Text>
        </View>
        {statusRequest === 'Unconfirmed' ? (
          <Text category="h8-s" status={'placeholder'} mb={20}>
            You have 19 hours left to response
          </Text>
        ) : null}
        {statusRequest == Request_Status_Type_Enum.Accepted ||
        statusRequest === Request_Status_Type_Enum.Unconfirmed ? (
          <Flex>
            <Button
              size={'small'}
              children={t('request:cancelBooking')}
              status="primary"
              style={globalStyle.flexOne}
            />
            <Button
              size={'small'}
              children={t('request:reschedule')}
              status="outline"
              style={{marginLeft: 16, ...globalStyle.flexOne}}
            />
          </Flex>
        ) : null}
      </Content>
      {statusRequest === Request_Status_Type_Enum.Completed ? (
        <Flex level="2" style={styles.bottom} padder pb={bottom + 8}>
          <Button
            children={t('request:confirm-hour-and-payment')}
            style={[globalStyle.flexOne]}
            onPress={onConfirmHour}
          />
        </Flex>
      ) : (
        <Layout
          style={[styles.fitBottom, {paddingBottom: bottom + 8}]}
          level="2">
          <Button
            children={t('request:sendMessage')}
            style={globalStyle.shadowBtn}
            onPress={onSendMessage}
          />
        </Layout>
      )}
    </Container>
  );
});

export default BookingDetails;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  iconCalendar: {
    ...globalStyle.icon16,
    tintColor: 'text-placeholder-color',
    marginRight: 8,
  },
  tag: {
    backgroundColor: 'color-twitter-100',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginTop: 12,
  },
  details: {
    marginVertical: 40,
  },
  cancelInterview: {
    alignSelf: 'center',
    marginBottom: 40,
  },
  additional: {
    marginBottom: 40,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    ...globalStyle.shadowFade,
    paddingTop: 12,
  },
  fitBottom: {
    left: 24,
    right: 24,
    bottom: 0,
    position: 'absolute',
  },
});
const DATA = [
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
