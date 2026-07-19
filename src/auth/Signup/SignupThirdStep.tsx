import React, {memo} from 'react';
import {Alert, TouchableOpacity, View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Input,
  Icon,
  Button,
} from '@ui-kitten/components';
import {NavigationProp, RouteProp, useNavigation, useRoute} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import {Controller, useForm} from 'react-hook-form';
import {RuleEmail, RuleName, RulePassword} from 'utils/rules';
import useToggle from 'hooks/useToggle';
import AnimatedAppearance from 'components/AnimatedAppearance';
import {AuthStackParamList, RootStackParamList} from 'navigation/types';
import {AuthContext} from '../../../AuthContext';

const SignupThirdStep = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'SignupThirdStep'>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['auth', 'success', 'common']);
  const {signUp, signInWithGoogle, signInWithApple, updateProfile} = React.useContext(AuthContext);

  const {goals, industries, preferredCountries} = route.params ?? {};

  const [invisible, setInvisible] = useToggle(true);
  const [canContinue, setContinue] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm({
    defaultValues: {
      full_name: '',
      email: 'lehieuds@gmail.com',
      password: '123456Aa',
    },
  });
  React.useEffect(() => {
    if (
      errors.email === undefined &&
      errors.password === undefined &&
      errors.full_name === undefined
    ) {
      setContinue(true);
    } else {
      setContinue(false);
    }
  }, [errors.email, errors.password, errors.full_name]);

  // Shared by email/password signup and both social sign-ins below — once an
  // account exists, everyone sees the same "pick a plan" onboarding step
  // before the celebratory success screen. The success payload is threaded
  // through as a param so Subscription can hand off to it once the user
  // subscribes or taps "Skip for now".
  const goToSubscription = React.useCallback(() => {
    navigate('Subscription', {
      fromOnboarding: true,
      onboardingSuccessPayload: {
        title: t('success:title_2'),
        logo: true,
        description: t('success:description_2'),
        children: [
          {
            title: t('success:see_your_dashboard'),
            onPress: () => navigate('MainBottomTab'),
            status: 'outline',
          },
          {
            title: t('success:start_practicing', {defaultValue: 'Start Practicing'}),
            onPress: () => navigate('MockInterviewSetup', {}),
            status: 'basic',
          },
        ],
        buttonsViewStyle: {marginHorizontal: 68},
      },
    });
  }, [navigate, t]);

  const handleSignup = handleSubmit(async data => {
    setIsSubmitting(true);
    try {
      await signUp({
        email: data.email,
        password: data.password,
        name: data.full_name,
        goals,
        industries,
        preferredCountries,
      });
      goToSubscription();
    } catch (e: any) {
      // Real Firebase Auth can now actually fail (email already in use, weak
      // password, network error) — surface it instead of swallowing it.
      Alert.alert(
        t('auth:sign_up_failed', {defaultValue: 'Sign up failed'}),
        e?.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  const onSocialComingSoon = React.useCallback((provider: string) => {
    Alert.alert(
      t('common:coming_soon', {defaultValue: 'Coming soon'}),
      `${provider} sign-up isn't connected yet — use email for now.`,
    );
  }, [t]);
  const [isSocialSubmitting, setIsSocialSubmitting] = React.useState(false);
  const onGoogle = React.useCallback(async () => {
    if (isSocialSubmitting) return;
    setIsSocialSubmitting(true);
    try {
      await signInWithGoogle();
      // signInWithGoogle only provisions the bare profile (POST /api/users/me)
      // — the onboarding data collected in the earlier steps
      // (goals/industries/preferredCountries) still needs an explicit PATCH,
      // same as the email/password path does via signUp().
      await updateProfile({goals, industries, preferredCountries});
      goToSubscription();
    } catch (e: any) {
      Alert.alert(
        t('auth:sign_up_failed', {defaultValue: 'Sign up failed'}),
        e?.message ?? 'Google sign-up was cancelled or failed.',
      );
    } finally {
      setIsSocialSubmitting(false);
    }
  }, [signInWithGoogle, updateProfile, goals, industries, preferredCountries, goToSubscription, isSocialSubmitting, t]);
  const onApple = React.useCallback(async () => {
    if (isSocialSubmitting) return;
    setIsSocialSubmitting(true);
    try {
      await signInWithApple();
      await updateProfile({goals, industries, preferredCountries});
      goToSubscription();
    } catch (e: any) {
      Alert.alert(
        t('auth:sign_up_failed', {defaultValue: 'Sign up failed'}),
        e?.message ?? 'Apple sign-up was cancelled or failed.',
      );
    } finally {
      setIsSocialSubmitting(false);
    }
  }, [signInWithApple, updateProfile, goals, industries, preferredCountries, goToSubscription, isSocialSubmitting, t]);
  // LinkedIn has no first-party Firebase/RN SDK — stays "coming soon" until
  // a custom OAuth2 flow is built (see docs/BACKEND_API_SPEC.md §2).
  const onLinkedInComingSoon = React.useCallback(() => onSocialComingSoon('LinkedIn'), [onSocialComingSoon]);
  return (
    <Container style={styles.container}>
      <TopNavigation accessoryLeft={<NavigationAction />} />
      <AnimatedAppearance>
        <Content padder contentContainerStyle={styles.content}>
          <Text mt={16}>{t('auth:heading_signup_3')}</Text>
          <Text mt={8} mb={16} category="h2">
            {t('auth:title_signup_3')}
          </Text>
          <Text mt={8} mb={48}>
            {t('auth:description_signup_3')}
          </Text>
          <Controller
            control={control}
            name="full_name"
            rules={RuleName}
            render={({field: {onChange, onBlur, value}}) => (
              <Input
                label={t('auth:full_name').toString()}
                status={errors.full_name ? 'warning' : 'basic'}
                style={styles.input}
                value={value}
                onChangeText={onChange}
                onTouchStart={handleSubmit(() => {})}
                onTouchEnd={handleSubmit(() => {})}
                onBlur={onBlur}
                keyboardType="email-address"
                caption={errors.full_name?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="email"
            rules={RuleEmail}
            render={({field: {onChange, onBlur, value}}) => (
              <Input
                label={t('auth:email').toString()}
                status={errors.email ? 'warning' : 'basic'}
                style={styles.input}
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
          <Controller
            control={control}
            name="password"
            rules={RulePassword}
            render={({field: {onChange, onBlur, value}}) => (
              <Input
                label={t('auth:password').toString()}
                status={errors.password ? 'warning' : 'basic'}
                style={styles.input}
                value={value}
                onTouchStart={handleSubmit(() => {})}
                onTouchEnd={handleSubmit(() => {})}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                caption={errors.password?.message}
                secureTextEntry={invisible}
                accessoryRight={props => (
                  <TouchableOpacity activeOpacity={0.7} onPress={setInvisible}>
                    <Icon
                      {...props}
                      pack="assets"
                      name={!invisible ? 'eyeOn' : 'eyeOff'}
                    />
                  </TouchableOpacity>
                )}
              />
            )}
          />
          <Button
            children={isSubmitting ? `${t('auth:sign_up')}…` : t('auth:sign_up')}
            onPress={handleSignup}
            disabled={!canContinue || isSubmitting}
          />

          <Text category="h8-s" status={'placeholder'} mt={32} mb={24} center>
            {t('auth:or')}
          </Text>
          <View style={styles.social}>
            <Icon pack="eva" name={'globe-2-outline'} style={styles.logoSocial} />
            <Button
              status="outline"
              disabled={isSocialSubmitting}
              onPress={onGoogle}
              children={<Text>{`${t('auth:google_login')}`}</Text>}
            />
          </View>
          <View style={styles.social}>
            <Icon pack="eva" name={'smartphone-outline'} style={styles.logoSocial} />
            <Button
              status="outline"
              disabled={isSocialSubmitting}
              onPress={onApple}
              children={<Text>{`${t('auth:apple_login')}`}</Text>}
            />
          </View>
          <View>
            <Icon pack="eva" name={'briefcase-outline'} style={styles.logoSocial} />
            <Button
              status="outline"
              onPress={onLinkedInComingSoon}
              children={<Text>{`${t('auth:linkedin_login')}`}</Text>}
            />
          </View>
        </Content>
      </AnimatedAppearance>
    </Container>
  );
});

export default SignupThirdStep;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 48,
  },
  input: {
    borderBottomWidth: 2,
    marginBottom: 24,
  },
  social: {
    marginBottom: 16,
  },
  logoSocial: {
    position: 'absolute',
    left: 16,
    top: 14,
  },
});
