import React, {memo} from 'react';
import {ScrollView, View} from 'react-native';
import {StyleService, useStyleSheet, useTheme, Icon, Button, Input} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Flex from 'components/Flex';
import {SkeletonList} from 'components/Skeleton';
import ApplicationItem from './ApplicationItem';
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
// Application Tracker is a Basic (Pro) feature — product decision: "if Job
// alert is a pro plan then application tracker should be a pro plan too."
// This used to be gated to Pro Premium/Premium Yearly only instead (before
// that, it was ungated entirely — app/api/tracker.py had no @require_pro/
// @require_premium at all). Now the exact same @require_pro gate as
// app/api/job_alerts.py's routes, Basic and up. This tab is one of two
// (alongside Practice History, which stays free) inside RequestsSrc's
// ViewPager, so it can't just early-return a full-screen ProLockGate like
// JobAlerts.tsx/LearningCourses.tsx do — that component brings its own
// TopNavigation, which would duplicate/clash with RequestsSrc's. Renders a
// compact locked card in the same spot the list would occupy instead.
const ApplicationsTab = memo(() => {
  const {navigate} =
    useNavigation<NavigationProp<MainBottomTabStackParamList & RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {t} = useTranslation(['request', 'common']);
  const {isPro} = React.useContext(AuthContext);

  const [applications, setApplications] = React.useState<JobApplicationProps[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (!isPro) {
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
  }, [isPro]);

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

  // Task #44/#49 mobile parity port of Saveur-Web's task #19 unified Job
  // Tracker board (product report: "the web app dashboard look so empty" --
  // specifically resume.io's single Kanban board Recommended -> Shortlist ->
  // Applied -> Interview -> Offer -> Rejected). This used to be a fake
  // "active"/"closed" 2-bucket split (Applied+Interviewing lumped together,
  // Offer+Rejected lumped together) -- now 4 real per-stage sections,
  // matching the web board's own 4 tracked-application columns exactly (its
  // other 2 columns, Recommended/Shortlisted, are job ALERTS, not tracked
  // applications -- see the "Find jobs" action added to actionsRow below for
  // that bridge instead of merging two entirely separate backend resources
  // into one list). No literal drag-and-drop here -- ApplicationDetails.tsx
  // already has a real "move to next stage" control once you tap into a
  // card (services/applicationsService.ts's updateApplicationStage), so the
  // capability already exists; this section is what was actually missing:
  // seeing every stage broken out at a glance instead of two coarse buckets.
  const applicationsByStage = React.useMemo(() => {
    const map: Record<Application_Stage_Enum, JobApplicationProps[]> = {
      [Application_Stage_Enum.Applied]: [],
      [Application_Stage_Enum.Interviewing]: [],
      [Application_Stage_Enum.Offer]: [],
      [Application_Stage_Enum.Rejected]: [],
    };
    for (const item of applications) {
      if (!matchesQuery(item)) continue;
      (map[item.stage] ?? map[Application_Stage_Enum.Applied]).push(item);
    }
    return map;
  }, [applications, matchesQuery]);
  const STAGE_SECTIONS = [
    Application_Stage_Enum.Applied,
    Application_Stage_Enum.Interviewing,
    Application_Stage_Enum.Offer,
    Application_Stage_Enum.Rejected,
  ];
  const STAGE_EMPTY_COPY: Record<Application_Stage_Enum, {key: string; defaultValue: string}> = {
    [Application_Stage_Enum.Applied]: {key: 'request:no_applied_applications', defaultValue: 'No applications in this stage yet.'},
    [Application_Stage_Enum.Interviewing]: {key: 'request:no_interviewing_applications', defaultValue: 'No interviews scheduled yet.'},
    [Application_Stage_Enum.Offer]: {key: 'request:no_offer_applications', defaultValue: 'No offers yet.'},
    [Application_Stage_Enum.Rejected]: {key: 'request:no_rejected_applications', defaultValue: 'Nothing here yet.'},
  };
  const noApplicationsMatch = STAGE_SECTIONS.every(stage => applicationsByStage[stage].length === 0);
  const isFiltering = q.length > 0;
  const hasAnyApplications = applications.length > 0;
  // "Compare offers" only makes sense with 2+ live offers to actually
  // compare — see CompareOffers.tsx's own comment.
  const offerCount = applications.filter(item => item.stage === Application_Stage_Enum.Offer).length;

  const onSeeAllPast = () => {
    navigate('Interviews', {
      screen: 'RequestsInPast',
      params: {requestType: Request_Type_Enum.Application},
    });
  };

  if (!isPro) {
    return (
      <View style={styles.container}>
        <Flex vertical itemsCenter style={styles.lockCard}>
          <Icon
            pack="eva"
            name="lock-outline"
            style={[globalStyle.icon40, {tintColor: theme['text-basic-color']}]}
          />
          <Text category="h6" bold center mt={16}>
            {t('request:application_tracker_pro_gate_title', {defaultValue: 'This is a Basic feature'})}
          </Text>
          <Text category="h9-s" status="placeholder" center mt={8} mb={24}>
            {t('request:application_tracker_pro_gate_body', {
              defaultValue: "Track every job you've applied for, all the way to offer — Application Tracker is a Saveur Basic feature.",
            })}
          </Text>
          <CtaButton
            accessoryLeft={props => <Icon {...props} pack="eva" name="lock-outline" />}
            accessoryRight={props => <Icon {...props} pack="eva" name="arrow-forward-outline" />}
            onPress={() => navigate('Subscription')}>
            {renderCenteredLabel(t('request:see_pro_premium_plans', {defaultValue: 'See Basic plans'}), {stretch: false})}
          </CtaButton>
        </Flex>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonList count={4} />
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
      {/* Premium Job Tracker feature entry points (product follow-up: "what
          more features can we add to the Job application tracker that can
          make it worth being added as a premium plan"). Shown even with an
          empty list — "Add from email" in particular is a second on-ramp
          into tracking alongside the existing WebView auto-detect flow.
          Product report: "the Add from email and Analytics button should
          both be on the same level horizontally" -- was a wrapping Flex
          row, which could drop "Analytics" to a second line on narrower
          screens once both outline buttons' icon+label width added up. A
          horizontal ScrollView guarantees they always stay on one row
          (scrollable rather than wrapping) regardless of screen width. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionsRow}
        style={{marginBottom: hasAnyApplications ? 16 : 0}}>
        {/* REVERTED (product follow-up: "give the add from email the same
            gray background you gave to the analytics and remove its
            border") -- was a filled status="primary" blue button with an
            explicit black border, per an earlier, separate request ("the
            Add from email button should be the default blue and the text
            white"). Now the exact same appearance="outline" status="basic"
            treatment as the Analytics/Compare offers buttons right next to
            it, so all three read as one consistent set instead of Add from
            email standing out as a different color/style. Alignment: this
            horizontal ScrollView's content already starts at the left edge
            by default -- there was no centering here -- but
            contentContainerStyle still pins alignItems to flex-start so
            that can never drift regardless of how many action buttons
            render next to it. */}
        {/* Task #44/#49: the bridge web's unified Job Tracker board gets for
            free by living on one page (its Recommended/Shortlisted columns
            are job ALERTS, a completely separate backend resource from the
            tracked applications this tab lists) -- on mobile those stay two
            separate screens, so this is the on-ramp from "tracking" back to
            "discovery" instead of merging two different data models into
            one list. */}
        <Button
          size="small"
          appearance="outline"
          status="basic"
          style={{marginRight: 10}}
          accessoryLeft={props => <Icon {...props} pack="eva" name="compass-outline" />}
          onPress={() => navigate('JobAlerts')}>
          {t('request:find_jobs_cta', {defaultValue: 'Find jobs'})}
        </Button>
        <Button
          size="small"
          appearance="outline"
          status="basic"
          style={{marginRight: 10}}
          accessoryLeft={props => <Icon {...props} pack="eva" name="email-outline" />}
          onPress={() => navigate('AddFromEmail')}>
          {t('request:add_from_email_cta', {defaultValue: 'Add from email'})}
        </Button>
        {hasAnyApplications ? (
          <Button
            size="small"
            appearance="outline"
            status="basic"
            style={{marginRight: 10}}
            accessoryLeft={props => <Icon {...props} pack="eva" name="bar-chart-2-outline" />}
            onPress={() => navigate('ApplicationAnalytics')}>
            {t('request:analytics_cta', {defaultValue: 'Analytics'})}
          </Button>
        ) : null}
        {offerCount >= 2 ? (
          <Button
            size="small"
            appearance="outline"
            status="basic"
            accessoryLeft={props => <Icon {...props} pack="eva" name="award-outline" />}
            onPress={() => navigate('CompareOffers')}>
            {t('request:compare_offers_cta', {defaultValue: 'Compare offers'})}
          </Button>
        ) : null}
      </ScrollView>
      {hasAnyApplications ? (
        <Input
          placeholder={t('request:search_applications', {defaultValue: 'Search by company, role, or location…'})}
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          textStyle={globalStyle.inputText}
          accessoryLeft={props => (
            <Icon {...props} style={[props.style, styles.accessoryLeftSpacing]} pack="assets" name="search" />
          )}
        />
      ) : null}
      {isFiltering && noApplicationsMatch ? (
        <Text category="h8-s" status="placeholder" center mt={24}>
          {t('request:no_applications_match', {defaultValue: 'No applications match your search.'})}
        </Text>
      ) : (
        <>
          {/* Product follow-up ("arrange this interview screen well and
              make it professional"): each section used to render just its
              header and then nothing at all when empty -- with no tracked
              applications yet, sections sat back-to-back with no content
              between them, reading as broken/unfinished rather than a real
              empty state. Each of the 4 real stage sections below falls
              back to its own short placeholder line (same pattern
              RequestsInPast.tsx already uses for its own empty states)
              instead of just trailing off. "See all" (into the full past-
              applications list) sits on the last section, same spot it
              held back when this was a single "Past" bucket. */}
          {STAGE_SECTIONS.map((stage, sectionIndex) => {
            const items = applicationsByStage[stage];
            const isLast = sectionIndex === STAGE_SECTIONS.length - 1;
            return (
              <View key={stage}>
                <Flex justify="flex-start" mb={24}>
                  <Text category="h6" bold>
                    {getApplicationStageLabel(stage, t)}
                  </Text>
                  <Text category="para-m" mt={4} ml={8} status="placeholder">
                    {items.length > 0 ? items.length : null}
                  </Text>
                  {isLast && items.length > 0 ? (
                    <Flex itemsCenter ml={12} style={globalStyle.flexOne}>
                      <Text category="h8" status="link" onPress={onSeeAllPast} bold>
                        {t('common:seeAll')}
                      </Text>
                    </Flex>
                  ) : null}
                </Flex>
                {items.length === 0 ? (
                  <Text category="h9-s" status="placeholder" mb={24}>
                    {t(STAGE_EMPTY_COPY[stage].key, {defaultValue: STAGE_EMPTY_COPY[stage].defaultValue})}
                  </Text>
                ) : (
                  items.map((item, i) => <ApplicationItem item={item} key={i} />)
                )}
              </View>
            );
          })}
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
  // See the "Add from email"/"border + alignment" comment above the button
  // itself in the component body.
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    // backgroundColor: 'background-basic-color-2',
  },
  searchInput: {
    ...globalStyle.inputField,
    marginBottom: 20,
  },
  // Bug report ("the search icon is touching the edge of the input
  // field") — Eva's own Input theme mapping gives accessoryLeft a
  // marginHorizontal via iconMarginHorizontal, but in practice it reads as
  // flush against the border. Same explicit fix already used on
  // JobPreferences.tsx/SignupSecondStep.tsx's own search inputs: layer an
  // extra marginLeft on top of Eva's own icon style instead of replacing
  // it.
  accessoryLeftSpacing: {
    marginLeft: 14,
  },
});
