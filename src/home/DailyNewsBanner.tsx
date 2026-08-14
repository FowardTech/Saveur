import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import Text from 'components/Text';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as newsService from 'services/newsService';
import { AuthContext } from '../../AuthContext';

// Product request: "Daily News and daily tips banners should display at the
// top of the HomeScreen. Make sure it looks good and professional." Daily
// Industry News (src/more/DailyIndustryNews.tsx) was previously reachable
// only from the More menu with no presence on Home at all -- this adds a
// compact preview banner (today's top headline) that deep-links into that
// full screen, matching the same "very small info card" shape
// ContinueLearningCard.tsx established rather than a tall promo block.
//
// Pro Premium gated, same as the full screen (AuthContext.isPremium,
// backend @require_premium on GET /news/today) -- deliberately hidden
// entirely rather than shown with a lock/upsell for non-Premium users, same
// posture the rest of Home takes with gated features (they're reachable by
// navigating in, not advertised inline on every visit).
const DailyNewsBanner = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const { t } = useTranslation(['home', 'common']);
  const { isPremium } = React.useContext(AuthContext);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { navigate } = navigation;

  const [headline, setHeadline] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    if (!isPremium) return;
    newsService.getTodayNews()
      .then(news => setHeadline(news.items[0]?.headline ?? null))
      .catch(() => setHeadline(null));
  }, [isPremium]);

  React.useEffect(() => { load(); }, [load]);

  // Refresh on focus -- "today" can roll over to a new digest while the app
  // sits backgrounded/on another tab, same convention as every other
  // self-fetching Home card in this file.
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  // BUG FIX (pre-launch i18n staleness audit) — same gap as
  // src/more/DailyIndustryNews.tsx's full-screen version of this same
  // digest.
  React.useEffect(() => {
    i18n.on('languageChanged', load);
    return () => {
      i18n.off('languageChanged', load);
    };
  }, [load]);

  if (!isPremium || !headline) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.card}
      onPress={() => navigate('DailyIndustryNews')}>
      <View style={styles.iconWrap}>
        <Icon pack="eva" name="globe-outline" style={[globalStyle.icon16, { tintColor: '#0891b2' }]} />
      </View>
      <View style={globalStyle.flexOne}>
        <Text category="h10" bold numberOfLines={1}>
          {t('home:daily_news_banner_title', { defaultValue: "Today's industry news" })}
        </Text>
        <Text category="h10" status="placeholder" numberOfLines={1} mt={1}>
          {headline}
        </Text>
      </View>
      <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
    </TouchableOpacity>
  );
});

export default DailyNewsBanner;

const themedStyles = StyleService.create({
  card: {
    ...globalStyle.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'background-basic-color-1',
    marginTop: 12,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 145, 178, 0.12)',
  },
});
