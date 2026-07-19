import React from 'react';
import 'i18n/config';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox, StatusBar } from 'react-native';
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
import { StripeProvider } from '@stripe/stripe-react-native';

LogBox.ignoreLogs([
  "[react-native-gesture-handler] Seems like you're using an old API with gesture components, check out new Gestures system!",
]);
LogBox.ignoreLogs([
  "AsyncStorage has been extracted from react-native core and will be removed in a future release. It can now be installed and imported from '@react-native-async-storage/async-storage' instead of 'react-native'. See https://github.com/react-native-async-storage/async-storage",
]);
LogBox.ignoreLogs(['Constants.installationId has been deprecated']);
LogBox.ignoreLogs(["exported from 'deprecated-react-native-prop-types'."]);
export default function App() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    AsyncStorage.getItem('theme').then(value => {
      if (value === 'light' || value === 'dark') setTheme(value);
    });
  }, []);

  const toggleTheme = () => {
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
            {/* publishableKey is intentionally empty here — POST
                /api/v1/billing/payment-sheet returns the real
                publishable_key per-request (see services/billingService.ts),
                so services/stripeService.ts calls the useStripe() hook's
                initStripe() to set the real key immediately before every
                checkout, rather than this app knowing/hardcoding one at
                boot. StripeProvider still needs to wrap the tree regardless
                — useStripe()/useConfirmPayment() etc. read this context to
                reach the native module, independent of whether a key has
                been set yet. */}
            {/* No merchantIdentifier here on purpose — that's Apple Pay's
                merchant ID, which requires its own separate Apple Developer
                registration + an Xcode "Apple Pay" capability/entitlement
                that hasn't been set up. Wasn't asked for; the Payment Sheet
                works fine for card payments without it. Add it later if
                Apple Pay support is wanted. */}
            <StripeProvider publishableKey="" urlScheme="saveur">
              <AuthProvider>
                <AppContainer />
              </AuthProvider>
            </StripeProvider>
          </SafeAreaProvider>
        </ApplicationProvider>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
