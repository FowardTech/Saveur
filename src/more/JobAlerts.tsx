import React, {memo} from 'react';
import {
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Icon,
  Input,
  Spinner,
} from '@ui-kitten/components';
import Slider from '@react-native-community/slider';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import {globalStyle} from 'styles/globalStyle';
import {JobAlertProps} from 'constants/Types';
import {RootStackParamList} from 'navigation/types';
import * as jobAlertsService from 'services/jobAlertsService';
import {AuthContext} from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import CompanyLogoAvatar from 'components/CompanyLogoAvatar';
import {renderCenteredLabel} from 'utils/buttonLabel';

// "Like a Google Alert, but for jobs" — matches new postings found online
// against profile.preferredCountries + profile.desiredRoles (see
// services/jobAlertsService.ts; the actual web crawling/matching is a
// backend job, not done here). Tapping an alert opens the posting's real
// application page in-app (src/more/WebViewScreen.tsx) instead of leaving
// to the system browser. The preferences editor at the top is what lets a
// user add/change desiredRoles/preferredCountries any time after signup —
// SignupSecondStep only collects them once, at account creation.
const JobAlerts = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'common']);
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const {profile, updateProfile, isPremium} = React.useContext(AuthContext);

  const [alerts, setAlerts] = React.useState<JobAlertProps[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  // Cursor-based "load more as you scroll" — see JOB_ALERTS_PAGE_SIZE (15)
  // in services/jobAlertsService.ts. null once the backend says there's no
  // next page; undefined isn't used here so a plain falsy check is enough.
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  const [isPrefsOpen, setIsPrefsOpen] = React.useState(false);
  const [roleDraft, setRoleDraft] = React.useState('');
  const [countryDraft, setCountryDraft] = React.useState('');
  const [desiredRoles, setDesiredRoles] = React.useState<string[]>(profile?.desiredRoles ?? []);
  const [preferredCountries, setPreferredCountries] = React.useState<string[]>(profile?.preferredCountries ?? []);
  // Max NEW alerts created per calendar day — enforced server-side in
  // job_search_service.refresh_alerts_for_user (User.job_alert_daily_limit).
  // A free-text field here let someone type "1" or "2" and end up thinking
  // Job Alerts was broken (nothing showing up) rather than realizing they'd
  // capped it — a slider bounded to the same 15-50 range the backend
  // enforces (app/api/users.py's update_me) makes "too low to be useful"
  // impossible to select in the first place.
  const [dailyLimit, setDailyLimit] = React.useState(
    Math.min(Math.max(profile?.jobAlertDailyLimit ?? 15, 15), 50),
  );
  const [isSavingPrefs, setIsSavingPrefs] = React.useState(false);

  // Keep the editor's local draft in sync if the real profile changes out
  // from under it (e.g. loaded after this screen already mounted).
  React.useEffect(() => {
    setDesiredRoles(profile?.desiredRoles ?? []);
    setPreferredCountries(profile?.preferredCountries ?? []);
    setDailyLimit(Math.min(Math.max(profile?.jobAlertDailyLimit ?? 15, 15), 50));
  }, [profile?.desiredRoles, profile?.preferredCountries, profile?.jobAlertDailyLimit]);

  // Loads (or reloads) page 1 — used on mount, pull-to-refresh, and after
  // saving preferences. Always replaces the list and resets pagination
  // rather than appending, since a preference change or refresh can
  // meaningfully reorder/replace what's relevant.
  const loadAlerts = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const page = await jobAlertsService.listJobAlerts();
      setAlerts(page.alerts);
      setNextCursor(page.nextCursor);
    } catch (error: any) {
      setLoadError(error?.message ?? t('more:job_alerts_load_failed', {defaultValue: 'Could not load job alerts.'}));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Infinite scroll — 15 at a time (JOB_ALERTS_PAGE_SIZE), fetched as the
  // user nears the bottom of the list. No-ops if already loading a page or
  // the backend already said there's nothing more (nextCursor === null).
  const loadMore = React.useCallback(async () => {
    if (isLoadingMore || isLoading || isRefreshing || !nextCursor) return;
    setIsLoadingMore(true);
    try {
      const page = await jobAlertsService.listJobAlerts(nextCursor);
      setAlerts(prev => [...prev, ...page.alerts]);
      setNextCursor(page.nextCursor);
    } catch {
      // Silent — a failed "load more" shouldn't interrupt the list the user
      // can already see. They'll just stop scrolling further; scrolling
      // back up and down again retries since nextCursor is unchanged.
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, isLoading, isRefreshing, nextCursor]);

  // Fires on every scroll tick (Content sets scrollEventThrottle={16}) —
  // triggers loadMore once the user is within ~400px of the bottom, the
  // same "near enough to start fetching before you actually hit the end"
  // margin most infinite-scroll lists use so the next page is ready before
  // you run out of content to look at.
  const onScroll = React.useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const {contentOffset, contentSize, layoutMeasurement} = e.nativeEvent;
      const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
      if (distanceFromBottom < 400) {
        loadMore();
      }
    },
    [loadMore],
  );

  // Pull-to-refresh — POST /api/v1/job-alerts/refresh queues a fresh
  // backend scan and returns right away (it now runs in a background
  // thread server-side; a full scan across every role x country combo can
  // take anywhere from several seconds to over a minute, which is why this
  // used to fail with "Couldn't refresh — that took too long" when it
  // blocked on the scan finishing). Re-fetching page 1 right after is still
  // worth doing (it'll pick up anything the scheduler already found since
  // the last load), but it's not guaranteed to show anything new from THIS
  // particular scan — that lands a little later, surfaced via the push
  // notification the backend sends per new match.
  const onPullToRefresh = React.useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await jobAlertsService.refreshJobAlerts();
      const page = await jobAlertsService.listJobAlerts();
      setAlerts(page.alerts);
      setNextCursor(page.nextCursor);
      setLoadError(null);
    } catch (error: any) {
      Alert.alert(
        t('more:job_alerts_refresh_failed_title', {defaultValue: "Couldn't refresh"}),
        error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  const [isTogglingPinId, setIsTogglingPinId] = React.useState<string | null>(null);
  const onTogglePin = React.useCallback(
    async (alert: JobAlertProps) => {
      if (isTogglingPinId) return;
      setIsTogglingPinId(alert.id);
      const nextPinned = !alert.pinned;
      // Optimistic — pinning is a lightweight, low-stakes toggle; flipping
      // it back on a rare failure is less jarring than a spinner on every
      // tap of what's meant to be a quick one-off action.
      setAlerts(prev => prev.map(a => (a.id === alert.id ? {...a, pinned: nextPinned} : a)));
      try {
        await jobAlertsService.toggleJobAlertPin(alert.id, nextPinned);
      } catch {
        setAlerts(prev => prev.map(a => (a.id === alert.id ? {...a, pinned: alert.pinned} : a)));
        Alert.alert(
          t('more:job_alerts_pin_failed_title', {defaultValue: "Couldn't update"}),
          t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
        );
      } finally {
        setIsTogglingPinId(null);
      }
    },
    [isTogglingPinId],
  );

  const hasNoPreferences = (profile?.desiredRoles?.length ?? 0) === 0 || (profile?.preferredCountries?.length ?? 0) === 0;

  const addRole = () => {
    const trimmed = roleDraft.trim();
    if (!trimmed) return;
    setDesiredRoles(prev => (prev.some(r => r.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]));
    setRoleDraft('');
  };
  const addCountry = () => {
    const trimmed = countryDraft.trim();
    if (!trimmed) return;
    setPreferredCountries(prev => (prev.some(c => c.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]));
    setCountryDraft('');
  };

  const onSavePrefs = async () => {
    if (isSavingPrefs) return;
    setIsSavingPrefs(true);
    try {
      // dailyLimit comes from the slider below, which is already bounded to
      // 15-50 by its own minimumValue/maximumValue — this just guards
      // against a non-integer step value some Android slider builds can
      // report. Same 15-50 clamp as app/api/users.py's update_me.
      // How often alerts get checked for (refresh interval) is no longer a
      // per-user setting — see app/api/users.py's update_me, which now
      // silently ignores jobAlertRefreshMinutes if an old client still
      // sends it; it's a single admin-controlled dial now
      // (app_config_service's "job_alerts" section) to prevent a single
      // account polling too aggressively from exhausting Firecrawl's rate
      // limit/credits for everyone.
      const jobAlertDailyLimit = Math.min(Math.max(Math.round(dailyLimit), 15), 50);
      await updateProfile({desiredRoles, preferredCountries, jobAlertDailyLimit});
      setDailyLimit(jobAlertDailyLimit);
      setIsPrefsOpen(false);
      loadAlerts();
    } catch (error: any) {
      Alert.alert(
        t('more:job_alerts_save_prefs_failed_title', {defaultValue: "Couldn't save preferences"}),
        error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const onOpenAlert = (alert: JobAlertProps) => {
    if (!alert.read) {
      setAlerts(prev => prev.map(a => (a.id === alert.id ? {...a, read: true} : a)));
      jobAlertsService.markJobAlertsRead([alert.id]).catch(() => {});
    }
    // Reverted per explicit follow-up request — back to landing on
    // JobAlertDetails first (title/company/matched role/source, with its
    // own "Apply on {source}" button to actually open the posting), not
    // straight to WebViewScreen. See JobAlertDetails.tsx's onApply for the
    // second-tap handoff to the real job/apply page.
    navigate('JobAlertDetails', {job: alert});
  };

  if (!isPremium) {
    return (
      <ProLockGate
        variant="premium"
        title={t('more:job_alerts', {defaultValue: 'Job Alerts'})}
        description={t('more:job_alerts_premium_gate_description', {
          defaultValue: 'Get notified the moment a real job posting matches your profile — Job Alerts is a Pro Premium feature.',
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:job_alerts', {defaultValue: 'Job Alerts'})}
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          <TouchableOpacity onPress={() => setIsPrefsOpen(prev => !prev)}>
            <Icon
              pack="eva"
              name={isPrefsOpen ? 'close-outline' : 'settings-2-outline'}
              style={[globalStyle.icon24, {tintColor: theme['text-basic-color']}]}
            />
          </TouchableOpacity>
        }
      />
      <Content
        padder
        avoidKeyboard
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onPullToRefresh} tintColor={theme['color-primary-500']} />
        }>
        {hasNoPreferences ? (
          <Layout level="2" style={styles.hintCard}>
            <Text category="h9-s">
              {t('more:job_alerts_hint', {
                defaultValue: "Add the roles you're targeting and the countries you'd work in so we know what to alert you about.",
              })}
            </Text>
            <Button size="small" style={{marginTop: 12}} onPress={() => setIsPrefsOpen(true)}>
              {t('more:job_alerts_set_preferences', {defaultValue: 'Set preferences'})}
            </Button>
          </Layout>
        ) : null}

        {/* Retention notice — job_search_service.cleanup_old_alerts (backend,
            runs daily) actually deletes alerts on this schedule, so this
            isn't just informational copy that could drift from real
            behavior; the pin icon on each card below is the described
            escape hatch. */}
        <Layout level="2" style={styles.retentionBanner}>
          <Icon
            pack="eva"
            name="info-outline"
            style={[globalStyle.icon20, {tintColor: theme['text-basic-color'], marginRight: 10}]}
          />
          <Text category="h10" status="placeholder" style={globalStyle.flexOne}>
            {t('more:job_alerts_retention_notice', {
              defaultValue: 'Job alerts auto-delete after 1 week. Tap the pin icon on one to keep it for 30 days instead.',
            })}
          </Text>
        </Layout>

        {isPrefsOpen ? (
          <Layout level="2" style={styles.prefsCard}>
            <Text category="h8" bold mb={4}>
              {t('more:job_alerts_targeted_roles_label', {defaultValue: "Roles you're targeting"})}
            </Text>
            <Input
              placeholder={t('more:job_alerts_role_placeholder', {defaultValue: 'e.g. Product Manager'})}
              value={roleDraft}
              onChangeText={setRoleDraft}
              onSubmitEditing={addRole}
              returnKeyType="done"
              accessoryRight={props => (
                <TouchableOpacity onPress={addRole} disabled={!roleDraft.trim()}>
                  <Icon {...props} pack="eva" name="plus-outline" />
                </TouchableOpacity>
              )}
              style={styles.prefsInput}
            />
            <View style={styles.chipsWrap}>
              {desiredRoles.map(role => (
                <TouchableOpacity
                  key={role}
                  onPress={() => setDesiredRoles(prev => prev.filter(r => r !== role))}
                  style={[styles.chip, {backgroundColor: theme['color-primary-500']}]}>
                  <Text category="h10" status="control" bold>
                    {role}
                  </Text>
                  <Icon pack="eva" name="close-outline" style={[globalStyle.icon16, {tintColor: theme['text-control-color'], marginLeft: 6}]} />
                </TouchableOpacity>
              ))}
            </View>

            <Text category="h8" bold mb={4} mt={16}>
              {t('more:job_alerts_targeted_countries_label', {defaultValue: "Countries you'd work in"})}
            </Text>
            <Input
              placeholder={t('more:job_alerts_country_placeholder', {defaultValue: 'e.g. United States'})}
              value={countryDraft}
              onChangeText={setCountryDraft}
              onSubmitEditing={addCountry}
              returnKeyType="done"
              accessoryRight={props => (
                <TouchableOpacity onPress={addCountry} disabled={!countryDraft.trim()}>
                  <Icon {...props} pack="eva" name="plus-outline" />
                </TouchableOpacity>
              )}
              style={styles.prefsInput}
            />
            <View style={styles.chipsWrap}>
              {preferredCountries.map(country => (
                <TouchableOpacity
                  key={country}
                  onPress={() => setPreferredCountries(prev => prev.filter(c => c !== country))}
                  style={[styles.chip, {backgroundColor: theme['background-basic-color-3']}]}>
                  <Text category="h10" bold>
                    {country}
                  </Text>
                  <Icon pack="eva" name="close-outline" style={[globalStyle.icon16, {tintColor: theme['text-basic-color'], marginLeft: 6}]} />
                </TouchableOpacity>
              ))}
            </View>

            <Flex justify="space-between" itemsCenter mb={4} mt={16}>
              <Text category="h8" bold>
                {t('more:job_alerts_daily_limit_label', {defaultValue: 'Max new alerts per day'})}
              </Text>
              {/* Was status="primary", which resolves to `text-primary-color`
                  -- a near-white/white token meant for text sitting ON a
                  colored surface (e.g. a filled button), not plain text
                  directly on the card background. That's exactly right in
                  dark mode (white reads fine there) but made this digit
                  invisible in light mode. Using the actual brand blue
                  directly instead -- readable against the card background
                  in both themes, and matches the slider's own accent color
                  right below it. */}
              <Text category="h8" bold style={{color: theme['color-primary-500']}}>
                {Math.round(dailyLimit)}
              </Text>
            </Flex>
            <Slider
              value={dailyLimit}
              minimumValue={15}
              maximumValue={50}
              step={1}
              onValueChange={value => setDailyLimit(value)}
              style={styles.slider}
              minimumTrackTintColor={theme['color-primary-500']}
              maximumTrackTintColor={theme['background-basic-color-3']}
              thumbTintColor={theme['color-primary-500']}
            />
            <Text category="h10" status="placeholder" mb={4}>
              {t('more:job_alerts_daily_limit_hint', {
                defaultValue:
                  "Choose anywhere from 15 to 50 — once you hit this many new matches in a day, we'll stop adding more until tomorrow.",
              })}
            </Text>

            <Button
              style={{marginTop: 20}}
              disabled={isSavingPrefs}
              accessoryLeft={isSavingPrefs ? () => <Spinner size="small" status="control" /> : undefined}
              onPress={onSavePrefs}>
              {isSavingPrefs
                ? t('more:job_alerts_saving', {defaultValue: 'Saving…'})
                : t('more:job_alerts_save_preferences', {defaultValue: 'Save preferences'})}
            </Button>
          </Layout>
        ) : null}

        {isLoading ? (
          <EmptyState variant="loading" />
        ) : loadError ? (
          <EmptyState
            variant="error"
            title={t('common:something_went_wrong', {defaultValue: 'Something went wrong'})}
            body={loadError}
            actionLabel={t('common:try_again', {defaultValue: 'Try again'})}
            onAction={loadAlerts}
          />
        ) : alerts.length === 0 ? (
          <EmptyState
            icon="bell-outline"
            title={t('more:job_alerts_empty_title', {defaultValue: 'No job matches yet'})}
            body={t('more:job_alerts_empty', {
              defaultValue: "We'll show new postings here as they're found.",
            })}
          />
        ) : (
          alerts.map(alert => (
            <TouchableOpacity key={alert.id} activeOpacity={0.8} onPress={() => onOpenAlert(alert)}>
              <Layout
                level="2"
                style={[
                  styles.alertCard,
                  !alert.read && {borderColor: theme['color-primary-500'], borderWidth: 1},
                ]}>
                <Flex justify="flex-start">
                  <CompanyLogoAvatar
                    logoUrl={alert.companyLogoUrl}
                    companyName={alert.company}
                    size="small"
                    style={{marginRight: 10, marginTop: 2}}
                  />
                  <View style={globalStyle.flexOne}>
                    <Flex justify="space-between" itemsCenter mb={4}>
                      <Text category="h7" bold style={{flex: 1}} numberOfLines={1}>
                        {alert.title}
                      </Text>
                      {!alert.read ? <View style={[styles.unreadDot, {marginRight: 8, backgroundColor: theme['color-primary-500']}]} /> : null}
                      <TouchableOpacity
                        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                        disabled={isTogglingPinId === alert.id}
                        onPress={() => onTogglePin(alert)}>
                        <Icon
                          pack="assets"
                          name={alert.pinned ? 'bookmarkActive' : 'bookmark'}
                          style={[
                            globalStyle.icon20,
                            {tintColor: alert.pinned ? theme['color-primary-500'] : theme['text-placeholder-color']},
                          ]}
                        />
                      </TouchableOpacity>
                    </Flex>
                    <Flex justify="space-between" itemsCenter mb={4}>
                      <Text category="h9-s" status="placeholder" style={globalStyle.flexOne} numberOfLines={1}>
                        {alert.company}
                        {alert.location ? ` · ${alert.location}` : ''}
                      </Text>
                      {alert.applied ? (
                        <View style={[styles.appliedBadge, {backgroundColor: theme['color-info-100']}]}>
                          <Text category="h10" bold status="info">
                            {t('more:applied_badge', {defaultValue: 'Applied'})}
                          </Text>
                        </View>
                      ) : null}
                    </Flex>
                    <Flex justify="space-between" itemsCenter mt={8}>
                      {alert.matchedRole ? (
                        <Text category="h10" status="link" bold>
                          {t('more:job_alerts_matches', {defaultValue: 'Matches: {{role}}', role: alert.matchedRole})}
                        </Text>
                      ) : <View />}
                      {alert.source ? (
                        <Text category="h10" status="placeholder">
                          {t('more:job_alerts_via_source', {defaultValue: 'via {{source}}', source: alert.source})}
                        </Text>
                      ) : null}
                    </Flex>
                  </View>
                </Flex>
              </Layout>
            </TouchableOpacity>
          ))
        )}

        {isLoadingMore ? (
          <Flex vertical itemsCenter justify="center" style={{paddingVertical: 20}}>
            <Spinner size="small" />
          </Flex>
        ) : nextCursor && alerts.length > 0 ? (
          // Explicit manual fetch, on top of the near-bottom auto-trigger in
          // onScroll above — gives a visible, tappable affordance instead of
          // relying purely on scroll position, which wasn't obvious there
          // was more to load.
          <Button
            size="small"
            appearance="outline"
            style={{marginTop: 4, marginBottom: 12, width: '100%'}}
            onPress={loadMore}>
            {renderCenteredLabel(t('common:load_more', {defaultValue: 'Load more'}))}
          </Button>
        ) : null}
      </Content>
    </Container>
  );
});

export default JobAlerts;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  hintCard: {
    backgroundColor: 'background-basic-color-2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  retentionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'background-basic-color-2',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  prefsCard: {
    backgroundColor: 'background-basic-color-2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  prefsInput: {
    marginBottom: 8,
    borderRadius: 12,
  },
  slider: {
    height: 32,
    marginBottom: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 99,
    marginRight: 8,
    marginBottom: 8,
  },
  alertCard: {
    backgroundColor: 'background-basic-color-2',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  appliedBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
});
