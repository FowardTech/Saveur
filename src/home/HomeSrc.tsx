import React, { memo } from 'react';
import { Alert, AppState, View } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon, Layout, Button, Spinner, Avatar } from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';

import Content from 'components/Content';
import Container from 'components/Container';
import HeaderHome from './Components/HeaderHome';
import { Images } from 'assets/images';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from 'navigation/types';
import Text from 'components/Text';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { chartConfig } from 'utils/chartConfig';
import useLayout from 'hooks/useLayout';
import {
  DATA_WEEKLY_PRACTICE,
  DATA_UPCOMING_SESSIONS,
  DATA_PAST_SESSIONS,
  DATA_BADGES,
} from 'constants/Data';
import { GamificationStreakProps, Interview_Type_Enum, LeaderboardEntryProps } from 'constants/Types';
import * as interviewService from 'services/interviewService';
import * as resumeService from 'services/resumeService';
import * as networkingService from 'services/networkingService';
import * as gamificationService from 'services/gamificationService';
import { AuthContext } from '../../AuthContext';

// Defined at module scope (not inline in JSX) so it's a stable component
// reference across renders — see Subscription.tsx's renderCheckoutSpinner
// for the same reasoning.
const renderCheckInSpinner = () => <Spinner size="tiny" status="control" />;

