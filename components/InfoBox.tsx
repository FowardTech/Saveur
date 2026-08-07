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
  variant?: 'accent' | 'neutral' | 'info';
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
// `info` (subtle light-blue fill, product request: "a small banner card
// explaining what they are... should be a subtle light blue banner" —
// used to introduce a feature the user may not understand yet, e.g.
// Company Intelligence/Dream Company Dashboard/Career DNA) reuses the same
// color-primary-transparent-100 tint this app already uses for other soft
// blue accents (see LearningCourses.tsx's continueIconWrap), just applied
// at banner scale instead of a small icon chip.
const InfoBox = memo(({icon, iconPack = 'eva', children, variant = 'neutral', style}: Props) => {
  const theme = useTheme();
  const bg = variant === 'accent'
    ? theme['color-accent-purple-bg']
    : variant === 'info'
    ? theme['color-primary-transparent-100']
    : theme['background-basic-color-2'];
  const iconColor = variant === 'accent'
    ? theme['color-accent-purple']
    : variant === 'info'
    ? theme['color-primary-500']
    : theme['text-basic-color'];

  // Product report: "make the info banner look like a real info banner" —
  // a borderless flat-tint rectangle with no other cue reads as just
  // another card on the screen, not specifically an informational callout.
  // A colored left accent stripe (the same convention a real "info/note"
  // banner uses everywhere — docs sites, IDEs, form validation hints) makes
  // the "this is a tip, not content" read immediate at a glance. Scoped to
  // `info` only — `neutral`/`accent` are used elsewhere (JobAlerts.tsx) for
  // a plainer soft-fill notice that wasn't part of this report, so left as
  // they were. itemsCenter -> flex-start so the icon sits at the top of the
  // text block instead of vertically centered against it (centered looked
  // fine for one line, but drifted the icon oddly once the copy wraps to
  // two).
  return (
    <Flex
      justify="flex-start"
      style={[
        {
          backgroundColor: bg,
          borderRadius: 10,
          padding: 12,
        },
        variant === 'info' && {
          borderLeftWidth: 3,
          borderLeftColor: iconColor,
        },
        style,
      ]}>
      {icon ? (
        <View style={{marginRight: 10, marginTop: 1}}>
          <Icon pack={iconPack} name={icon} style={[globalStyle.icon16, {tintColor: iconColor}]} />
        </View>
      ) : null}
      <Text category="h10" numberOfLines={2} style={{flex: 1, color: iconColor}}>
        {children}
      </Text>
    </Flex>
  );
});

export default InfoBox;
