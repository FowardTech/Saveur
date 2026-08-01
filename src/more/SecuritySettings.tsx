import React, {memo} from 'react';
import {Alert, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, Toggle, Button, Input, Spinner} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import * as biometricAuthService from 'services/biometricAuthService';
import * as twoFactorService from 'services/twoFactorService';
import {AuthContext} from '../../AuthContext';
import CtaButton from 'components/CtaButton';

// Reached from More > Security. Houses both device-local biometric app-lock
// (services/biometricAuthService.ts) and account-level email-code 2FA
// (services/twoFactorService.ts) — grouped together since both are "how do
// I get into my account" settings, even though one is purely on-device and
// the other is backend-enforced.
const SecuritySettings = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'auth', 'common']);
  const {profile, refreshProfile} = React.useContext(AuthContext);

  // --- Biometric app-lock ---
  const [bioAvailable, setBioAvailable] = React.useState(false);
  const [bioLabel, setBioLabel] = React.useState('Biometrics');
  const [bioEnabled, setBioEnabled] = React.useState(false);
  const [bioLoading, setBioLoading] = React.useState(true);
  const [bioBusy, setBioBusy] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const [{available, label}, enabled] = await Promise.all([
        biometricAuthService.checkAvailability(),
        biometricAuthService.isEnabled(),
      ]);
      setBioAvailable(available);
      setBioLabel(label);
      setBioEnabled(enabled && available);
      setBioLoading(false);
    })();
  }, []);

  const onToggleBiometric = React.useCallback(
    async (next: boolean) => {
      if (bioBusy) return;
      setBioBusy(true);
      try {
        if (next) {
          // Confirm the sensor actually works before persisting the setting
          // — otherwise a misconfigured/broken sensor could lock the user
          // out of the app on next launch with no way back in short of
          // reinstalling.
          const success = await biometricAuthService.prompt(
            t('more:biometric_confirm_prompt', {defaultValue: 'Confirm {{label}} to turn this on', label: bioLabel}),
          );
          if (!success) {
            Alert.alert(
              t('more:biometric_setup_failed_title', {defaultValue: "Couldn't confirm"}),
              t('more:biometric_setup_failed_body', {
                defaultValue: 'Verification failed or was cancelled — nothing was changed.',
              }),
            );
            return;
          }
        }
        await biometricAuthService.setEnabled(next);
        setBioEnabled(next);
      } finally {
        setBioBusy(false);
      }
    },
    [bioBusy, bioLabel, t],
  );

  // --- Email-code 2FA ---
  const [twoFAEnabled, setTwoFAEnabled] = React.useState(!!profile?.twoFactorEnabled);
  const [isEnabling2FA, setIsEnabling2FA] = React.useState(false);
  const [twoFACode, setTwoFACode] = React.useState('');
  const [twoFAEmailHint, setTwoFAEmailHint] = React.useState<string | null>(null);
  const [twoFABusy, setTwoFABusy] = React.useState(false);

  React.useEffect(() => {
    setTwoFAEnabled(!!profile?.twoFactorEnabled);
  }, [profile?.twoFactorEnabled]);

  const onStartEnable2FA = React.useCallback(async () => {
    if (twoFABusy) return;
    setTwoFABusy(true);
    try {
      const hint = await twoFactorService.sendCode('enable');
      setTwoFAEmailHint(hint);
      setIsEnabling2FA(true);
    } catch (error: any) {
      Alert.alert(
        t('more:two_factor_send_failed_title', {defaultValue: "Couldn't send a code"}),
        error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setTwoFABusy(false);
    }
  }, [twoFABusy, t]);

  const onConfirmEnable2FA = React.useCallback(async () => {
    if (twoFABusy || twoFACode.length < 6) return;
    setTwoFABusy(true);
    try {
      await twoFactorService.verifyCode(twoFACode, 'enable');
      setTwoFAEnabled(true);
      setIsEnabling2FA(false);
      setTwoFACode('');
      await refreshProfile();
    } catch (error: any) {
      setTwoFACode('');
      Alert.alert(
        t('more:two_factor_verify_failed_title', {defaultValue: "That code didn't work"}),
        error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setTwoFABusy(false);
    }
  }, [twoFABusy, twoFACode, refreshProfile, t]);

  const onCancelEnable2FA = React.useCallback(() => {
    setIsEnabling2FA(false);
    setTwoFACode('');
    setTwoFAEmailHint(null);
  }, []);

  const onDisable2FA = React.useCallback(() => {
    Alert.alert(
      t('more:two_factor_disable_confirm_title', {defaultValue: 'Turn off two-factor authentication?'}),
      t('more:two_factor_disable_confirm_body', {
        defaultValue: 'Your account will only need your password to sign in.',
      }),
      [
        {text: t('common:cancel', {defaultValue: 'Cancel'}), style: 'cancel'},
        {
          text: t('more:two_factor_disable', {defaultValue: 'Turn off'}),
          style: 'destructive',
          onPress: async () => {
            if (twoFABusy) return;
            setTwoFABusy(true);
            try {
              await twoFactorService.disable();
              setTwoFAEnabled(false);
              await refreshProfile();
            } catch (error: any) {
              Alert.alert(
                t('more:two_factor_disable_failed_title', {defaultValue: "Couldn't turn it off"}),
                error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
              );
            } finally {
              setTwoFABusy(false);
            }
          },
        },
      ],
    );
  }, [twoFABusy, refreshProfile, t]);

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('more:security', {defaultValue: 'Security'})} accessoryLeft={<NavigationAction />} />
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h9-s" bold mb={12}>
          {t('more:biometric_section_title', {defaultValue: 'App Lock'})}
        </Text>
        {bioLoading ? (
          <Spinner size="small" />
        ) : !bioAvailable ? (
          <Text category="h9" status="placeholder" mb={32}>
            {t('more:biometric_unavailable', {defaultValue: 'Biometrics are not set up on this device.'})}
          </Text>
        ) : (
          <Flex justify="space-between" itemsCenter mb={32}>
            <View style={{flex: 1, marginRight: 12}}>
              <Text category="para-m">
                {t('more:biometric_toggle_title', {defaultValue: 'Sign in with {{label}}', label: bioLabel})}
              </Text>
              <Text category="h10" status="placeholder" mt={2}>
                {t('more:biometric_toggle_body', {
                  defaultValue: 'Unlock the app with {{label}} on this device instead of relying only on your saved session.',
                  label: bioLabel,
                })}
              </Text>
            </View>
            <Toggle checked={bioEnabled} disabled={bioBusy} onChange={onToggleBiometric} status="primary" />
          </Flex>
        )}

        <Text category="h9-s" bold mb={4}>
          {t('more:two_factor_section_title', {defaultValue: 'Two-Factor Authentication'})}
        </Text>
        <Text category="h10" status="placeholder" mb={16}>
          {t('more:two_factor_section_body', {
            defaultValue: 'Require a code sent to your email whenever you sign in on a new device.',
          })}
        </Text>

        {isEnabling2FA ? (
          <View>
            <Text category="h9" mb={8}>
              {twoFAEmailHint
                ? t('auth:two_factor_body_with_email', {
                    defaultValue: 'We sent a 6-digit code to {{email}}.',
                    email: twoFAEmailHint,
                  })
                : t('auth:two_factor_body', {defaultValue: 'We sent a 6-digit code to your email.'})}
            </Text>
            <Input
              value={twoFACode}
              onChangeText={value => setTwoFACode(value.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              style={{marginBottom: 12}}
            />
            <Flex justify="space-between" itemsCenter>
              <Button appearance="ghost" status="basic" disabled={twoFABusy} onPress={onCancelEnable2FA}>
                {t('common:cancel', {defaultValue: 'Cancel'})}
              </Button>
              <CtaButton disabled={twoFABusy || twoFACode.length < 6} onPress={onConfirmEnable2FA}>
                {twoFABusy
                  ? t('more:two_factor_verifying', {defaultValue: 'Verifying…'})
                  : t('more:two_factor_confirm', {defaultValue: 'Confirm'})}
              </CtaButton>
            </Flex>
          </View>
        ) : twoFAEnabled ? (
          <Button status="danger" appearance="outline" disabled={twoFABusy} onPress={onDisable2FA}>
            {t('more:two_factor_disable', {defaultValue: 'Turn off'})}
          </Button>
        ) : (
          <CtaButton disabled={twoFABusy} onPress={onStartEnable2FA}>
            {twoFABusy
              ? t('more:two_factor_sending', {defaultValue: 'Sending…'})
              : t('more:two_factor_enable', {defaultValue: 'Turn on'})}
          </CtaButton>
        )}
      </Content>
    </Container>
  );
});

export default SecuritySettings;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 48,
  },
});
