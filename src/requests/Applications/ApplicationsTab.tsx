import React, {memo} from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet, useTheme, Icon, Button, Input} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Flex from 'components/Flex';
import ApplicationItem from './ApplicationItem';
import TitleList from '../Components/TitleList';
import {globalStyle} from 'styles/globalStyle';
import {renderCenteredLabel} from 'utils/buttonLabel';
import {getApplicationStageLabel} from 'utils/interviewTypeLabels';
import {MainBottomTabStackParamList, RootStackParamList} from 'navigation/types';
import {Application_Stage_Enum, JobApplicationProps, Request_Type_Enum} from 'constants/Types';
import * as applicationsService from 'services/applicationsService';
import {AuthContext} from '../../../AuthContext';
import CtaButton from 'components/CtaButton';

// Applications tab — fetches the full tracked-application list from
// applicationsService and splits it client-side into "active" (Applied /
// Interviewing) and "closed" (Offer / Rejected) groups, mirroring the old
// static DATA_APPLICATIONS_ACTIVE/CLOSED grouping.
//
// Application Tracker is a Pro Premium feature (Pro Premium or Pro Yearly —
// see saveur-backend/app/services/entitlements_service.py's module
// docstring) per explicit product decision — was previously ungated
// entirely (app/api/tracker.py had no @require_pro/@require_premium at
// all). This tab is one of two (alongside Practice History, which stays
// free) inside RequestsSrc's ViewPager, so it can't just early-return a
// full-screen ProLockGate like JobAlerts.tsx/LearningCourses.tsx do — that
// component brings its own TopNavigation, which would duplicate/clash with
// RequestsSrc's. Renders a compact locked card in the same spot the list
// would occupy instead.
const ApplicationsTab = memo(() => {
  const {navigate} =
    useNavigation<NavigationProp<MainBottomTabStackParamList & RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {t} = useTranslation(['request', 'common']);
  const {isPremium} = React.useContext(AuthContext);

  const [applications, setApplications] = React.useState<JobApplicationProps[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (!isPremium) {
      setIsLoading(false);
      return;
    }
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
          setError(e?.message ?? t('request:load_applications_failed', {defaultValue: "Couldn't load your applications."}));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isPremium]);

  // Client-side search — matches company, role, location, or the stage's
  // display label (not the raw enum value, for the same translated-locale
  // reason as PracticeHistoryTab's search).
  const q = query.trim().toLowerCase();
  const matchesQuery = React.useCallback(
    (item: JobApplicationProps) => {
      if (!q) return true;
      const haystack = [item.company, item.role, item.location, getApplicationStageLabel(item.stage, t)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    },
    [q, t],
  );

  const activeApplications = applications.filter(
    item =>
      (item.stage === Application_Stage_Enum.Applied ||
        item.stage === Application_Stage_Enum.Interviewing) &&
      matchesQuery(item),
  );
  const closedApplications = applications.filter(
    item =>
      (item.stage === Application_Stage_Enum.Offer ||
        item.stage === Application_Stage_Enum.Rejected) &&
      matchesQuery(item),
  );
  const isFiltering = q.length > 0;
  const hasAnyApplications = applications.length > 0;

  const onSeeAllPast = () => {
    navigate('Interviews', {
      screen: 'RequestsInPast',
      params: {requestType: Request_Type_Enum.Application},
    });
  };

  if (!isPremium) {
    return (
      <View style={styles.container}>
        <Flex vertical itemsCenter style={styles.lockCard}>
          <Icon
            pack="eva"
            name="lock-outline"
            style={[globalStyle.icon40, {tintColor: theme['text-basic-color']}]}
          />
          <Text category="h6" bold center mt={16}>
            {t('request:application_tracker_pro_gate_title', {defaultValue: 'This is a Pro Premium feature'})}
          </Text>
          <Text category="h9-s" status="placeholder" center mt={8} mb={24}>
            {t('request:application_tracker_pro_gate_body', {
              defaultValue: "Track every job you've applied for, all the way to offer — Application Tracker is a Pro Premium feature.",
            })}
          </Text>
          <CtaButton
            accessoryLeft={props => <Icon {...props} pack="eva" name="lock-outline" />}
            accessoryRight={props => <Icon {...props} pack="eva" name="arrow-forward-outline" />}
            onPress={() => navigate('Subscription')}>
            {renderCenteredLabel(t('request:see_pro_premium_plans', {defaultValue: 'See Pro Premium plans'}), {stretch: false})}
          </CtaButton>
        </Flex>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text category="h8-s" status="placeholder" center>
          {t('request:loading_applications', {defaultValue: 'Loading applications…'})}
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
      {hasAnyApplications ? (
        <Input
          placeholder={t('request:search_applications', {defaultValue: 'Search by company, role, or location…'})}
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          accessoryLeft={props => <Icon {...props} pack="assets" name="search" />}
        />
      ) : null}
      {isFiltering && activeApplications.length === 0 && closedApplications.length === 0 ? (
        <Text category="h8-s" status="placeholder" center mt={24}>
          {t('request:no_applications_match', {defaultValue: 'No applications match your search.'})}
        </Text>
      ) : (
        <>
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
        </>
      )}
    </View>
  );
});

export default ApplicationsTab;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingTop: 32,
  },
  lockCard: {
    // Added the app's own card treatment (product follow-up, app-wide
    // consistency pass) — was unbordered/unstyled, floating directly on
    // the screen instead of reading as a defined card the way every other
    // lock/upgrade prompt in the app does.
    ...globalStyle.card,
    paddingHorizontal: 24,
    paddingVertical: 32,
    // `card`'s shadow needs an opaque fill to render correctly on Android
    // (was 'transparent') — this renders on a plain <Flex> with no
    // `level` prop, so the fill has to live here.
    backgroundColor: 'background-basic-color-2',
  },
  searchInput: {
    ...globalStyle.inputField,
    marginBottom: 20,
  },
});
