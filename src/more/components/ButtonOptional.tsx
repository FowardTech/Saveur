import React from 'react';
import {Alert, View} from 'react-native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import {
  useStyleSheet,
  StyleService,
  Icon,
  Toggle,
  useTheme,
} from '@ui-kitten/components';
import Flex from 'components/Flex';
import GradientIconBadge from 'components/GradientIconBadge';
import {globalStyle} from 'styles/globalStyle';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {MainBottomTabStackParamList} from 'navigation/types';

export interface ButtonOptionalProps {
  title: string;
  icon: string;
  onPress?(): void;
  navigateSrc?:
    | 'ProfileSrc'
    | 'EditProfile'
    | 'PaymentMethod'
    | 'ChangeCareType'
    | 'MoreSrc';
  withToggle?: boolean;
  checked?: boolean;
  // REDESIGN (product reference — iOS Settings app: a colored rounded-
  // square badge behind each row's icon, white glyph on top). This prop
  // had a long back-and-forth history — ButtonFill's circular shadowed
  // squircle originally, then dropped entirely for a flat no-chip glyph —
  // and is back in real use again now, this time as a small square badge
  // rather than a big circle. See the render below.
  // REDESIGN follow-up (product report: "the icon background in screenshot
  // i showed you are glossy gradient") — this used to be applied as a flat
  // `backgroundColor` directly; it's now handed to GradientIconBadge
  // (components/GradientIconBadge.tsx) as its base color instead, which
  // derives a glossy two-tone gradient + highlight sheen from it. Callers
  // (MoreSrc.tsx's STATUS_COLORS map) didn't need to change at all — same
  // single hex per row, just rendered differently underneath.
  iconBackgroundColor?: string;
  // No longer applied — the icon badge's glyph is always white now (see
  // iconBackgroundColor above), so a separate glyph tint has nothing left
  // to vary against. Kept in the type only so MoreSrc.tsx's DATA_DETAILS/
  // DATA_APPLICATION entries (which still pass it) don't need a separate
  // sweep to strip a now-inert value.
  iconColor?: string;
  iconBorderColor?: string;
  // Small unread indicator on the icon's top-right corner (product request
  // item: "job alert, daily industry news and Weekly reports count badge so
  // that users can know when new updates arrive" — see
  // services/moreMenuBadgesService.ts). `badgeCount` renders a numeric pill
  // (clamped "9+", same convention as HeaderHome.tsx's bell badge) for
  // Job Alerts, which has a real per-item unread count; `badgeDot` renders a
  // plain dot for Daily Industry News / Weekly Career Report, which are each
  // a single cached blob per period rather than a countable list — there's
  // no meaningful "how many", just "is there something new". If both are
  // passed, the count wins.
  badgeCount?: number;
  badgeDot?: boolean;
  status:
    | 'basic'
    | 'danger'
    | 'placeholder'
    | 'success'
    | 'facebook'
    | 'warning'
    | 'twitter'
    | 'green'
    | 'twitter-3'
    | 'white'
    | 'transparent'
    | 'neutral';
}

