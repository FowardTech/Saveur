import React from 'react';
import {StyleProp, View, ViewStyle} from 'react-native';
import {useTheme} from '@ui-kitten/components';
import Svg, {Circle, Path, Rect} from 'react-native-svg';

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
//
// REVERTED from unDraw back to hand-drawn line art, sized up (product
// report: "The recent illustrations you added are too small make them
// moderate. Also i dont want illustrations from undraw. I would prefer
// humaan[s], icons8 and iconscout") -- see src/home/HomeHeroArt.tsx's
// ArtGiftBox comment for the full licensing writeup behind this reversal
// (same reasoning applies here). Kept as simple tintable line art rather
// than adding a Humaaans-style flat person -- a tray/warning triangle is
// already a clear enough glyph on its own, and every other empty state in
// the app already uses this per-theme (danger/primary) tintable-stroke
// construction, which a fixed-palette illustration would have broken.
const EmptyTrayIllustration = ({color}: {color: string}) => (
  <Svg width={76} height={76} viewBox="0 0 64 64" fill="none">
    <Path
      d="M12 38 L20 16 H44 L52 38"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Rect x={10} y={38} width={44} height={14} rx={3} stroke={color} strokeWidth={2.5} />
    <Path
      d="M10 42.5 H23 C24 46 26.5 48.5 32 48.5 C37.5 48.5 40 46 41 42.5 H54"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx={22} cy={9} r={2.4} fill={color} opacity={0.5} />
    <Circle cx={34} cy={6} r={1.8} fill={color} opacity={0.35} />
  </Svg>
);

const ErrorIllustration = ({color}: {color: string}) => (
  <Svg width={76} height={76} viewBox="0 0 64 64" fill="none">
    <Path
      d="M32 10 L58 52 H6 Z"
      stroke={color}
      strokeWidth={2.5}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <Path d="M32 26 V38" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    <Circle cx={32} cy={45} r={1.8} fill={color} />
  </Svg>
);
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
  const illustrationColor = isError ? theme['color-danger-100'] : theme['color-primary-500'];
  const badgeBg = isError ? theme['color-danger-100'] + '1F' : theme['color-primary-transparent-200'];

  return (
    <Flex vertical itemsCenter justify="center" style={[{paddingVertical: 56}, style]}>
      <View
        style={{
          width: 116,
          height: 116,
          borderRadius: 58,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: badgeBg,
          marginBottom: 16,
        }}>
        {isError ? (
          <ErrorIllustration color={illustrationColor} />
        ) : (
          <EmptyTrayIllustration color={illustrationColor} />
        )}
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
