import React from 'react';
import 'i18n/config';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Appearance, AppState, Linking, LogBox, StatusBar } from 'react-native';
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
import * as jobShareService from 'services/jobShareService';
import * as appsFlyerService from 'services/appsFlyerService';
import * as configService from 'services/configService';
import { flushPendingVideoUploads } from 'services/interviewService';
import { AppConfig } from 'services/configService';
import AppGateScreen from 'components/AppGateScreen';
import BootSplash from 'react-native-bootsplash';

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
    const syncFromSystem = () => {
      if (!hasExplicitPreference.current) {
        setTheme(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
      }
    };
    const subscription = Appearance.addChangeListener(syncFromSystem);
    // Android reliability fallback (this is the actual fix for "auto
    // dark/light doesn't work correctly on Android"): on several Android/RN
    // combinations, Appearance.addChangeListener silently misses or delays
    // the event when the system theme flips while this app is backgrounded
    // -- e.g. a phone set to auto-switch to dark at sunset while the app
    // sits in the background never gets the callback, so the app comes back
    // to the foreground still in the old theme until something else happens
    // to trigger a re-render. Re-reading Appearance.getColorScheme() (a
    // cheap synchronous call, not the event's possibly-stale colorScheme
    // param) every time the app returns to the foreground catches anything
    // the listener above missed, independent of whether the listener fired.
    const appStateSub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') syncFromSystem();
    });
    return () => {
      subscription.remove();
      appStateSub.remove();
    };
  }, []);

  // Retries any video interview uploads that failed even after
  // LiveInterviewSession.tsx's own in-session retries (see
  // interviewService.uploadSessionVideoResilient) — e.g. the network was
  // still down, or the app got killed mid-upload. Cheap no-op when nothing's
  // queued, which is the overwhelmingly common case; only actually does
  // anything for the rare user who hit a real upload failure, and lets that
  // resolve itself automatically the next time they open the app instead of
  // requiring them to redo the interview.
  React.useEffect(() => {
    flushPendingVideoUploads().catch(() => {});
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') flushPendingVideoUploads().catch(() => {});
    });
    return () => sub.remove();
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
    // appsFlyerService.init() reads configService's cached appsflyer
    // section, so it has to run AFTER the fetch resolves (or on whatever
    // cached/default config was already there before this call), not in
    // parallel with it — chained here rather than as its own independent
    // effect for that reason.
    configService.loadAppConfig().then(config => {
      setAppConfig(config);
      appsFlyerService.init();
    }).finally(() => {
      // This is the actual handoff point from the native BootSplash view
      // (ios/caren_family/AppDelegate.swift's customize(_:) — same mark/
      // background/footer as LaunchScreen.storyboard, kept on screen by
      // RNBootSplash instead of the OS dismissing straight to a blank RN
      // root view) to the real app. Waiting for this config fetch to
      // settle (success OR failure — .finally, not .then) before hiding
      // means the maintenance/force-update gate above never has a chance
      // to flash in behind the splash; a fade avoids a hard cut against
      // whatever screen ends up underneath. No-ops harmlessly on Android
      // (native module not initialized there — installSplashScreen/
      // Theme.App.SplashScreen already handles Android's own launch, and
      // isn't part of this fix).
      BootSplash.hide({ fade: true }).catch(() => {});
    });
  }, []);
  const maintenance = appConfig.maintenance;
  const blockedByUpdate = configService.needsForceUpdate(appConfig);

  // Deferred deep link resolution for a shared job (product request item)
  // — see services/appsFlyerService.ts + jobShareService.ts's file header
  // for the full flow. Independent of sign-in state (same reasoning as the
  // push-notification/referral listeners elsewhere in this file): a fresh
  // install from a shared link resolves this before the user has even
  // reached signup. The resulting job id just sits in AsyncStorage
  // (jobShareService.setPendingJobId) until HomeSrc.tsx picks it up once
  // the user actually reaches Home — this effect only ever captures it,
  // never navigates directly, since the navigator may not exist yet on a
  // cold start and the user may not be authenticated/entitled at all.
  React.useEffect(() => {
    return appsFlyerService.registerDeepLinkListeners(jobId => {
      jobShareService.setPendingJobId(jobId).catch(() => {});
    });
  }, []);

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
  // Also carries the saveur://job?id=X fallback link jobShareService.ts
  // hands the share sheet when OneLink isn't configured yet — only useful
  // for an already-installed app (no deferred resolution, unlike the
  // AppsFlyer listeners above), but still a real working link in the
  // meantime. extractJobIdFromUrl is a no-op (returns null) for any URL
  // that isn't a job link, so it's safe to always call here too.
  const handleIncomingUrl = React.useCallback((url: string | null | undefined) => {
    referralService.handleIncomingUrl(url);
    linkedinAuthService.handleIncomingUrl(url);
    const jobId = jobShareService.extractJobIdFromUrl(url);
    if (jobId) jobShareService.setPendingJobId(jobId).catch(() => {});
  }, []);

  React.useEffect(() => {
    Linking.getInitialURL().then(handleIncomingUrl);
    const subscription = Linking.addEventListener('url', ({url}) => handleIncomingUrl(url));
    return () => subscription.remove();
  }, [handleIncomingUrl]);

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
              // `tools-outline` isn't a real Eva Icons name (there's no
              // tools/wrench/hammer icon in that set at all) -- Icon can't
              // resolve it to a component and crashes the whole app with
              // "Element type is invalid ... but got: undefined" the moment
              // maintenance mode is switched on, for every user. `settings-
              // 2-outline` (a gear) is the closest real icon for this.
              <AppGateScreen
                iconName="settings-2-outline"
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
