import * as React from 'react';
import { Image, ImageStyle, View } from 'react-native';
import { StyleService, TopNavigation, useStyleSheet, Layout, Icon } from '@ui-kitten/components';
import Container from 'components/Container';
import Content from 'components/Content';
import Text from 'components/Text';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { useTranslation } from 'react-i18next';
import { globalStyle } from 'styles/globalStyle';
import * as configService from 'services/configService';
import { Images } from 'assets/images';

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
                {/* REVERTED (product ask: "remove the backgrounds from the
                    icons... give the icons themselves the platform
                    blue") -- this cycled through a color-primary-
                    transparent-100 tint circle and a GradientIconBadge; no
                    badge/background now, plain glyph tinted platform blue
                    (#0063f8) directly.
                    REDESIGN (product-supplied icon pack, "use them in the
                    appropriate places in the app") -- when an item has no
                    admin-configured icon (the common case, falling back to
                    'rocket-outline'), render the real illustrated rocket
                    icon instead of the plain Eva glyph. Admin-configured
                    custom icons (item.icon set from Config > Upcoming
                    Features in the dashboard) still render as a plain Eva
                    glyph, since the admin picks from Eva's icon set, not
                    this image pack. */}
                {item.icon ? (
                  <Icon
                    pack="eva"
                    name={item.icon}
                    style={[globalStyle.icon20, styles.iconWrap, { tintColor: '#0063f8' }]}
                  />
                ) : (
                  <Image
                    source={Images.iconRocket}
                    style={[styles.iconWrap, styles.iconImage] as ImageStyle[]}
                    resizeMode="contain"
                  />
                )}
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
  // Just the spacing now -- GradientIconBadge owns its own size/shape via
  // its `size`/`radius` props at the call site.
  iconWrap: {
    marginRight: 12,
  },
  // Matches globalStyle.icon20's 28x28 footprint (the size the Eva glyph
  // branch above still renders at) so a row doesn't visibly reflow between
  // the two icon types.
  iconImage: {
    width: 28,
    height: 28,
  },
});
