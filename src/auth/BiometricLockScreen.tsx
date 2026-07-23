import React, {memo} from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet, useTheme, Icon, Button} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Container from 'components/Container';
import Content from 'components/Content';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';
import * as biometricAuthService from 'services/biometricAuthService';
import {AuthContext} from '../../AuthContext';

type Props = {
  label: string; // "Face ID" / "Touch ID" / "Fingerprint" — from checkAvailability()
  onUnlock: () => void;
};

// Full-screen gate rendered by navigation/AppContainer.tsx when the device-
// wide biometric app-lock is on (see services/biometricAuthService.ts) and
// this cold start hasn't been unlocked yet. Not a Stack.Screen — same
// reasoning as TwoFactorVerify: there's nothing to navigate around it to
// until it resolves.
const BiometricLockScreen = memo(({label, onUnlock}: Props) => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['auth', 'common']);
  const {signOut} = React.useContext(AuthContext);

  const [isPrompting, setIsPrompting] = React.useState(false);
  const [wasDenied, setWasDenied] = React.useState(false);

  const runPrompt = React.useCallback(async () => {
    if (isPrompting) return;
    setIsPrompting(true);
    setWasDenied(false);
    try {
      const success = await biometricAuthService.prompt(
        t('auth:biometric_unlock_prompt', {defaultValue: 'Unlock Saveur'}),
      );
      if (success) {
        onUnlock();
      } else {
        setWasDenied(true);
      }
    } finally {
      setIsPrompting(false);
    }
  }, [isPrompting, onUnlock, t]);

  // Auto-trigger once on mount so the user doesn't have to tap anything on
  // the common path — the retry button below only matters after a
  // cancel/failure.
  React.useEffect(() => {
    runPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No password re-entry UI here (this is a local device gate, not a
  // separate credential) — the honest fallback when someone can't/won't use
  // biometrics right now is to sign out and use the normal Login screen.
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const onUsePasswordInstead = React.useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }, [isSigningOut, signOut]);

  return (
    <Container style={styles.container}>
      <Content padder contentContainerStyle={styles.content}>
        <Flex vertical itemsCenter justify="center">
          <View style={[styles.iconCircle, {backgroundColor: theme['color-primary-transparent-200']}]}>
            <Icon
              pack="eva"
              name="lock-outline"
              style={[globalStyle.icon40, {tintColor: theme['color-primary-500']}]}
            />
          </View>
          <Text category="h5" bold center mt={20}>
            {t('auth:biometric_locked_title', {defaultValue: 'Saveur is locked'})}
          </Text>
          <Text category="h8" status="placeholder" center mt={10} maxWidth={320}>
            {wasDenied
              ? t('auth:biometric_denied_body', {
                  defaultValue: 'Verification was cancelled or failed. Try again, or sign out.',
                  label,
                })
              : t('auth:biometric_locked_body', {
                  defaultValue: 'Use {{label}} to continue.',
                  label,
                })}
          </Text>
          <Button style={styles.button} disabled={isPrompting} onPress={runPrompt}>
            {isPrompting
              ? t('auth:biometric_checking', {defaultValue: 'Checking…'})
              : t('auth:biometric_unlock', {defaultValue: 'Unlock with {{label}}', label})}
          </Button>
          <Button
            appearance="ghost"
            status="danger"
            disabled={isSigningOut}
            onPress={onUsePasswordInstead}
            style={{marginTop: 4}}>
            {t('auth:biometric_use_password', {defaultValue: 'Sign out and use password instead'})}
          </Button>
        </Flex>
      </Content>
    </Container>
  );
});

export default BiometricLockScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
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
    width: '100%',
  },
});
