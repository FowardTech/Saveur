import React from 'react';
import {StyleProp, View, ViewStyle} from 'react-native';
import {useTheme} from '@ui-kitten/components';
import Svg, {Circle, Ellipse, Path, Rect} from 'react-native-svg';

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
// Full-colour illustrations (fixed palette, not theme-tinted) so every empty
// / error state reads as a friendly, finished illustration.
const EmptyTrayIllustration = (_: {color?: string}) => (
  <Svg width={96} height={96} viewBox="0 0 96 96" fill="none">
    <Ellipse cx={48} cy={84} rx={28} ry={4} fill="rgba(0,0,0,0.08)" />
    {/* envelope back */}
    <Rect x={14} y={30} width={68} height={46} rx={8} fill="#7C5CFF" />
    {/* letter peeking out */}
    <Rect x={24} y={18} width={48} height={36} rx={5} fill="#FFFFFF" />
    <Rect x={31} y={26} width={26} height={4} rx={2} fill="#C9BBFF" />
    <Rect x={31} y={35} width={34} height={4} rx={2} fill="#E4DDFF" />
    <Rect x={31} y={44} width={20} height={4} rx={2} fill="#E4DDFF" />
    {/* envelope front flaps */}
    <Path d="M14 40 L48 62 L82 40 V68 a8 8 0 0 1 -8 8 H22 a8 8 0 0 1 -8 -8 Z" fill="#A592FF" />
    <Path d="M14 68 L40 52 M82 68 L56 52" stroke="#7C5CFF" strokeWidth={2.5} strokeLinecap="round" />
    {/* sparkles */}
    <Circle cx={80} cy={22} r={3.5} fill="#FFC94A" />
    <Circle cx={14} cy={20} r={2.5} fill="#FF5FA2" />
    <Path d="M86 40 l1.8 4 4 1.8 -4 1.8 -1.8 4 -1.8 -4 -4 -1.8 4 -1.8z" fill="#19B87A" />
  </Svg>
);

const ErrorIllustration = (_: {color?: string}) => (
  <Svg width={96} height={96} viewBox="0 0 96 96" fill="none">
    <Ellipse cx={48} cy={84} rx={28} ry={4} fill="rgba(0,0,0,0.08)" />
    <Path d="M48 14 L86 78 H10 Z" fill="#FF8A3D" stroke="#FF8A3D" strokeWidth={8} strokeLinejoin="round" />
    <Rect x={44} y={36} width={8} height={24} rx={4} fill="#FFFFFF" />
    <Circle cx={48} cy={69} r={4.5} fill="#FFFFFF" />
    <Circle cx={80} cy={22} r={3.5} fill="#FFC94A" />
    <Circle cx={14} cy={30} r={2.5} fill="#FF5FA2" />
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
  const badgeBg = isError ? '#FF8A3D1F' : '#7C5CFF1A';

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
