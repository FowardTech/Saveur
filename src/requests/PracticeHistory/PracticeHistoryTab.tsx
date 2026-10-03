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
import {PracticeHistoryIllustration} from 'components/EmptyState';
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

  // Product report: "When a scheduled mock interview date and also the
  // time has passed the interview should clear off from the practice
  // history screen." An item's status stays "Scheduled" (see
  // interviewService.ts's statusFromWire) for as long as the session was
  // started but never actually completed -- there's no separate
  // abandonment/expiry process server-side, so a session the user started
  // and then walked away from just sits under "Scheduled" forever with no
  // way to tell it apart from one genuinely still in progress. `date` is
  // the session's real start time and `durationMin` its configured length
  // (see MockInterviewSessionProps), so `date + durationMin` is the
  // point by which the session should have naturally ended -- once that's
  // in the past, it's stale, not upcoming, and gets dropped from view
  // entirely rather than misleadingly relabeled "Completed" (it never
  // actually finished).
  const isPastDue = React.useCallback((item: MockInterviewSessionProps) => {
    const startMs = typeof item.date === 'number' ? item.date : new Date(item.date).getTime();
    const endMs = startMs + item.durationMin * 60 * 1000;
    return Date.now() > endMs;
  }, []);

  const upcomingData = sessions.filter(item => item.status === 'Scheduled' && !isPastDue(item) && matchesQuery(item));
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
          accessoryLeft={props => (
            <Icon {...props} style={[props.style, styles.accessoryLeftSpacing]} pack="assets" name="search" />
          )}
        />
      ) : null}
      {isEmpty ? (
        isFiltering ? (
          <Text category="h8-s" status="placeholder" center mt={24}>
            {t('request:no_practice_history_match', {defaultValue: 'No sessions match your search.'})}
          </Text>
        ) : (
          <EmptyData
            illustration={<PracticeHistoryIllustration size={150} />}
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
  // Same fix as ApplicationsTab.tsx's own searchInput (bug report: "the
  // search icon is touching the edge of the input field") — see that
  // file's comment.
  accessoryLeftSpacing: {
    marginLeft: 14,
  },
});
