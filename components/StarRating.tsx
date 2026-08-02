import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Icon, useTheme } from '@ui-kitten/components';

// Read-only star-rating row (full reskin, product request item —
// "screenshot 3" reference: star-rating rows). NOT the interactive
// tap-to-rate control (that already exists purpose-built in
// components/AppRatingModal.tsx, with its own tap handling/state) — this is
// for DISPLAYING an existing numeric rating/score as stars wherever one
// shows up read-only (past submitted ratings, interview feedback scores,
// company/review-style content).
//
// Supports a fractional `value` (e.g. 3.4) by rounding each star to
// filled/empty at the 0.5 mark — react-native-eva-icons has no half-star
// glyph to render a true partial star, so this is the closest fair
// approximation rather than truncating down on every fractional value.
export interface StarRatingProps {
  /** 0-max. */
  value: number;
  max?: number;
  size?: number;
  color?: string;
  emptyColor?: string;
  style?: StyleProp<ViewStyle>;
}

const StarRating: React.FC<StarRatingProps> = ({ value, max = 5, size = 16, color, emptyColor, style }) => {
  const theme = useTheme();
  const filledColor = color ?? theme['color-warning-500'];
  const trackColor = emptyColor ?? theme['text-hint-color'];
  const clamped = Math.max(0, Math.min(max, value));

  return (
    <View style={[{ flexDirection: 'row' }, style]}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = clamped - i >= 0.5;
        return (
          <Icon
            key={i}
            pack="eva"
            name={filled ? 'star' : 'star-outline'}
            style={{
              width: size,
              height: size,
              marginRight: i < max - 1 ? 2 : 0,
              tintColor: filled ? filledColor : trackColor,
            }}
          />
        );
      })}
    </View>
  );
};

export default StarRating;

// Convenience helper — several existing scores in this app are 0-100
// (interview overallScore, etc.), not a 0-5 star scale. Centralized here
// so every call site converts the same way instead of each hand-rolling
// `(score / 100) * 5`.
export const percentToStars = (percent: number, max = 5): number => (percent / 100) * max;
