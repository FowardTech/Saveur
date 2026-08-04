import React, {memo} from 'react';
import {Alert, TouchableOpacity, View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Input,
  Icon,
  Button,
  Avatar,
  CheckBox,
} from '@ui-kitten/components';
import {NavigationProp, RouteProp, useNavigation, useRoute} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import {Controller, useForm} from 'react-hook-form';
import {RuleEmail, RuleName, RulePassword} from 'utils/rules';
import useToggle from 'hooks/useToggle';
import AnimatedAppearance from 'components/AnimatedAppearance';
import AvatarPickerModal from 'components/AvatarPickerModal';
import {AuthStackParamList, RootStackParamList} from 'navigation/types';
import {mapFirebaseAuthError} from 'utils/authErrors';
import {AuthContext} from '../../../AuthContext';
import CtaButton from 'components/CtaButton';

const SignupThirdStep = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'SignupThirdStep'>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['auth', 'success', 'common', 'more']);
  const {signUp, signInWithGoogle, signInWithLinkedIn, updateProfile} = React.useContext(AuthContext);

  const {goals, industries, preferredCountries, desiredRoles, locale} = route.params ?? {};

  const [invisible, setInvisible] = useToggle(true);
  const [canContinue, setContinue] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // Terms & Privacy Policy acceptance (product request item) — required
  // before ANY account-creation path completes below (email/password,
  // Google, LinkedIn) — see Login.tsx's identical requireTermsAcceptance
  // for the sign-in-side counterpart of this same product requirement.
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

  // Optional leaderboard avatar preset, picked here per explicit product
  // request ("users should be giving the option to set it during signup").
  // Deliberately never tied to the account's real photo — see
  // UserProfileProps.leaderboardAvatarUrl (constants/Types.tsx) for why this
  // is a wholly separate field. Skipping this step is fine; the leaderboard
  // just falls back to the generated default like any account before this
  // existed.
  const [leaderboardAvatarUrl, setLeaderboardAvatarUrl] = React.useState<string | undefined>(undefined);
  const [isAvatarPickerVisible, setIsAvatarPickerVisible] = React.useState(false);

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm({
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
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

  // Shared by email/password signup and both social sign-ins below. Used to
  // route through the Subscription/paywall screen before the celebratory
  // success screen — now goes straight to SuccessScr instead, so signup no
  // longer forces a plan choice; Subscription is still reachable any time
  // afterward from Profile/More, unchanged.
  const goToSuccess = React.useCallback(() => {
    navigate('SuccessScr', {
      successScr: {
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

  // Also shared by all three signup paths below. Both ChooseUsername and
  // StudentVerification's endpoints require an authenticated user
  // (@require_auth), so they can only run once the Firebase account
  // genuinely exists — i.e. right here, immediately after signup succeeds,
  // rather than as an earlier step in this wizard. ChooseUsername (product
  // request item: "type in their desired username or generate a username
  // from signup") is the first post-account-creation stop now — it's own
  // `fromSignup` continue/skip path is what chains on into
  // StudentVerification (or straight to goToSuccess), mirroring exactly how
  // StudentVerification's own `fromSignup` mode used to chain straight into
  // goToSuccess.
  const goToUsernameStep = React.useCallback(() => {
    navigate('ChooseUsername', {fromSignup: true});
  }, [navigate]);

  // Shared by the email/password path and both social sign-in paths below —
  // all three can now land on "an account with this email already exists"
  // (auth/email-already-in-use), and all three should offer the exact same
  // "Log In instead" way out rather than each showing its own ad hoc wording.
  const showAlreadyRegisteredAlert = React.useCallback(() => {
    Alert.alert(
      t('auth:email_already_registered_title', {defaultValue: 'That email is already registered'}),
      t('auth:email_already_registered_body', {
        defaultValue: 'An account with this email already exists. Log in instead, or use a different email.',
      }),
      [
        {text: t('common:cancel', {defaultValue: 'Cancel'}), style: 'cancel'},
        {
          text: t('auth:login', {defaultValue: 'Log In'}),
          onPress: () => navigate('AuthStack', {screen: 'Login'}),
        },
      ],
    );
  }, [t, navigate]);

  const handleSignup = handleSubmit(async data => {
    if (!requireTermsAcceptance()) return;
    setIsSubmitting(true);
    try {
      await signUp({
        email: data.email,
        password: data.password,
        name: data.full_name,
        goals,
        industries,
        preferredCountries,
        desiredRoles,
        locale,
        leaderboardAvatarUrl,
      });
      goToUsernameStep();
    } catch (e: any) {
      // Real Firebase Auth can now actually fail (email already in use, weak
      // password, network error) — surface it instead of swallowing it.
      // auth/email-already-in-use gets its own title + a direct "Log In"
      // action (rather than just Firebase's generic default alert) since
      // that's the one failure here with an obvious next step for the user.
      if (e?.code === 'auth/email-already-in-use') {
        showAlreadyRegisteredAlert();
      } else {
        Alert.alert(
          t('auth:sign_up_failed', {defaultValue: 'Sign up failed'}),
          mapFirebaseAuthError(e),
        );
      }
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
      // `{isSignup: true}` makes AuthContext check Firebase's
      // additionalUserInfo.isNewUser and throw a tagged
      // auth/email-already-in-use error (instead of just silently signing
      // the person into their existing account) when this Google account
      // turns out to already be registered — was previously indistinguishable
      // from a genuine cancellation/failure, always showing the same generic
      // "Google sign-up was cancelled or failed" regardless of the real
      // reason.
      await signInWithGoogle({isSignup: true});
      // signInWithGoogle only provisions the bare profile (POST /api/users/me)
      // — the onboarding data collected in the earlier steps
      // (goals/industries/preferredCountries/locale/leaderboardAvatarUrl)
      // still needs an explicit PATCH, same as the email/password path does
      // via signUp().
      await updateProfile({goals, industries, preferredCountries, desiredRoles, locale, leaderboardAvatarUrl});
      goToUsernameStep();
    } catch (e: any) {
      if (e?.code === 'auth/email-already-in-use' || e?.code === 'auth/account-exists-with-different-credential') {
        showAlreadyRegisteredAlert();
      } else {
        // See same-purpose log in Login.tsx's onGoogle catch — nothing was
        // surfacing the raw GoogleSignin native error code (e.g. 12500)
        // anywhere reachable without remote JS debugging attached.
        console.warn('[Google Sign-Up failed]', {
          code: e?.code,
          message: e?.message,
          nativeErrorMessage: e?.nativeErrorMessage,
        });
        Alert.alert(
          t('auth:sign_up_failed', {defaultValue: 'Sign up failed'}),
          mapFirebaseAuthError(e, t('auth:google_signup_failed', {defaultValue: 'Google sign-up was cancelled or failed.'})),
        );
      }
    } finally {
      setIsSocialSubmitting(false);
    }
  }, [signInWithGoogle, updateProfile, goals, industries, preferredCountries, desiredRoles, locale, leaderboardAvatarUrl, goToUsernameStep, isSocialSubmitting, t, showAlreadyRegisteredAlert, requireTermsAcceptance]);
  // LinkedIn has no first-party Firebase/RN SDK — AuthContext's
  // signInWithLinkedIn drives a custom OAuth2 flow instead. Same
  // isSignup/already-registered handling as onGoogle above.
  const onLinkedIn = React.useCallback(async () => {
    if (isSocialSubmitting) return;
    if (!requireTermsAcceptance()) return;
    setIsSocialSubmitting(true);
    try {
      await signInWithLinkedIn({isSignup: true});
      await updateProfile({goals, industries, preferredCountries, desiredRoles, locale, leaderboardAvatarUrl});
      goToUsernameStep();
    } catch (e: any) {
      if (e?.code === 'auth/email-already-in-use' || e?.code === 'auth/account-exists-with-different-credential') {
        showAlreadyRegisteredAlert();
      } else {
        Alert.alert(
          t('auth:sign_up_failed', {defaultValue: 'Sign up failed'}),
          mapFirebaseAuthError(e, t('auth:linkedin_signup_failed', {defaultValue: 'LinkedIn sign-up was cancelled or failed.'})),
        );
      }
    } finally {
      setIsSocialSubmitting(false);
    }
  }, [signInWithLinkedIn, updateProfile, goals, industries, preferredCountries, desiredRoles, locale, leaderboardAvatarUrl, goToUsernameStep, isSocialSubmitting, t, showAlreadyRegisteredAlert, requireTermsAcceptance]);
  return (
    <Container style={styles.container}>
      <TopNavigation accessoryLeft={<NavigationAction />} />
      <AnimatedAppearance>
        <Content padder avoidKeyboard contentContainerStyle={styles.content}>
          <Text mt={16}>{t('auth:heading_signup_3')}</Text>
          {/* BUG FIX (custom fonts not rendering on Android): the inline
              `fontWeight: '800'` override used to win over Text.tsx's own
              (now-fixed) 'normal' weight, which broke the Android lookup for
              the real PlusJakartaSans-Bold.ttf file `bold` already selects
              — see Text.tsx's comment for the full mechanism. Removed; the
              Bold font file itself is already the boldest cut available. */}
          <Text mt={8} mb={16} category="h2" bold>
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
          {/* Optional -- product request item, see leaderboardAvatarUrl's
              comment above. Purely cosmetic for the Leaderboard; skipping
              this leaves it null and the generated default avatar is used
              instead, same as any account that predates this step. */}
          <Flex justify="space-between" itemsCenter mb={32}>
            <Flex vertical style={{flex: 1, paddingRight: 16}}>
              <Text category="h8-s" bold>
                {t('more:leaderboard_avatar', {defaultValue: 'Leaderboard avatar'})}
              </Text>
              <Text category="c1" status="placeholder" mt={4}>
                {t('auth:leaderboard_avatar_signup_description', {
                  defaultValue: 'Optional — shown next to your username on the Leaderboard only.',
                })}
              </Text>
            </Flex>
            <TouchableOpacity activeOpacity={0.75} onPress={() => setIsAvatarPickerVisible(true)}>
              {leaderboardAvatarUrl ? (
                <Avatar source={{uri: leaderboardAvatarUrl}} size="large" shape="rounded" />
              ) : (
                <Flex center style={styles.avatarPlaceholder}>
                  <Icon pack="eva" name="plus-outline" style={styles.avatarPlaceholderIcon} />
                </Flex>
              )}
            </TouchableOpacity>
          </Flex>
          {/* Terms & Privacy Policy acceptance (product request item) —
              gates handleSignup/onGoogle/onLinkedIn above via
              requireTermsAcceptance(). Reuses term_of_service/
              privacy_policy/agree_term/and — pre-existing, already-
              translated-in-all-12-locales keys left over from this app's
              original template, which had this same consent line. */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setAgreedToTerms(v => !v)}
            style={styles.termsRow}>
            <CheckBox checked={agreedToTerms} onChange={setAgreedToTerms} />
            <Text category="h9-s" ml={8} style={{flex: 1}}>
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
          <CtaButton
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
          <View>
            <Icon pack="eva" name={'briefcase-outline'} style={styles.logoSocial} />
            <Button
              status="outline"
              disabled={isSocialSubmitting}
              onPress={onLinkedIn}
              children={<Text>{`${t('auth:linkedin_login')}`}</Text>}
            />
          </View>
        </Content>
      </AnimatedAppearance>
      <AvatarPickerModal
        visible={isAvatarPickerVisible}
        currentUrl={leaderboardAvatarUrl}
        onClose={() => setIsAvatarPickerVisible(false)}
        onSelect={url => {
          setLeaderboardAvatarUrl(url);
          setIsAvatarPickerVisible(false);
        }}
      />
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
    color: 'color-primary-100'
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'border-basic-color-3',
    borderStyle: 'dashed',
  },
  avatarPlaceholderIcon: {
    width: 20,
    height: 20,
    tintColor: 'text-hint-color',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
});
