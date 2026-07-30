import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Icon, Layout, useTheme} from '@ui-kitten/components';

import Text from 'components/Text';
import {globalStyle} from 'styles/globalStyle';

// Full-screen blocker shown instead of the main app when the admin-
// configured "maintenance" or "release" (force-update) config says so — see
// services/configService.ts and App.tsx's gate check. Plain View/StyleSheet
// centering (not the shared Flex component) on purpose: Flex's `justify`
// prop silently defaults to "space-between" when omitted, which spreads
// content apart with big gaps instead of centering it — the exact bug
// already fixed once in src/messages/VoiceCoachView.tsx, not worth
// reintroducing here.
type Props = {
  iconName: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const AppGateScreen = memo(({iconName, title, message, actionLabel, onAction}: Props) => {
  const theme = useTheme();
  return (
    <Layout style={styles.root} level="1">
      <View style={styles.body}>
        <View style={[styles.iconCircle, {backgroundColor: theme['background-basic-color-2']}]}>
          <Icon
            pack="eva"
            name={iconName}
            style={[globalStyle.icon40, {tintColor: theme['text-basic-color']}]}
          />
        </View>
        <Text category="h5" bold center mt={20}>
          {title}
        </Text>
        <Text category="h8" status="placeholder" center mt={10} maxWidth={320}>
          {message}
        </Text>
        {actionLabel && onAction ? (
          <Button style={styles.button} onPress={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </View>
    </Layout>
  );
});

export default AppGateScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    marginTop: 28,
    minWidth: 200,
  },
});
