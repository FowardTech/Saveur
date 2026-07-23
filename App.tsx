import React from 'react';
import 'i18n/config';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Appearance, Linking, LogBox, StatusBar } from 'react-native';
import { ApplicationProvider, IconRegistry } from '@ui-kitten/components';
import { default as darkTheme } from 'constants/theme/dark.json';
import { default as lightTheme } from 'constants/theme/light.json';
import { default as customTheme } from 'constants/theme/appTheme.json';
import { default as customMapping } from 'constants/theme/mapping.json';
import { EvaIconsPack } from '@ui-kitten/eva-icons';
import AssetIconsPack from 'assets/AssetIconsPack';
import * as eva from '@eva-design/eva';
import ThemeContext from './ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppContainer from 'navigation/AppContainer';
import { AuthProvider } from './AuthContext';
import { setupNotificationTapListeners, setupForegroundPushHandler } from 'services/pushNotificationService';
import { maybeDetectLanguageFromLocation } from 'utils/locationLanguage';
import * as referralService from 'services/referralService';
import * as linkedinAuthService from 'services/linkedinAuthService';
import * as configService from 'services/configService';
import { AppConfig } from 'services/configService';
import AppGateScreen from 'components/AppGateScreen';

LogBox.ignoreLogs([
  "[react-native-gesture-handler] Seems like you're using an old API with gesture components, check out new Gestures system!",
]);
LogBox.ignoreLogs([
  "AsyncStorage has been extracted from react-native core and will be removed in a future release. It can now be installed and imported from '@react-native-async-storage/async-storage' instead of 'react-native'. See https://github.com/react-native-async-storage/async-storage",
]);
LogBox.ignoreLogs(['Constants.installationId has been deprecated']);
LogBox.ignoreLogs(["exported from 'deprecated-react-native-prop-types'."]);
export default function App() {
  // Defaults to the device's own current appearance (Settings > Display,
  // which on iOS/Android can itself already be set to auto-switch by time of
  // day) rather than always starting on 'light' — matches what most apps do
  // and is what was actually requested: dark mode should track the system,
  // not just be a manual-only toggle. `hasExplicitPreference` flips true the
  // moment the user taps the toggle below, at which point their choice wins
  // over the system going forward (persisted in AsyncStorage so it survives
  // app restarts) — the toggle isn't going away, it's just an override now
  // instead of the only way to change themes.
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() =>
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  );
  const hasExplicitPreference = React.useRef(false);

  React.useEffect(() => {
    AsyncStorage.getItem('theme').then(value => {
      if (value === 'light' || value === 'dark') {
        hasExplicitPreference.current = true;
        setTheme(value);
      }
    });
  }, []);

  // Live-follow the OS appearance while the user hasn't overridden it. This
  // is what actually makes it "change with the system" rather than only
  // reading the system scheme once at cold start — e.g. a phone set to
  // auto-switch to dark at sunset will flip this app over too, without the
  // user needing to relaunch it.
  React.useEffect(() => {
    const subscription = Appearance.addChangeListener(({colorScheme}) => {
      if (!hasExplicitPreference.current) {
        setTheme(colorScheme === 'dark' ? 'dark' : 'light');
      }
    });
    return () => subscription.remove();
  }, []);

  // Admin-configurable maintenance mode / forced update gate — see
  // services/configService.ts. Fetched once here, before the main
  // navigator ever mounts, so a "down for maintenance" or "please update"
  // state is the very first thing a blocked user sees rather than
  // flashing the real app first. Fails open: `appConfig` starts as
  // configService's safe defaults (nothing blocked), and loadAppConfig()
  // itself never throws, so a network hiccup here never locks anyone out.
  const [appConfig, setAppConfig] = React.useState<AppConfig>(configService.getCachedConfig());
  React.useEffect(() => {
    configService.loadAppConfig().then(setAppConfig);
  }, []);
  const maintenance = appConfig.maintenance;
  const blockedByUpdate = configService.needsForceUpdate(appConfig);

  // Independent of sign-in state — a killed-app push tap can resolve via
  // getInitialNotification() before AuthContext's onAuthStateChanged fires,
  // so this is set up unconditionally at the app root rather than gated on
  // being signed in. See services/pushNotificationService.ts.
  React.useEffect(() => {
    const unsubscribe = setupNotificationTapListeners();
    return unsubscribe;
  }, []);

  // A push that arrives while the app is already open never triggers a
  // system notification on its own (Firebase's own behavior, not a bug) —
  // this displays a real local notification via notifee instead, so a
  // foreground push looks and behaves the same as a background one rather
  // than showing a plain in-app Alert popup. See
  // services/pushNotificationService.ts's file header for details.
  React.useEffect(() => {
    const unsubscribe = setupForegroundPushHandler();
    return unsubscribe;
  }, []);

  // First-open, one-time location-permission-based language detection — see
  // utils/locationLanguage.ts. Runs unconditionally at the app root (same
  // reasoning as the push-notification listeners above: independent of
  // sign-in state, since this should apply even to a brand-new user who
  // hasn't signed up yet). No-ops after the very first attempt ever, and
  // never overrides a language the user already picked.
  React.useEffect(() => {
    maybeDetectLanguageFromLocation();
  }, []);

  // Referral deep link capture — saveur://referral?code=XXXXXXX (the
  // "saveur" scheme already existed for Stripe's payment-sheet redirect;
  // this just adds a second thing it can carry). Handles both a cold start
  // (app opened directly via the link) and a warm one (app already running,
  // link tapped while backgrounded/foregrounded). The actual code is only
  // stored locally here — it's sent to the backend as `referred_by_code` on
  // the next sign-up sync call, see services/authService.ts's
  // provisionProfile() and services/referralService.ts.
  // Also carries the saveur://linkedin-redirect?token=...&is_new_user=...
  // callback from the LinkedIn OAuth flow (see services/linkedinAuthService.ts)
  // — handleIncomingUrl there is a no-op for any URL that isn't that specific
  // redirect, so it's safe to always call alongside the referral handler.
  React.useEffect(() => {
    Linking.getInitialURL().then(url => {
      referralService.handleIncomingUrl(url);
      linkedinAuthService.handleIncomingUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({url}) => {
      referralService.handleIncomingUrl(url);
      linkedinAuthService.handleIncomingUrl(url);
    });
    return () => subscription.remove();
  }, []);

  const toggleTheme = () => {
    hasExplicitPreference.current = true;
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    AsyncStorage.setItem('theme', nextTheme).then(() => {
      setTheme(nextTheme);
    });
  };
  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <IconRegistry icons={[EvaIconsPack, AssetIconsPack]} />
        <ApplicationProvider
          {...eva}
          theme={
            theme === 'light'
              ? { ...eva.light, ...customTheme, ...lightTheme }
              : { ...eva.dark, ...customTheme, ...darkTheme }
          }
          /* @ts-ignore */
          customMapping={customMapping}
        >
          <SafeAreaProvider>
            <StatusBar
              barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
              translucent={true}
              backgroundColor={'#00000000'}
            />
            {/* No <StripeProvider> here on purpose. It was here initially
                with an empty publishableKey (the real key only exists per-
                request, from POST /billing/payment-sheet — see
                services/billingService.ts), on the assumption it just needed
                a placeholder until initStripe() set the real one later. That
                assumption was wrong: Stripe's SDK validates the key the
                moment StripeProvider mounts, and an empty string trips a
                FATAL assertion crash (Swift assertionFailure — freezes/
                kills the whole app, not a catchable JS error). Checked
                @stripe/stripe-react-native's actual source: useStripe()
                doesn't read any React Context at all, it's just plain
                functions — so StripeProvider isn't required for it to work.
                initStripe() (called in src/more/Subscription.tsx, right
                before checkout, with the real key from that request) does
                the exact same SDK-configuration job on its own. */}
            {maintenance.enabled ? (
              <AppGateScreen
                iconName="tools-outline"
                title={maintenance.title || 'Down for maintenance'}
                message={maintenance.message || "We're making some improvements. Please check back shortly."}
              />
            ) : blockedByUpdate ? (
              <AppGateScreen
                iconName="arrow-upward-outline"
                title={appConfig.release.update_title || 'Update required'}
                message={appConfig.release.update_message || 'Please update the app to continue.'}
                actionLabel="Update now"
                onAction={() => {
                  const url = configService.getUpdateUrl(appConfig);
                  if (url) Linking.openURL(url).catch(() => {});
                }}
              />
            ) : (
              <AuthProvider>
                <AppContainer />
              </AuthProvider>
            )}
          </SafeAreaProvider>
        </ApplicationProvider>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
