import React, {memo} from 'react';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Datepicker,
  Icon,
  Toggle,
  Layout,
  Button,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import Weekdays from 'components/Weekdays';
import Flex from 'components/Flex';
import dayjs from 'dayjs';
import useToggle from 'hooks/useToggle';
import TimePicker from 'components/TimePicker';
import Calculate from 'components/Calculate';
import {CreateJobStackParamList} from 'navigation/types';
import TitleStep from 'components/TitleStep';

const FrequencyDate = memo(() => {
  const {navigate} = useNavigation<NavigationProp<CreateJobStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['creat_job', 'common']);

  const [startDate, setStartDate] = React.useState<Date>(new Date());
  const [flexibleDate, setFlexibleDate] = useToggle(true);
  const [flexibleTime, setFlexibleTime] = useToggle(true);
  const [duration, setDuration] = React.useState<number>(5);

  const [showPickTime, setShowPickTime] = React.useState(false);

  const _onSave = () => {};
  const _onNext = () => {
    navigate('AboutYourFamily', {children: []});
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          <Text bold status={'link'} mr={20} onPress={_onSave}>
            {t('common:save')}
          </Text>
        }
      />
      <Content padder>
        <TitleStep
          step={2}
          totalStep={7}
          title={t('creat_job:frequency-&-date')}
        />
        <Weekdays data={DAY_IN_WEEK} size="giant" status="basic" />
        <Datepicker
          label={t('creat_job:start-date')}
          /* @ts-ignore */
          placeholder={null}
          style={styles.date}
          min={new Date(1900, 0, 0)}
          max={new Date()}
          onSelect={nextDate => {
            setStartDate(nextDate);
          }}
          filter={() => true}
          accessoryLeft={props => (
            <Flex>
              <Icon pack="assets" name="calendar" {...props} />
              <Text center category="h7" ml={12} bold>
                {dayjs(startDate).format('ddd, MMM DD')}
              </Text>
            </Flex>
          )}
        />
        <Flex itemsCenter mb={40} mt={24} onPress={setFlexibleDate}>
          <Text children={t('creat_job:start-date-is-flexible')} />
          <Toggle checked={flexibleDate} onChange={setFlexibleDate} />
        </Flex>
        <TimePicker
          label={t('creat_job:start-time')}
          time={startDate}
          show={showPickTime}
          setShow={setShowPickTime}
        />
        <Flex itemsCenter mb={40} mt={24} onPress={setFlexibleTime}>
          <Text children={t('creat_job:start-time-is-flexible')} />
          <Toggle checked={flexibleTime} onChange={setFlexibleTime} />
        </Flex>
        <Calculate
          value={duration}
          setValue={setDuration}
          title={t('creat_job:duration')}
        />
      </Content>
      <Layout style={styles.bottom}>
        <Button children={t('creat_job:about-your-family')} onPress={_onNext} />
      </Layout>
    </Container>
  );
});

export default FrequencyDate;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  date: {
    marginTop: 40,
    borderBottomWidth: 1,
    borderColor: 'background-basic-color-3',
  },
  bottom: {
    marginHorizontal: 24,
    paddingVertical: 8,
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
