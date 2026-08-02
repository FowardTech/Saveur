import React, {memo} from 'react';
import {useTheme} from '@ui-kitten/components';

import Text from './Text';

export type StatusBadgeVariant = 'accent' | 'info' | 'success' | 'warning' | 'danger';

interface Props {
  label: string;
  variant?: StatusBadgeVariant;
  style?: any;
}

// Small colored pill for a short status word (product request item —
// explicit ZipRecruiter reference: the "New" / "Urgent" / "Be Seen First"
// tags on job cards). Distinct from the app's existing free-floating
// colored-text badges (e.g. JobAlertDetails.tsx's "Applied" pill, which
// predates this and is left as-is) — this is the new shared primitive for
// any FUTURE status tag, so new ones don't each hand-rip their own pill
// styling. `accent` (purple) is reserved for a "featured/highlighted" tag
// the way the reference uses purple specifically for "Be Seen First" and
// nothing else — `info` (blue) is the general-purpose one ("New", plain
// informational tags).
// BUG FIX (illegible pill text — "green pills using a light green is making
// the text almost not visible, also the orange text"): `success`/`warning`
// used to pair their PALEST palette shade (-100, the brightest/lightest
// tone) as the TEXT color on top of an already-pale tinted background
// (-transparent-200), which is close to no contrast at all. `color-success-
// 200` (#0EAD69) is the same darker green already used elsewhere in the app
// for legible text-on-light-fill (see light.json's `text-completed-color`).
// There was no darker warning shade defined anywhere in the palette at all
// (`color-warning-100` was the only one, #FE9870 — a light peach, exactly
// the illegible orange reported) — added `color-warning-700` (#B45309, a
// proper darkened burnt-orange keeping the same hue) to
// constants/theme/appTheme.json for this.
const VARIANT_TOKENS: Record<StatusBadgeVariant, {bg: string; text: string}> = {
  accent: {bg: 'color-accent-purple-bg', text: 'color-accent-purple'},
  info: {bg: 'color-badge-info-bg', text: 'color-badge-info-text'},
  success: {bg: 'color-success-transparent-200', text: 'color-success-200'},
  warning: {bg: 'color-warning-transparent-200', text: 'color-warning-700'},
  danger: {bg: 'color-danger-transparent-200', text: 'color-danger-100'},
};

const StatusBadge = memo(({label, variant = 'info', style}: Props) => {
  const theme = useTheme();
  const tokens = VARIANT_TOKENS[variant];
  return (
    <Text
      category="h10"
      bold
      style={[
        {
          backgroundColor: theme[tokens.bg],
          color: theme[tokens.text],
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 99,
          overflow: 'hidden',
          alignSelf: 'flex-start',
        },
        style,
      ]}>
      {label}
    </Text>
  );
});

export default StatusBadge;