// Dashboard — streak/XP/leaderboard now come from the real backend (see
// services/gamificationService.ts). Weekly practice stats, upcoming session
// and badge unlock state are still mock/client-computed — TODO: wire those
// up to real session history once that domain's backend work lands here too.
const HomeSrc = memo(() => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const { width } = useLayout();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home', 'common']);
  const { isSignedIn, emailVerified, resendVerificationEmail, refreshEmailVerified } =
    React.useContext(AuthContext);

  // Non-blocking "verify your email" banner — see AuthContext.emailVerified's
  // doc comment. Deliberately NOT a hard gate on the rest of the app: an
  // interview-prep tool has no action that strictly requires a verified
  // email today, and a hard gate risks locking someone out entirely if a
  // verification email gets lost/delayed. Only ever true for an
  // email/password account — Google/Apple sign-ins are pre-verified.
  const [resendingVerification, setResendingVerification] = React.useState(false);
  const onResendVerification = React.useCallback(async () => {
    if (resendingVerification) return;
    setResendingVerification(true);
    try {
      await resendVerificationEmail();
      Alert.alert(
        t('home:verification_resent_title', { defaultValue: 'Email sent' }),
        t('home:verification_resent_body', { defaultValue: 'Check your inbox for the verification link.' }),
      );
    } catch (error: any) {
      Alert.alert(
        t('home:verification_resend_failed_title', { defaultValue: "Couldn't send that" }),
        error?.message ?? t('common:try_again_later', { defaultValue: 'Please try again in a moment.' }),
      );
    } finally {
      setResendingVerification(false);
    }
  }, [resendingVerification, resendVerificationEmail, t]);

  // Firebase only learns the user tapped the emailed link after an explicit
  // reload — refresh whenever the app returns to the foreground (matching
  // Subscription.tsx's AppState pattern for Stripe checkout) so the banner
  // clears itself without the user having to do anything extra.
  React.useEffect(() => {
    if (!isSignedIn || emailVerified) return;
    const listener = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        refreshEmailVerified();
      }
    });
    return () => listener.remove();
  }, [isSignedIn, emailVerified, refreshEmailVerified]);

  const sessionsThisWeek = DATA_WEEKLY_PRACTICE.reduce((sum, d) => sum + d.sessions, 0);
  const avgScore = Math.round(
    DATA_PAST_SESSIONS.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) /
      DATA_PAST_SESSIONS.length,
  );

  // Gamification streak/XP — GET /api/v1/gamification/streak (see
  // services/gamificationService.ts). Replaces the old hardcoded
  // `streakDays = 5`. streakDays feeds two badge unlock conditions below.
  const [streak, setStreak] = React.useState<GamificationStreakProps | null>(null);
  const [streakLoading, setStreakLoading] = React.useState(true);
  const [streakError, setStreakError] = React.useState<string | null>(null);
  const [checkingIn, setCheckingIn] = React.useState(false);
  const streakDays = streak?.streakDays ?? 0;

  const loadStreak = React.useCallback(async () => {
    setStreakLoading(true);
    setStreakError(null);
    try {
      const data = await gamificationService.getStreak();
      setStreak(data);
    } catch (error: any) {
      setStreakError(error?.message ?? t('home:streak_load_failed', { defaultValue: 'Could not load your streak.' }));
    } finally {
      setStreakLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  // POST /api/v1/gamification/checkin — daily check-in. Action-triggered
  // failure surfaces via Alert (same pattern as src/auth/Login/Login.tsx's
  // onLogin catch block), since this is a user-initiated tap, not a
  // background load.
  const onCheckIn = React.useCallback(async () => {
    if (checkingIn || streakLoading || streak?.checkedInToday) return;
    setCheckingIn(true);
    try {
      const updated = await gamificationService.checkin();
      setStreak(updated);
    } catch (error: any) {
      Alert.alert(
        t('home:check_in_failed_title', { defaultValue: "Couldn't check in" }),
        error?.message ?? t('home:check_in_failed_body', { defaultValue: 'Please try again in a moment.' }),
      );
    } finally {
      setCheckingIn(false);
    }
  }, [checkingIn, streakLoading, streak, t]);

  // Leaderboard — GET /api/v1/gamification/leaderboard.
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntryProps[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = React.useState(true);
  const [leaderboardError, setLeaderboardError] = React.useState<string | null>(null);

  const loadLeaderboard = React.useCallback(async () => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const data = await gamificationService.getLeaderboard();
      setLeaderboard(data);
    } catch (error: any) {
      setLeaderboardError(
        error?.message ?? t('home:leaderboard_load_failed', { defaultValue: 'Could not load the leaderboard.' }),
      );
    } finally {
      setLeaderboardLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Gamification: badge unlock state is computed client-side from whatever's
  // cheaply derivable out of existing mock data — practice history length,
  // the real streak day-count above, resume-import count (used as a
  // stand-in for "ATS optimized" too, since analyzeResume's mock score is
  // itself derived from import count — see resumeService.ts), and tracked
  // networking contacts.
  // TODO (BACKEND): once badge unlocks move server-side (see
  // docs/BACKEND_API_SPEC.md §15), this client-side computation goes away —
  // out of scope for this pass, which only wires streak/XP/leaderboard.
  const [unlockedBadgeIds, setUnlockedBadgeIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const [history, importedSources, contacts] = await Promise.all([
        interviewService.getPracticeHistory(),
        resumeService.getImportedSources(),
        networkingService.listContacts(),
      ]);
      if (cancelled) return;
      const completed = history.filter(s => s.status === 'Completed');
      const importedCount = Object.keys(importedSources).length;

      const unlocked = new Set<string>();
      if (completed.length >= 1) unlocked.add('first_interview');
      if (completed.length >= 5) unlocked.add('five_sessions');
      if (completed.length >= 10) unlocked.add('ten_sessions');
      if (streakDays >= 3) unlocked.add('three_day_streak');
      if (streakDays >= 5) unlocked.add('five_day_streak');
      if (completed.some(s => (s.overallScore ?? 0) >= 90)) unlocked.add('perfect_score');
      if (importedCount > 0) unlocked.add('resume_uploaded');
      if (importedCount >= 3) unlocked.add('ats_optimized');
      if (completed.some(s => s.interviewType === Interview_Type_Enum.Coding)) unlocked.add('coding_complete');
      if (contacts.length >= 3) unlocked.add('networker');

      setUnlockedBadgeIds(unlocked);
    })();
    return () => {
      cancelled = true;
    };
  }, [streakDays]);

  return (
    <Container style={styles.container}>
      <HeaderHome
        name={'Edith Johnson'}
        avatar={Images.avatar2}
        email={'lehieuds@gmail.com'}
        notification={3}
      />
      <Content contentContainerStyle={styles.content} padder>
        {isSignedIn && !emailVerified ? (
          <Flex
            style={styles.verifyBanner}
            justify="flex-start"
            itemsCenter
            mb={16}>
            <Icon
              pack="eva"
              name="email-outline"
              style={[globalStyle.icon20, { tintColor: theme['color-warning-500'] }]}
            />
            <View style={[globalStyle.flexOne, styles.verifyBannerText]}>
              <Text category="h9-s" bold>
                {t('home:verify_email_title', { defaultValue: 'Verify your email' })}
              </Text>
              <Text category="h10" status="placeholder" mt={2}>
                {t('home:verify_email_body', { defaultValue: "We sent you a link — tap it, then come back here." })}
              </Text>
            </View>
            <Button
              size="tiny"
              status="warning"
              disabled={resendingVerification}
              accessoryLeft={resendingVerification ? renderCheckInSpinner : undefined}
              onPress={onResendVerification}>
              {t('home:resend', { defaultValue: 'Resend' })}
            </Button>
          </Flex>
        ) : null}
        <View style={styles.statsRow}>
          <Layout level="2" style={styles.statCard}>
            <Icon pack="assets" name="stats" style={[globalStyle.icon24, { tintColor: theme['color-primary-500'] }]} />
            {streakLoading && !streak ? (
              <Spinner size="small" style={styles.streakSpinner} />
            ) : (
              <Text category="h3" bold mt={8}>
                {streakDays}
              </Text>
            )}
            <Text category="h9-s" status="placeholder">
              {t('home:day_streak', { defaultValue: 'Day Streak' })}
            </Text>
          </Layout>
          <Layout level="2" style={styles.statCard}>
            <Icon pack="assets" name="interview" style={[globalStyle.icon24, { tintColor: theme['color-primary-500'] }]} />
            <Text category="h3" bold mt={8}>
              {sessionsThisWeek}
            </Text>
            <Text category="h9-s" status="placeholder">
              {t('home:sessions_this_week', { defaultValue: 'Sessions This Week' })}
            </Text>
          </Layout>
          <Layout level="2" style={styles.statCard}>
            <Icon pack="assets" name="rateFull" style={[globalStyle.icon24, { tintColor: theme['color-primary-500'] }]} />
            <Text category="h3" bold mt={8}>
              {avgScore}%
            </Text>
            <Text category="h9-s" status="placeholder">
              {t('home:average_score', { defaultValue: 'Average Score' })}
            </Text>
          </Layout>
        </View>

        <Layout level="2" style={styles.checkInCard}>
          <View style={globalStyle.flexOne}>
            <Text category="h9-s" status="placeholder">
              {t('home:xp_label', { defaultValue: 'XP' })}
            </Text>
            <Text category="h7" bold mt={2}>
              {streakLoading && !streak ? '—' : `${streak?.xp ?? 0} XP`}
            </Text>
            {streakError ? (
              <Flex justify="flex-start" itemsCenter mt={6}>
                <Text category="h10" status="danger" mr={12}>
                  {streakError}
                </Text>
                <Text category="h10" status="link" onPress={loadStreak}>
                  {t('common:try_again', { defaultValue: 'Try again' }).toString()}
                </Text>
              </Flex>
            ) : null}
          </View>
          <Button
            size="small"
            status={streak?.checkedInToday ? 'basic' : 'primary'}
            disabled={checkingIn || streakLoading || !!streakError || !!streak?.checkedInToday}
            onPress={onCheckIn}
            accessoryLeft={checkingIn ? renderCheckInSpinner : undefined}>
            {streak?.checkedInToday
              ? t('home:checked_in_today', { defaultValue: 'Checked in' })
              : t('home:check_in', { defaultValue: 'Check In' })}
          </Button>
        </Layout>

        <Text category="h6" bold mt={32} mb={16}>
          {t('home:weekly_practice', { defaultValue: 'Weekly Practice' })}
        </Text>
        <BarChart
          data={{
            labels: DATA_WEEKLY_PRACTICE.map(d => d.day),
            datasets: [{ data: DATA_WEEKLY_PRACTICE.map(d => d.sessions) }],
          }}
          width={width - 48}
          height={180}
          fromZero
          showValuesOnTopOfBars
          withInnerLines={false}
          chartConfig={chartConfig}
          yAxisLabel=""
          yAxisSuffix=""
          style={styles.chart}
        />

        {DATA_UPCOMING_SESSIONS.length > 0 ? (
          <>
            <Text category="h6" bold mt={16} mb={16}>
              {t('home:upcoming_session', { defaultValue: 'Upcoming Session' })}
            </Text>
            <Flex
              level="2"
              style={styles.upcomingCard}
              justify="flex-start"
              itemsCenter
              onPress={() => navigate('MockInterviewSetup', {})}>
              <View style={globalStyle.flexOne}>
                <Text category="h7" bold>
                  {DATA_UPCOMING_SESSIONS[0].interviewType}
                </Text>
                <Text category="h9-s" status="placeholder" mt={4}>
                  {DATA_UPCOMING_SESSIONS[0].mode} · {DATA_UPCOMING_SESSIONS[0].difficulty} ·{' '}
                  {DATA_UPCOMING_SESSIONS[0].durationMin} min
                </Text>
              </View>
              <Icon pack="assets" name="arrowRight" style={globalStyle.icon16} />
            </Flex>
          </>
        ) : null}

        <Flex
          style={styles.ctaCard}
          justify="flex-start"
          vertical
          onPress={() => navigate('MainBottomTab')}>
          <Text category="h6" status="control" bold mb={4}>
            {t('home:ready_to_practice', { defaultValue: 'Ready to practice?' })}
          </Text>
          <Text category="h9-s" status="control">
            {t('home:ready_to_practice_description', {
              defaultValue: 'Pick an interview type and start a mock session.',
            })}
          </Text>
        </Flex>

        <Flex justify="space-between" itemsCenter mt={32} mb={16}>
          <Text category="h6" bold>
            {t('home:badges', { defaultValue: 'Badges' })}
          </Text>
          <Text category="h9-s" status="placeholder">
            {unlockedBadgeIds.size}/{DATA_BADGES.length}
          </Text>
        </Flex>
        <View style={styles.badgesGrid}>
          {DATA_BADGES.map(badge => {
            const unlocked = unlockedBadgeIds.has(badge.id);
            return (
              <View key={badge.id} style={[styles.badgeCard, !unlocked && styles.badgeCardLocked]}>
                <View
                  style={[
                    styles.badgeIconWrap,
                    { backgroundColor: unlocked ? theme['color-primary-500'] : theme['background-basic-color-3'] },
                  ]}>
                  <Icon
                    pack={badge.iconPack ?? 'assets'}
                    name={badge.icon}
                    style={[globalStyle.icon20, { tintColor: unlocked ? '#fff' : theme['text-hint-color'] }]}
                  />
                </View>
                <Text category="h10" bold center mt={8} numberOfLines={2} status={unlocked ? 'basic' : 'placeholder'}>
                  {badge.title}
                </Text>
                <Text category="h10" center mt={2} status="placeholder" numberOfLines={2}>
                  {badge.description}
                </Text>
              </View>
            );
          })}
        </View>

        <Text category="h6" bold mt={32} mb={16}>
          {t('home:leaderboard', { defaultValue: 'Leaderboard' })}
        </Text>
        {leaderboardLoading ? (
          <Flex itemsCenter justify="center" style={styles.leaderboardStatus}>
            <Spinner size="small" />
          </Flex>
        ) : leaderboardError ? (
          <Flex vertical itemsCenter style={styles.leaderboardStatus}>
            <Text category="h9-s" status="danger" center mb={12}>
              {leaderboardError}
            </Text>
            <Button size="small" onPress={loadLeaderboard}>
              {t('common:try_again', { defaultValue: 'Try again' }).toString()}
            </Button>
          </Flex>
        ) : leaderboard.length === 0 ? (
          <Text category="h9-s" status="placeholder" center mv={16}>
            {t('home:leaderboard_empty', { defaultValue: 'No leaderboard data yet.' })}
          </Text>
        ) : (
          <View>
            {leaderboard.slice(0, 10).map(entry => (
              <Flex
                key={entry.id}
                justify="flex-start"
                itemsCenter
                mb={12}
                style={[styles.leaderboardRow, entry.isCurrentUser && { backgroundColor: theme['background-basic-color-2'] }]}>
                <Text category="h8" bold status="placeholder" style={styles.leaderboardRank}>
                  #{entry.rank}
                </Text>
                <Avatar
                  source={entry.avatarUrl ? { uri: entry.avatarUrl } : Images.avatar1}
                  shape="rounded"
                  size="tiny"
                  /* @ts-ignore */
                  style={styles.leaderboardAvatar}
                />
                <Text category="h8" bold style={globalStyle.flexOne} numberOfLines={1}>
                  {entry.name}
                  {entry.isCurrentUser ? ` (${t('home:you', { defaultValue: 'You' })})` : ''}
                </Text>
                <Text category="h8-s" status="placeholder">
                  {entry.xp} XP
                </Text>
              </Flex>
            ))}
          </View>
        )}
      </Content>
    </Container>
  );
});

export default HomeSrc;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  verifyBanner: {
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    backgroundColor: 'background-basic-color-2',
    borderWidth: 1,
    borderColor: 'color-warning-500',
  },
  verifyBannerText: {
    marginHorizontal: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  statCard: {
    width: '31%',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 16,
  },
  streakSpinner: {
    marginTop: 8,
  },
  chart: {
    borderRadius: 16,
    marginLeft: -8,
  },
  upcomingCard: {
    borderRadius: 16,
    padding: 16,
  },
  ctaCard: {
    borderRadius: 16,
    padding: 24,
    marginTop: 32,
    backgroundColor: 'button-basic-color',
    ...globalStyle.shadowBtn,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  badgeCard: {
    width: '31%',
    borderRadius: 16,
    backgroundColor: 'background-basic-color-2',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  badgeCardLocked: {
    opacity: 0.55,
  },
  badgeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  leaderboardStatus: {
    paddingVertical: 16,
  },
  leaderboardRow: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  leaderboardRank: {
    width: 32,
  },
  leaderboardAvatar: {
    marginRight: 12,
  },
});
