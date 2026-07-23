import React, {memo} from 'react';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Button,
  Spinner,
} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import UserAvatar from 'components/UserAvatar';
import {LeaderboardEntryProps} from 'constants/Types';
import * as gamificationService from 'services/gamificationService';

// Full leaderboard (GET /api/v1/gamification/leaderboard returns up to the
// backend's own top-50 cap — see app/api/gamification.py's leaderboard()).
// HomeSrc.tsx's dashboard card only ever shows the top 4 with a "View all"
// link into this screen, which is the same fetch, just unsliced — avoids a
// second, separate "top N" concept/param to keep in sync with the backend.
const Leaderboard = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['home', 'common']);

  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntryProps[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await gamificationService.getLeaderboard();
      setLeaderboard(data);
    } catch (error: any) {
      setLoadError(
        error?.message ?? t('home:leaderboard_load_failed', {defaultValue: 'Could not load the leaderboard.'}),
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('home:leaderboard', {defaultValue: 'Leaderboard'})}
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
            <Button size="small" onPress={load}>
              {t('common:try_again', {defaultValue: 'Try again'}).toString()}
            </Button>
          </Flex>
        ) : leaderboard.length === 0 ? (
          <Text category="h9-s" status="placeholder" center mv={16}>
            {t('home:leaderboard_empty', {defaultValue: 'No leaderboard data yet.'})}
          </Text>
        ) : (
          leaderboard.map(entry => (
            <Flex
              key={entry.id}
              justify="flex-start"
              itemsCenter
              mb={12}
              style={[styles.row, entry.isCurrentUser && {backgroundColor: theme['background-basic-color-2']}]}>
              <Text category="h8" bold status="placeholder" style={styles.rank}>
                #{entry.rank}
              </Text>
              <UserAvatar
                uri={entry.avatarUrl}
                name={entry.name}
                size="tiny"
                style={styles.avatar}
              />
              <Text category="h8" bold style={styles.name} numberOfLines={1}>
                {entry.name}
                {entry.isCurrentUser ? ` (${t('home:you', {defaultValue: 'You'})})` : ''}
              </Text>
              <Text category="h8-s" status="placeholder">
                {entry.xp} XP
              </Text>
            </Flex>
          ))
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
  row: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  rank: {
    width: 32,
  },
  avatar: {
    marginRight: 12,
  },
  name: {
    flex: 1,
  },
});
