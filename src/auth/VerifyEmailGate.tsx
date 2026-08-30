import React, {memo} from 'react';
import {Alert, AppState} from 'react-native';
import {StyleService, useStyleSheet, Button} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import BrandWordmark from 'components/BrandWordmark';
import {AuthContext} from '../../AuthContext';
import {renderCenteredLabel} from 'utils/buttonLabel';
import useLayout from 'hooks/useLayout';
import CtaButton from 'components/CtaButton';
import {ArtEmailSent} from 'src/home/HomeHeroArt';

// Shown IN PLACE of the Home/Practice/Coach/Interviews tabs (see
// navigation/MainBottomTab.tsx) whenever a signed-in user hasn't verified
// their email yet — replaces the old approach (a dismissible banner on Home
// only, everything else fully usable regardless) with a real gate, per an
// explicit product decision: practice/coach/tools are blocked until
// verified, but the Profile tab itself is deliberately left untouched (not
// gated) so Resend/Logout/account settings always stay reachable — this
// screen duplicates a "Resend" and "Log out" action directly for
// convenience, rather than forcing a trip to the Profile tab just for that.
// (See utils/buttonLabel.tsx's renderCenteredLabel for why button text below
// is rendered that way instead of as a plain string.)
const VerifyEmailGate = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const {bottom} = useLayout();
  const {t} = useTranslation(['auth', 'more', 'common']);
  const {profile, resendVerificationEmail, refreshEmailVerified, signOut} = React.useContext(AuthContext);

  const [isResending, setIsResending] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const onResend = React.useCallback(async () => {
    if (isResending) return;
    setIsResending(true);
    try {
      await resendVerificationEmail();
      Alert.alert(
        t('auth:email_sent_title', {defaultValue: 'Email sent'}),
        t('auth:email_sent_body', {defaultValue: 'Check your inbox for the verification link.'}),
      );
    } catch (e: any) {
      Alert.alert(
        t('auth:send_failed_title', {defaultValue: "Couldn't send that"}),
        e?.message ?? t('auth:send_failed_body', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setIsResending(false);
    }
  }, [isResending, resendVerificationEmail, t]);

  const onIveVerified = React.useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const verified = await refreshEmailVerified();
      if (!verified) {
        Alert.alert(
          t('auth:not_verified_yet_title', {defaultValue: 'Not verified yet'}),
          t('auth:not_verified_yet_body', {
            defaultValue:
              "We don't see that link tapped yet. Check your inbox (and spam folder), or resend the email.",
          }),
        );
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshEmailVerified, t]);

  // BUG FIX (product report: "when user verify email it should auto detect
  // without user click the 'I have verified - Refresh' button") — this gate
  // used to rely entirely on the user remembering to come back and tap that
  // button. Tapping the emailed link normally opens the mail app or a
  // browser, which backgrounds Saveur, so listening for the app returning
  // to the foreground (same AppState pattern already used for Home's old
  // banner and Subscription.tsx's Stripe-checkout return) silently reruns
  // the same check `onIveVerified` runs manually — no error alert here
  // since an unverified "not yet" result on a background poll is the
  // expected common case, not something to interrupt the user about. A
  // short foreground interval is layered on top for the case where
  // verification happens without ever backgrounding the app (e.g. the link
  // opens in an in-app browser tab/webview rather than a separate app).
  React.useEffect(() => {
    let cancelled = false;
    const tryRefresh = () => {
      if (cancelled) return;
      refreshEmailVerified();
    };
    const listener = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') tryRefresh();
    });
    const interval = setInterval(tryRefresh, 15000);
    return () => {
      cancelled = true;
      listener.remove();
      clearInterval(interval);
    };
  }, [refreshEmailVerified]);

  const onLogout = React.useCallback(() => {
    Alert.alert(
      t('more:logout_confirm_title', {defaultValue: 'Log out?'}),
      t('more:logout_confirm_body', {defaultValue: "You'll need to sign back in to use the app."}),
      [
        {text: t('common:cancel', {defaultValue: 'Cancel'}), style: 'cancel'},
        {
          text: t('more:logout', {defaultValue: 'Log out'}),
          style: 'destructive',
          onPress: async () => {
            if (isSigningOut) return;
            setIsSigningOut(true);
            try {
              await signOut();
            } finally {
              setIsSigningOut(false);
            }
          },
        },
      ],
    );
  }, [isSigningOut, signOut, t]);

  return (
    <Container style={styles.container}>
      <Content padder contentContainerStyle={[styles.content, {paddingBottom: bottom + 24}]}>
        {/* justify="center" is explicit here for the same reason as
            components/ProLockGate.tsx — Flex.tsx defaults justify to
            'space-between' when omitted, which on this flex:1 column would
            spread the wordmark to the top and the last Button (Log out) to
            the very bottom edge instead of grouping everything together.

            `center` (alignSelf) was also wrong here, same as ProLockGate —
            it only centers the Flex box within ITS parent, not its
            children. The wordmark/icon (fixed sizes, no textAlign of their
            own) sat flush left as a result. `itemsCenter` is Flex's actual
            alignItems:'center' prop. */}
        <Flex vertical itemsCenter justify="center" style={{flex: 1}}>
          {/* <BrandWordmark markOnly size={64} /> */}
          {/* Product request: "add illustrations like the gift box
              wherever needed" — was a bare "email-outline" Eva icon. An
              envelope with a confirmed/sent badge reads as encouraging
              rather than a plain static glyph, fitting for a screen whose
              whole point is "check your inbox, one more step." See
              src/home/HomeHeroArt.tsx's own comment for the full sweep. */}
          <ArtEmailSent size={100} />
          <Text category="h3" bold center mt={20}>
            {t('auth:verify_email_gate_title', {defaultValue: 'Verify your email'})}
          </Text>
          <Text category="h9-s" status="placeholder" center mt={12} maxWidth={320}>
            {t('auth:verify_email_gate_body', {
              email: profile?.email || t('auth:your_email_fallback', {defaultValue: 'your email'}),
              defaultValue:
                "We sent a verification link to {{email}}. Tap it, then come back here — practice sessions, the AI coach, and other tools unlock once you're verified.",
            })}
          </Text>

          <CtaButton
            style={{marginTop: 32, width: '100%'}}
            disabled={isResending}
            onPress={onResend}>
            {renderCenteredLabel(
              isResending
                ? t('auth:sending', {defaultValue: 'Sending…'})
                : t('auth:resend_verification_email', {defaultValue: 'Resend verification email'}),
            )}
          </CtaButton>
          <Button
            style={{marginTop: 12, width: '100%'}}
            appearance="outline"
            disabled={isRefreshing}
            onPress={onIveVerified}>
            {renderCenteredLabel(
              isRefreshing
                ? t('auth:checking', {defaultValue: 'Checking…'})
                : t('auth:ive_verified_refresh', {defaultValue: "I've verified — refresh"}),
            )}
          </Button>
          <Button
            style={{marginTop: 12, width: '100%'}}
            appearance="ghost"
            status="danger"
            disabled={isSigningOut}
            onPress={onLogout}>
            {renderCenteredLabel(t('more:logout', {defaultValue: 'Log out'}))}
          </Button>
        </Flex>
      </Content>
    </Container>
  );
});

export default VerifyEmailGate;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
});
