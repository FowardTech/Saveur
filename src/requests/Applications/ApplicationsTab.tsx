import React, {memo} from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import Text from 'components/Text';
import ApplicationItem from './ApplicationItem';
import TitleList from '../Components/TitleList';
import {MainBottomTabStackParamList} from 'navigation/types';
import {Application_Stage_Enum, JobApplicationProps, Request_Type_Enum} from 'constants/Types';
import * as applicationsService from 'services/applicationsService';

// Applications tab — fetches the full tracked-application list from
// applicationsService and splits it client-side into "active" (Applied /
// Interviewing) and "closed" (Offer / Rejected) groups, mirroring the old
// static DATA_APPLICATIONS_ACTIVE/CLOSED grouping.
const ApplicationsTab = memo(() => {
  const {navigate} =
    useNavigation<NavigationProp<MainBottomTabStackParamList>>();
  const styles = useStyleSheet(themedStyles);

  const [applications, setApplications] = React.useState<JobApplicationProps[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    applicationsService
      .listApplications()
      .then(result => {
        if (!cancelled) {
          setApplications(result);
          setError(null);
        }
      })
      .catch((e: any) => {
        if (!cancelled) {
          setError(e?.message ?? "Couldn't load your applications.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeApplications = applications.filter(
    item =>
      item.stage === Application_Stage_Enum.Applied ||
      item.stage === Application_Stage_Enum.Interviewing,
  );
  const closedApplications = applications.filter(
    item =>
      item.stage === Application_Stage_Enum.Offer ||
      item.stage === Application_Stage_Enum.Rejected,
  );

  const onSeeAllPast = () => {
    navigate('Interviews', {
      screen: 'RequestsInPast',
      params: {requestType: Request_Type_Enum.Application},
    });
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text category="h8-s" status="placeholder" center>
          Loading applications…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text category="h8-s" status="danger" center>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <>
        <TitleList current dataLength={activeApplications.length} />
        {activeApplications.map((item, i) => {
          return <ApplicationItem item={item} key={i} />;
        })}
      </>
      <>
        <TitleList
          dataLength={closedApplications.length}
          current={false}
          onSeeAll={onSeeAllPast}
        />
        {closedApplications.map((item, i) => {
          return <ApplicationItem item={item} key={i} />;
        })}
      </>
    </View>
  );
});

export default ApplicationsTab;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingTop: 32,
  },
});
