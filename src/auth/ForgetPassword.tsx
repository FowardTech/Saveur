import React, {memo} from 'react';
import {Alert} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Input,
  Button,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import {Controller, useForm} from 'react-hook-form';
import {RuleEmail} from 'utils/rules';
import {AuthStackParamList} from 'navigation/types';
import {globalStyle} from 'styles/globalStyle';
import * as emailService from 'services/emailService';

// Real Firebase-hosted password reset (POST /api/v1/email/send-password-reset
// — see services/emailService.ts). The actual password change now happens on
// Firebase's own hosted reset page in the browser after the user taps the
// emailed link, NOT in this app — so this screen no longer navigates to the
// old in-app "enter code + new password" flow (src/auth/NewPassword.tsx),
// which was always a mock with a fake "reset code" field that had no real
// backend meaning. That screen/route is left registered but unreachable
// rather than deleted, in case it's repurposed later.
const ForgetPassword = memo(() => {
  useNavigation<NavigationProp<AuthStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['auth', 'common']);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const {
    control,
    handleSubmit,
    getValues,
    formState: {errors},
  } = useForm({
    defaultValues: {
      email: 'lehieuds@gmail.com',
    },
  });

  const onSend = handleSubmit(async ({email}) => {
    setIsSubmitting(true);
    try {
      await emailService.sendPasswordReset(email);
      // Backend always responds {sent: true} regardless of whether the
      // address has an account (avoids leaking account existence) — so this
      // confirmation shows unconditionally on a successful call, same as the
      // backend's own behavior.
      setSent(true);
    } catch (e: any) {
      Alert.alert(
        t('auth:reset_email_failed_title', {defaultValue: 'Could not send that'}),
        e?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Container style={styles.container}>
      <TopNavigation accessoryLeft={<NavigationAction />} />

      <Content padder contentContainerStyle={styles.content}>
        <Text category="h2" mb={8}>
          {t('auth:forget_password')}
        </Text>
        <Text category="para-m" mb={48}>
          {t('auth:description_forget_password')}
        </Text>
        {sent ? (
          <Text category="h8-s" status="success" mb={24}>
            {t('auth:reset_email_sent', {
              defaultValue: `If an account exists for ${getValues('email')}, a reset link is on its way. Check your inbox.`,
            })}
          </Text>
        ) : (
          <Controller
            control={control}
            name="email"
            rules={RuleEmail}
            render={({field: {onChange, onBlur, value}}) => (
              <Input
                label={t('auth:email').toString()}
                status={errors.email ? 'warning' : 'basic'}
                style={styles.email}
                value={value}
                onChangeText={onChange}
                onTouchStart={handleSubmit(() => {})}
                onTouchEnd={handleSubmit(() => {})}
                onBlur={onBlur}
                keyboardType="email-address"
                caption={errors.email?.message}
              />
            )}
          />
        )}
        <Button
          children={
            sent
              ? t('auth:resend_link', {defaultValue: 'Resend link'})
              : isSubmitting
              ? `${t('auth:send_reset_link', {defaultValue: 'Send reset link'})}…`
              : t('auth:send_reset_link', {defaultValue: 'Send reset link'})
          }
          disabled={isSubmitting}
          onPress={onSend}
          style={globalStyle.shadowBtn}
        />
      </Content>
    </Container>
  );
});

export default ForgetPassword;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    marginTop: 16,
  },
  email: {
    borderBottomWidth: 2,
    marginBottom: 32,
  },
});
