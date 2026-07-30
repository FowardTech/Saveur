import {CommonActions, createNavigationContainerRef} from '@react-navigation/native';
import {JobAlertProps} from 'constants/Types';
import {RootStackParamList} from './types';

// Standard React Navigation "navigate without the navigation prop" escape
// hatch (https://reactnavigation.org/docs/navigating-without-navigation-prop/)
// — needed because services/pushNotificationService.ts's tap handlers fire
// from Firebase listeners set up in App.tsx, outside any screen component,
// so there's no useNavigation() to call.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// A push tap can resolve before the navigator has mounted — specifically
// messaging().getInitialNotification() when the app was launched cold by
// tapping a notification (not just backgrounded). Queue whichever one
// destination was requested and flush it from AppContainer's
// <NavigationContainer onReady> once the navigator is actually ready to
// accept a navigate() call. Generalized from a job-alert-only queue (a
// single `pendingJob`) so a tap on any OTHER notification type (see
// services/pushNotificationService.ts) has somewhere to go too, instead of
// being silently dropped if it happens to launch the app cold.
type PendingNavigation =
  | {name: 'JobAlertDetails'; params: {job: JobAlertProps}}
  | {
      name: 'WebViewScreen';
      params: {url: string; title?: string; job?: {company: string; role: string; applyUrl: string; companyLogoUrl?: string}};
    }
  | {name: 'Notification'}
  | {name: 'WeeklyCareerReport'}
  | {name: 'DailyIndustryNews'}
  // Used by AuthContext.tsx's LinkedIn cold-start sign-in fallback — see its
  // comment for why: the Stack.Navigator's `initialRouteName` prop only
  // matters on first mount, so simply flipping `isSignedIn` to true after
  // the navigator has already mounted on Login does NOT move the app off
  // that screen (every other sign-in path gets there via each button
  // handler's own explicit nextScreen('MainBottomTab') stack reset — this
  // fallback has no button handler to call that from, since it runs from a
  // plain Firebase listener with no navigation prop in scope).
  | {name: 'ResetToMain'};

let pendingNavigation: PendingNavigation | null = null;

function runNavigation(nav: PendingNavigation): void {
  if (nav.name === 'JobAlertDetails') {
    navigationRef.navigate('JobAlertDetails', nav.params);
  } else if (nav.name === 'WebViewScreen') {
    navigationRef.navigate('WebViewScreen', nav.params);
  } else if (nav.name === 'Notification') {
    navigationRef.navigate('Notification');
  } else if (nav.name === 'WeeklyCareerReport') {
    navigationRef.navigate('WeeklyCareerReport');
  } else if (nav.name === 'DailyIndustryNews') {
    navigationRef.navigate('DailyIndustryNews');
  } else {
    // Mirrors Login.tsx's nextScreen() reset — MainBottomTab becomes the
    // only entry in history, so there's no way to "back" into the Login
    // screen from a session that's now genuinely signed in.
    navigationRef.dispatch(
      CommonActions.reset({index: 0, routes: [{name: 'MainBottomTab'}]}),
    );
  }
}

function queueOrNavigate(nav: PendingNavigation): void {
  if (!navigationRef.isReady()) {
    pendingNavigation = nav;
    return;
  }
  runNavigation(nav);
}

// Every job-alert tap path (JobAlerts list, notification bell, push tap,
// shared-job deep link landing) lands here first — the in-app job details
// screen (src/more/JobAlertDetails.tsx), whose own "Apply on {source}"
// button is what actually opens the real posting via
// navigateToJobAlertWebView below. There was a brief period where every
// call site skipped straight to the WebView instead (to cut the extra tap)
// — reverted per explicit follow-up request, back to this details-first
// flow everywhere.
export function navigateToJobAlertDetails(job: JobAlertProps): void {
  queueOrNavigate({name: 'JobAlertDetails', params: {job}});
}

// Reached from JobAlertDetails.tsx's "Apply on {source}" button (the one
// action that actually leaves the details screen) — not navigated to
// directly by any push/notification/list tap path itself; those all go
// through navigateToJobAlertDetails above.
export function navigateToJobAlertWebView(job: JobAlertProps): void {
  queueOrNavigate({
    name: 'WebViewScreen',
    params: {
      url: job.applyUrl,
      title: job.title,
      job: {
        company: job.company,
        role: job.title,
        applyUrl: job.applyUrl,
        companyLogoUrl: job.companyLogoUrl,
      },
    },
  });
}

/** Generic fallback destination for any non-job-alert push tap — see
 * services/pushNotificationService.ts's handleNotificationTap. */
export function navigateToNotifications(): void {
  queueOrNavigate({name: 'Notification'});
}

/** Weekly Career Report push tap (Saveur-Backend's
 * career_report_service.send_weekly_report_broadcast sends
 * data.type = "weekly_career_report") — takes the user straight to the
 * report screen (src/more/WeeklyCareerReport.tsx) instead of the generic
 * in-app notification list. */
export function navigateToWeeklyCareerReport(): void {
  queueOrNavigate({name: 'WeeklyCareerReport'});
}

/** Daily Industry News push tap (Saveur-Backend's
 * news_service.send_daily_news_broadcast sends
 * data.type = "daily_industry_news") — takes the user straight to the news
 * screen (src/more/DailyIndustryNews.tsx) instead of the generic in-app
 * notification list. */
export function navigateToDailyIndustryNews(): void {
  queueOrNavigate({name: 'DailyIndustryNews'});
}

/** See the ResetToMain case in PendingNavigation above — call once a cold-
 * start LinkedIn sign-in (or any other listener-driven sign-in with no
 * button handler in scope) has actually completed. */
export function resetToMainAfterExternalSignIn(): void {
  queueOrNavigate({name: 'ResetToMain'});
}

export function flushPendingNavigation(): void {
  if (!pendingNavigation || !navigationRef.isReady()) return;
  const nav = pendingNavigation;
  pendingNavigation = null;
  runNavigation(nav);
}
