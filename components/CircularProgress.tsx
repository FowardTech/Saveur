import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

// Reusable circular progress ring (full reskin, product request item —
// "screenshot 3" reference: circular progress rings instead of plain
// numbers/bars). Pure SVG (react-native-svg, already a dependency — see
// utils/chartConfig.ts's BarChart usage elsewhere) rather than a native
// progress-view library, so it works identically on iOS/Android and can
// take an optional two-color gradient stroke (matching the "rounded-
// gradient-card" look) instead of only a flat color.
//
// Rotated -90deg so progress starts at 12 o'clock (the conventional
// direction for this kind of ring) instead of SVG's default 3 o'clock
// start — matches the reference screenshot.
export interface CircularProgressProps {
  /** 0-100. Values outside that range are clamped. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** Color of the unfilled track behind the progress stroke. */
  trackColor?: string;
  /** Solid stroke color — ignored if gradientFrom/gradientTo are both set. */
  color?: string;
  gradientFrom?: string;
  gradientTo?: string;
  /** Centered content (e.g. a number + label) rendered on top of the ring. */
  children?: React.ReactNode;
  style?: ViewStyle;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 64,
  strokeWidth = 8,
  trackColor = 'rgba(39, 39, 85, 0.08)',
  color = '#0063f8',
  gradientFrom,
  gradientTo,
  children,
  style,
}) => {
  const clamped = Math.max(0, Math.min(100, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const useGradient = !!gradientFrom && !!gradientTo;
  // Unique per instance so multiple rings on one screen don't collide on
  // the same <Defs> gradient id.
  const gradientId = React.useId();

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        {useGradient ? (
          <Defs>
            <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={gradientFrom} />
              <Stop offset="100%" stopColor={gradientTo} />
            </SvgLinearGradient>
          </Defs>
        ) : null}
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={useGradient ? `url(#${gradientId})` : color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      {children}
    </View>
  );
};

export default CircularProgress;
