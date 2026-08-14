import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import Text from 'components/Text';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import { EKeyAsyncStorage, accountScopedKey } from 'constants/Types';
import * as configService from 'services/configService';
import { AuthContext } from '../../AuthContext';

// Product request: "add a banner in the homescreen at the top top for
// regular informations like policy change, change in terms and conditions
// etc. And it should be configurable from the admin." Admin-authored via
// saveur-backend's app_config_service.py "home_banner" section (Admin >
// Content > Home banner) — title/message/optional link, auto-translated
// server-side the same way FAQ/About/maintenance already are (see
// content.py's GET /config).
//
// Deliberately its own section, not a reuse of "maintenance" — maintenance
// is a full-screen BLOCKING gate (components/AppGateScreen.tsx) meant for
// real outages; this is a small, non-blocking strip meant for "FYI,
// nothing's broken" notices. Rendered ABOVE HeaderHome in HomeSrc.tsx (not
// inside the scrollable Content, unlike DailyNewsBanner/DailyTipsBanner
// just below it) — "top top" per the product request — so it's visible the
// instant Home loads, with no scrolling required.
//
// Dismissible, per account, until the CONTENT changes: fingerprints
// title+message+link_url and remembers that exact combination in
// AsyncStorage (EKeyAsyncStorage.homeBannerDismissed). An admin editing the
// copy later (e.g. a real Terms update) changes the fingerprint, so it
// reappears once for everyone who already dismissed the old wording —
// nobody has to remember to bump a version number, and re-saving identical
// text won't needlessly re-show it.
const AnnouncementBanner = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const { t } = useTranslation(['more', 'common']);
  const { profile } = React.useContext(AuthContext);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const [config, setConfig] = React.useState(() => configService.getCachedConfig().home_banner);
  // undefined = still reading AsyncStorage (render nothing yet, avoid a
  // one-frame flash of the banner before we know it was already dismissed).
  const [dismissed, setDismissed] = React.useState<string | null | undefined>(undefined);

  // App.tsx's config fetch can resolve after this component has already
  // mounted (e.g. a slow network on cold start) — subscribe so a banner an
  // admin just published still shows up without requiring a full app
  // restart. Same pub/sub configService already built for FaqScreen/
  // AboutScreen's identical "read synchronously, react to a later fetch"
  // need.
  React.useEffect(() => configService.subscribe(() => {
    setConfig(configService.getCachedConfig().home_banner);
  }), []);

  React.useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(accountScopedKey(EKeyAsyncStorage.homeBannerDismissed, profile?.uid))
      .then(value => { if (!cancelled) setDismissed(value); })
      .catch(() => { if (!cancelled) setDismissed(null); });
    return () => { cancelled = true; };
  }, [profile?.uid]);

  const fingerprint = `${config.title}|${config.message}|${config.link_url}`;

  const onDismiss = React.useCallback(() => {
    setDismissed(fingerprint);
    AsyncStorage.setItem(
      accountScopedKey(EKeyAsyncStorage.homeBannerDismissed, profile?.uid),
      fingerprint,
    ).catch(() => {});
  }, [fingerprint, profile?.uid]);

  const onLinkPress = React.useCallback(() => {
    if (!config.link_url) return;
    navigation.navigate('WebViewScreen', {
      url: config.link_url,
      title: config.link_label || config.title,
    });
  }, [navigation, config.link_url, config.link_label, config.title]);

  if (!config.enabled || (!config.title && !config.message)) return null;
  if (dismissed === undefined || dismissed === fingerprint) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: theme['color-primary-transparent-200'] }]}>
      <Icon pack="eva" name="info-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
      <View style={[globalStyle.flexOne, styles.textWrap]}>
        {config.title ? (
          <Text category="h10" bold numberOfLines={1}>
            {config.title}
          </Text>
        ) : null}
        {config.message ? (
          <Text category="h10" status="placeholder" numberOfLines={2} mt={config.title ? 2 : 0}>
            {config.message}
          </Text>
        ) : null}
        {config.link_url ? (
          <TouchableOpacity onPress={onLinkPress} activeOpacity={0.7}>
            <Text category="h10" status="link" bold mt={4}>
              {config.link_label || t('more:learn_more', { defaultValue: 'Learn more' })}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={t('common:close', { defaultValue: 'Close' }).toString()}>
        <Icon pack="eva" name="close-outline" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
      </TouchableOpacity>
    </View>
  );
});

export default AnnouncementBanner;

const themedStyles = StyleService.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  textWrap: {
    marginHorizontal: 10,
  },
});
