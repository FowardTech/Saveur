import React from 'react';
import {StyleProp, ViewStyle} from 'react-native';
import {Icon, useTheme} from '@ui-kitten/components';

import Text from './Text';
import Flex from './Flex';
import {Spinner} from '@ui-kitten/components';

// Shared "nothing here yet / loading / error" block — a design-consistency
// pass found every screen reinventing this from scratch: different icon
// sizes, different presence/absence of an icon at all, different
// paddingVertical (40 vs 60), different title/body structure, and three
// completely different visual treatments within the same screen for
// loading vs error vs empty (see JobAlerts.tsx before this existed). Use
// this instead of a one-off <Flex vertical itemsCenter center> block so
// every "nothing to show" moment in the app looks and behaves the same way.
export interface EmptyStateProps {
  /** 'loading' shows a spinner and ignores icon/actionLabel. */
  variant?: 'empty' | 'error' | 'loading';
  /** eva icon pack name, e.g. "credit-card-outline". Ignored for `loading`. */
  icon?: string;
  title?: string;
  body?: string;
  actionLabel?: string;
  onAction?(): void;
  style?: StyleProp<ViewStyle>;
}

const EmptyState = ({
  variant = 'empty',
  icon = 'inbox-outline',
  title,
  body,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) => {
  const theme = useTheme();

  if (variant === 'loading') {
    return (
      <Flex vertical itemsCenter justify="center" style={[{paddingVertical: 60}, style]}>
        <Spinner size="large" />
      </Flex>
    );
  }

  const isError = variant === 'error';

  return (
    <Flex vertical itemsCenter justify="center" style={[{paddingVertical: 56}, style]}>
      <Icon
        pack="eva"
        name={isError ? 'alert-circle-outline' : icon}
        style={{
          width: 32,
          height: 32,
          marginBottom: 12,
          tintColor: isError ? theme['color-danger-100'] : theme['text-hint-color'],
        }}
      />
      {title ? (
        <Text category="h7" bold status={isError ? 'danger' : undefined} center mb={8}>
          {title}
        </Text>
      ) : null}
      {body ? (
        <Text category="h9-s" status="placeholder" center>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Text category="h9" status="link" bold onPress={onAction} mt={16}>
          {actionLabel}
        </Text>
      ) : null}
    </Flex>
  );
};

export default EmptyState;
