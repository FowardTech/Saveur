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
// `info` (product request: "a small banner card explaining what they
// are... should be a subtle light blue banner" — used to introduce a
// feature the user may not understand yet, e.g. Company Intelligence/
// Dream Company Dashboard/Career DNA/Job Alerts/AI Career Twin) started as
// a light-blue color-primary-transparent-100 fill.
//
// BUG FIX/REDESIGN (product follow-up: "I thought i asked you to make all
// the info cards white why are some screens still have the info card
// background as blue? Also the info card text font color should be black
// not blue" -- the original request, scoped to the Dream Company Dashboard
// screenshot at the time, only ever overrode that ONE call site's `style`
// prop rather than this shared component's own `info` variant default, so
// every other screen using variant="info" -- JobAlerts, AICareerTwin,
// CareerDna, JobAlertDetails, CompanyIntelligence -- kept the old blue
// fill/text. Now applied here instead, globally: background is the same
// plain background-basic-color-2 every other card in the app uses (not a
// literal white -- that token itself already IS white in light mode and
// resolves correctly to a dark surface in dark mode, same as `neutral`
// below), and the text color is a separate `textColor` (theme's normal
// text-basic-color, dark in light mode / light in dark mode) instead of
// being tied to `iconColor`. Icon glyph + the left accent stripe below
// intentionally STILL use iconColor (blue) -- only the fill and the text
// were called out as wrong, not the icon or border.
const InfoBox = memo(({icon, iconPack = 'eva', children, variant = 'neutral', style}: Props) => {
  const theme = useTheme();
  const bg = variant === 'accent'
    ? theme['color-accent-purple-bg']
    : theme['background-basic-color-2'];
  const iconColor = variant === 'accent'
    ? theme['color-accent-purple']
    : variant === 'info'
    ? theme['color-primary-500']
    : theme['text-basic-color'];
  const textColor = variant === 'info' ? theme['text-basic-color'] : iconColor;

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
          borderRadius: 16,
          padding: 12,
        },
        variant === 'info' && {
          borderLeftWidth: 3,
          borderLeftColor: iconColor,
          // BUG FIX (product report: "I told you that the border radius of
          // the info cards should be 5 or 6 why is the one in the company
          // intelligence still having a different border radius") -- that
          // request only ever got applied as a per-call-site `style`
          // override on DreamCompanies.tsx's own InfoBox, not here on the
          // shared component's own default -- so every OTHER variant="info"
          // call site (CompanyIntelligence.tsx, CareerDna.tsx,
          // AICareerTwin.tsx) kept the un-reduced 16px default the whole
          // time. Scoped to `info` only, matching the original request's
          // own scope -- `neutral`/`accent` are a different, unrelated use
          // (JobAlerts.tsx) that was never part of this ask.
          borderRadius: 6,
        },
        style,
      ]}>
      {icon ? (
        <View style={{marginRight: 10, marginTop: 1}}>
          <Icon pack={iconPack} name={icon} style={[globalStyle.icon16, {tintColor: iconColor}]} />
        </View>
      ) : null}
      <Text category="h10" numberOfLines={2} style={{flex: 1, color: textColor}}>
        {children}
      </Text>
    </Flex>
  );
});

export default InfoBox;
