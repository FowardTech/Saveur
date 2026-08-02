import React, {memo} from 'react';
import {ActivityIndicator} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Input,
  Icon,
} from '@ui-kitten/components';
import {NavigationProp, RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import {AuthContext} from '../../../AuthContext';
import * as authService from 'services/authService';
import {isFeatureEnabled} from 'services/configService';
import CtaButton from 'components/CtaButton';

// "Choose your username" signup step (product request item: "I want users
// to have the option to either type in their desired username or generate
// a username from signup. If user dont set the username from signup then
// the system should auto generate as usual. when users are setting their
// own preferred username they must not type in anything that looks like
// their real name. as they type the username if the username have been
// taken already, let the user know").
//
// Reached right after account creation (SignupThirdStep.tsx's
// goToUsernameStep, after signUp()/updateProfile() have already run) —
// has to be *after* signup rather than during it because the availability
// check and PATCH both require an authenticated user (@require_auth), same
// reasoning as StudentVerification.tsx being post-signup too. By the time
// this screen mounts, `profile.username` is already the random handle
// POST /users/sync auto-assigned (username_service.ensure_username) — this
// screen's whole job is just to let the user optionally replace it, never
// to be the only path to getting one at all (skipping/continuing with the
// suggested one is always valid, matching "if user dont set the username...
// auto generate as usual").
const ChooseUsername = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['auth', 'success', 'common']);
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ChooseUsername'>>();
  const fromSignup = !!route.params?.fromSignup;
  const {profile, updateProfile, refreshProfile} = React.useContext(AuthContext);

  // Mirrors SignupThirdStep.tsx's / StudentVerification.tsx's own
  // goToSuccess — reached this way whenever this screen is part of the
  // signup wizard, so finishing (or skipping) it continues the exact same
  // chain those screens already use rather than stranding the user here.
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

  // Same "is Student Verification even on" gate SignupThirdStep.tsx used to
  // apply before navigating here directly -- now this screen is the one
  // link in that chain instead.
  const goNext = React.useCallback(() => {
    if (isFeatureEnabled('student_verification')) {
      navigate('StudentVerification', {fromSignup: true});
    } else {
      goToSuccess();
    }
  }, [navigate, goToSuccess]);

  const [mode, setMode] = React.useState<'suggested' | 'custom'>('suggested');
  const [customUsername, setCustomUsername] = React.useState('');
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  type CheckState = 'idle' | 'checking' | 'available' | 'invalid_format' | 'looks_like_name' | 'taken';
  const [checkState, setCheckState] = React.useState<CheckState>('idle');

  // Debounced live availability check as the user types — product request:
  // "as they type the username if the username have been taken already,
  // let the user know that the username they typed have been taking
  // already." Also surfaces the format rule and the anti-real-name rule the
  // same way, so all three failure modes look identical to the user instead
  // of only "taken" being handled.
  React.useEffect(() => {
    if (mode !== 'custom') return;
    const candidate = customUsername.trim();
    if (!candidate) {
      setCheckState('idle');
      return;
    }
    setCheckState('checking');
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await authService.checkUsernameAvailability(candidate);
      if (cancelled) return;
      if (result.available) {
        setCheckState('available');
      } else {
        setCheckState((result.reason as CheckState) ?? 'taken');
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customUsername, mode]);

  const onRegenerate = React.useCallback(async () => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    try {
      await authService.regenerateUsername();
      await refreshProfile();
    } catch {
      // Best-effort — the current suggested username (already valid) just
      // stays as-is if this fails.
    } finally {
      setIsRegenerating(false);
    }
  }, [isRegenerating, refreshProfile]);

  const canContinue = mode === 'suggested' || checkState === 'available';

  const onContinue = React.useCallback(async () => {
    if (isSubmitting) return;
    if (mode === 'custom') {
      if (checkState !== 'available') return;
      setIsSubmitting(true);
      try {
        await updateProfile({username: customUsername.trim()});
      } catch {
        // The live check above should have already caught this, but a race
        // (someone else grabbed it a moment ago) is still possible — drop
        // back to checking state so the error copy below re-renders instead
        // of silently continuing with an unsaved username.
        setCheckState('taken');
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }
    goNext();
  }, [isSubmitting, mode, checkState, customUsername, updateProfile, goNext]);

  const statusCopy = (): {text: string; tone: 'placeholder' | 'success' | 'danger'} | null => {
    switch (checkState) {
      case 'checking':
        return {text: t('auth:username_checking', {defaultValue: 'Checking availability…'}), tone: 'placeholder'};
      case 'available':
        return {text: t('auth:username_available', {defaultValue: 'Username available'}), tone: 'success'};
      case 'taken':
        return {
          text: t('auth:username_taken', {defaultValue: 'That username has already been taken'}),
          tone: 'danger',
        };
      case 'looks_like_name':
        return {
          text: t('auth:username_looks_like_name', {
            defaultValue: "That looks too close to your real name — pick something more anonymous.",
          }),
          tone: 'danger',
        };
      case 'invalid_format':
        return {
          text: t('auth:username_invalid_format', {
            defaultValue: '3-20 characters, starting with a letter — letters, numbers, and underscores only.',
          }),
          tone: 'danger',
        };
      default:
        return null;
    }
  };
  const status = statusCopy();

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction />}
        title={t('auth:choose_username_title', {defaultValue: 'Pick your username'}).toString()}
        accessoryRight={
          fromSignup
            ? () => (
                <Button appearance="ghost" status="basic" size="small" onPress={goNext}>
                  {t('common:skip', {defaultValue: 'Skip'})}
                </Button>
              )
            : undefined
        }
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={24}>
          {t('auth:choose_username_description', {
            defaultValue:
              'This is the only name other Saveur users ever see — on the Leaderboard and when sharing content with each other. It never shows your real name.',
          })}
        </Text>

        <Flex style={styles.tabs}>
          <Button
            style={styles.tabButton}
            appearance={mode === 'suggested' ? 'filled' : 'outline'}
            status={mode === 'suggested' ? 'primary' : 'basic'}
            size="small"
            onPress={() => setMode('suggested')}>
            {t('auth:username_mode_suggested', {defaultValue: 'Use suggested'})}
          </Button>
          <Button
            style={[styles.tabButton, {marginLeft: 12}]}
            appearance={mode === 'custom' ? 'filled' : 'outline'}
            status={mode === 'custom' ? 'primary' : 'basic'}
            size="small"
            onPress={() => setMode('custom')}>
            {t('auth:username_mode_custom', {defaultValue: 'Type my own'})}
          </Button>
        </Flex>

        {mode === 'suggested' ? (
          <Layout level="2" style={styles.suggestedCard}>
            <Flex justify="space-between" itemsCenter>
              <Flex vertical style={{flex: 1}}>
                <Text category="c1" status="placeholder">
                  {t('auth:username_your_handle', {defaultValue: 'Your handle'})}
                </Text>
                <Text category="h6" bold mt={4}>
                  @{profile?.username || '…'}
                </Text>
              </Flex>
              <Button
                appearance="ghost"
                size="small"
                disabled={isRegenerating}
                accessoryLeft={
                  isRegenerating ? () => <ActivityIndicator size="small" /> : props => <Icon {...props} pack="eva" name="refresh-outline" />
                }
                onPress={onRegenerate}>
                {t('auth:username_generate_another', {defaultValue: 'Generate another'})}
              </Button>
            </Flex>
          </Layout>
        ) : (
          <>
            <Input
              placeholder={t('auth:username_placeholder', {defaultValue: 'yourusername'}).toString()}
              value={customUsername}
              onChangeText={setCustomUsername}
              autoCapitalize="none"
              autoCorrect={false}
              status={status?.tone === 'danger' ? 'warning' : status?.tone === 'success' ? 'success' : 'basic'}
              style={styles.input}
              accessoryRight={
                checkState === 'checking'
                  ? () => <ActivityIndicator size="small" />
                  : checkState === 'available'
                  ? props => <Icon {...props} pack="eva" name="checkmark-circle-2-outline" style={[props?.style, {tintColor: theme['color-success-500']}]} />
                  : checkState === 'taken' || checkState === 'looks_like_name' || checkState === 'invalid_format'
                  ? props => <Icon {...props} pack="eva" name="close-circle-outline" style={[props?.style, {tintColor: theme['color-danger-500']}]} />
                  : undefined
              }
            />
            {status ? (
              <Text
                category="h10"
                status={status.tone}
                mt={-16}
                mb={16}>
                {status.text}
              </Text>
            ) : null}
          </>
        )}

        <CtaButton
          style={[globalStyle.shadowBtn, {marginTop: 24}]}
          disabled={!canContinue || isSubmitting}
          onPress={onContinue}>
          {isSubmitting ? `${t('common:continue', {defaultValue: 'Continue'})}…` : t('common:continue', {defaultValue: 'Continue'})}
        </CtaButton>
      </Content>
    </Container>
  );
});

export default ChooseUsername;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 48,
  },
  tabs: {
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
  },
  suggestedCard: {
    ...globalStyle.card,
    borderRadius: 16,
    padding: 16,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill to render correctly on Android — dropped the
    // explicit 'transparent' override so this Layout's own `level="2"`
    // background shows through instead.
  },
  input: {
    borderBottomWidth: 2,
    marginBottom: 8,
  },
});
