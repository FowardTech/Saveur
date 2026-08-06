import React, {memo} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {Icon, Layout, useTheme} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import CtaButton from 'components/CtaButton';
import {globalStyle} from 'styles/globalStyle';
import {detectLanguageFromLocation} from 'utils/locationLanguage';

// First-launch, blocking location-permission gate. Product request: "When
// the user installs the app for the first time and opens the app, one of
// the permissions the user must grant is the user location. before
// continuing into the app. So immediately the user selects grants the user
// location permission the content of the app should automatically change to
// the language spoken in that region or country."
//
// Rendered from App.tsx, before AuthProvider/AppContainer ever mount (same
// pattern as the existing maintenance/force-update AppGateScreen branches
// there), and gated on EKeyAsyncStorage.locationLanguageGateSeen so it only
// ever shows on the very first cold start, never again after that flag is
// set — regardless of which button the user taps below.
//
// "Allow Location Access" triggers the OS permission prompt via
// utils/locationLanguage.ts's detectLanguageFromLocation(), which requests
// permission, reverse-geocodes the fix, and calls i18n.changeLanguage(...)
// before this component's onDone() fires — so the language has already
// changed by the time the rest of the app (starting with the onboarding
// carousel) renders. Per explicit product direction on the fallback
// behavior, denying the permission (or any failure along the way) does NOT
// block the user — "Not now" and a failed/denied Allow both fall straight
// through to onDone(), leaving the device's own system language
// (i18n/language-detector.ts's existing fallback) in place and letting the
// user into the app immediately either way.
type Props = {
  onDone(): void;
};

const LocationLanguageGate = memo(({onDone}: Props) => {
  const theme = useTheme();
  const {t} = useTranslation('common');
  const [working, setWorking] = React.useState(false);

  const onAllow = React.useCallback(async () => {
    setWorking(true);
    try {
      await detectLanguageFromLocation();
    } finally {
      onDone();
    }
  }, [onDone]);

  return (
    <Layout style={styles.root} level="1">
      <View style={styles.body}>
        <View style={[styles.iconCircle, {backgroundColor: theme['background-basic-color-2']}]}>
          <Icon
            pack="eva"
            name="pin-outline"
            style={[globalStyle.icon40, {tintColor: theme['text-basic-color']}]}
          />
        </View>
        <Text category="h3" bold center mt={20}>
          {t('location_gate_title', {defaultValue: 'Enable location for the best experience'})}
        </Text>
        <Text category="h8" status="placeholder" center mt={10} maxWidth={320}>
          {t('location_gate_message', {
            defaultValue:
              "Saveur uses your approximate location just once, to set the app's language to the one spoken in your region. You can always change it later in Settings.",
          })}
        </Text>
        {working ? (
          <ActivityIndicator style={styles.spinner} color={theme['color-primary-500']} />
        ) : (
          <>
            <CtaButton style={styles.button} onPress={onAllow}>
              {t('location_gate_allow', {defaultValue: 'Allow Location Access'})}
            </CtaButton>
            <Text
              category="h9"
              bold
              center
              mt={16}
              onPress={onDone}
              style={styles.skip}>
              {t('location_gate_skip', {defaultValue: 'Not now'})}
            </Text>
          </>
        )}
      </View>
    </Layout>
  );
});

export default LocationLanguageGate;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    marginTop: 28,
    minWidth: 240,
  },
  skip: {
    textDecorationLine: 'underline',
  },
  spinner: {
    marginTop: 28,
  },
});
