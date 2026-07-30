import React, { memo } from 'react';
import { Linking, View } from 'react-native';
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
import { globalStyle } from 'styles/globalStyle';
import * as newsService from 'services/newsService';
import { NewsItem } from 'services/newsService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';

// Daily Industry News — product request item, Pro Premium feature. Real,
// web-search-grounded headlines (Perplexity) tailored to the learner's own
// industries/desired roles, not free-associated AI text — see
// app/api/news.py.
const DailyIndustryNews = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const { isPremium } = React.useContext(AuthContext);

  const [items, setItems] = React.useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setIsLoading(true);
    setError(null);
    newsService.getTodayNews()
      .then(news => setItems(news.items))
      .catch(() => setError(t('more:news_load_failed', { defaultValue: "Couldn't load today's news right now." })))
      .finally(() => setIsLoading(false));
  }, [t]);

  React.useEffect(() => {
    if (isPremium) load();
    else setIsLoading(false);
  }, [isPremium, load]);

  if (!isPremium) {
    return (
      <ProLockGate
        variant="premium"
        title={t('more:daily_industry_news', { defaultValue: 'Daily Industry News' })}
        description={t('more:news_pro_gate_description', {
          defaultValue: 'A real, AI-curated daily digest of news relevant to your industry and target roles — a Pro Premium feature.',
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:daily_industry_news', { defaultValue: 'Daily Industry News' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
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
        ) : items.length === 0 ? (
          <Flex vertical center style={{ paddingVertical: 60 }}>
            <Icon pack="eva" name="globe-outline" style={[globalStyle.icon24, { tintColor: theme['text-hint-color'] }]} />
            <Text category="h9-s" status="placeholder" mt={12} center>
              {t('more:news_empty', { defaultValue: 'No news digest available right now — check back later today.' })}
            </Text>
          </Flex>
        ) : (
          items.map((item, i) => (
            <Layout key={i} level="2" style={styles.newsCard}>
              <Text category="h8" bold mb={6}>{item.headline}</Text>
              <Text category="h9-s" status="placeholder" mb={10}>{item.summary}</Text>
              {item.sourceUrl ? (
                <Flex
                  justify="flex-start"
                  itemsCenter
                  onPress={() => Linking.openURL(item.sourceUrl).catch(() => {})}
                >
                  <Icon pack="eva" name="external-link-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                  <Text category="h10" status="link" ml={6}>{item.sourceName || item.sourceUrl}</Text>
                </Flex>
              ) : null}
            </Layout>
          ))
        )}
      </Content>
    </Container>
  );
});

export default DailyIndustryNews;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  newsCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
});
