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
    {/* open empty box */}
    <Path d="M16 40 L48 52 L80 40 V66 L48 78 L16 66 Z" fill="#A592FF" />
    <Path d="M48 52 V78 L16 66 V40 Z" fill="#7C5CFF" />
    <Path d="M16 40 L28 24 L48 32 L36 46 Z" fill="#C9BBFF" />
    <Path d="M80 40 L68 24 L48 32 L60 46 Z" fill="#E4DDFF" />
    <Circle cx={80} cy={20} r={3.5} fill="#FFC94A" />
    <Circle cx={14} cy={22} r={2.5} fill="#FF5FA2" />
  </Svg>
);

/** Practice / mock-interview history: microphone with speech bubble and progress bars. */
export const PracticeHistoryIllustration = ({size = 96}: {size?: number}) => (
  <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
    <Ellipse cx={48} cy={86} rx={30} ry={4} fill="rgba(0,0,0,0.08)" />
    {/* progress bars */}
    <Rect x={10} y={56} width={10} height={26} rx={3} fill="#19B87A" />
    <Rect x={24} y={46} width={10} height={36} rx={3} fill="#FFC94A" />
    {/* speech bubble */}
    <Rect x={52} y={10} width={34} height={24} rx={8} fill="#FF5FA2" />
    <Path d="M60 34 L58 42 L68 34 Z" fill="#FF5FA2" />
    <Circle cx={61} cy={22} r={2.5} fill="#FFFFFF" />
    <Circle cx={69} cy={22} r={2.5} fill="#FFFFFF" />
    <Circle cx={77} cy={22} r={2.5} fill="#FFFFFF" />
    {/* microphone */}
    <Rect x={40} y={34} width={22} height={34} rx={11} fill="#7C5CFF" />
    <Rect x={46} y={40} width={4} height={10} rx={2} fill="#C9BBFF" />
    <Path d="M34 56 a17 17 0 0 0 34 0" stroke="#A592FF" strokeWidth={4} strokeLinecap="round" />
    <Path d="M51 73 V82 M42 82 H60" stroke="#A592FF" strokeWidth={4} strokeLinecap="round" />
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
  /** Optional custom (coloured) illustration shown instead of the default. */
  illustration?: React.ReactNode;
  title?: string;
  body?: string;
  actionLabel?: string;
  onAction?(): void;
  style?: StyleProp<ViewStyle>;
}

const EmptyState = ({
  variant = 'empty',
  illustration,
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
        {illustration ? (
          illustration
        ) : isError ? (
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
