import React, {memo} from 'react';
import {View} from 'react-native';
import {Icon, useTheme} from '@ui-kitten/components';

import Text from './Text';
import Flex from './Flex';
import {globalStyle} from 'styles/globalStyle';

interface Props {
  icon?: string;
  iconPack?: 'eva' | 'assets';
  children: React.ReactNode;
  variant?: 'accent' | 'neutral';
  style?: any;
}

// Soft-tinted, borderless hint/tip box (product request item — explicit
// ZipRecruiter reference: the "Be Seen First" box on the job details screen
// and the location-mismatch notice, both a rounded fill with no border,
// optionally an icon, and a line of explanatory copy). Distinct from
// StatusBadge (a short pill label) — this is for a full sentence of
// context, not a one-word tag. `accent` (soft purple fill) matches the
// reference's "Be Seen First" treatment; `neutral` (soft gray fill) is for
// a plain informational note that isn't tied to any particular feature.
const InfoBox = memo(({icon, iconPack = 'eva', children, variant = 'neutral', style}: Props) => {
  const theme = useTheme();
  const bg = variant === 'accent' ? theme['color-accent-purple-bg'] : theme['background-basic-color-2'];
  const iconColor = variant === 'accent' ? theme['color-accent-purple'] : theme['text-basic-color'];

  return (
    <Flex
      itemsCenter
      justify="flex-start"
      style={[
        {
          backgroundColor: bg,
          borderRadius: 14,
          padding: 14,
        },
        style,
      ]}>
      {icon ? (
        <View style={{marginRight: 10}}>
          <Icon pack={iconPack} name={icon} style={[globalStyle.icon20, {tintColor: iconColor}]} />
        </View>
      ) : null}
      <Text category="h10" style={{flex: 1, color: iconColor}}>
        {children}
      </Text>
    </Flex>
  );
});

export default InfoBox;