const ButtonOptional = ({
  title,
  icon = 'back',
  onPress,
  withToggle,
  checked,
  navigateSrc,
  iconBackgroundColor,
  badgeCount,
  badgeDot,
}: ButtonOptionalProps) => {
  const theme = useTheme();
  const {t} = useTranslation(['more', 'common']);
  const {navigate, goBack} =
    useNavigation<NavigationProp<MainBottomTabStackParamList>>();

  const onNavigate = React.useCallback(() => {
    if (navigateSrc === undefined) {
      Alert.alert(
        t('common:warning', {defaultValue: 'Warning'}),
        t('more:feature_not_available', {defaultValue: 'This feature is not available yet'}),
      );
    } else {
      navigate('Profile', {screen: navigateSrc});
    }
  }, [navigateSrc, t]);
  const styles = useStyleSheet(themedStyles);
  return (
    <Flex
      style={styles.container}
      itemsCenter
      onPress={onPress ? onPress : onNavigate}>
      <Flex justify="flex-start" itemsCenter>
        <View>
          {/* REDESIGN (product reference — iOS Settings app: each row's
              icon sits inside a small colored rounded-square badge, white
              glyph on top, instead of a bare tinted icon). Was a plain,
              unwrapped icon glyph directly next to the label (see this
              comment's own git history for the two earlier redesigns that
              led here — a shadowed circle, then a flat no-chip glyph).
              iconBackgroundColor is finally used again (MoreSrc.tsx now
              passes a distinct color per row instead of the old uniform
              gray) — the glyph itself is always white now, matching every
              icon in the reference screenshot regardless of the badge's
              own color.
              REDESIGN follow-up ("the icon background... is glossy
              gradient") — GradientIconBadge in place of a flat-colored
              View, see iconBackgroundColor's own comment above. */}
          <GradientIconBadge
            color={iconBackgroundColor ?? theme['color-primary-500']}
            size={32}
            radius={9}>
            <Icon pack="assets" name={icon} style={{width: 18, height: 18, tintColor: '#fff'}} />
          </GradientIconBadge>
          {badgeCount ? (
            <View style={styles.badgeCount}>
              <Text category="h9" status="control" fontSize={11} lineHeight={13}>
                {badgeCount > 9 ? '9+' : badgeCount}
              </Text>
            </View>
          ) : badgeDot ? (
            <View style={styles.badgeDot} />
          ) : null}
        </View>
        {/* Product request: a touch smaller than the previous para-m
            default, matching the reference settings list's text size.
            Weight/color history: first went bold + opacity 0.75 (a
            follow-up: "reduce the blackness of the menu items texts").
            Latest follow-up reverses the color half of that and asks for
            weight instead: "revert the blackness... back to normal but
            reduce the font weight" -- so opacity is gone (back to
            full-strength text-basic-color, already theme-aware: near-
            black in light mode, near-white in dark mode, see constants/
            theme/{light,dark}.json) and `bold` is swapped for `medium`
            (PlusJakartaSans-Medium -- see components/Text.tsx), a step
            down from Bold without dropping all the way to plain Regular. */}
        <Text ml={16} category="para-s" medium>
          {title}
        </Text>
      </Flex>
      {withToggle ? (
        <Toggle
          onChange={onPress}
          status="primary"
          onPress={onPress}
          checked={checked}
        />
      ) : (
        // Product request: was arrowRight (a full arrow, shaft + head) —
        // swapped for a plain chevron, the more conventional "opens a
        // sub-screen" affordance for a settings list row.
        <Icon
          pack="assets"
          name="chevronRight"
          style={[globalStyle.icon20, {tintColor: theme['text-basic-color']}]}
        />
      )}
    </Flex>
  );
};

export default ButtonOptional;

const themedStyles = StyleService.create({
  // Product follow-up correction: "the settings items should have full
  // width from left to right covering the full width of the screen and
  // remove the border radius" — the first pass still respected the page's
  // 24px side margin (Content's `padder`) and had rounded corners, reading
  // as a rounded card floating on the page rather than a true edge-to-edge
  // row. borderRadius is gone (square corners), and the actual edge-to-edge
  // bleed past that 24px page margin is done by the parent `details`/
  // `application` wrappers in MoreSrc.tsx (marginHorizontal: -24, see that
  // file's comment) — width:'100%' here just means "fill whatever width
  // that now-wider parent gives me", so this row ends up flush with the
  // physical screen edges on both sides. paddingHorizontal keeps the
  // icon/text from sitting flush against those edges themselves.
  //
  // Product report: "Remove the white background and border line from the
  // settings items" — was background-basic-color-2 (solid white, #FFFFFF),
  // which against Container's own level="3" gray page body (#F0F0F0, see
  // Container.tsx's comment) read as a distinct white card/tile per row —
  // the flat white-rectangle edge against the gray page is what actually
  // looked like an unwanted "border line" here, not a real borderWidth
  // (there never was one). Transparent now, completing the "plain flat
  // icon-list settings screen, no chip/background" redesign direction this
  // component's own icon already moved to (see the REDESIGN comment on the
  // Icon below) — rows are separated by the marginTop gap alone now, the
  // same way the icon row itself has no boxed chrome around it either.
  // Product report: "Reduce the gaps between the items in the settings
  // screen" — paddingVertical 14 -> 10 and marginTop 10 -> 2 (rows used to
  // sit 24px apart edge-to-edge — 14 top pad + 10 marginTop + 14 bottom pad
  // of the row above — now 22px, a noticeably tighter, denser list without
  // rows touching or feeling cramped against each other).
  container: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 2,
  },
  // Same corner-badge idea as HeaderHome.tsx's bell badge, re-tuned for the
  // new 32x32 icon badge (was tuned for a plain 22x22 glyph before this
  // redesign — see iconWrap's own comment).
  badgeCount: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: 'color-danger-100',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Plain dot variant for Daily Industry News / Weekly Career Report — a
  // "there's something new" indicator rather than a count, same idea as
  // JobAlerts.tsx's unread-item dot.
  badgeDot: {
    position: 'absolute',
    top: -3,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'color-danger-100',
    borderWidth: 2,
    borderColor: 'background-basic-color-1',
  },
});
