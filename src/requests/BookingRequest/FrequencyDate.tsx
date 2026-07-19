import React, {memo} from 'react';
import {View} from 'react-native';
import {
  StyleService,
  useStyleSheet,
  Datepicker,
  Toggle,
  Icon,
} from '@ui-kitten/components';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import TitleStep from 'components/TitleStep';
import Weekdays from 'components/Weekdays';
import Flex from 'components/Flex';
import TimePicker from 'components/TimePicker';
import Calculate from 'components/Calculate';
import dayjs from 'dayjs';
import useToggle from 'hooks/useToggle';
import Content from 'components/Content';

const FrequencyDate = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['creat_job', 'common']);

  const [startDate, setStartDate] = React.useState<Date>(new Date());
  const [flexibleDate, setFlexibleDate] = useToggle(true);
  const [flexibleTime, setFlexibleTime] = useToggle(true);
  const [duration, setDuration] = React.useState<number>(5);

  const [showPickTime, setShowPickTime] = React.useState(false);
  return (
    <Content style={styles.container}>
      <TitleStep
        step={2}
        totalStep={5}
        title={t('creat_job:frequency-&-date')}
      />
      <Weekdays
        data={DAY_IN_WEEK}
        size="giant"
        status="basic"
        style={styles.week}
      />
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
  );
});

export default FrequencyDate;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  date: {
    marginTop: 40,
    borderBottomWidth: 1,
    borderColor: 'background-basic-color-3',
  },
  week: {
    marginTop: 40,
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
