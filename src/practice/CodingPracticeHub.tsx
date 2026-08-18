import React, {memo} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Icon} from '@ui-kitten/components';
import {NavigationProp, useNavigation, useFocusEffect} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import { SkeletonList } from 'components/Skeleton';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import * as codingService from 'services/codingService';
import {CodingProblemSummary, CodingStats} from 'services/codingService';

// Free-practice Coding Practice hub (product follow-up: "add more
// features to the coding tool so that its worth the amount its paid for"
// — the tool previously had exactly 8 problems, no browsable list, and no
// persistent progress at all; every run only ever lived inside a single
// timed mock-interview session's InterviewFeedback blob, nothing
// queryable as "problems I've solved"). This screen is the new primary
// entry point: browse the full ~24-problem bank, filter by
// difficulty/category, see solved/attempted state and a running stats
// header, bookmark problems to revisit. Tapping a row opens
// CodingProblemSolve.tsx (the same Judge0/AI-backed editor
// CodingInterview.tsx uses, just without a timer or an interview session
// wrapping it). CodingInterview.tsx / the timed mock-interview flow is
// completely unchanged — this is an additional on-ramp, not a
// replacement.
const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#10B981',
  medium: '#F59E0B',
  hard: '#EF4444',
};

function difficultyLabel(t: (k: string, o?: any) => any, difficulty: string): string {
  switch (difficulty) {
    case 'easy':
      return t('find:coding_difficulty_easy', {defaultValue: 'Easy'});
    case 'medium':
      return t('find:coding_difficulty_medium', {defaultValue: 'Medium'});
    case 'hard':
      return t('find:coding_difficulty_hard', {defaultValue: 'Hard'});
    default:
      return difficulty;
  }
}

