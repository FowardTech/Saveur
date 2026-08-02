import React, {memo} from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet, Input, Icon} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import {Images} from 'assets/images';
import {globalStyle} from 'styles/globalStyle';
import {MainBottomTabStackParamList} from 'navigation/types';
import {Request_Type_Enum, MockInterviewSessionProps} from 'constants/Types';
import TitleList from '../Components/TitleList';
import EmptyData from '../Components/EmptyData';
import PracticeSessionItem from './PracticeSessionItem';
import * as interviewService from 'services/interviewService';
import {getInterviewTypeLabel, getPracticeModeLabel, getDifficultyLabel} from 'utils/interviewTypeLabels';

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
  const [query, setQuery] = React.useState('');

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

  // Client-side only — session count per user is small enough that a
  // server-side search endpoint isn't worth it yet. Matches against every
  // field a user would actually recognize a session by: the interview
  // type/mode/difficulty *display labels* (not the raw enum values, which
  // may not match what's rendered in translated locales) and the optional
  // targeted company.
  const q = query.trim().toLowerCase();
  const matchesQuery = React.useCallback(
    (item: MockInterviewSessionProps) => {
      if (!q) return true;
      const haystack = [
        getInterviewTypeLabel(item.interviewType, t),
        getPracticeModeLabel(item.mode, t),
        getDifficultyLabel(item.difficulty, t),
        item.company,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    },
    [q, t],
  );

  const upcomingData = sessions.filter(item => item.status === 'Scheduled' && matchesQuery(item));
  const pastData = sessions.filter(item => item.status === 'Completed' && matchesQuery(item));
  const isFiltering = q.length > 0;

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
      {sessions.length > 0 ? (
        <Input
          placeholder={t('request:search_practice_history', {defaultValue: 'Search by type, mode, or company…'})}
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          textStyle={globalStyle.inputText}
          accessoryLeft={props => <Icon {...props} pack="assets" name="search" />}
        />
      ) : null}
      {isEmpty ? (
        isFiltering ? (
          <Text category="h8-s" status="placeholder" center mt={24}>
            {t('request:no_practice_history_match', {defaultValue: 'No sessions match your search.'})}
          </Text>
        ) : (
          <EmptyData
            image={Images.noInterview}
            title={t('request:noPracticeHistory')}
            description={t('request:noPracticeHistoryTitle')}
          />
        )
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
  searchInput: {
    ...globalStyle.inputField,
    marginBottom: 20,
  },
});
