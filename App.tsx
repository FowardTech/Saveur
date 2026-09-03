import React from 'react';
import 'i18n/config';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Appearance, AppState, Linking, LogBox, StatusBar } from 'react-native';
import { ApplicationProvider, IconRegistry } from '@ui-kitten/components';
import { default as darkTheme } from 'constants/theme/dark.json';
import { default as lightTheme } from 'constants/theme/light.json';
import { default as customTheme } from 'constants/theme/appTheme.json';
import { default as customMapping } from 'constants/theme/mapping.json';
// Was @ui-kitten/eva-icons' EvaIconsPack (Eva's own outline icon set) --
// replaced with a lucide-react-native-backed pack registered under the same
// 'eva' name (see assets/LucideEvaIconsPack.tsx's own comment) per explicit
// product direction to use the admin dashboard's icon style everywhere in
// the mobile app, not just Settings/tabs.
import LucideEvaIconsPack from 'assets/LucideEvaIconsPack';
import AssetIconsPack from 'assets/AssetIconsPack';
import * as eva from '@eva-design/eva';
import ThemeContext from './ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppContainer from 'navigation/AppContainer';
import { AuthProvider } from './AuthContext';
import { setupNotificationTapListeners, setupForegroundPushHandler } from 'services/pushNotificationService';
import LocationLanguageGate from 'components/LocationLanguageGate';
import { EKeyAsyncStorage } from 'constants/Types';
import * as referralService from 'services/referralService';
import * as linkedinAuthService from 'services/linkedinAuthService';
import * as emailConnectionService from 'services/emailConnectionService';
import * as calendarConnectionService from 'services/calendarConnectionService';
import * as jobShareService from 'services/jobShareService';
import * as shareIntentService from 'services/shareIntentService';
import * as appsFlyerService from 'services/appsFlyerService';
import * as configService from 'services/configService';
import { flushPendingVideoUploads } from 'services/interviewService';
import { AppConfig } from 'services/configService';
import AppGateScreen from 'components/AppGateScreen';
import BootSplash from 'react-native-bootsplash';
import { useTranslation } from 'react-i18next';
import * as crashReportingService from 'services/crashReportingService';

