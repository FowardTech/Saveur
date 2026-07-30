import React, {memo} from 'react';
import {StyleService, useStyleSheet, useTheme, Icon, Button, TopNavigation} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import useLayout from 'hooks/useLayout';
import {renderCenteredLabel} from 'utils/buttonLabel';

interface ProLockGateProps {
  title?: string;
  description: string;
  // 'premium' is for features gated behind Pro Premium/Pro Yearly
  // specifically (Job Alerts, Learning Courses) — a plain monthly Pro
  // subscriber will land on this gate too, so the heading/CTA copy needs to
  // say "Pro Premium", not "Pro" (which they may already have). Defaults to
  // 'pro' for every other Pro-gated screen, unchanged from before.
  variant?: 'pro' | 'premium';
}

// Full-screen replacement for a Pro-only feature (Job Alerts, Networking
// Assistant, Resume Builder, JD Analyzer, the whole Coach tab) when the
// signed-in user isn't on an active paid plan — see AuthContext's `isPro`
// (backed by services/entitlementsService.ts's isProTier). Same "full lock
// screen + Upgrade CTA" pattern as src/auth/VerifyEmailGate.tsx, but this
// one is rendered by the screen itself (`if (!isPro) return <ProLockGate
// .../>;`, placed after all of that screen's own hooks — see each call
// site) rather than swapped in at the navigator level, since most of these
// are pushed screens, not tab roots. Unlike the email-verification gate,
// this one keeps a working back button — browsing away to a still-free
// part of the app is a normal way out, not something to block.
const ProLockGate = memo(({title, description, variant = 'pro'}: ProLockGateProps) => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const {bottom} = useLayout();
  const isPremiumVariant = variant === 'premium';

  return (
    <Container style={styles.container}>
      <TopNavigation title={title ?? 'Pro feature'} accessoryLeft={<NavigationAction />} />
      <Content padder contentContainerStyle={[styles.content, {paddingBottom: bottom + 24}]}>
        {/* `justify` wasn't passed here before — Flex.tsx defaults it to
            'space-between' when omitted (see that component), which on a
            flex:1 vertical group with no explicit justify pins the FIRST
            child (the lock icon) to the top and the LAST child (the CTA
            button) to the very bottom edge of the full-window-height content
            area, instead of grouping everything together. That's what put
            the button behind the custom tab bar (MainBottomTab.tsx's
            tabBarStyle overlaps the last ~46 units of every tab screen) and
            left a big empty gap above it. Explicit justify="center" groups
            icon/title/description/button as one block, vertically centered.

            `center` (alignSelf) was also wrong here — see Flex.tsx: it only
            centers the Flex box itself within ITS parent, not its children.
            With the box left to its default full-width stretch and no
            per-child horizontal centering, the fixed-size 40x40 lock Icon
            fell back to sitting flush against the left edge (default
            cross-axis behavior for an item with an explicit size and no
            alignItems override) — the Text/Button below only looked centered
            because Text has its own `center` (textAlign) prop and Button is
            explicitly width:'100%'. `itemsCenter` is Flex's actual
            alignItems:'center' prop and is what horizontally centers the
            icon. paddingBottom on this box (vs. even top/bottom) nudges the
            whole centered block up slightly, per design feedback that dead
            center read a bit low. */}
        <Flex vertical itemsCenter justify="center" style={styles.body}>
          <Icon
            pack="eva"
            name="lock-outline"
            style={[globalStyle.icon40, {tintColor: theme['text-basic-color']}]}
          />
          <Text category="h5" bold center mt={20}>
            {isPremiumVariant ? 'This is a Pro Premium feature' : 'This is a Pro feature'}
          </Text>
          <Text category="h9-s" status="placeholder" center mt={12} maxWidth={320}>
            {description}
          </Text>
          <Button
            style={styles.cta}
            accessoryLeft={props => <Icon {...props} pack="eva" name="lock-outline" />}
            accessoryRight={props => <Icon {...props} pack="eva" name="arrow-forward-outline" />}
            onPress={() => navigate('Subscription')}>
            {renderCenteredLabel(isPremiumVariant ? 'See Pro Premium plans' : 'See Pro plans', {stretch: false})}
          </Button>
        </Flex>
      </Content>
    </Container>
  );
});

export default ProLockGate;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  body: {
    flex: 1,
    paddingBottom: 48,
  },
  cta: {
    marginTop: 32,
    width: '100%',
  },
});
