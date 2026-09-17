import React from 'react';
import {StyleProp, View, ViewStyle} from 'react-native';
import {useTheme} from '@ui-kitten/components';
import {SvgXml} from 'react-native-svg';

import Text from './Text';
import Flex from './Flex';
import {Spinner} from '@ui-kitten/components';
import {ART_EMPTY_TRAY_SVG, ART_ERROR_SVG} from '../src/home/illustrationSvgs';

// Shared "nothing here yet / loading / error" block — a design-consistency
// pass found every screen reinventing this from scratch: different icon
// sizes, different presence/absence of an icon at all, different
// paddingVertical (40 vs 60), different title/body structure, and three
// completely different visual treatments within the same screen for
// loading vs error vs empty (see JobAlerts.tsx before this existed). Use
// this instead of a one-off <Flex vertical itemsCenter center> block so
// every "nothing to show" moment in the app looks and behaves the same way.
//
// Product report ("the illustrations you added ... are ones you created
// yourself ... use real illustrations, pick ones that fit from online") --
// the two hand-drawn line-art SVGs (an open tray, an alert triangle) that
// used to live directly in this file are replaced with real, freely-
// licensed unDraw illustrations (https://undraw.co -- free for commercial/
// personal use, no attribution required): "Empty" for the normal empty
// case, "Warning" for the error case. Since every "nothing here yet" screen
// in the app already routes through this one shared component (see the
// call sites), swapping the illustration here upgrades all of them at once.
// unDraw illustrations carry their own fixed color palette rather than a
// single tintable stroke color, so the old per-theme (danger/primary) color
// prop is gone -- these render the same in both the empty and error case,
// distinguished by which scene is shown, not by color.
const EmptyTrayIllustration = () => <SvgXml xml={ART_EMPTY_TRAY_SVG} width={72} height={54} />;

const ErrorIllustration = () => <SvgXml xml={ART_ERROR_SVG} width={68} height={70} />;
export interface EmptyStateProps {
  /** 'loading' shows a spinner and ignores icon/actionLabel. */
  variant?: 'empty' | 'error' | 'loading';
  /** No longer used -- kept optional so existing call sites passing an eva
   * icon name don't need editing. Both 'empty' and 'error' now render a
   * fixed SVG illustration instead (see EmptyTrayIllustration/
   * ErrorIllustration above) rather than a per-screen custom glyph. */
  icon?: string;
  title?: string;
  body?: string;
  actionLabel?: string;
  onAction?(): void;
  style?: StyleProp<ViewStyle>;
}

const EmptyState = ({
  variant = 'empty',
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
  const badgeBg = isError ? theme['color-danger-100'] + '1F' : theme['color-primary-transparent-200'];

  return (
    <Flex vertical itemsCenter justify="center" style={[{paddingVertical: 56}, style]}>
      <View
        style={{
          width: 104,
          height: 104,
          borderRadius: 52,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: badgeBg,
          marginBottom: 16,
        }}>
        {isError ? <ErrorIllustration /> : <EmptyTrayIllustration />}
      </View>
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
