import React, {memo} from 'react';
import {View, StyleProp, ViewStyle} from 'react-native';
import {Avatar, Icon, useTheme} from '@ui-kitten/components';
import Text from './Text';

// Shows the user's real uploaded photo when they have one. Otherwise falls
// back to a neutral placeholder — NOT one of the leftover childcare-template
// stock photos (assets/images's avatar1..avatar10, real photos of random
// strangers left over from the pre-Saveur template) that used to stand in
// for "no profile picture yet" across Edit Profile, the Profile tab, and the
// More/Home tab headers. A stranger's face was never a sensible "you haven't
// set a photo" state.
//
// When a `name` is available (it always is once signed in, whether via
// email or Google), the fallback is the user's initials on a colored circle
// rather than a generic person icon — this is what shows immediately after
// a Google sign-in, since Google's own profile photo isn't always returned/
// synced, until the person sets their own photo in Edit Profile.
type Size = 'tiny' | 'small' | 'medium' | 'large' | 'giant';

// Mirrors Eva Design's own Avatar size scale (in px) so the fallback circle
// is pixel-identical in size to a real photo at the same `size` prop.
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
  uri?: string | null;
  name?: string | null;
  size?: Size;
  style?: StyleProp<ViewStyle>;
  // Defaults to this component's original rounded-square look everywhere
  // it was already in use (Edit Profile, Profile tab, More/Home headers,
  // etc.) so nothing else changes. 'round' gives a fully circular avatar —
  // added for the homescreen leaderboard preview per explicit follow-up
  // ("make it rounded instead of square shaped").
  shape?: 'rounded' | 'round';
}

function getInitials(name?: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

const UserAvatar = memo(({uri, name, size = 'medium', style, shape = 'rounded'}: Props) => {
  const theme = useTheme();

  if (uri) {
    return <Avatar source={{uri}} size={size} shape={shape} style={style} />;
  }

  const px = SIZE_PX[size];
  const initials = getInitials(name);

  return (
    <View
      style={[
        {
          width: px,
          height: px,
          borderRadius: shape === 'round' ? px / 2 : px / 4,
          backgroundColor: initials ? theme['color-primary-500'] : theme['background-basic-color-3'],
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}>
      {initials ? (
        <Text
          category={FONT_CATEGORY[size]}
          bold
          style={{color: theme['text-control-color'] ?? '#fff'}}>
          {initials}
        </Text>
      ) : (
        <Icon
          pack="eva"
          name="person"
          style={{width: px * 0.55, height: px * 0.55, tintColor: theme['text-hint-color']}}
        />
      )}
    </View>
  );
});

export default UserAvatar;
