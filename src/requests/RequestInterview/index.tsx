import React, {memo} from 'react';
import {View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Layout,
  Avatar,
  Button,
  ViewPager,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import {RootStackParamList} from 'navigation/types';
import Flex from 'components/Flex';

import {globalStyle} from 'styles/globalStyle';
import {MY_FAVORITES} from 'constants/Data';

import InterviewPlan from './InterviewPlan';
import AboutFamily from './AboutFamily';
import HourlyRate from './HourlyRate';
import AnythingElse from './AnythingElse';

const RequestInterview = memo(() => {
  const {goBack, navigate} =
    useNavigation<NavigationProp<RootStackParamList>>();
  const {bottom} = useLayout();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'creat_job', 'common']);

  const [step, setStep] = React.useState(0);

  const _onCancel = () => {
    navigate('CaregiverProfile');
  };
  const DATA_USER = MY_FAVORITES[4];

  const _onNext = React.useCallback(() => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      navigate('RequestStack', {screen: 'ReviewRequestInterview'});
    }
  }, [step]);
  const _onPrv = React.useCallback(() => {
    if (step <= 0) {
      goBack();
    } else {
      setStep(step - 1);
    }
  }, [step]);

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction onPress={_onPrv} />}
        accessoryRight={
          <Text status={'link'} bold mr={16} onPress={_onCancel}>
            {t('common:cancel')}
          </Text>
        }
      />
      <ViewPager
        selectedIndex={step}
        onSelect={setStep}
        style={styles.viewPager}
        swipeEnabled={false}
        shouldLoadComponent={i => step === i}>
        {/* Step 1 */}
        <InterviewPlan />
        {/* Step 2 */}
        <AboutFamily />
        {/* Step 3 */}
        <HourlyRate />
        {/* Step 4 */}
        <AnythingElse step={4} totalStep={4} />
      </ViewPager>

      {/* Bottom */}
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
            children={step === 3 ? t('common:review') : t('common:next')}
            style={[globalStyle.flexOne]}
            onPress={_onNext}
          />
        </Flex>
      </Layout>
    </Container>
  );
});

export default RequestInterview;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },

  bottom: {
    ...globalStyle.shadowFade,
    ...globalStyle.topBorder24,
    paddingTop: 20,
    paddingBottom: 12,
    paddingHorizontal: 24,
  },
  viewPager: {
    flex: 1,
  },
});
