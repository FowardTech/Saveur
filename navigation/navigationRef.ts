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
  | {name: 'Notification'}
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
  } else if (nav.name === 'Notification') {
    navigationRef.navigate('Notification');
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

export function navigateToJobAlertDetails(job: JobAlertProps): void {
  queueOrNavigate({name: 'JobAlertDetails', params: {job}});
}

/** Generic fallback destination for any non-job-alert push tap — see
 * services/pushNotificationService.ts's handleNotificationTap. */
export function navigateToNotifications(): void {
  queueOrNavigate({name: 'Notification'});
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
