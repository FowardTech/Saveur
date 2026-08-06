import React, { memo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import UserAvatar from 'components/UserAvatar';
import CircularProgress from 'components/CircularProgress';
import { globalStyle } from 'styles/globalStyle';
import { LeaderboardEntryProps } from 'constants/Types';
import * as gamificationService from 'services/gamificationService';
import CtaButton from 'components/CtaButton';

// Redesign (product follow-up — a reference screenshot of a fitness/habit
// app's leaderboard: Daily/Weekly/Monthly tabs, a top-3 "podium" with the
// #1 spot elevated and crowned, then a ranked list below). Explicit
// instruction: match THAT LAYOUT, not that app's pink/purple color scheme.
//
// SIMPLIFICATION PASS (product report: "this leaderboard has too many
// colors... the chart bars should just be the platform default blue
// color... must be consistent and simple like the cards in the rest of the
// app"): this used to give each podium rank its own gold/silver/bronze
// gradient (ring, rank badge, and the podium "riser" bars themselves), plus
// a gradient-filled active tab pill and a gold-tinted trophy badge — a lot
// of one-off color next to the flat, single-accent white cards everywhere
// else in this app. Every one of those per-rank colors is gone now: the
// ring, rank badge, podium bars, active tab, and XP text all use the same
// single flat brand blue (color-primary-500) that's already this app's one
// accent color everywhere else, with only SIZE (not color) still marking
// which rank is #1 vs #2/#3.
//
// The Daily/Weekly/Monthly tabs are now functional: GET
// /api/v1/gamification/leaderboard?period=daily|weekly|monthly (see
// services/gamificationService.ts) aggregates XP actually earned within
// that calendar window from the backend's new XpEvent ledger, rather than
// always returning the same all-time User.xp ranking. Switching tabs
// re-fetches for the newly selected period.
const PERIODS = [
  { key: 'daily', labelKey: 'home:leaderboard_daily', defaultValue: 'Daily' },
  { key: 'weekly', labelKey: 'home:leaderboard_weekly', defaultValue: 'Weekly' },
  { key: 'monthly', labelKey: 'home:leaderboard_monthly', defaultValue: 'Monthly' },
] as const;
type Period = (typeof PERIODS)[number]['key'];

// Modernization pass (product request — "make the leaderboard look more
// nicer and modern"): #1's ring is noticeably bigger than #2/#3 now (was a
// much subtler 60/52/52 split) so the hierarchy reads at a glance instead
// of needing the crown/trophy to do all the work.
const PODIUM_RING_SIZE: Record<1 | 2 | 3, number> = {
  1: 76,
  2: 56,
  3: 56,
};
const PODIUM_BASE_HEIGHT: Record<1 | 2 | 3, number> = {
  1: 64,
  2: 44,
  3: 36,
};
const PODIUM_ORDER: Array<1 | 2 | 3> = [2, 1, 3];

// Full leaderboard (GET /api/v1/gamification/leaderboard returns up to the
// backend's own top-50 cap — see app/api/gamification.py's leaderboard()).
// HomeSrc.tsx's dashboard card only ever shows the top 4 with a "View all"
// link into this screen, which is the same fetch, just unsliced — avoids a
// second, separate "top N" concept/param to keep in sync with the backend.
const Leaderboard = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home', 'common']);

  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntryProps[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [activePeriod, setActivePeriod] = React.useState<Period>('daily');

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await gamificationService.getLeaderboard(activePeriod);
      setLeaderboard(data);
    } catch (error: any) {
      setLoadError(
        error?.message ?? t('home:leaderboard_load_failed', { defaultValue: 'Could not load the leaderboard.' }),
      );
    } finally {
      setIsLoading(false);
    }
  }, [t, activePeriod]);

  // Re-fetches whenever the selected tab changes, since `load` is
  // recreated with the new `activePeriod` baked into its getLeaderboard
  // call above.
  React.useEffect(() => {
    load();
  }, [load]);

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  // top3[rank - 1] since the array is 0-indexed but ranks are 1-indexed —
  // undefined (not every leaderboard has 3+ entries yet) is handled by
  // rendering an empty placeholder spot so the podium doesn't collapse
  // lopsided with only 1-2 real spots filled in.
  const podiumEntry = (rank: 1 | 2 | 3) => top3[rank - 1];

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('home:leaderboard', { defaultValue: 'Leaderboard' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        {isLoading ? (
          <Flex itemsCenter justify="center" style={styles.status}>
            <Spinner size="large" />
          </Flex>
        ) : loadError ? (
          <Flex vertical itemsCenter justify="center" style={styles.status}>
            <Text category="h9-s" status="danger" center mb={12}>
              {loadError}
            </Text>
            <CtaButton size="small" onPress={load}>
              {t('common:try_again', { defaultValue: 'Try again' }).toString()}
            </CtaButton>
          </Flex>
        ) : leaderboard.length === 0 ? (
          <Text category="h9-s" status="placeholder" center mv={16}>
            {t('home:leaderboard_empty', { defaultValue: 'No leaderboard data yet.' })}
          </Text>
        ) : (
          <>
            {/* Modernization pass (product request — "make the leaderboard
                look more nicer and modern"): the tabs + podium used to sit
                directly on the page's own gray background, same weight as
                empty space. Grounding both inside one card gives the whole
                top section a clear visual boundary/lift, same shadow
                language every other card in the app already uses. */}
            <View style={styles.heroCard}>
              <View style={styles.tabsRow}>
                {PERIODS.map(period => {
                  const active = activePeriod === period.key;
                  return (
                    <TouchableOpacity
                      key={period.key}
                      activeOpacity={0.8}
                      onPress={() => setActivePeriod(period.key)}
                      style={[
                        styles.tabPill,
                        active && { backgroundColor: theme['color-primary-500'] },
                      ]}>
                      <Text
                        category="h9-s"
                        bold
                        center
                        style={{ color: active ? '#fff' : theme['background-basic-color-6'] }}>
                        {t(period.labelKey, { defaultValue: period.defaultValue })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.podiumRow}>
                {PODIUM_ORDER.map(rank => {
                  const entry = podiumEntry(rank);
                  return (
                    <View key={rank} style={[styles.podiumSpot, rank === 1 && styles.podiumSpotFirst]}>
                      {entry ? (
                        <>
                          {rank === 1 ? (
                            // Trophy badge (product request — "add a yellow
                            // trophy svg there to show who is leading") —
                            // simplified per follow-up ("too many colors"):
                            // plain neutral icon circle (same
                            // background-basic-color-2 treatment every other
                            // icon-wrap in this app uses) with the icon
                            // tinted the app's one accent blue, instead of a
                            // gold-tinted glass circle.
                            <View style={styles.trophyBadge}>
                              <Icon
                                pack="eva"
                                name="trophy"
                                style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]}
                              />
                            </View>
                          ) : null}
                          {/* SIMPLIFICATION PASS: flat brand-blue stroke for
                              every rank (was a distinct gold/silver/bronze
                              gradient per rank) — only the ring SIZE still
                              varies by rank (see PODIUM_RING_SIZE), not its
                              color. */}
                          <CircularProgress
                            progress={100}
                            size={PODIUM_RING_SIZE[rank]}
                            strokeWidth={3}
                            color={theme['color-primary-500']}
                            style={styles.podiumAvatarRing}>
                            <UserAvatar
                              uri={entry.avatarUrl}
                              name={entry.name}
                              size={rank === 1 ? 'large' : 'medium'}
                            />
                          </CircularProgress>
                          <View style={[styles.podiumRankBadge, { backgroundColor: theme['color-primary-500'] }]}>
                            <Text category="h10" bold style={{ color: '#FFFFFF' }}>
                              {rank}
                            </Text>
                          </View>
                          <Text category="h9-s" bold center numberOfLines={1} mt={6} style={styles.podiumName}>
                            {entry.name}
                            {entry.isCurrentUser ? ` (${t('home:you', { defaultValue: 'You' })})` : ''}
                          </Text>
                          <Text category="h10" status="placeholder" center>
                            {entry.xp} {t('home:xp_label', { defaultValue: 'XP' })}
                          </Text>
                        </>
                      ) : (
                        <View style={styles.podiumEmptyFill} />
                      )}
                      {/* SIMPLIFICATION PASS ("the chart bars should just be
                          the platform default blue color"): one flat
                          brand-blue tint for every podium riser — was a
                          separate gold/silver/bronze gradient per rank (see
                          this file's header comment). Rank hierarchy still
                          reads from height alone (PODIUM_BASE_HEIGHT). */}
                      <View
                        style={[
                          styles.podiumBase,
                          { height: PODIUM_BASE_HEIGHT[rank], backgroundColor: theme['color-primary-transparent-200'] },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
            </View>

            {rest.length > 0 ? (
              <View style={styles.listCard}>
                {rest.map((entry, index) => (
                  <View
                    key={entry.id}
                    style={[
                      styles.row,
                      index > 0 && globalStyle.divider,
                      entry.isCurrentUser && { backgroundColor: theme['color-primary-transparent-100'] },
                    ]}>
                    {/* Modernization pass — a small circular chip instead
                        of bare number text, echoing the podium's own
                        numbered rank badge above so the ranked list reads
                        as the same design language, not a separate plain
                        list. */}
                    <View style={styles.rankChip}>
                      <Text category="h10" bold status="placeholder">
                        {entry.rank}
                      </Text>
                    </View>
                    <UserAvatar uri={entry.avatarUrl} name={entry.name} size="small" style={styles.avatar} />
                    <Text category="h9" bold style={styles.name} numberOfLines={1}>
                      {entry.name}
                      {entry.isCurrentUser ? ` (${t('home:you', { defaultValue: 'You' })})` : ''}
                    </Text>
                    {/* Product report ("All text in blue should now be
                        black except the pills and link text") -- this XP
                        value is plain row text, not a pill or a link. */}
                    <Text category="h9-s" bold style={{ color: theme['text-basic-color'] }}>
                      {entry.xp} {t('home:xp_label', { defaultValue: 'XP' })}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </Content>
    </Container>
  );
});

export default Leaderboard;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  status: {
    paddingVertical: 40,
  },
  // Modernization pass — see the JSX comment above where this is used.
  // Grounds the tabs + podium in one card instead of both floating
  // directly on the page's own gray background.
  heroCard: {
    ...globalStyle.card,
    borderRadius: 14,
    padding: 16,
    paddingTop: 20,
    marginTop: 12,
    backgroundColor: 'background-basic-color-2',
  },
  // Daily/Weekly/Monthly segmented control (product follow-up, reference
  // screenshot's own tab row) — a neutral gray track with a flat solid
  // brand-blue pill for whichever period is active (was a two-stop
  // gradient — see this file's header comment on the simplification pass).
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: 'background-basic-color-3',
    borderRadius: 999,
    padding: 4,
    marginBottom: 28,
  },
  tabPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 999,
  },
  // Top-3 "podium" (product follow-up, reference screenshot) — 3 columns,
  // 2nd/1st/3rd left-to-right (matches the reference's own arrangement),
  // aligned to the bottom so each spot's own colored "base" block (see
  // podiumBase) reads as a literal podium step of increasing height for a
  // higher rank.
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  podiumSpot: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 130,
  },
  // #1's spot gets extra bottom margin pushed INTO the row (via a taller
  // podiumBase, not this style) plus its own trophy badge above the avatar
  // — no extra style needed here beyond what podiumBase/trophyBadge
  // already do, kept as a hook in case future polish wants to nudge this
  // spot further.
  podiumSpotFirst: {},
  // Trophy badge (see the JSX comment above where this is used) — neutral
  // gray icon circle (was gold-tinted — see this file's header comment on
  // the simplification pass), same plain icon-wrap treatment used
  // elsewhere in the app.
  trophyBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    backgroundColor: 'background-basic-color-3',
  },
  // Redesign v2 (full reskin): the ring itself is now drawn by
  // CircularProgress (see the JSX above) — this style is just a spacing
  // hook, kept as a real (mostly empty) object so the call site doesn't
  // need a conditional.
  podiumAvatarRing: {},
  // Small circular rank badge overlapping the bottom edge of the avatar
  // ring (product follow-up, reference screenshot's own numbered badge) —
  // negative marginTop pulls it up to overlap instead of sitting as a
  // separate row. Flat brand-blue fill now (backgroundColor set inline in
  // the JSX) — was a per-rank gradient, see this file's header comment.
  podiumRankBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginTop: -10,
    borderWidth: 2,
    borderColor: 'background-basic-color-1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumName: {
    maxWidth: 100,
  },
  // Filled when a podium spot has no real entry yet (fewer than 3 real
  // leaderboard rows) — keeps the 3-column layout from collapsing lopsided
  // while there's nothing to show in that spot.
  podiumEmptyFill: {
    flex: 1,
  },
  // The literal "podium step" block (product follow-up, reference
  // screenshot) — height varies per rank (see PODIUM_BASE_HEIGHT), rounded
  // only on top since it's meant to look like the top edge of a
  // riser/step. Fill (a flat brand-blue tint, backgroundColor set inline
  // in the JSX) is the same for every rank now — see this file's header
  // comment on the simplification pass.
  podiumBase: {
    width: '86%',
    marginTop: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  // Ranks 4+ list card.
  listCard: {
    ...globalStyle.card,
    marginTop: 28,
    padding: 8,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill to render correctly on Android (was
    // 'transparent' for the earlier border-only direction) — this renders
    // on a plain View (no `level` prop), so the fill has to live here.
    backgroundColor: 'background-basic-color-2',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rankChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: 'background-basic-color-3',
  },
  avatar: {
    marginRight: 12,
  },
  name: {
    flex: 1,
  },
});
