import React, {memo} from 'react';
import {View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  ViewPager,
  Layout,
  Button,
  Avatar,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import TypeOfCare from './TypeOfCare';
import FrequencyDate from './FrequencyDate';
import {RootStackParamList} from 'navigation/types';
import {globalStyle} from 'styles/globalStyle';
import Flex from 'components/Flex';
import {MY_FAVORITES} from 'constants/Data';
import HourlyRate from './HourlyRate';
import AnythingElse from '../RequestInterview/AnythingElse';
import AboutFamily from '../RequestInterview/AboutFamily';

const BookingRequest = memo(() => {
  const {navigate, goBack} =
    useNavigation<NavigationProp<RootStackParamList>>();
  const {bottom} = useLayout();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'creat_job', 'common']);

  const [activeTab, setActiveTab] = React.useState(0);
  const DATA_USER = MY_FAVORITES[4];

  const _onSave = () => {};
  const _onNext = React.useCallback(() => {
    if (activeTab < 4) {
      setActiveTab(activeTab + 1);
    } else {
      navigate('RequestStack', {screen: 'ReviewRequestBooking'});
    }
  }, [activeTab]);
  const _onPrv = React.useCallback(() => {
    if (activeTab <= 0) {
      goBack();
    } else {
      setActiveTab(activeTab - 1);
    }
  }, [activeTab]);

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction onPress={_onPrv} />}
        accessoryRight={
          <Text status="link" bold mr={16} onPress={_onSave}>
            {t('common:save')}
          </Text>
        }
      />
      <Content>
        <ViewPager
          style={styles.content}
          selectedIndex={activeTab}
          onSelect={setActiveTab}>
          <TypeOfCare />
          <FrequencyDate />
          <AboutFamily />
          <HourlyRate />
          <AnythingElse step={5} totalStep={5} />
        </ViewPager>
      </Content>
      <Layout style={[styles.bottom, {paddingBottom: bottom + 8}]}>
        <Flex itemsCenter>
          <Flex justify="flex-start" mr={48} itemsCenter>
            <Avatar shape="rounded" source={DATA_USER.avatar} size="tiny" />
            <View>
              <Text category="h8" bold ml={16} mb={4}>
                {DATA_USER.name}
              </Text>
              <Text category="h8" bold status={'placeholder'} ml={16}>
                {DATA_USER.hourlyRate}
              </Text>
            </View>
          </Flex>
          <Button
            children={activeTab === 4 ? t('common:review') : t('common:next')}
            style={[globalStyle.flexOne]}
            onPress={_onNext}
          />
        </Flex>
      </Layout>
    </Container>
  );
});

export default BookingRequest;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  content: {
    flex: 1,
  },
  bottom: {
    ...globalStyle.shadowFade,
    ...globalStyle.topBorder24,
    paddingTop: 20,
    paddingBottom: 12,
    paddingHorizontal: 24,
  },
});
