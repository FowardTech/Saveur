import React, { memo } from 'react';
import { View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import StarRating from 'components/StarRating';
import { globalStyle } from 'styles/globalStyle';
import * as appRatingService from 'services/appRatingService';
import { AppRatingProps } from 'services/appRatingService';

// My Ratings — product direction: the periodic QA rating prompt
// (components/AppRatingModal.tsx) should be visible not just to the admin
// dashboard but to "the user that sent the ratings too". This is a plain
// read-only history of what this user has submitted; nothing here is
// editable (a rating is a point-in-time QA signal, not a note to revise).
const MyRatings = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);

  const [ratings, setRatings] = React.useState<AppRatingProps[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setIsLoading(true);
    setError(null);
    appRatingService.getMyRatings()
      .then(setRatings)
      .catch(() => setError(t('more:my_ratings_load_failed', { defaultValue: "Couldn't load your ratings right now." })))
      .finally(() => setIsLoading(false));
  }, [t]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:my_ratings', { defaultValue: 'My Ratings' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('more:my_ratings_description', {
            defaultValue: 'Every rating you’ve sent us about how Saveur is helping you reach your goals.',
          })}
        </Text>
        {isLoading ? (
          <Flex center style={{ paddingVertical: 60 }}>
            <Spinner size="large" />
          </Flex>
        ) : error ? (
          <Flex vertical center style={{ paddingVertical: 60 }}>
            <Text category="h9-s" status="danger" center mb={12}>{error}</Text>
            <Text category="h9" status="link" onPress={load}>
              {t('common:try_again', { defaultValue: 'Try again' })}
            </Text>
          </Flex>
        ) : ratings.length === 0 ? (
          <Flex vertical center style={{ paddingVertical: 60 }}>
            <Icon pack="eva" name="star-outline" style={[globalStyle.icon24, { tintColor: theme['text-hint-color'] }]} />
            <Text category="h9-s" status="placeholder" mt={12} center>
              {t('more:my_ratings_empty', { defaultValue: "You haven't sent a rating yet — we'll ask you every once in a while." })}
            </Text>
          </Flex>
        ) : (
          ratings.map(r => (
            <Layout key={r.id} level="2" style={styles.ratingCard}>
              <Flex justify="space-between" itemsCenter mb={r.comment ? 8 : 0}>
                {/* Redesign v2 (full reskin): replaced this screen's own
                    hand-rolled star loop with the shared read-only
                    components/StarRating.tsx — same visual result, one
                    fewer place duplicating the same star-fill logic. */}
                <StarRating value={r.score} size={16} />
                <Text category="h10" status="placeholder">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                </Text>
              </Flex>
              {r.comment ? (
                <Text category="h9-s">{r.comment}</Text>
              ) : null}
            </Layout>
          ))
        )}
      </Content>
    </Container>
  );
});

export default MyRatings;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  ratingCard: {
    ...globalStyle.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
  },
});
