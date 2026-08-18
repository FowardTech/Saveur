import React, { memo } from 'react';
import { KeyboardAvoidingView, Modal, Platform, TouchableOpacity, View } from 'react-native';
import {
  Icon,
  Input,
  Layout,
  StyleService,
  TopNavigation,
  useStyleSheet,
  useTheme,
} from '@ui-kitten/components';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';
import { accentTintBg } from 'utils/accentPalette';
import EmptyState from 'components/EmptyState';
import { SkeletonList } from 'components/Skeleton';
import { globalStyle } from 'styles/globalStyle';
import dayjs from 'utils/dayjs';
import { RootStackParamList } from 'navigation/types';
import { GamificationStreakProps, MockInterviewSessionProps } from 'constants/Types';
import * as gamificationService from 'services/gamificationService';
import * as interviewService from 'services/interviewService';
import * as applicationsService from 'services/applicationsService';
import * as goalsPreferencesService from 'services/goalsPreferencesService';
import { WeeklyTargets } from 'services/goalsPreferencesService';
import { AuthContext } from '../../AuthContext';

type TargetKey = keyof WeeklyTargets;

// Expanded Goals screen (product reference — a fitness app's "Goals" screen:
// a Nutrition section with per-macro targets + edit pencils, a Weight
// section with current/goal readouts). This app has no calories/weight to
// track, so the same layout shape is repurposed with Saveur's own
// equivalents: a Career section (the goal picked at signup/ChangeCareType,
// plus target roles/countries counts), a Weekly Targets section (practice
// sessions + applications — this account's own personal targets, edited
// inline the same way the reference edits a macro target), and a Progress
// section (current/longest streak, same "two readouts side by side" shape
// as the reference's Current Weight/Goal Weight rows). Reachable from
// More > Career Goal, which now opens here first instead of jumping
// straight to the goal picker (see MoreSrc.tsx's DATA_DETAILS).
const GoalsScreen = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'find', 'common']);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { profile } = React.useContext(AuthContext);

  const [streak, setStreak] = React.useState<GamificationStreakProps | null>(null);
  const [sessions, setSessions] = React.useState<MockInterviewSessionProps[]>([]);
  const [appliedThisWeek, setAppliedThisWeek] = React.useState(0);
  const [targets, setTargets] = React.useState<WeeklyTargets | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Same Monday-first week boundary as interviewService.computeWeeklyPractice
  // (see that function's own comment on why `.day()`, not `startOf('week')`)
  // — kept consistent here so "this week" means the same calendar days on
  // both this screen and My Progress.
  const isThisWeek = React.useCallback((ts?: number | string) => {
    if (!ts) return false;
    const today = dayjs();
    const daysSinceMonday = (today.day() + 6) % 7;
    const monday = today.subtract(daysSinceMonday, 'day').startOf('day');
    const sunday = monday.add(7, 'day');
    const d = dayjs(ts);
    return d.isAfter(monday) && d.isBefore(sunday);
  }, []);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [streakResult, history, applications, weeklyTargets] = await Promise.all([
        gamificationService.getStreak().catch(() => null),
        interviewService.getPracticeHistory(),
        applicationsService.listApplications().catch(() => []),
        goalsPreferencesService.getWeeklyTargets(),
      ]);
      setStreak(streakResult);
      setSessions(history);
      setAppliedThisWeek(applications.filter(a => isThisWeek(a.appliedDate)).length);
      setTargets(weeklyTargets);
    } catch (error: any) {
      setLoadError(
        error?.message ?? t('find:could_not_load_progress', { defaultValue: 'Could not load your progress.' }),
      );
    } finally {
      setIsLoading(false);
    }
  }, [isThisWeek, t]);

  // Re-checks every time this screen regains focus — same reasoning as
  // MyProgress.tsx: editing the career goal or a weekly target and coming
  // back here shouldn't need a remount to show the new value.
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  const practiceThisWeek = React.useMemo(() => {
    const completed = sessions.filter(s => s.status === 'Completed');
    return interviewService.computeWeeklyPractice(completed).reduce((sum, d) => sum + d.sessions, 0);
  }, [sessions]);

  const goal = profile?.goals?.[0];
  const desiredRolesCount = profile?.desiredRoles?.length ?? 0;
  const countriesCount = profile?.preferredCountries?.length ?? 0;

  // Inline edit modal for a single weekly target — mirrors the reference's
  // "tap a macro's pencil, type a new target number" flow. One shared modal
  // for both targets rather than two near-identical ones.
  const [editingKey, setEditingKey] = React.useState<TargetKey | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const [isSavingTarget, setIsSavingTarget] = React.useState(false);

  const onOpenEdit = (key: TargetKey) => {
    setEditingKey(key);
    setEditValue(String(targets?.[key] ?? ''));
  };

  const onSaveTarget = async () => {
    if (!editingKey || !targets || isSavingTarget) return;
    const parsed = parseInt(editValue, 10);
    if (!parsed || parsed <= 0) return;
    setIsSavingTarget(true);
    try {
      const next: WeeklyTargets = { ...targets, [editingKey]: parsed };
      await goalsPreferencesService.setWeeklyTargets(next);
      setTargets(next);
      setEditingKey(null);
    } finally {
      setIsSavingTarget(false);
    }
  };

  const editTitle =
    editingKey === 'practiceSessions'
      ? t('more:goals_edit_practice_target', { defaultValue: 'Weekly practice sessions target' })
      : t('more:goals_edit_applications_target', { defaultValue: 'Weekly applications target' });

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:goals_title', { defaultValue: 'Goals' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        {isLoading ? (
          <SkeletonList count={4} style={{ paddingHorizontal: 16 }} />
        ) : loadError ? (
          <EmptyState
            variant="error"
            title={t('common:something_went_wrong', { defaultValue: 'Something went wrong' })}
            body={loadError}
            actionLabel={t('common:try_again', { defaultValue: 'Try again' })}
            onAction={load}
          />
        ) : (
          <>
            {/* Product follow-up ("the color style and blend is not
                consistent throughout the app... use it in certain other
                places too") — same pastel-icon-badge header treatment
                RecentActivityList.tsx uses on Home ("Recent activity"),
                one fixed accent per section rather than a hashed/cycled
                color, since these are 3 fixed, semantically distinct
                sections (not a repeating list). */}
            <Flex justify="flex-start" itemsCenter mb={12}>
              <View style={[styles.sectionIconWrap, { backgroundColor: accentTintBg('#0063f8') }]}>
                <Icon pack="eva" name="briefcase-outline" style={[globalStyle.icon16, { tintColor: '#0063f8' }]} />
              </View>
              <Text category="h6" bold ml={10}>
                {t('more:goals_section_career', { defaultValue: 'Career' })}
              </Text>
            </Flex>
            <Layout level="2" style={styles.card}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => navigate('ChangeCareType')}
                activeOpacity={0.7}>
                <View style={globalStyle.flexOne}>
                  <Text category="h10" status="placeholder">
                    {t('more:goals_current_goal', { defaultValue: 'Current goal' })}
                  </Text>
                  <Text category="h9" bold mt={2} numberOfLines={1}>
                    {goal ?? t('more:goals_no_goal_set', { defaultValue: 'Not set' })}
                  </Text>
                </View>
                <Icon
                  pack="assets"
                  name="edit_profile"
                  style={{ width: 18, height: 18, tintColor: theme['text-hint-color'] }}
                />
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.statsRow}
                onPress={() => navigate('JobPreferences')}
                activeOpacity={0.7}>
                <View style={styles.statCol}>
                  {/* BUG FIX: status="primary" resolves to
                      constants/theme/mapping.json's `text-primary-color`,
                      which is a near-white token meant for text drawn ON a
                      primary-colored (blue) surface (e.g. a filled button —
                      see components/CtaButton.tsx, which reads that exact
                      token for its own white label). Used directly on a
                      plain white card like this one, it was invisible in
                      light mode — same root cause already found and fixed
                      once before in src/more/JobAlerts.tsx, CareerBriefingDetail.tsx,
                      CareerDiary.tsx, PaymentHistory.tsx, and both
                      Practical Scenario screens (see their own "Was
                      status='primary'" comments), just never swept through
                      the rest of the app until now. text-basic-color reads
                      correctly in both themes and matches the product rule
                      that plain values (not pills/links) should be black,
                      not blue. */}
                  <Text category="h7" bold style={{ color: theme['text-basic-color'] }}>
                    {desiredRolesCount}
                  </Text>
                  <Text category="h10" status="placeholder" center mt={2}>
                    {t('more:goals_target_roles', { defaultValue: 'Target roles' })}
                  </Text>
                </View>
                <View style={[styles.statCol, styles.statColBorder]}>
                  <Text category="h7" bold style={{ color: theme['text-basic-color'] }}>
                    {countriesCount}
                  </Text>
                  <Text category="h10" status="placeholder" center mt={2}>
                    {t('more:goals_countries', { defaultValue: 'Countries' })}
                  </Text>
                </View>
                <View style={styles.statCol}>
                  <Icon
                    pack="assets"
                    name="chevronRight"
                    style={{ width: 18, height: 18, tintColor: theme['text-hint-color'], alignSelf: 'center' }}
                  />
                  <Text category="h10" status="placeholder" center mt={2}>
                    {t('more:goals_edit', { defaultValue: 'Edit' })}
                  </Text>
                </View>
              </TouchableOpacity>
            </Layout>

            <Flex justify="flex-start" itemsCenter mt={28} mb={12}>
              <View style={[styles.sectionIconWrap, { backgroundColor: accentTintBg('#F59E0B') }]}>
                <Icon pack="eva" name="flag-outline" style={[globalStyle.icon16, { tintColor: '#F59E0B' }]} />
              </View>
              <Text category="h6" bold ml={10}>
                {t('more:goals_section_weekly_targets', { defaultValue: 'Weekly targets' })}
              </Text>
            </Flex>
            <Layout level="2" style={styles.card}>
              <View style={styles.targetRow}>
                <View style={globalStyle.flexOne}>
                  <Text category="h9" bold>
                    {t('more:goals_practice_sessions', { defaultValue: 'Practice sessions' })}
                  </Text>
                  <Text category="h10" status="placeholder" mt={2}>
                    {t('more:goals_of_target_this_week', {
                      defaultValue: '{{done}} of {{target}} this week',
                      done: practiceThisWeek,
                      target: targets?.practiceSessions ?? 0,
                    })}
                  </Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, (practiceThisWeek / Math.max(1, targets?.practiceSessions ?? 1)) * 100)}%`,
                          backgroundColor: theme['color-primary-500'],
                        },
                      ]}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.pencilButton}
                  onPress={() => onOpenEdit('practiceSessions')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon
                    pack="assets"
                    name="edit_profile"
                    style={{ width: 18, height: 18, tintColor: theme['text-hint-color'] }}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.divider} />
              <View style={styles.targetRow}>
                <View style={globalStyle.flexOne}>
                  <Text category="h9" bold>
                    {t('more:goals_applications', { defaultValue: 'Applications' })}
                  </Text>
                  <Text category="h10" status="placeholder" mt={2}>
                    {t('more:goals_of_target_this_week', {
                      defaultValue: '{{done}} of {{target}} this week',
                      done: appliedThisWeek,
                      target: targets?.applications ?? 0,
                    })}
                  </Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, (appliedThisWeek / Math.max(1, targets?.applications ?? 1)) * 100)}%`,
                          backgroundColor: theme['color-primary-500'],
                        },
                      ]}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.pencilButton}
                  onPress={() => onOpenEdit('applications')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon
                    pack="assets"
                    name="edit_profile"
                    style={{ width: 18, height: 18, tintColor: theme['text-hint-color'] }}
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={{ marginTop: 14, alignSelf: 'flex-start' }}
                onPress={() => navigate('LearningCourses')}>
                {/* This one genuinely IS a link (navigates on tap, arrow
                    affordance) — status="link" (text-link-color, a real
                    visible blue in both themes) is the correct status here,
                    not the near-white "primary" one. */}
                <Text category="h10" bold status="link">
                  {t('more:goals_view_learning_courses', { defaultValue: 'Continue Learning Courses →' })}
                </Text>
              </TouchableOpacity>
            </Layout>

            <Flex justify="flex-start" itemsCenter mt={28} mb={12}>
              <View style={[styles.sectionIconWrap, { backgroundColor: accentTintBg('#10B981') }]}>
                <Icon pack="eva" name="trending-up-outline" style={[globalStyle.icon16, { tintColor: '#10B981' }]} />
              </View>
              <Text category="h6" bold ml={10}>
                {t('more:goals_section_progress', { defaultValue: 'Progress' })}
              </Text>
            </Flex>
            <Layout level="2" style={styles.card}>
              <Flex justify="space-between">
                <View style={globalStyle.flexOne}>
                  <Text category="h10" status="placeholder">
                    {t('more:goals_current_streak', { defaultValue: 'Current streak' })}
                  </Text>
                  <Text category="h6" bold style={{ color: theme['text-basic-color'] }} mt={4}>
                    {t('more:goals_days', { defaultValue: '{{count}} days', count: streak?.streakDays ?? 0 })}
                  </Text>
                </View>
                <View style={globalStyle.flexOne}>
                  <Text category="h10" status="placeholder">
                    {t('more:goals_longest_streak', { defaultValue: 'Longest streak' })}
                  </Text>
                  <Text category="h6" bold style={{ color: theme['text-basic-color'] }} mt={4}>
                    {t('more:goals_days', {
                      defaultValue: '{{count}} days',
                      count: streak?.longestStreak ?? streak?.streakDays ?? 0,
                    })}
                  </Text>
                </View>
              </Flex>
              <TouchableOpacity style={{ marginTop: 16, alignSelf: 'flex-start' }} onPress={() => navigate('MyProgress')}>
                <Text category="h10" bold status="link">
                  {t('more:goals_view_full_progress', { defaultValue: 'View full progress →' })}
                </Text>
              </TouchableOpacity>
            </Layout>
          </>
        )}
      </Content>

      <Modal visible={editingKey !== null} animationType="fade" transparent onRequestClose={() => setEditingKey(null)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.editCard, { backgroundColor: theme['background-basic-color-1'] }]}>
            <Text category="h8" bold center mb={16}>
              {editTitle}
            </Text>
            <Input
              autoFocus
              keyboardType="number-pad"
              value={editValue}
              onChangeText={setEditValue}
              style={styles.editInput}
              textStyle={{ textAlign: 'center' }}
            />
            <CtaButton style={{ marginTop: 20 }} loading={isSavingTarget} onPress={onSaveTarget}>
              {t('common:save', { defaultValue: 'Save' })}
            </CtaButton>
            <TouchableOpacity
              style={{ marginTop: 12 }}
              disabled={isSavingTarget}
              onPress={() => setEditingKey(null)}>
              <Text category="h9-s" status="placeholder" center>
                {t('common:cancel', { defaultValue: 'Cancel' })}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Container>
  );
});

export default GoalsScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  card: {
    ...globalStyle.card,
    padding: 16,
  },
  // Same pastel-icon-badge header treatment as RecentActivityList.tsx's
  // headerIconWrap on Home's "Recent activity" section (28x28/radius 9).
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'border-basic-color-3',
    marginVertical: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
  },
  statColBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'border-basic-color-3',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pencilButton: {
    marginLeft: 12,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'background-basic-color-3',
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 24,
  },
  editCard: {
    width: '100%',
    // Google-style furnishing pass (see styles/globalStyle.ts's `card`) --
    // 14 -> 20.
    borderRadius: 20,
    padding: 24,
  },
  editInput: {
    borderRadius: 12,
  },
});
