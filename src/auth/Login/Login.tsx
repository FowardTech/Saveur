import React, {memo} from 'react';
import {Alert, View, TouchableOpacity} from 'react-native';

import {
  StyleService,
  useStyleSheet,
  Input,
  Icon,
  Button,
} from '@ui-kitten/components';
import {
  CommonActions,
  NavigationProp,
  useNavigation,
} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import BrandWordmark from 'components/BrandWordmark';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {Controller, useForm} from 'react-hook-form';
import {RuleEmail, RulePassword} from 'utils/rules';
import useToggle from 'hooks/useToggle';
import Flex from 'components/Flex';
import {RootStackParamList} from 'navigation/types';
import {globalStyle} from 'styles/globalStyle';
import {AuthContext} from '../../../AuthContext';

const Login = memo(() => {
  const {navigate, dispatch} =
    useNavigation<NavigationProp<RootStackParamList>>();
  const {bottom} = useLayout();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['auth', 'common']);
  const {signIn, signInWithGoogle, signInWithApple} = React.useContext(AuthContext);

  const nextScreen = React.useCallback((screenName: string) => {
    const resetAction = CommonActions.reset({
      index: 1,
      routes: [
        {
          name: screenName,
        },
      ],
    });
    dispatch(resetAction);
  }, [dispatch]);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [invisible, setInvisible] = useToggle(true);
  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm({
    defaultValues: {
      email: 'lehieuds@gmail.com',
      password: '123456Aa',
    },
  });
  const [canContinue, setCanContinue] = React.useState(false);
  React.useEffect(() => {
    if (errors.email === undefined && errors.password === undefined) {
      setCanContinue(false);
    } else {
      setCanContinue(true);
    }
  }, [errors.email, errors.password]);

  const onLogin = handleSubmit(async ({email, password}) => {
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      nextScreen('MainBottomTab');
    } catch (e: any) {
      // Real Firebase Auth can now actually fail (wrong password, no such
      // account, network error) — surface it instead of swallowing it.
      Alert.alert(
        t('auth:sign_in_failed', {defaultValue: 'Sign in failed'}),
        e?.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  });
  const onSocialComingSoon = React.useCallback((provider: string) => {
    Alert.alert(
      t('common:coming_soon', {defaultValue: 'Coming soon'}),
      `${provider} sign-in isn't connected yet — use email for now.`,
    );
  }, [t]);
  const [isSocialSubmitting, setIsSocialSubmitting] = React.useState(false);
  const onGoogle = React.useCallback(async () => {
    if (isSocialSubmitting) return;
    setIsSocialSubmitting(true);
    try {
      await signInWithGoogle();
      nextScreen('MainBottomTab');
    } catch (e: any) {
      Alert.alert(
        t('auth:sign_in_failed', {defaultValue: 'Sign in failed'}),
        e?.message ?? 'Google sign-in was cancelled or failed.',
      );
    } finally {
      setIsSocialSubmitting(false);
    }
  }, [signInWithGoogle, nextScreen, isSocialSubmitting, t]);
  const onApple = React.useCallback(async () => {
    if (isSocialSubmitting) return;
    setIsSocialSubmitting(true);
    try {
      await signInWithApple();
      nextScreen('MainBottomTab');
    } catch (e: any) {
      Alert.alert(
        t('auth:sign_in_failed', {defaultValue: 'Sign in failed'}),
        e?.message ?? 'Apple sign-in was cancelled or failed.',
      );
    } finally {
      setIsSocialSubmitting(false);
    }
  }, [signInWithApple, nextScreen, isSocialSubmitting, t]);
  // LinkedIn has no first-party Firebase/RN SDK — stays a clear "coming
  // soon" until a custom OAuth2 flow is built for it (see
  // docs/BACKEND_API_SPEC.md §2).
  const onLinkedIn = React.useCallback(() => onSocialComingSoon('LinkedIn'), [onSocialComingSoon]);
  const onAuth = React.useCallback(
    screen => () => {
      navigate('AuthStack', {screen: screen});
    },
    [navigate],
  );
  return (
    <Container style={styles.container}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <BrandWordmark size={44} />
        <Text mt={24} category="h7" mb={72}>
          {t('auth:welcome_back')}
        </Text>
        {/* TODO: no real authentication wired up — Login always succeeds. */}
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
        <Controller
          control={control}
          name="password"
          rules={RulePassword}
          render={({field: {onChange, onBlur, value}}) => (
            <Input
              label={t('auth:password').toString()}
              status={errors.password ? 'warning' : 'basic'}
              style={styles.password}
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
        <TouchableOpacity
          activeOpacity={0.54}
          onPress={onAuth('ForgetPassword')}
          style={styles.forgetPass}>
          <Text category="h8-s" status={'placeholder'} mv={24} center underline>
            {t('auth:forgot_password')}?
          </Text>
        </TouchableOpacity>
        <Button
          onPress={onLogin}
          disabled={canContinue || isSubmitting}
          style={globalStyle.shadowBtn}>
          {isSubmitting ? `${t('auth:login').toString()}…` : t('auth:login').toString()}
        </Button>
        <Text category="h8-s" status={'placeholder'} mt={40} mb={24} center>
          {t('auth:or')}
        </Text>
        <View style={styles.facebook}>
          <Icon pack="eva" name={'globe-2-outline'} style={styles.logoSocial} />
          <Button
            status="outline"
            disabled={isSocialSubmitting}
            onPress={onGoogle}
            children={<Text>{`${t('auth:google_login')}`}</Text>}
          />
        </View>
        <View style={styles.facebook}>
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
            onPress={onLinkedIn}
            children={<Text>{`${t('auth:linkedin_login')}`}</Text>}
          />
        </View>
      </KeyboardAwareScrollView>
      <Flex center mb={bottom + 16} style={styles.bottom}>
        <Text category="h8-s">{t('auth:dont_have_an_account')}</Text>
        <TouchableOpacity activeOpacity={0.54} onPress={onAuth('SignupFirstStep')}>
          <Text status={'link'} category="h8-s">
            {t('auth:sign_up')}
          </Text>
        </TouchableOpacity>
      </Flex>
    </Container>
  );
});

export default Login;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingBottom: 0,
  },
  content: {
    marginTop: 40,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  email: {
    borderBottomWidth: 2,
    marginBottom: 24,
  },
  password: {
    borderBottomWidth: 2,
  },
  facebook: {
    marginBottom: 16,
    flex: 1,
  },
  logoSocial: {
    position: 'absolute',
    left: 16,
    top: 14,
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
  },
  forgetPass: {
    alignSelf: 'center',
  },
});
