import * as React from 'react';
import { View } from 'react-native';
import { StyleService, TopNavigation, useStyleSheet, useTheme, Layout, Icon } from '@ui-kitten/components';
import Container from 'components/Container';
import Content from 'components/Content';
import Text from 'components/Text';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { useTranslation } from 'react-i18next';
import { globalStyle } from 'styles/globalStyle';
import * as configService from 'services/configService';

// Upcoming Features (product request item — see src/home/NextLessonHomeCard.tsx,
// the "Continue & Upcoming" row's third card this screen is reached from
// once a learner has no next curriculum lesson to take). Same
// admin-editable/no-app-release content pattern as FaqScreen.tsx: content
// comes from configService's cached app config (see saveur-backend's
// app_config_service.py's "upcoming_features" section and the admin
// dashboard's Config > Upcoming features tab), title/description translated
// server-side for non-English users. Plain static list, not tap-to-expand
// like FAQ — there's no separate "answer" to reveal, the description is
// short enough to always show.
const UpcomingFeatures = () => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home', 'common']);
  const [, forceRerender] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => configService.subscribe(forceRerender), []);
  const items = configService.getCachedConfig().upcoming_features.items.filter(i => i.enabled);

  return (
    <Container>
      <TopNavigation
        title={t('home:upcoming_features_title', { defaultValue: 'Upcoming Features' })}
        accessoryLeft={() => <NavigationAction />}
      />
      <Content contentContainerStyle={styles.content}>
        {items.length === 0 ? (
          <Text category="h9-s" status="placeholder" center mt={20}>
            {t('home:upcoming_features_empty', { defaultValue: "Nothing to preview yet — check back soon." })}
          </Text>
        ) : (
          items.map((item, index) => (
            <Layout key={item.id || index} level="2" style={styles.card}>
              <Flex justify="flex-start" itemsCenter>
                <View style={styles.iconWrap}>
                  <Icon
                    pack="eva"
                    name={item.icon || 'rocket-outline'}
                    style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]}
                  />
                </View>
                <View style={globalStyle.flexOne}>
                  <Text category="h9" bold>{item.title}</Text>
                  {item.description ? (
                    <Text category="h9-s" status="placeholder" mt={4}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </Flex>
            </Layout>
          ))
        )}
      </Content>
    </Container>
  );
};

export default UpcomingFeatures;

const themedStyles = StyleService.create({
  content: {
    padding: 20,
  },
  card: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'color-primary-transparent-100',
  },
});
