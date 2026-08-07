import React, {memo, useState} from 'react';
import {View, StyleProp, ViewStyle} from 'react-native';
import {Avatar, Icon, useTheme} from '@ui-kitten/components';
import {globalStyle} from 'styles/globalStyle';

// Company-logo counterpart to UserAvatar.tsx — real logo when one resolves,
// a clean icon fallback otherwise. The logo URL here (see
// utils/companyLogo.ts / Saveur-Backend's company_logo_service.py) is a
// best-effort guess (a verified domain when the caller has one, else a
// slugified-company-name-plus-.com heuristic) run through a logo-lookup
// service — wrong guesses are expected and will 404. `onError` below is
// what makes that degrade to the icon fallback instead of rendering a
// broken image.
//
// BUG FIX (product report: "I dont want initials" — explicitly across Job
// Alerts, Dream Company Dashboard, the mock-interview company picker, and
// Company List): this used to fall back to a generated colored-circle
// initial (or a bare "?" with no company name at all) whenever the logo
// URL was missing or 404'd. Replaced with a plain icon fallback instead —
// `fallbackIcon` lets each call site pick the icon that fits its own
// context (Job Alerts explicitly asked for a briefcase; every other
// surface asked for "a company icon", i.e. the generic office-building
// glyph — see assets/LucideEvaIconsPack.tsx's 'building-outline').
//
// Also: logo.clearbit.com (the service this used to point at) shut down
// for good on Dec 8 2025 (HubSpot's own deprecation notice) — EVERY logo
// lookup through it has been failing outright since, which is the real
// reason logos looked completely broken for even extremely well-known
// companies like Google/Amazon, not a flaw in the domain-guessing logic
// itself. See utils/companyLogo.ts / company_logo_service.py's own
// comments for the replacement service.
type Size = 'tiny' | 'small' | 'medium' | 'large' | 'giant';

const SIZE_PX: Record<Size, number> = {
  tiny: 24,
  small: 32,
  medium: 40,
  large: 48,
  giant: 72,
};

const ICON_SIZE_PX: Record<Size, number> = {
  tiny: 12,
  small: 16,
  medium: 18,
  large: 22,
  giant: 32,
};

interface Props {
  logoUrl?: string | null;
  companyName?: string | null;
  size?: Size;
  shape?: 'round' | 'rounded' | 'square';
  style?: StyleProp<ViewStyle>;
  /** Icon shown when there's no logo URL, or it failed to load. Defaults to
   * the generic company/building glyph — pass 'briefcase-outline' for a
   * job-listing context (Job Alerts, Applications), which explicitly asked
   * for that icon specifically. */
  fallbackIcon?: 'building-outline' | 'briefcase-outline';
}

const CompanyLogoAvatar = memo(
  ({logoUrl, companyName, size = 'medium', shape = 'rounded', style, fallbackIcon = 'building-outline'}: Props) => {
    const theme = useTheme();
    const [failed, setFailed] = useState(false);

    if (logoUrl && !failed) {
      return (
        <Avatar
          source={{uri: logoUrl}}
          size={size}
          shape={shape}
          style={style}
          onError={() => setFailed(true)}
        />
      );
    }

    const px = SIZE_PX[size];

    return (
      <View
        // `companyName` is still accepted as a prop (several call sites
        // pass it for accessibility/semantic purposes even though it no
        // longer renders as visible text) — accessibilityLabel keeps that
        // use meaningful rather than a silent no-op prop.
        accessibilityLabel={companyName ?? undefined}
        style={[
          {
            width: px,
            height: px,
            borderRadius: shape === 'round' ? px / 2 : px / 4,
            backgroundColor: theme['background-basic-color-3'],
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          },
          style,
        ]}>
        <Icon
          pack="eva"
          name={fallbackIcon}
          style={[
            globalStyle.icon20,
            {
              width: ICON_SIZE_PX[size],
              height: ICON_SIZE_PX[size],
              tintColor: theme['text-hint-color'],
            },
          ]}
        />
      </View>
    );
  },
);

export default CompanyLogoAvatar;
