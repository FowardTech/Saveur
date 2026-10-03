import React, {memo} from 'react';
import {Alert, View, TouchableOpacity} from 'react-native';

import {
  StyleService,
  useStyleSheet,
  Input,
  Icon,
  CheckBox,
} from '@ui-kitten/components';
import {
  CommonActions,
  NavigationProp,
  useNavigation,
} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import TermsCheckBox from 'components/TermsCheckBox';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import BrandWordmark from 'components/BrandWordmark';
import CtaButton from 'components/CtaButton';
import SocialAuthButton from 'components/SocialAuthButton';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {Controller, useForm} from 'react-hook-form';
import {RuleEmail, RulePassword} from 'utils/rules';
import useToggle from 'hooks/useToggle';
import Flex from 'components/Flex';
import {RootStackParamList} from 'navigation/types';
import {globalStyle} from 'styles/globalStyle';
import {mapFirebaseAuthError} from 'utils/authErrors';
import {AuthContext} from '../../../AuthContext';

const Login = memo(() => {
  const {navigate, dispatch} =
    useNavigation<NavigationProp<RootStackParamList>>();
  const {bottom} = useLayout();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['auth', 'common']);
  const {signIn, signInWithGoogle, signInWithLinkedIn} = React.useContext(AuthContext);

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
  // Terms & Privacy Policy acceptance (product request item) — required
  // before ANY sign-in path completes, not just email/password, since
  // Google and LinkedIn are equally "logging in". Unchecked by default on
  // every visit (not persisted) so a returning user re-affirms it each
  // session, same as re-typing a password rather than it being
  // autofilled/remembered.
  const [agreedToTerms, setAgreedToTerms] = React.useState(false);
  const requireTermsAcceptance = React.useCallback((): boolean => {
    if (agreedToTerms) return true;
    Alert.alert(
      t('auth:must_accept_terms_title', {defaultValue: 'Terms required'}),
      t('auth:must_accept_terms_body', {
        defaultValue: 'Please accept the Terms of Service and Privacy Policy to continue.',
      }),
    );
    return false;
  }, [agreedToTerms, t]);
  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm({
    // Was hardcoded to a leftover template account (same class of bug as
    // EditProfile's old "Edith Johnson" fake data) — every visit to this
    // screen silently prefilled someone else's login. Should always start
    // blank.
    defaultValues: {
      email: '',
      password: '',
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
    if (!requireTermsAcceptance()) return;
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      nextScreen('MainBottomTab');
    } catch (e: any) {
      // Real Firebase Auth can now actually fail (wrong password, no such
      // account, network error) — surface it instead of swallowing it.
      Alert.alert(
        t('auth:sign_in_failed', {defaultValue: 'Sign in failed'}),
        mapFirebaseAuthError(e),
      );
    } finally {
      setIsSubmitting(false);
    }
  });
  const [isSocialSubmitting, setIsSocialSubmitting] = React.useState(false);
  const onGoogle = React.useCallback(async () => {
    if (isSocialSubmitting) return;
    if (!requireTermsAcceptance()) return;
    setIsSocialSubmitting(true);
    try {
      await signInWithGoogle();
      nextScreen('MainBottomTab');
    } catch (e: any) {
      // mapFirebaseAuthError swallows anything not in its known-codes list
      // (e.g. GoogleSignin's native statusCodes like SIGN_IN_FAILED/12500)
      // down to a generic fallback string, and nothing was ever logging the
      // raw error — so a real native failure code never reached logcat or
      // the Metro terminal, only ever a friendly Alert with no diagnostic
      // value. Logging it here (console.warn shows up directly in the Metro
      // bundler terminal, no logcat grepping needed) surfaces e.code/e.message
      // /e.nativeErrorMessage on the next reproduction.
      console.warn('[Google Sign-In failed]', {
        code: e?.code,
        message: e?.message,
        nativeErrorMessage: e?.nativeErrorMessage,
      });
      Alert.alert(
        t('auth:sign_in_failed', {defaultValue: 'Sign in failed'}),
        mapFirebaseAuthError(e, t('auth:google_signin_failed', {defaultValue: 'Google sign-in was cancelled or failed.'})),
      );
    } finally {
      setIsSocialSubmitting(false);
    }
  }, [signInWithGoogle, nextScreen, isSocialSubmitting, t, requireTermsAcceptance]);
  // LinkedIn has no first-party Firebase/RN SDK — AuthContext's
  // signInWithLinkedIn drives a custom OAuth2 flow (system browser +
  // backend code exchange) instead. Shares the same busy-state/error
  // handling as Google above.
  const onLinkedIn = React.useCallback(async () => {
    if (isSocialSubmitting) return;
    if (!requireTermsAcceptance()) return;
    setIsSocialSubmitting(true);
    try {
      await signInWithLinkedIn();
      nextScreen('MainBottomTab');
    } catch (e: any) {
      // Same diagnostic-value fix as onGoogle above — nothing was logging
      // the raw error here either.
      console.warn('[LinkedIn Sign-In failed]', {
        code: e?.code,
        message: e?.message,
        nativeErrorMessage: e?.nativeErrorMessage,
      });
      Alert.alert(
        t('auth:sign_in_failed', {defaultValue: 'Sign in failed'}),
        mapFirebaseAuthError(e, t('auth:linkedin_signin_failed', {defaultValue: 'LinkedIn sign-in was cancelled or failed.'})),
      );
    } finally {
      setIsSocialSubmitting(false);
    }
  }, [signInWithLinkedIn, nextScreen, isSocialSubmitting, t, requireTermsAcceptance]);
  const onAuth = React.useCallback(
    screen => () => {
      navigate('AuthStack', {screen: screen});
    },
    [navigate],
  );
  return (
    <Container style={styles.container}>
      {/* BUG FIX (product report: "In the android the continue with
          linkedIn button is being covered by the dont have an account?
          container") -- this ScrollView had no `style` of its own, only
          `contentContainerStyle`, so its own height was purely content-
          driven instead of properly filling/being bounded within its
          parent flex column. That's tolerated fine on iOS but is a known
          measurement quirk of this library on Android, where an
          unbounded KeyboardAwareScrollView can end up rendered over the
          same vertical space as a trailing sibling (the "Don't have an
          account?" Flex row right below it) instead of pushing it down.
          `flex: 1` gives it a real, properly bounded box to lay out
          within, same as this component gets everywhere else it doesn't
          have a trailing sibling to conflict with. */}
      <KeyboardAwareScrollView style={{flex: 1}} contentContainerStyle={styles.content}>
        <BrandWordmark size={44} />
        {/* REMOVED (product follow-up: "Remove this illustration from the
            login screen") -- was ArtWelcomeWave (see src/home/HomeHeroArt.tsx),
            added for an earlier, separate report ("There is no image or
            illustrations or icon in the welcome screen"). Straight from the
            wordmark into the heading again now. */}
        {/* Redesign (product follow-up — "big text" consistency pass):
            was category="h7" (16px, not bold), the smallest heading size
            used anywhere as an actual screen title in this app. Bumped to
            match the same big-bold treatment src/auth/Signup/
            SignupSecondStep.tsx and SignupThirdStep.tsx already use for
            their own headings, so the whole auth flow reads consistently.
            mb trimmed from 72 to 40 now that the illustration above already
            carries some of that visual separation on its own. */}
        <Text mt={8} category="h2" bold mb={20}>
          {t('auth:welcome_back')}
        </Text>
        <Controller
          control={control}
          name="email"
          rules={RuleEmail()}
          render={({field: {onChange, onBlur, value}}) => (
            <Input
              label={t('auth:email').toString()}
              status={errors.email ? 'warning' : 'basic'}
              style={styles.email}
              textStyle={globalStyle.inputText}
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
          rules={RulePassword()}
          render={({field: {onChange, onBlur, value}}) => (
            <Input
              label={t('auth:password').toString()}
              status={errors.password ? 'warning' : 'basic'}
              style={styles.password}
              textStyle={globalStyle.inputText}
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
          <Text category="h8-s" status={'placeholder'} mv={12} center underline>
            {t('auth:forgot_password')}?
          </Text>
        </TouchableOpacity>
        {/* Terms & Privacy Policy acceptance (product request item) — gates
            onLogin/onGoogle/onLinkedIn above via requireTermsAcceptance().
            term_of_service/privacy_policy/agree_term/and are pre-existing,
            already-translated-in-all-12-locales keys (leftover from this
            app's original template, which had this same consent line —
            reused here rather than adding new duplicate strings). */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setAgreedToTerms(v => !v)}
          style={styles.termsRow}>
          <TermsCheckBox checked={agreedToTerms} onChange={setAgreedToTerms} />
          <Text category="h9-s" ml={8} style={globalStyle.flexOne}>
            {t('auth:agree_term')}{' '}
            <Text
              category="h9-s"
              status="link"
              onPress={() => navigate('PolicyScreen', {initialTab: 'terms_of_service'})}>
              {t('auth:term_of_service')}
            </Text>{' '}
            {t('auth:and')}{' '}
            <Text
              category="h9-s"
              status="link"
              onPress={() => navigate('PolicyScreen', {initialTab: 'privacy_policy'})}>
              {t('auth:privacy_policy')}
            </Text>
          </Text>
        </TouchableOpacity>
        <CtaButton onPress={onLogin} disabled={canContinue || isSubmitting} loading={isSubmitting}>
          {t('auth:login').toString()}
        </CtaButton>
        <Text category="h8-s" status={'placeholder'} mt={20} mb={16} center>
          {t('auth:or')}
        </Text>
        <SocialAuthButton
          provider="google"
          label={t('auth:google_login')}
          disabled={isSocialSubmitting}
          onPress={onGoogle}
        />
        <SocialAuthButton
          provider="linkedin"
          label={t('auth:linkedin_login')}
          disabled={isSocialSubmitting}
          onPress={onLinkedIn}
        />
      </KeyboardAwareScrollView>
      <Flex center mt={20} mb={bottom + 16} style={styles.bottom}>
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
    marginTop: 8,
    paddingHorizontal: 24,
    paddingBottom: 24,
    zIndex: 10,
  },
  // Product request ("make text inputs all through the app consistent in
  // design") — was a bare underline (borderBottomWidth only, no fill/full
  // border), a different convention from the boxed border+background+
  // radius-12 look (globalStyle.inputField) used by most other Input
  // fields across the app (search boxes, JD Analyzer, Job Preferences,
  // etc.). Now shares that same convention instead of its own one-off
  // underline style.
  // Product report ("the input fields should have a gray border"): local
  // override, not a change to globalStyle.inputField itself (that shared
  // token is intentionally borderless post-SYMPHONY-REDESIGN and is spread
  // by ~15 other screens that were never asked to change).
  email: {
    ...globalStyle.inputField,
    borderWidth: 1,
    borderColor: 'border-card-default',
    marginBottom: 14,
  },
  password: {
    ...globalStyle.inputField,
    borderWidth: 1,
    borderColor: 'border-card-default',
  },
  // Was `position: 'absolute', bottom: 0` — floating this row fixed at the
  // very bottom of the screen regardless of scroll position, which is what
  // caused it to sit right on top of the LinkedIn button (my first attempt
  // at fixing that fought the symptom with a big padding buffer instead of
  // the actual cause, which just pushed a large dead gap between the two
  // instead). Removed the absolute positioning entirely — this row now
  // flows normally right after the LinkedIn button like every other
  // element on this screen, so it sits close to it again ("the way they
  // are before") with just a small `mt={20}` gap (see the JSX) instead of
  // either overlapping or being stranded at the screen edge. `mb`
  // (safe-area inset + 16, set in the JSX) still keeps it clear of the
  // home indicator on devices that need it.
  bottom: {},
  forgetPass: {
    alignSelf: 'center',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
});
