import React, {memo} from 'react';
import {View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Icon,
  Button,
  Layout,
} from '@ui-kitten/components';
import {useRoute} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';
import dayjs from 'utils/dayjs';
import {Request_Status_Type_Enum} from 'constants/Types';
import {InterviewDetailsScreenNavigationProp} from 'navigation/types';
import IRecommended from 'components/IRecommended';
import {MY_FAVORITES} from 'constants/Data';

const InterviewDetails = memo(() => {
  const {bottom} = useLayout();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'common']);

  const route = useRoute<InterviewDetailsScreenNavigationProp>();
  const StatusRequest = route.params.type;

  const onAddToCalendar = () => {};
  const onSendMessage = () => {};
  const onAccept = () => {};
  const onDecline = () => {};

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
          StatusRequest === 'Completed'
            ? 'completed'
            : StatusRequest === 'Accepted'
            ? 'info'
            : 'warning'
        }
        mb={8}>
        {StatusRequest}
      </Text>
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h6" mv={24} bold>
          {t('request:interviewWith')}
        </Text>
        <IRecommended item={MY_FAVORITES[1]} />
        <View style={styles.contact}>
          <Text category="h6" bold>
            {t('request:contact-via')}
          </Text>
          <Text category="h7" mt={24} mb={8} bold>
            {t('request:video-call-interview')}
          </Text>
          {StatusRequest === 'Unconfirmed' ? (
            <Text category="h8-s">
              {t('request:video-call-interview-description')}
            </Text>
          ) : (
            <Text category="h7" status={'link'} bold>
              088.048.0316
            </Text>
          )}
        </View>
        <View>
          <Text category="h6" bold>
            {t('request:when')}
          </Text>
          <Text category="para-m" mt={16} mb={8}>
            {dayjs(new Date()).format('ddd, MM DD')}
          </Text>
          <Flex>
            <Text category="para-m">17:00 - 17:30</Text>
            {StatusRequest === 'Accepted' ? (
              <Flex justify="flex-start" itemsCenter onPress={onAddToCalendar}>
                <Icon
                  pack="assets"
                  name="calendarRequest"
                  style={styles.iconCalendar}
                />
                <Text status={'link'} category="h8" bold>
                  {t('request:addToCalendar')}
                </Text>
              </Flex>
            ) : null}
          </Flex>
        </View>
        <View style={styles.details}>
          <Text category="h6" bold>
            {t('common:details')}
          </Text>
          <Text category="para-m" mt={16} mb={8}>
            1 Children - John - Dogs
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
        {StatusRequest === 'Unconfirmed' ? (
          <Text category="h8-s" status={'placeholder'} mb={20}>
            You have 19 hours left to response
          </Text>
        ) : null}
        {StatusRequest == Request_Status_Type_Enum.Completed ||
        StatusRequest == Request_Status_Type_Enum.Accepted ? (
          <>
            <Button
              children={
                StatusRequest === Request_Status_Type_Enum.Completed
                  ? t('request:deleteInterview').toString()
                  : t('request:cancelInterview').toString()
              }
              size="small"
              appearance="outline"
              style={styles.cancelInterview}
            />
          </>
        ) : null}
        {StatusRequest === Request_Status_Type_Enum.Unconfirmed ? (
          <Flex>
            <Button
              size={'small'}
              children={t('request:cancel-request')}
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
      <Flex level="2" style={styles.bottom} padder pb={bottom + 8}>
        <Button
          children={t('request:send-message').toString()}
          style={globalStyle.flexOne}
          onPress={onDecline}
        />
      </Flex>
    </Container>
  );
});

export default InterviewDetails;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  content: {
    paddingBottom: 140,
  },
  personal: {
    padding: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    ...globalStyle.shadow,
    marginBottom: 40,
  },
  cancelInterview: {
    alignSelf: 'center',
    marginBottom: 40,
  },
  dot: {
    width: 2,
    height: 2,
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  contact: {
    marginBottom: 40,
  },
  iconCalendar: {
    ...globalStyle.icon16,
    tintColor: 'text-placeholder-color',
    marginRight: 8,
  },
  details: {
    marginVertical: 40,
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
    paddingTop: 14,
  },
});
