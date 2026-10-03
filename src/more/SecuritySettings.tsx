import React, {memo} from 'react';
import {Alert, Image, ImageStyle, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, Toggle, Button, Input, Spinner} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';
import auth from '@react-native-firebase/auth';

import Text from 'components/Text';
import SectionTitle from 'components/SectionTitle';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import {globalStyle} from 'styles/globalStyle';
import * as biometricAuthService from 'services/biometricAuthService';
import * as twoFactorService from 'services/twoFactorService';
import * as authService from 'services/authService';
import {AuthContext} from '../../AuthContext';
import CtaButton from 'components/CtaButton';
import {Images} from 'assets/images';

// Same password-strength policy as utils/rules.ts's RulePassword and
// Saveur-Backend/app/api/users.py's change_password — kept in sync
// deliberately rather than only relying on the backend's own 400.
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,16}$/;

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

  // --- Update password ---
  // Only accounts that actually have a password (i.e. signed up/in with
  // email+password) can change one — a Google/Apple/LinkedIn-only account
  // has no password on file, and the backend's verify-current-password step
  // would just always fail "incorrect" for them, which reads as a bug
  // rather than the truth ("there's nothing to change"). Checked once from
  // Firebase's own provider list rather than guessed from anything backend
  // profile state tracks.
  const hasPasswordProvider = React.useMemo(
    () => (auth().currentUser?.providerData ?? []).some((p: any) => p?.providerId === 'password'),
    [],
  );
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [pwBusy, setPwBusy] = React.useState(false);

  const onStartChangePassword = React.useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsChangingPassword(true);
  }, []);

  const onCancelChangePassword = React.useCallback(() => {
    setIsChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, []);

  const onSubmitChangePassword = React.useCallback(async () => {
    if (pwBusy) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(
        t('more:change_password_missing_title', {defaultValue: 'Missing information'}),
        t('more:change_password_missing_body', {defaultValue: 'Enter your current password and a new password.'}).toString(),
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(
        t('more:change_password_mismatch_title', {defaultValue: "Passwords don't match"}),
        t('more:change_password_mismatch_body', {defaultValue: 'Your new password and confirmation must be the same.'}).toString(),
      );
      return;
    }
    if (!PASSWORD_PATTERN.test(newPassword)) {
      Alert.alert(
        t('more:change_password_weak_title', {defaultValue: 'Password too weak'}),
        t('auth:err_password_pattern', {
          defaultValue: 'Password must include an uppercase letter, a lowercase letter, a number, and a special character (e.g. ! @ # $ %).',
        }).toString(),
      );
      return;
    }
    setPwBusy(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(
        t('more:change_password_success_title', {defaultValue: 'Password updated'}),
        t('more:change_password_success_body', {defaultValue: "You'll use your new password next time you sign in."}).toString(),
      );
    } catch (error: any) {
      Alert.alert(
        t('more:change_password_failed_title', {defaultValue: "Couldn't update your password"}),
        error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setPwBusy(false);
    }
  }, [pwBusy, currentPassword, newPassword, confirmPassword, t]);

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
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        {/* Product request: "In the security screen add the shield icon
            there i.e one of those icons i uploaded" -- a centered hero
            icon at the top of the screen, the same real illustrated shield
            from the icon pack already used elsewhere in this app
            (assets/images/index.ts's iconShield). Plain <Image>, no
            tintColor -- full-color source art, not a tintable glyph. */}
        <View style={styles.heroIconWrap}>
          <Image source={Images.iconShield} resizeMode="contain" style={styles.heroIcon as ImageStyle} />
        </View>
        <SectionTitle mt={0} mb={12}>
          {t('more:biometric_section_title', {defaultValue: 'App Lock'})}
        </SectionTitle>
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

        <SectionTitle mt={0} mb={4}>
          {t('more:two_factor_section_title', {defaultValue: 'Two-Factor Authentication'})}
        </SectionTitle>
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
              style={[globalStyle.inputField, {marginBottom: 12}]}
              textStyle={globalStyle.inputText}
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

        <SectionTitle mt={32} mb={4}>
          {t('more:change_password_section_title', {defaultValue: 'Password'})}
        </SectionTitle>
        {!hasPasswordProvider ? (
          <Text category="h10" status="placeholder" mb={8}>
            {t('more:change_password_no_provider', {
              defaultValue: "You signed in with a social account, so there's no password to update here.",
            })}
          </Text>
        ) : isChangingPassword ? (
          <View>
            <Input
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder={t('more:current_password_placeholder', {defaultValue: 'Current password'}).toString()}
              secureTextEntry
              style={[globalStyle.inputField, {marginBottom: 12}]}
              textStyle={globalStyle.inputText}
            />
            <Input
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={t('more:new_password_placeholder', {defaultValue: 'New password'}).toString()}
              secureTextEntry
              style={[globalStyle.inputField, {marginBottom: 12}]}
              textStyle={globalStyle.inputText}
            />
            <Input
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('more:confirm_new_password_placeholder', {defaultValue: 'Confirm new password'}).toString()}
              secureTextEntry
              style={[globalStyle.inputField, {marginBottom: 12}]}
              textStyle={globalStyle.inputText}
            />
            <Flex justify="space-between" itemsCenter>
              <Button appearance="ghost" status="basic" disabled={pwBusy} onPress={onCancelChangePassword}>
                {t('common:cancel', {defaultValue: 'Cancel'})}
              </Button>
              <CtaButton disabled={pwBusy} onPress={onSubmitChangePassword}>
                {pwBusy
                  ? t('more:change_password_saving', {defaultValue: 'Updating…'})
                  : t('more:change_password_confirm', {defaultValue: 'Update password'})}
              </CtaButton>
            </Flex>
          </View>
        ) : (
          <CtaButton onPress={onStartChangePassword}>
            {t('more:change_password_start', {defaultValue: 'Update password'})}
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
  heroIconWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroIcon: {
    width: 64,
    height: 64,
  },
});
