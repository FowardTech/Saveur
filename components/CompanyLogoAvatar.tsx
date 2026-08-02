import React, {memo, useState} from 'react';
import {View, StyleProp, ViewStyle} from 'react-native';
import {Avatar, Text, useTheme} from '@ui-kitten/components';

// Company-logo counterpart to UserAvatar.tsx — same "real photo, or a clean
// generated fallback, never a random stock photo" philosophy, but the logo
// URL here (see services/jobAlertsService.ts / applicationsService.ts) is a
// best-effort guess built server-side (Perplexity's reported company domain
// when available, else a slugified-company-name-plus-.com heuristic, run
// through Clearbit's logo API) rather than something the user or company
// verified themselves — wrong guesses are expected and will 404. `onError`
// below is what makes that degrade to the fallback instead of rendering a
// broken image.
type Size = 'tiny' | 'small' | 'medium' | 'large' | 'giant';

const SIZE_PX: Record<Size, number> = {
  tiny: 24,
  small: 32,
  medium: 40,
  large: 48,
  giant: 72,
};

const FONT_CATEGORY: Record<Size, 'h9' | 'h8' | 'h7' | 'h6' | 'h3'> = {
  tiny: 'h9',
  small: 'h8',
  medium: 'h7',
  large: 'h6',
  giant: 'h3',
};

interface Props {
  logoUrl?: string | null;
  companyName?: string | null;
  size?: Size;
  shape?: 'round' | 'rounded' | 'square';
  style?: StyleProp<ViewStyle>;
}

function getInitial(name?: string | null): string {
  if (!name) return '';
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : '';
}

const CompanyLogoAvatar = memo(({logoUrl, companyName, size = 'medium', shape = 'rounded', style}: Props) => {
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
  const initial = getInitial(companyName);

  return (
    <View
      style={[
        {
          width: px,
          height: px,
          borderRadius: shape === 'round' ? px / 2 : px / 4,
          backgroundColor: initial ? theme['color-primary-500'] : theme['background-basic-color-3'],
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}>
      {/* BUG FIX (custom fonts not rendering on Android): the initial's
          <Text> used to set `fontWeight: 'bold'` in style without the
          `bold` prop, so Text.tsx rendered the family as
          PlusJakartaSans-Regular while this local override asked Android
          for a BOLD style — it looked for a nonexistent
          "PlusJakartaSans-Regular_bold.ttf" and fell back to the system
          font. Using the `bold` prop instead selects the real
          PlusJakartaSans-Bold.ttf file by name, which Android can
          actually find. */}
      {initial ? (
        <Text category={FONT_CATEGORY[size]} bold style={{color: theme['text-control-color'] ?? '#fff'}}>
          {initial}
        </Text>
      ) : (
        <Text category={FONT_CATEGORY[size]} style={{color: theme['text-hint-color']}}>
          ?
        </Text>
      )}
    </View>
  );
});

export default CompanyLogoAvatar;
