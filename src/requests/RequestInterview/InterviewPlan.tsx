import React, {memo} from 'react';
import {
  StyleService,
  useStyleSheet,
  Layout,
  Icon,
  Datepicker,
} from '@ui-kitten/components';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import Flex from 'components/Flex';
import TimePicker from 'components/TimePicker';
import dayjs from 'utils/dayjs';
import TabBar from 'components/TabBar';
import TitleStep from 'components/TitleStep';
import useToggle from 'hooks/useToggle';

const InterviewPlan = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'creat_job', 'common']);

  const [showFrom, setShowFrom] = useToggle(false);
  const [activeTabContact, setActiveTabContact] = React.useState(0);
  const [showTo, setShowTo] = useToggle(false);
  const [startTime, setStartTime] = React.useState<Date>(new Date());
  const [endTime, setEndTime] = React.useState<Date>(new Date());
  return (
    <Layout style={styles.content}>
      <TitleStep
        step={1}
        totalStep={4}
        title={t('request:interview-plan')}
        style={styles.step}
      />
      <Text category="h6" bold mt={40} mb={24}>
        {t('request:interview-via')}
      </Text>
      <TabBar
        selectedIndex={activeTabContact}
        onChange={setActiveTabContact}
        tabs={[
          t('request:phone-call'),
          t('request:video-call'),
          t('request:messages'),
        ]}
      />
      <Datepicker
        label={t('request:interview-date')}
        /* @ts-ignore */
        placeholder={null}
        style={styles.date}
        min={new Date(1900, 0, 0)}
        onSelect={nextDate => {
          setStartTime(nextDate);
        }}
        filter={() => true}
        accessoryLeft={props => (
          <Flex>
            <Icon pack="assets" name="calendar" {...props} />
            <Text center category="h7" ml={12} bold>
              {dayjs(startTime).format('ddd, MMM DD')}
            </Text>
          </Flex>
        )}
      />
      <Flex>
        <TimePicker
          label={t('request:from')}
          time={startTime}
          show={showFrom}
          setShow={setShowFrom}
          style={styles.from}
        />
        <TimePicker
          label={t('request:to')}
          time={endTime}
          show={showTo}
          setShow={setShowTo}
        />
      </Flex>
    </Layout>
  );
});

export default InterviewPlan;

const themedStyles = StyleService.create({
  content: {
    paddingHorizontal: 24,
  },
  step: {
    marginTop: 16,
  },
  date: {
    marginVertical: 40,
  },
  from: {
    marginRight: 32,
    flex: 1,
  },
});
