/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Must be registered here, outside any component, before
// AppRegistry.registerComponent — @react-native-firebase/messaging requires
// this to exist or it logs a warning, and it's the hook Android uses to wake
// the app for a data-only push while backgrounded/killed. It's deliberately
// a no-op: the `notification` block on a real push is already shown by the
// OS while backgrounded, and the actual "route to Job Details" logic only
// runs on tap (see services/pushNotificationService.ts's
// onNotificationOpenedApp / getInitialNotification handlers, wired from
// App.tsx), not on mere receipt.
messaging().setBackgroundMessageHandler(async () => {});

AppRegistry.registerComponent(appName, () => App);
