import React, { memo } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
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
import { globalStyle } from 'styles/globalStyle';
import { LeaderboardEntryProps } from 'constants/Types';
import * as gamificationService from 'services/gamificationService';
import CtaButton from 'components/CtaButton';
import { Images } from 'assets/images';

// REDESIGN (product request, explicit reference screenshot: a colorful
// podium with a blue "trophy" hero banner up top, a tinted card per
// top-3 rank — mint green for #1, neutral for #2, coral/orange for #3 —
// each with a white-ringed avatar, an overlapping numbered badge, a
// star+score pill, and a green "+N%" change indicator, then a plain
// ranked list below with the same star-pill/percent treatment per row).
// This explicitly REVERSES the earlier "too many colors, must be flat
// brand-blue everywhere" simplification pass described lower in this
// file's history — reusing this app's own existing tinted-tile palette
// (styles/tileColors.ts, the same mint/blue/orange/rose set already used
// by MyProgress.tsx's stat tiles, WeeklyCareerReport.tsx, CareerDna.tsx,
// FindScreen.tsx) rather than inventing new one-off colors, so this is
// colorful in the way the reference wants while still drawing from a
// palette the rest of the app already uses consistently.
//
// `change_pct` (the green "+N%") is real, not decorative — see
// Saveur-Backend/app/api/gamification.py's leaderboard(), which now also
// returns each entry's XP change vs. the equivalent PRIOR calendar window
// (e.g. this week vs. last week). `null` (no prior-window activity to
// compare against) renders as a flat "New" badge instead of a
// percentage, since inventing a percentage from a zero baseline would be
// misleading, not informative.
//
// FOLLOW-UP CORRECTION (product report: "The leader board is not looking
// good at all. I dont want any color gradients at all... the text is in
// white color... on a gray background in light mode, that does not make
// sense"): two real problems, both fixed:
// 1) The hero banner's blue LinearGradient is gone — flat, ungradiented
//    fill now (same plain-card treatment the rest of this app's headers
//    use), no gradient anywhere on this screen.
// 2) The podium's "New" badge (and several unrelated screens — see
//    src/more/GoalsScreen.tsx, SharedContentDetail.tsx, MyProgress.tsx,
//    RequestsInPass.tsx, all fixed alongside this) were using
//    `status="primary"`, which resolves to constants/theme/mapping.json's
//    `text-primary-color` — a near-white token that's only actually
//    correct for text drawn ON a primary (blue)-filled surface (see
//    components/CtaButton.tsx, which legitimately reads that same token
//    for its own white button label). Used as plain text directly on a
//    light card, it's genuinely invisible in light mode — this was already
//    independently discovered and patched in six OTHER files before this
//    (see e.g. src/more/JobAlerts.tsx's own "Was status='primary'"
//    comment), just never swept through the rest of the app until this
//    report. Fixed at each call site with an explicit text-basic-color (for
//    plain values) or status="link" (for the two that are actually
//    tappable links) rather than touching the shared theme token itself —
//    that token is still correct and load-bearing for CtaButton and every
//    other genuinely-on-a-colored-surface use.
const PERIODS = [
  { key: 'daily', labelKey: 'home:leaderboard_daily', defaultValue: 'Daily' },
  { key: 'weekly', labelKey: 'home:leaderboard_weekly', defaultValue: 'Weekly' },
  { key: 'monthly', labelKey: 'home:leaderboard_monthly', defaultValue: 'Monthly' },
] as const;
type Period = (typeof PERIODS)[number]['key'];

const PODIUM_ORDER: Array<1 | 2 | 3> = [2, 1, 3];
const PODIUM_CARD_HEIGHT: Record<1 | 2 | 3, number> = {
  1: 230,
  2: 196,
  3: 196,
};
const PODIUM_AVATAR_SIZE: Record<1 | 2 | 3, 'large' | 'medium'> = {
  1: 'large',
  2: 'medium',
  3: 'medium',
};

// Per-rank tint, pulled from styles/tileColors.ts's shared palette (see the
// header comment above) instead of one-off hex values — index 1 (mint) for
// #1, index 0 (blue) for #2, index 2 (orange) for #3, matching the
// reference screenshot's own green/blue/orange arrangement.
const RANK_COLOR: Record<1 | 2 | 3, { card: string; pill: string; pillText: string }> = {
  1: { card: 'color-tile-mint-bg', pill: 'color-tile-mint-text', pillText: '#FFFFFF' },
  2: { card: 'color-badge-info-bg', pill: 'color-badge-info-text', pillText: '#FFFFFF' },
  3: { card: 'color-tile-orange-bg', pill: 'color-tile-orange-text', pillText: '#FFFFFF' },
};

