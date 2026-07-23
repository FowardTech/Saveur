import React, {memo} from 'react';
import {Alert} from 'react-native';
import {StyleService, useStyleSheet, useTheme, Icon, Button} from '@ui-kitten/components';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import BrandWordmark from 'components/BrandWordmark';
import {globalStyle} from 'styles/globalStyle';
import {AuthContext} from '../../AuthContext';
import {renderCenteredLabel} from 'utils/buttonLabel';
import useLayout from 'hooks/useLayout';

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
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {bottom} = useLayout();
  const {profile, resendVerificationEmail, refreshEmailVerified, signOut} = React.useContext(AuthContext);

  const [isResending, setIsResending] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const onResend = React.useCallback(async () => {
    if (isResending) return;
    setIsResending(true);
    try {
      await resendVerificationEmail();
      Alert.alert('Email sent', 'Check your inbox for the verification link.');
    } catch (e: any) {
      Alert.alert("Couldn't send that", e?.message ?? 'Please try again in a moment.');
    } finally {
      setIsResending(false);
    }
  }, [isResending, resendVerificationEmail]);

  const onIveVerified = React.useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const verified = await refreshEmailVerified();
      if (!verified) {
        Alert.alert(
          'Not verified yet',
          "We don't see that link tapped yet. Check your inbox (and spam folder), or resend the email.",
        );
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshEmailVerified]);

  const onLogout = React.useCallback(() => {
    Alert.alert('Log out?', "You'll need to sign back in to use the app.", [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Log out',
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
    ]);
  }, [isSigningOut, signOut]);

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
          <BrandWordmark markOnly size={64} />
          <Icon
            pack="eva"
            name="email-outline"
            style={[globalStyle.icon40, {tintColor: theme['color-primary-500'], marginTop: 24}]}
          />
          <Text category="h5" bold center mt={20}>
            Verify your email
          </Text>
          <Text category="h9-s" status="placeholder" center mt={12} maxWidth={320}>
            We sent a verification link to {profile?.email ?? 'your email'}. Tap it, then come back
            here — practice sessions, the AI coach, and other tools unlock once you're verified.
          </Text>

          <Button
            style={{marginTop: 32, width: '100%'}}
            disabled={isResending}
            onPress={onResend}>
            {renderCenteredLabel(isResending ? 'Sending…' : 'Resend verification email')}
          </Button>
          <Button
            style={{marginTop: 12, width: '100%'}}
            appearance="outline"
            disabled={isRefreshing}
            onPress={onIveVerified}>
            {renderCenteredLabel(isRefreshing ? 'Checking…' : "I've verified — refresh")}
          </Button>
          <Button
            style={{marginTop: 12, width: '100%'}}
            appearance="ghost"
            status="danger"
            disabled={isSigningOut}
            onPress={onLogout}>
            {renderCenteredLabel('Log out')}
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
