import React, {memo} from 'react';
import {Alert, View} from 'react-native';
import {StyleService, useStyleSheet, useTheme, Input, Icon, Button, Spinner} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Container from 'components/Container';
import Content from 'components/Content';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';
import {AuthContext} from '../../AuthContext';

// Full-screen gate rendered by navigation/AppContainer.tsx whenever
// AuthContext.twoFactorPending is true — i.e. the user is Firebase-
// authenticated but hasn't entered their emailed 2FA code yet. Not a
// react-navigation screen (no back button, no way to reach the rest of the
// app around it) since there's nothing to navigate to until this resolves.
const TwoFactorVerify = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['auth', 'common']);
  const {twoFactorEmailHint, verifyTwoFactorLogin, resendTwoFactorLoginCode, cancelTwoFactorLogin} =
    React.useContext(AuthContext);

  const [code, setCode] = React.useState('');
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);

  const onVerify = React.useCallback(async () => {
    if (isVerifying || code.length < 6) return;
    setIsVerifying(true);
    try {
      await verifyTwoFactorLogin(code);
    } catch (error: any) {
      setCode('');
      Alert.alert(
        t('auth:two_factor_failed_title', {defaultValue: "That code didn't work"}),
        error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setIsVerifying(false);
    }
  }, [code, isVerifying, verifyTwoFactorLogin, t]);

  const onResend = React.useCallback(async () => {
    if (isResending) return;
    setIsResending(true);
    try {
      await resendTwoFactorLoginCode();
      Alert.alert(
        t('auth:two_factor_resent_title', {defaultValue: 'Code sent'}),
        t('auth:two_factor_resent_body', {defaultValue: 'Check your inbox for a new code.'}),
      );
    } catch (error: any) {
      Alert.alert(
        t('auth:two_factor_resend_failed_title', {defaultValue: "Couldn't send a new code"}),
        error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setIsResending(false);
    }
  }, [isResending, resendTwoFactorLoginCode, t]);

  const onCancel = React.useCallback(async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelTwoFactorLogin();
    } finally {
      setIsCancelling(false);
    }
  }, [isCancelling, cancelTwoFactorLogin]);

  return (
    <Container style={styles.container}>
      <Content padder contentContainerStyle={styles.content}>
        <Flex vertical itemsCenter justify="center">
          <View style={[styles.iconCircle, {backgroundColor: theme['color-primary-transparent-200']}]}>
            <Icon
              pack="eva"
              name="shield-outline"
              style={[globalStyle.icon40, {tintColor: theme['color-primary-500']}]}
            />
          </View>
          <Text category="h5" bold center mt={20}>
            {t('auth:two_factor_title', {defaultValue: 'Enter your code'})}
          </Text>
          <Text category="h8" status="placeholder" center mt={10} maxWidth={320}>
            {twoFactorEmailHint
              ? t('auth:two_factor_body_with_email', {
                  defaultValue: 'We sent a 6-digit code to {{email}}.',
                  email: twoFactorEmailHint,
                })
              : t('auth:two_factor_body', {defaultValue: 'We sent a 6-digit code to your email.'})}
          </Text>
          <Input
            value={code}
            onChangeText={value => setCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            style={styles.codeInput}
            textStyle={styles.codeInputText}
            autoFocus
          />
          <Button
            style={styles.verifyButton}
            disabled={code.length < 6 || isVerifying}
            onPress={onVerify}
            accessoryLeft={isVerifying ? () => <Spinner size="small" status="control" /> : undefined}>
            {isVerifying
              ? t('auth:two_factor_verifying', {defaultValue: 'Verifying…'})
              : t('auth:two_factor_verify', {defaultValue: 'Verify'})}
          </Button>
          <Button
            appearance="ghost"
            status="basic"
            disabled={isResending}
            onPress={onResend}
            style={{marginTop: 8}}>
            {isResending
              ? t('auth:two_factor_resending', {defaultValue: 'Sending…'})
              : t('auth:two_factor_resend', {defaultValue: 'Resend code'})}
          </Button>
          <Button
            appearance="ghost"
            status="danger"
            disabled={isCancelling}
            onPress={onCancel}
            style={{marginTop: 4}}>
            {t('auth:two_factor_cancel', {defaultValue: 'Sign out'})}
          </Button>
        </Flex>
      </Content>
    </Container>
  );
});

export default TwoFactorVerify;

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
  codeInput: {
    marginTop: 28,
    width: '100%',
  },
  codeInputText: {
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '700',
    textAlign: 'center',
  },
  verifyButton: {
    marginTop: 20,
    width: '100%',
  },
});