// "arrays" -> "Arrays", "dynamic_programming" -> "Dynamic Programming" —
// categories are backend-defined snake_case slugs (coding_problems.py),
// this is just a display-formatting helper, not a translation (category
// names are effectively CS-vocabulary proper nouns, same reasoning
// applied to interview stage names elsewhere in this app).
function categoryLabel(category: string): string {
  return category
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const CodingPracticeHub = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['find', 'common']);

  const [problems, setProblems] = React.useState<CodingProblemSummary[] | null>(null);
  const [stats, setStats] = React.useState<CodingStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = React.useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
  const [bookmarkedOnly, setBookmarkedOnly] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [list, statsResult] = await Promise.all([
        codingService.listProblems(),
        codingService.getStats(),
      ]);
      setProblems(list);
      setStats(statsResult);
    } catch (e: any) {
      setLoadError(e?.message ?? t('find:coding_hub_load_failed', {defaultValue: 'Could not load the problem list.'}));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Reload every time this screen regains focus (not just on mount) so
  // solved/bookmarked state picked up on CodingProblemSolve.tsx shows up
  // immediately on the way back, without a manual pull-to-refresh.
  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    (problems ?? []).forEach(p => set.add(p.category));
    return Array.from(set).sort();
  }, [problems]);

  const filtered = (problems ?? []).filter(p => {
    if (difficultyFilter && p.difficulty !== difficultyFilter) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (bookmarkedOnly && !p.bookmarked) return false;
    return true;
  });

  const onToggleBookmark = async (p: CodingProblemSummary) => {
    // Optimistic — the star flips immediately, then reconciles with the
    // server. A failed toggle is low-stakes enough (not a paid action) to
    // just silently revert rather than surface an alert.
    setProblems(prev =>
      prev ? prev.map(item => (item.slug === p.slug ? {...item, bookmarked: !item.bookmarked} : item)) : prev,
    );
    try {
      await codingService.setBookmark(p.slug, !p.bookmarked);
    } catch {
      setProblems(prev =>
        prev ? prev.map(item => (item.slug === p.slug ? {...item, bookmarked: p.bookmarked} : item)) : prev,
      );
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:coding_practice_hub_title', {defaultValue: 'Coding Practice'})}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        {stats ? (
          <View style={[globalStyle.card, styles.statsCard]}>
            <View style={globalStyle.flexOne}>
              <Text category="h5" bold>
                {t('find:coding_stats_solved', {
                  defaultValue: '{{solved}} / {{total}} solved',
                  solved: stats.solvedTotal,
                  total: stats.totalProblems,
                })}
              </Text>
              {stats.attemptedTotal > 0 ? (
                <Text category="h10" status="placeholder" mt={4}>
                  {t('find:coding_stats_attempted', {
                    defaultValue: '{{count}} more in progress',
                    count: stats.attemptedTotal,
                  })}
                </Text>
              ) : null}
            </View>
            <View style={[styles.statsBadge, {backgroundColor: theme['color-primary-transparent-200']}]}>
              <Icon pack="eva" name="code-outline" style={[globalStyle.icon24, {tintColor: theme['color-primary-500']}]} />
            </View>
          </View>
        ) : null}

        <Flex justify="flex-start" wrap mb={8}>
          {[null, 'easy', 'medium', 'hard'].map(d => {
            const active = difficultyFilter === d;
            return (
              <TouchableOpacity
                key={d ?? 'all'}
                activeOpacity={0.7}
                onPress={() => setDifficultyFilter(d)}
                style={[
                  styles.chip,
                  {backgroundColor: active ? theme['color-primary-500'] : theme['background-basic-color-2']},
                ]}>
                <Text category="h10" bold status={active ? 'control' : 'basic'}>
                  {d ? difficultyLabel(t, d) : t('find:coding_difficulty_all', {defaultValue: 'All'})}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setBookmarkedOnly(v => !v)}
            style={[
              styles.chip,
              {backgroundColor: bookmarkedOnly ? '#F59E0B' : theme['background-basic-color-2']},
            ]}>
            <Icon
              pack="eva"
              name={bookmarkedOnly ? 'star' : 'star-outline'}
              style={[globalStyle.icon16, {tintColor: bookmarkedOnly ? theme['text-control-color'] : theme['text-hint-color']}]}
            />
          </TouchableOpacity>
        </Flex>

        {categories.length > 0 ? (
          <Flex justify="flex-start" wrap mb={16}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setCategoryFilter(null)}
              style={[
                styles.chip,
                {backgroundColor: !categoryFilter ? theme['background-basic-color-3'] : theme['background-basic-color-2']},
              ]}>
              <Text category="h10" status="basic">
                {t('find:coding_category_all', {defaultValue: 'All topics'})}
              </Text>
            </TouchableOpacity>
            {categories.map(c => {
              const active = categoryFilter === c;
              return (
                <TouchableOpacity
                  key={c}
                  activeOpacity={0.7}
                  onPress={() => setCategoryFilter(c)}
                  style={[
                    styles.chip,
                    {backgroundColor: active ? theme['background-basic-color-3'] : theme['background-basic-color-2']},
                  ]}>
                  <Text category="h10" status="basic">
                    {categoryLabel(c)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Flex>
        ) : null}

        {isLoading && !problems ? (
          <SkeletonList count={4} style={{ paddingHorizontal: 16 }} />
        ) : loadError && !problems ? (
          <EmptyState
            variant="error"
            title={t('common:something_went_wrong', {defaultValue: 'Something went wrong'})}
            body={loadError}
            actionLabel={t('common:try_again', {defaultValue: 'Try again'})}
            onAction={load}
          />
        ) : filtered.length === 0 ? (
          <Text category="h9-s" status="placeholder" center mt={24}>
            {t('find:coding_hub_no_results', {defaultValue: 'No problems match these filters.'})}
          </Text>
        ) : (
          filtered.map(p => (
            <TouchableOpacity
              key={p.slug}
              activeOpacity={0.75}
              style={[globalStyle.card, styles.problemRow]}
              onPress={() => navigate('CodingProblemSolve', {slug: p.slug})}>
              <View style={styles.statusDot}>
                {p.status === 'solved' ? (
                  <Icon pack="eva" name="checkmark-circle-2" style={[globalStyle.icon20, {tintColor: '#10B981'}]} />
                ) : p.status === 'attempted' ? (
                  <Icon pack="eva" name="clock-outline" style={[globalStyle.icon20, {tintColor: '#F59E0B'}]} />
                ) : (
                  <Icon pack="eva" name="radio-button-off-outline" style={[globalStyle.icon20, {tintColor: theme['text-hint-color']}]} />
                )}
              </View>
              <View style={globalStyle.flexOne}>
                <Text category="h8" bold numberOfLines={1}>
                  {p.title}
                </Text>
                <Flex justify="flex-start" itemsCenter mt={4}>
                  <View style={[styles.difficultyPill, {backgroundColor: `${DIFFICULTY_COLORS[p.difficulty] ?? '#8B5CF6'}1F`}]}>
                    <Text category="h10" bold style={{color: DIFFICULTY_COLORS[p.difficulty] ?? '#8B5CF6'}}>
                      {difficultyLabel(t, p.difficulty)}
                    </Text>
                  </View>
                  <Text category="h10" status="placeholder" ml={8}>
                    {categoryLabel(p.category)}
                  </Text>
                </Flex>
              </View>
              <TouchableOpacity
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                onPress={() => onToggleBookmark(p)}>
                <Icon
                  pack="eva"
                  name={p.bookmarked ? 'star' : 'star-outline'}
                  style={[globalStyle.icon20, {tintColor: p.bookmarked ? '#F59E0B' : theme['text-hint-color']}]}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </Content>
    </Container>
  );
});

export default CodingPracticeHub;

const themedStyles = StyleService.create({
  container: {flex: 1},
  content: {paddingBottom: 60},
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
    backgroundColor: 'background-basic-color-2',
  },
  statsBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 99,
    marginRight: 8,
    marginBottom: 8,
  },
  problemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    backgroundColor: 'background-basic-color-2',
  },
  statusDot: {
    marginRight: 12,
  },
  difficultyPill: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
});