LogBox.ignoreLogs([
  "[react-native-gesture-handler] Seems like you're using an old API with gesture components, check out new Gestures system!",
]);
LogBox.ignoreLogs([
  "AsyncStorage has been extracted from react-native core and will be removed in a future release. It can now be installed and imported from '@react-native-async-storage/async-storage' instead of 'react-native'. See https://github.com/react-native-async-storage/async-storage",
]);
LogBox.ignoreLogs(['Constants.installationId has been deprecated']);
LogBox.ignoreLogs(["exported from 'deprecated-react-native-prop-types'."]);
function App() {
  const { t } = useTranslation();
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
  // Product report: "sometimes the video recording failed to save to the
  // server... it should save to the server even after the user has
  // finished the interview." Scoped explicitly to a JS-level resilient
  // retry (no new native background-upload dependency) -- this keeps
  // retrying for as long as the JS runtime is actually alive (foreground,
  // or the brief grace period either OS gives a just-backgrounded app),
  // which covers the common real-world case (a network blip, a slow
  // connection) without the build risk of a native background-upload
  // library. It will NOT survive the app being force-quit mid-upload --
  // flushPendingVideoUploads' own persisted AsyncStorage queue picks that
  // back up the next time the app is opened at all, same as before.
  //
  // Two triggers beyond the original "on every foreground" one:
  //  1. A steady interval while the app is in the foreground -- covers a
  //     video that's still mid-upload (not yet failed into the queue) when
  //     connectivity drops and later recovers WITHOUT the app ever leaving
  //     the foreground, which the old active-only listener could never
  //     catch (nothing about staying foregrounded the whole time ever
  //     fires an AppState 'change' event).
  //  2. One immediate attempt right as the app starts backgrounding --
  //     both iOS and Android grant a departing app a real, if short,
  //     window of continued execution (Apple's ~30s expiring background
  //     task time; Android is looser but still not instant), so a queued
  //     upload that's small enough often has a genuine chance to finish in
  //     exactly that window instead of waiting for the user to reopen the
  //     app at all.
  React.useEffect(() => {
    flushPendingVideoUploads().catch(() => {});
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active' || nextState === 'background') {
        flushPendingVideoUploads().catch(() => {});
      }
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') flushPendingVideoUploads().catch(() => {});
    }, 20000);
    return () => {
      sub.remove();
      clearInterval(interval);
    };
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

  // First-launch, blocking location-permission gate — see
  // components/LocationLanguageGate.tsx for the full flow. `null` while the
  // AsyncStorage flag is still being read (renders nothing for that brief
  // instant, same as the BootSplash-covered window every other startup
  // check here has); `false` shows the gate; `true` skips straight to the
  // real app, which is every launch after the very first one.
  const [locationGateSeen, setLocationGateSeen] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    AsyncStorage.getItem(EKeyAsyncStorage.locationLanguageGateSeen).then(seen => {
      setLocationGateSeen(!!seen);
    });
  }, []);
  const onLocationGateDone = React.useCallback(() => {
    AsyncStorage.setItem(EKeyAsyncStorage.locationLanguageGateSeen, '1').catch(() => {});
    setLocationGateSeen(true);
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
  // Also carries saveur://gmail-connected?... / saveur://outlook-connected?...
  // from the Job Tracker's "Connect Gmail"/"Connect Outlook" OAuth flows
  // (see services/emailConnectionService.ts), and
  // saveur://google-calendar-connected?... / saveur://outlook-calendar-connected?...
  // from the calendar-connect equivalents (services/calendarConnectionService.ts)
  // — same no-op-unless-matching convention.
  // Also carries the saveur://job?id=X fallback link jobShareService.ts
  // hands the share sheet when OneLink isn't configured yet — only useful
  // for an already-installed app (no deferred resolution, unlike the
  // AppsFlyer listeners above), but still a real working link in the
  // meantime. extractJobIdFromUrl is a no-op (returns null) for any URL
  // that isn't a job link, so it's safe to always call here too.
  const handleIncomingUrl = React.useCallback((url: string | null | undefined) => {
    referralService.handleIncomingUrl(url);
    linkedinAuthService.handleIncomingUrl(url);
    emailConnectionService.handleIncomingUrl(url);
    calendarConnectionService.handleIncomingUrl(url);
    const jobId = jobShareService.extractJobIdFromUrl(url);
    if (jobId) jobShareService.setPendingJobId(jobId).catch(() => {});
    // OS Share Sheet integration (product request: "Ability to share files
    // to Saveur from the device") — iOS's Share Extension (see
    // ios/SaveurShareExtension/ShareViewController.swift) can't reach a
    // running host app's JS runtime directly, so it re-opens Saveur via
    // saveur://shared-import instead, landing here the same way every
    // other saveur:// deep link does. checkForSharedFiles below picks up
    // whatever that extension just wrote to the shared App Group
    // container.
    if (shareIntentService.handleIncomingUrl(url)) {
      checkForSharedFiles();
    }
  }, []);

  React.useEffect(() => {
    Linking.getInitialURL().then(handleIncomingUrl);
    const subscription = Linking.addEventListener('url', ({url}) => handleIncomingUrl(url));
    return () => subscription.remove();
  }, [handleIncomingUrl]);

  // OS Share Sheet integration, continued — Android's own two delivery
  // paths (see shareIntentService.ts's file header): getPendingSharedFiles
  // covers a cold start (MainActivity.onCreate already had the ACTION_SEND
  // intent) checked once here at mount, and addShareListener covers a
  // share tapped while the app is already running/backgrounded
  // (MainActivity.onNewIntent). Either way, this only ever CAPTURES the
  // result into AsyncStorage (setPendingSharedFiles) — same "never
  // navigate directly" posture as jobShareService.setPendingJobId a few
  // effects above — HomeSrc.tsx's useFocusEffect is what actually
  // navigates to My Documents once the navigator/auth state is ready.
  const checkForSharedFiles = React.useCallback(() => {
    shareIntentService.getPendingSharedFiles().then(files => {
      if (files.length) shareIntentService.setPendingSharedFiles(files).catch(() => {});
    });
  }, []);

  React.useEffect(() => {
    checkForSharedFiles();
    return shareIntentService.addShareListener(files => {
      if (files.length) shareIntentService.setPendingSharedFiles(files).catch(() => {});
    });
  }, [checkForSharedFiles]);

  const toggleTheme = () => {
    hasExplicitPreference.current = true;
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    AsyncStorage.setItem('theme', nextTheme).then(() => {
      setTheme(nextTheme);
    });
  };
  return (
    // BUG FIX (product report: "the homescreen is freezing, anytime it loads
    // and i try to scroll it just freezes and refuses to scroll" — every
    // load, both platforms): react-native-gesture-handler v2 (see
    // package.json) requires the whole app to be wrapped in
    // GestureHandlerRootView, not just the top-of-entry-file import (see
    // index.js's own comment on this same fix) — without it, v2's native
    // gesture event dispatcher has nowhere to attach, so gesture-handler-
    // driven components (including @react-navigation/stack's own swipe/slide
    // screen transitions, used as this app's ROOT navigator in
    // navigation/AppContainer.tsx, wrapping every screen including Home)
    // don't hand touches off to ordinary scrollable content correctly. This
    // was completely missing before. `style={{flex:1}}` per RNGH's own
    // docs — it needs to actually fill the screen, not just wrap it.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
          <IconRegistry icons={[LucideEvaIconsPack, AssetIconsPack]} />
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
                title={
                  maintenance.title ||
                  t('common:maintenance_title', {defaultValue: 'Down for maintenance'})
                }
                message={
                  maintenance.message ||
                  t('common:maintenance_message', {
                    defaultValue: "We're making some improvements. Please check back shortly.",
                  })
                }
              />
            ) : blockedByUpdate ? (
              <AppGateScreen
                iconName="arrow-upward-outline"
                title={
                  appConfig.release.update_title ||
                  t('common:update_required_title', {defaultValue: 'Update required'})
                }
                message={
                  appConfig.release.update_message ||
                  t('common:update_required_message', {
                    defaultValue: 'Please update the app to continue.',
                  })
                }
                actionLabel={t('common:update_now', {defaultValue: 'Update now'})}
                onAction={() => {
                  const url = configService.getUpdateUrl(appConfig);
                  if (url) Linking.openURL(url).catch(() => {});
                }}
              />
            ) : locationGateSeen === null ? null : locationGateSeen === false &&
              appConfig.feature_flags.location_language_gate !== false ? (
              // First launch only — see components/LocationLanguageGate.tsx.
              // Every launch after this one has locationGateSeen === true
              // and falls straight through to the real app below. Admin
              // toggle (product request: "make all those new features
              // configurable in the admin") — while off, this condition is
              // simply false and the app falls through to AuthProvider/
              // AppContainer below without ever marking locationGateSeen
              // true, so if the admin turns the flag back on, a user who
              // was skipped while it was off still sees it once, same as
              // any other first-launch user.
              <LocationLanguageGate onDone={onLocationGateDone} />
            ) : (
              <AuthProvider>
                <AppContainer />
              </AuthProvider>
            )}
          </SafeAreaProvider>
          </ApplicationProvider>
        </ThemeContext.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Sentry's error boundary + native-crash-handling wrapper (see
// services/crashReportingService.ts's own comment for why this has to be
// applied here, at export time, rather than inside App() itself). A no-op
// passthrough — export default App unchanged — while SENTRY_DSN is unset.
export default crashReportingService.wrap(App);
