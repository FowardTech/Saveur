/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Must be registered here, outside any component, before
// AppRegistry.registerComponent — @react-native-firebase/messaging requires
// this to exist or it logs a warning, and it's the hook Android uses to wake
// the app for a data-only push while backgrounded/killed. Otherwise
// deliberately a no-op: the `notification` block on a real push is already
// shown by the OS while backgrounded, and the actual "route to Job Details"
// logic only runs on tap (see services/pushNotificationService.ts's
// onNotificationOpenedApp / getInitialNotification handlers, wired from
// App.tsx), not on mere receipt.
//
// The one thing this DOES need to do on receipt (not just on tap): update
// the app-icon badge count. iOS gets this for free from the push's own
// `aps.badge` field (APNs applies it to the icon itself, no app code
// involved, background or not — see Saveur-Backend's push_service.py). //
// Android has no such OS-level mechanism — nothing sets the launcher badge
// unless app code explicitly calls it, and this background handler is the
// only code that runs at all for a backgrounded/killed-app Android push. Bug
// report this fixes (Android half of it): "Saveur's app icon doesn't show a
// notification badge count like other apps do." notifee.setBadgeCount is a
// no-op on unsupported Android launchers, and is harmless/redundant (but not
// wrong) to also call on iOS.
messaging().setBackgroundMessageHandler(async remoteMessage => {
  const raw = remoteMessage?.data?.badge_count;
  const count = raw !== undefined ? Number(raw) : NaN;
  if (Number.isFinite(count)) {
    try {
      await notifee.setBadgeCount(count);
    } catch (err) {
      console.warn('[push] setBadgeCount (background) failed', err);
    }
  }
});

AppRegistry.registerComponent(appName, () => App);
