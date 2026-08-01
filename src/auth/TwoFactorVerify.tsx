import React, {memo} from 'react';
import {Alert, TextInput, TouchableWithoutFeedback, View} from 'react-native';
import {StyleService, useStyleSheet, useTheme, Icon, Button} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Container from 'components/Container';
import Content from 'components/Content';
import Flex from 'components/Flex';
import CtaButton from 'components/CtaButton';
import {globalStyle} from 'styles/globalStyle';
import {AuthContext} from '../../AuthContext';

const CODE_LENGTH = 6;

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
  // Real input element driving the 6 visual boxes below (product request
  // item, ZipRecruiter reference — individually bordered digit boxes
  // instead of one wide text field). A single hidden TextInput capturing
  // every keystroke, rather than 6 separate focus-juggling TextInputs, so
  // `code`/setCode/onVerify/onResend/onCancel below are ALL completely
  // unchanged from before this redesign — this only replaces how the code
  // is drawn on screen, not how it's captured, which matters on a
  // security-sensitive login step. Also means SMS/email autofill (iOS/
  // Android's one-tap "use code from message" suggestion) keeps working
  // exactly as it did on the old single Input, since that's tied to a real
  // focused TextInput, not something achievable with 6 separate ones
  // without extra plumbing.
  const hiddenInputRef = React.useRef<TextInput>(null);

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
          <View style={[styles.iconCircle, {backgroundColor: theme['background-basic-color-2']}]}>
            <Icon
              pack="eva"
              name="shield-outline"
              style={[globalStyle.icon40, {tintColor: theme['text-basic-color']}]}
            />
          </View>
          <Text category="h3" bold center mt={20}>
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
          {/* 6 bordered boxes (product request item, ZipRecruiter
              reference) sitting on top of one hidden real TextInput — see
              hiddenInputRef's own comment above for why. Tapping anywhere
              in the row focuses the hidden input, same as tapping the old
              single Input would have. */}
          <TouchableWithoutFeedback onPress={() => hiddenInputRef.current?.focus()}>
            <View style={styles.codeRow}>
              {Array.from({length: CODE_LENGTH}).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.codeBox,
                    {borderColor: code.length === i ? theme['color-accent-purple'] : theme['border-card-default']},
                  ]}>
                  <Text category="h3" bold center>
                    {code[i] ?? ''}
                  </Text>
                </View>
              ))}
            </View>
          </TouchableWithoutFeedback>
          <TextInput
            ref={hiddenInputRef}
            value={code}
            onChangeText={value => setCode(value.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH))}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
            // Real, focusable, and actually receiving text (so OS
            // autofill/one-time-code suggestions still work) — just
            // rendered with zero visible footprint since the 6 boxes above
            // are what the user actually sees.
            style={styles.hiddenInput}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
          />
          <CtaButton
            style={styles.verifyButton}
            disabled={code.length < CODE_LENGTH || isVerifying}
            onPress={onVerify}
            loading={isVerifying}>
            {isVerifying
              ? t('auth:two_factor_verifying', {defaultValue: 'Verifying…'})
              : t('auth:two_factor_verify', {defaultValue: 'Verify'})}
          </CtaButton>
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
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 28,
  },
  codeBox: {
    width: 46,
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Zero visible footprint (not display:none -- that would stop it from
  // being focusable/receiving text on some RN/Android versions) but a
  // real, focused, keyboard-driving TextInput underneath the 6 boxes.
  hiddenInput: {
    position: 'absolute',
    height: 0,
    width: 0,
    opacity: 0,
  },
  verifyButton: {
    marginTop: 20,
    width: '100%',
  },
});