function ChangeBadge({ changePct, t }: { changePct: number | null | undefined; t: (k: string, o?: any) => string }) {
  const theme = useTheme();
  if (changePct == null) {
    // Was status="primary" — see this file's header comment on why that
    // rendered invisible white text here.
    return (
      <Text category="h10" bold center mt={6} style={{ color: theme['text-basic-color'] }}>
        {t('home:leaderboard_new', { defaultValue: 'New' })}
      </Text>
    );
  }
  const isUp = changePct >= 0;
  return (
    <Flex justify="center" itemsCenter mt={6}>
      {/* No dedicated "down" arrow in this app's icon set (see
          assets/LucideEvaIconsPack.tsx) — the same up-arrow rotated 180°
          reads identically to a down arrow rather than adding a new icon
          mapping just for the (rare — XP only ever goes up) negative
          case. */}
      <Icon
        pack="eva"
        name="arrow-upward-outline"
        style={{
          width: 12,
          height: 12,
          tintColor: isUp ? '#22C55E' : '#EF4444',
          marginRight: 2,
          transform: [{ rotate: isUp ? '0deg' : '180deg' }],
        }}
      />
      <Text category="h10" bold style={{ color: isUp ? '#22C55E' : '#EF4444' }}>
        {isUp ? '+' : ''}{changePct}%
      </Text>
    </Flex>
  );
}

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

  // "make that leaderboard screen more professional" — a per-period caption
  // under the trophy so the hero card reads as "here's who's winning right
  // now" rather than just a static graphic, same idea as a real leaderboard
  // product (Duolingo, Strava, etc.) framing the podium around a specific
  // time window instead of leaving it ambiguous.
  const periodCaption =
    activePeriod === 'daily'
      ? t('home:leaderboard_caption_daily', { defaultValue: "Today's top performers" })
      : activePeriod === 'weekly'
      ? t('home:leaderboard_caption_weekly', { defaultValue: "This week's top performers" })
      : t('home:leaderboard_caption_monthly', { defaultValue: "This month's top performers" });

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('home:leaderboard', { defaultValue: 'Leaderboard' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        {/* Product polish pass ("make that leaderboard screen more
            professional") — a one-line subhead under the title, same role
            a real product's leaderboard screen almost always has (context
            for what's being ranked and why), which this screen never had —
            it went straight from the nav bar into the trophy hero card with
            nothing explaining what the rankings even measure. */}
        <Text category="h9-s" status="placeholder" mb={4}>
          {t('home:leaderboard_subtitle', {
            defaultValue: 'See how your XP stacks up against the Saveur community.',
          })}
        </Text>
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
            {/* "Trophy" hero (reference screenshot) — houses the Daily/
                Weekly/Monthly tabs plus a trophy badge. Flat card fill, no
                gradient (see this file's header comment on the follow-up
                correction) — same plain-card/segmented-tab treatment this
                app already uses everywhere else (gray track, solid brand-
                blue active pill), just with a trophy icon added below it. */}
            <View
              style={[
                globalStyle.card,
                styles.heroCard,
                { backgroundColor: theme['background-basic-color-2'] },
              ]}>
              <View style={[styles.tabsRow, { backgroundColor: theme['background-basic-color-3'] }]}>
                {PERIODS.map(period => {
                  const active = activePeriod === period.key;
                  return (
                    <TouchableOpacity
                      key={period.key}
                      activeOpacity={0.8}
                      onPress={() => setActivePeriod(period.key)}
                      style={[styles.tabPill, active && { backgroundColor: theme['color-primary-500'] }]}>
                      <Text
                        category="h9-s"
                        bold
                        center
                        style={{ color: active ? '#FFFFFF' : theme['text-hint-color'] }}>
                        {t(period.labelKey, { defaultValue: period.defaultValue })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.trophyWrap}>
                {/* Product request: "Replace the trophy icon in the
                    leaderboard screen with image 2" — was a plain Eva
                    'award-outline' glyph (a flat-icon substitute, since
                    'trophy' isn't a real Eva Icons name) tinted brand-blue
                    inside a gray circle. Now the real illustrated gold
                    trophy graphic (assets/images/img_trophy.png). It's
                    already a finished, full-color illustration, so it sits
                    on a soft warm-gold-tinted backdrop instead of the old
                    flat gray icon-circle treatment (which was designed
                    around a monochrome glyph, not a real image) — reads as
                    a genuine badge/award moment rather than a generic
                    icon-in-a-box. */}
                <View style={styles.trophyCircle}>
                  <Image source={Images.trophy} style={styles.trophyImage} resizeMode="contain" />
                </View>
                <Text category="h10" bold status="placeholder" mt={10} center>
                  {periodCaption}
                </Text>
              </View>
            </View>

            <View style={styles.podiumRow}>
              {PODIUM_ORDER.map(rank => {
                const entry = podiumEntry(rank);
                const colors = RANK_COLOR[rank];
                if (!entry) {
                  return <View key={rank} style={styles.podiumEmptyFill} />;
                }
                return (
                  <View
                    key={rank}
                    style={[
                      styles.podiumCard,
                      {
                        height: PODIUM_CARD_HEIGHT[rank],
                        backgroundColor: theme[colors.card],
                      },
                    ]}>
                    <View style={[styles.rankBadge, { backgroundColor: theme[colors.pill] }]}>
                      <Text category="h10" bold style={{ color: colors.pillText }}>
                        {rank}
                      </Text>
                    </View>
                    <View style={styles.podiumAvatarRing}>
                      <UserAvatar
                        uri={entry.avatarUrl}
                        name={entry.name}
                        size={PODIUM_AVATAR_SIZE[rank]}
                        shape="round"
                      />
                    </View>
                    <Text category="h9-s" bold center numberOfLines={1} mt={10} style={styles.podiumName}>
                      {entry.name}
                      {entry.isCurrentUser ? ` (${t('home:you', { defaultValue: 'You' })})` : ''}
                    </Text>
                    <View style={[styles.scorePill, { backgroundColor: theme[colors.pill] }]}>
                      <Icon pack="eva" name="star" style={[globalStyle.icon16, { tintColor: colors.pillText }]} />
                      <Text category="h10" bold ml={4} style={{ color: colors.pillText }}>
                        {entry.xp}
                      </Text>
                    </View>
                    <ChangeBadge changePct={entry.changePct} t={t} />
                  </View>
                );
              })}
            </View>

            {rest.length > 0 ? (
              <>
                {/* Section label (polish pass) — the podium above and this
                    list read as two disconnected blocks with nothing
                    marking where "the podium" ends and "everyone else"
                    begins; a plain section header is a small thing but is
                    exactly what a real, professional ranked-list screen
                    (App Store charts, Strava segments, etc.) always has. */}
                <Text category="h9" bold mt={24} mb={10}>
                  {t('home:leaderboard_more_rankings', { defaultValue: 'More Rankings' })}
                </Text>
                <View style={styles.listCard}>
                  {rest.map((entry, index) => (
                  <View
                    key={entry.id}
                    style={[
                      styles.row,
                      index > 0 && globalStyle.divider,
                      entry.isCurrentUser && { backgroundColor: theme['color-primary-transparent-100'] },
                    ]}>
                    <View style={styles.rankChip}>
                      <Text category="h10" bold status="placeholder">
                        {entry.rank}
                      </Text>
                    </View>
                    <UserAvatar uri={entry.avatarUrl} name={entry.name} size="small" shape="round" style={styles.avatar} />
                    <Text category="h9" bold style={styles.name} numberOfLines={1}>
                      {entry.name}
                      {entry.isCurrentUser ? ` (${t('home:you', { defaultValue: 'You' })})` : ''}
                    </Text>
                    <View style={styles.rowRight}>
                      <View style={[styles.rowPill, { backgroundColor: theme['background-basic-color-3'] }]}>
                        <Icon pack="eva" name="star" style={{ width: 12, height: 12, tintColor: theme['text-hint-color'] }} />
                        <Text category="h10" bold ml={4} style={{ color: theme['text-basic-color'] }}>
                          {entry.xp}
                        </Text>
                      </View>
                      <ChangeBadge changePct={entry.changePct} t={t} />
                    </View>
                  </View>
                  ))}
                </View>
              </>
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
  // Trophy hero (see the JSX comment above) — flat card fill (no
  // gradient, per the follow-up correction), rounded like every other
  // card in the app, houses the period tabs and the trophy badge.
  heroCard: {
    borderRadius: 20,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 4,
  },
  tabPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 999,
  },
  trophyWrap: {
    alignItems: 'center',
    marginTop: 20,
  },
  // Soft warm-gold backdrop behind the real trophy image (see the JSX
  // comment above) — a literal one-off tint rather than a shared theme
  // token, deliberately picked to complement the trophy graphic's own
  // gold/amber palette instead of the app's usual brand-blue icon-circle
  // treatment, which was designed around a flat monochrome glyph, not a
  // full-color illustration. Bigger than the old 64px icon circle (88px)
  // since a real illustrated graphic reads better with more breathing room
  // than a small glyph does.
  trophyCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(217, 160, 44, 0.14)',
  },
  trophyImage: {
    width: 56,
    height: 56,
  },
  // Top-3 podium — 3 separate tinted cards (2nd/1st/3rd left-to-right,
  // matching the reference's own arrangement), each sized taller for a
  // higher rank via PODIUM_CARD_HEIGHT, bottom-aligned so the shorter
  // #2/#3 cards read as literal podium steps next to the taller #1.
  // Positive spacing now (was a negative overlap margin designed to tuck
  // under the old gradient hero's rounded bottom edge — no longer needed
  // now that the hero above is a normal flat card with regular spacing).
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  podiumEmptyFill: {
    flex: 1,
    marginHorizontal: 4,
  },
  podiumCard: {
    ...globalStyle.card,
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 18,
    alignItems: 'center',
    paddingTop: 14,
    paddingHorizontal: 8,
  },
  // Numbered rank badge, top-left corner of each podium card (reference
  // screenshot's own overlapping badge treatment).
  rankBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // White ring around each podium avatar (reference screenshot) — a plain
  // padded border, not a progress arc, since there's no "progress" being
  // shown here, just a decorative frame.
  podiumAvatarRing: {
    padding: 3,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  podiumName: {
    maxWidth: '100%',
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
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
  rowRight: {
    alignItems: 'flex-end',
  },
  rowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
});
