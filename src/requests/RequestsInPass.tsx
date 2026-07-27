import React, {memo} from 'react';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
} from '@ui-kitten/components';
import {useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import ButtonFill from 'components/ButtonFill';
import NavigationAction from 'components/NavigationAction';
import {RequestsInPassScreenNavigationProp} from 'navigation/types';
import {
  Application_Stage_Enum,
  JobApplicationProps,
  MockInterviewSessionProps,
  Request_Type_Enum,
} from 'constants/Types';
import ApplicationItem from './Applications/ApplicationItem';
import PracticeSessionItem from './PracticeHistory/PracticeSessionItem';
import * as applicationsService from 'services/applicationsService';
import * as interviewService from 'services/interviewService';

const RequestsInPast = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'common']);

  const route = useRoute<RequestsInPassScreenNavigationProp>();
  const request_type = route.params.requestType;
  const [title, setTitle] = React.useState<string>('');
  const [applications, setApplications] = React.useState<JobApplicationProps[]>([]);
  const [pastSessions, setPastSessions] = React.useState<MockInterviewSessionProps[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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
          <>
            {applications.map((item, i) => {
              return <ApplicationItem item={item} key={i} />;
            })}
          </>
        ) : (
          <>
            {pastSessions.map((item, i) => {
              return <PracticeSessionItem item={item} key={i} />;
            })}
          </>
        )}
      </Content>
      <ButtonFill
        icon="filter"
        status="warning"
        size="large"
        // onPress={show}
        style={styles.filter}
      />
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
});
