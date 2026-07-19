import React, {memo} from 'react';
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
import NavigationAction from 'components/NavigationAction';
import {MY_FAVORITES} from 'constants/Data';
import IRecommended from 'components/IRecommended';
import {RootStackParamList} from 'navigation/types';

const ReviewRequestInterview = memo(() => {
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
        accessoryLeft={<NavigationAction />}
        title={t('request:review')}
      />
      <Content padder contentContainerStyle={styles.content}>
        <Text bold category="h6" mb={24}>
          {t('request:interviewWith')}
        </Text>
        <IRecommended item={MY_FAVORITES[4]} />
        <Text bold category="h6" mb={24} mt={16}>
          {t('request:contact-via')}
        </Text>
        <Text bold mb={8}>
          {t('request:video-call-interview')}
        </Text>
        <Text category="h8" mb={40}>
          {t('request:video-call-interview-description')}
        </Text>
        <Text category="h6" bold mb={16}>
          {t('request:when')}
        </Text>
        <Text mb={8}>Tue, Otc 14</Text>
        <Text mb={40}>17:30 - 18:00</Text>
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
      </Content>
      <Layout style={styles.bottom}>
        <Button children={t('request:send-request')} onPress={_onSendRequest} />
      </Layout>
    </Container>
  );
});

export default ReviewRequestInterview;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    marginTop: 24,
    paddingBottom: 40,
  },
  bottom: {
    marginHorizontal: 24,
    paddingVertical: 8,
  },
});
