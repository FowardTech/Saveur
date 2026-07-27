import React, {memo} from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import {Images} from 'assets/images';
import {MainBottomTabStackParamList} from 'navigation/types';
import {Request_Type_Enum, MockInterviewSessionProps} from 'constants/Types';
import TitleList from '../Components/TitleList';
import EmptyData from '../Components/EmptyData';
import PracticeSessionItem from './PracticeSessionItem';
import * as interviewService from 'services/interviewService';

// "Practice History" — merges the old Interview/Booking sub-tabs into a
// single list of mock-interview sessions (upcoming + past), fetched from
// interviewService.getPracticeHistory() and split client-side by `status`.
const PracticeHistoryTab = memo(() => {
  const {navigate} =
    useNavigation<NavigationProp<MainBottomTabStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'common']);

  const [sessions, setSessions] = React.useState<MockInterviewSessionProps[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    interviewService.getPracticeHistory().then(result => {
      if (!cancelled) {
        setSessions(result);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const upcomingData = sessions.filter(item => item.status === 'Scheduled');
  const pastData = sessions.filter(item => item.status === 'Completed');

  const onSeeAllPast = () => {
    navigate('Interviews', {
      screen: 'RequestsInPast',
      params: {requestType: Request_Type_Enum.Interview},
    });
  };

  const isEmpty = upcomingData.length === 0 && pastData.length === 0;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text category="h8-s" status="placeholder" center>
          {t('request:loading_practice_history', {defaultValue: 'Loading practice history…'})}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isEmpty ? (
        <EmptyData
          image={Images.noInterview}
          title={t('request:noPracticeHistory')}
          description={t('request:noPracticeHistoryTitle')}
        />
      ) : (
        <>
          {upcomingData.length > 0 ? (
            <>
              <TitleList current dataLength={upcomingData.length} />
              {upcomingData.map((item, i) => (
                <PracticeSessionItem item={item} key={i} />
              ))}
            </>
          ) : null}
          {pastData.length > 0 ? (
            <View style={styles.pastContent}>
              <TitleList
                current={false}
                dataLength={pastData.length}
                onSeeAll={onSeeAllPast}
              />
              {pastData.map((item, i) => (
                <PracticeSessionItem item={item} key={i} />
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
});

export default PracticeHistoryTab;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingTop: 32,
  },
  pastContent: {
    marginTop: 12,
  },
});
