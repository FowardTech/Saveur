import React, {memo} from 'react';
import {Modal, TouchableOpacity, View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
} from '@ui-kitten/components';
import {useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import ButtonFill from 'components/ButtonFill';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import {RequestsInPassScreenNavigationProp} from 'navigation/types';
import {
  Application_Stage_Enum,
  JobApplicationProps,
  MockInterviewSessionProps,
  Practice_Mode_Enum,
  Request_Type_Enum,
} from 'constants/Types';
import {getPracticeModeLabel, getApplicationStageLabel} from 'utils/interviewTypeLabels';
import {globalStyle} from 'styles/globalStyle';
import ApplicationItem from './Applications/ApplicationItem';
import PracticeSessionItem from './PracticeHistory/PracticeSessionItem';
import * as applicationsService from 'services/applicationsService';
import * as interviewService from 'services/interviewService';

const RequestsInPast = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {t} = useTranslation(['request', 'common']);

  const route = useRoute<RequestsInPassScreenNavigationProp>();
  const request_type = route.params.requestType;
  const [title, setTitle] = React.useState<string>('');
  const [applications, setApplications] = React.useState<JobApplicationProps[]>([]);
  const [pastSessions, setPastSessions] = React.useState<MockInterviewSessionProps[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // The filter button (below) previously rendered with its onPress
  // commented out (`// onPress={show}`, calling a `show` function that
  // didn't even exist anywhere in this file) -- it looked like a real,
  // tappable filter control but did absolutely nothing. Now backed by
  // real state: a mode filter (Voice/Text/Video) for practice history,
  // a stage filter (Offer/Rejected -- the only two stages this screen
  // ever shows, per the Application_Stage_Enum filter above) for past
  // applications.
  const [isFilterVisible, setIsFilterVisible] = React.useState(false);
  const [modeFilter, setModeFilter] = React.useState<Practice_Mode_Enum | null>(null);
  const [stageFilter, setStageFilter] = React.useState<Application_Stage_Enum | null>(null);
  const isFilterActive = request_type === Request_Type_Enum.Application ? stageFilter != null : modeFilter != null;

  React.useEffect(() => {
    if (request_type === Request_Type_Enum.Application) {
      setTitle('applicationInPass');
    } else {
      setTitle('practiceHistoryInPast');
    }
  }, [request_type]);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    if (request_type === Request_Type_Enum.Application) {
      applicationsService
        .listApplications()
        .then(result => {
          if (cancelled) return;
          setApplications(
            result.filter(
              item =>
                item.stage === Application_Stage_Enum.Offer ||
                item.stage === Application_Stage_Enum.Rejected,
            ),
          );
        })
        .catch((e: any) => {
          if (!cancelled) setError(e?.message ?? t('request:load_past_applications_failed', {defaultValue: "Couldn't load past applications."}));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    } else {
      interviewService
        .getPracticeHistory()
        .then(result => {
          if (cancelled) return;
          setPastSessions(result.filter(item => item.status === 'Completed'));
        })
        .catch((e: any) => {
          if (!cancelled) setError(e?.message ?? t('request:load_past_practice_failed', {defaultValue: "Couldn't load past practice sessions."}));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [request_type]);

  const filteredApplications = stageFilter
    ? applications.filter(item => item.stage === stageFilter)
    : applications;
  const filteredPastSessions = modeFilter
    ? pastSessions.filter(item => item.mode === modeFilter)
    : pastSessions;

  const modeOptions = [
    Practice_Mode_Enum.Voice,
    Practice_Mode_Enum.Text,
    Practice_Mode_Enum.Video,
  ];
  const stageOptions = [
    Application_Stage_Enum.Offer,
    Application_Stage_Enum.Rejected,
  ];

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction icon="back" />}
        title={title ? t(`request:${title}`).toString() : ''}
      />
      <Content contentContainerStyle={styles.content}>
        {isLoading ? (
          <Text category="h8-s" status="placeholder" center mt={24}>
            {t('common:loading', {defaultValue: 'Loading…'})}
          </Text>
        ) : error ? (
          <Text category="h8-s" status="danger" center mt={24}>
            {error}
          </Text>
        ) : request_type === Request_Type_Enum.Application ? (
          filteredApplications.length === 0 ? (
            <Text category="h8-s" status="placeholder" center mt={24}>
              {t('request:no_applications_match_filter', {defaultValue: 'No applications match this filter.'})}
            </Text>
          ) : (
            <>
              {filteredApplications.map((item, i) => {
                return <ApplicationItem item={item} key={i} />;
              })}
            </>
          )
        ) : filteredPastSessions.length === 0 ? (
          <Text category="h8-s" status="placeholder" center mt={24}>
            {t('request:no_sessions_match_filter', {defaultValue: 'No sessions match this filter.'})}
          </Text>
        ) : (
          <>
            {filteredPastSessions.map((item, i) => {
              return <PracticeSessionItem item={item} key={i} />;
            })}
          </>
        )}
      </Content>
      <ButtonFill
        icon="filter"
        status={isFilterActive ? 'primary' : 'warning'}
        size="large"
        onPress={() => setIsFilterVisible(true)}
        style={styles.filter}
      />

      <Modal
        visible={isFilterVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFilterVisible(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsFilterVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            {/* Product request: "all bottom sheets should have a close
                button" -- this one already closes on backdrop tap and has
                a "Done" link at the bottom, but neither is the explicit
                close-X affordance every other sheet in the app uses. Same
                header-row treatment added here for consistency. */}
            <Flex justify="space-between" itemsCenter mb={16}>
              <Text category="h7" bold>
                {t('request:filter_by', {defaultValue: 'Filter by'})}
              </Text>
              <TouchableOpacity onPress={() => setIsFilterVisible(false)} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, {tintColor: theme['text-basic-color']}]} />
              </TouchableOpacity>
            </Flex>
            {(request_type === Request_Type_Enum.Application
              ? stageOptions
              : modeOptions
            ).map(option => {
              const isSelected =
                request_type === Request_Type_Enum.Application
                  ? stageFilter === option
                  : modeFilter === option;
              const label =
                request_type === Request_Type_Enum.Application
                  ? getApplicationStageLabel(option, t)
                  : getPracticeModeLabel(option, t);
              return (
                <TouchableOpacity
                  key={option}
                  activeOpacity={0.7}
                  style={styles.optionRow}
                  onPress={() => {
                    if (request_type === Request_Type_Enum.Application) {
                      setStageFilter(prev => (prev === option ? null : (option as Application_Stage_Enum)));
                    } else {
                      setModeFilter(prev => (prev === option ? null : (option as Practice_Mode_Enum)));
                    }
                  }}>
                  <Text category="h8-s">{label}</Text>
                  {isSelected ? (
                    <Icon
                      pack="eva"
                      name="checkmark-circle-2"
                      style={[globalStyle.icon20, {tintColor: theme['text-basic-color']}]}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}
            <Flex justify="space-between" itemsCenter mt={20}>
              <TouchableOpacity
                onPress={() => {
                  setModeFilter(null);
                  setStageFilter(null);
                }}>
                <Text category="h8-s" status="danger">
                  {t('request:clear_filter', {defaultValue: 'Clear filter'})}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsFilterVisible(false)}>
                {/* BUG FIX: was status="primary" (text-primary-color, a
                    near-white token meant for text on a colored surface —
                    invisible here on this plain modal sheet in light mode).
                    This is a real tappable confirm action, same as "Clear
                    filter" above (status="danger", a real visible red) —
                    status="link" is the correct, visible equivalent for a
                    non-destructive action. */}
                <Text category="h8-s" status="link" bold>
                  {t('common:done', {defaultValue: 'Done'})}
                </Text>
              </TouchableOpacity>
            </Flex>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </Container>
  );
});

export default RequestsInPast;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    marginHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  filter: {
    position: 'absolute',
    right: 12,
    bottom: 60,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: 'background-basic-color-1',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 32,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'border-basic-color-3',
  },
});
