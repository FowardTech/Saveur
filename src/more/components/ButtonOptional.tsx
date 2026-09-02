import React from 'react';
import {Alert, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';

import Text from 'components/Text';
import {
  useStyleSheet,
  StyleService,
  Icon,
  Toggle,
  useTheme,
} from '@ui-kitten/components';
import Flex from 'components/Flex';
import ProBadge from 'components/ProBadge';
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
  // REDESIGN, ROUND 1 (product reference — iOS Settings app: a colored
  // rounded-square badge behind each row's icon, white glyph on top). This
  // prop had a long back-and-forth history — ButtonFill's circular
  // shadowed squircle originally, then dropped entirely for a flat
  // no-chip glyph, then this colored badge, then reverted again ("remove
  // the backgrounds from the icons... give the icons the black color they
  // were before"). No longer read anywhere; kept in the type only so
  // MoreSrc.tsx's DATA_DETAILS/DATA_APPLICATION entries (which still pass
  // it, now inert) don't need a separate sweep to strip it. `gradientColors`
  // below is the REAL badge prop again now.
  iconBackgroundColor?: string;
  // REDESIGN, ROUND 2 (product request: "give all the icons in the setting
  // a lineargradient background. Like the screenshot above" — the iOS
  // Settings app, each row's icon on its own colored rounded-square badge).
  // Opt-in two-stop gradient (MoreSrc.tsx cycles a fixed palette across all
  // its rows via index) rendered behind the icon glyph -- see the render
  // call site below for how it's layered. When set, the glyph itself
  // renders solid white (matches ActionCard.tsx's own gradient-variant
  // icon tinting) since a white line icon is the only thing guaranteed
  // legible against an arbitrary saturated color.
  gradientColors?: string[];
  // Back in real use (see iconBackgroundColor's own comment above) — the
  // icon glyph's tint when no gradientColors is passed, the same plain
  // theme-adaptive black/white color (MoreSrc.tsx's ICON_GLYPH) every row
  // used before the badge redesign.
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
  // Small gold "PRO" pill after the row title (reference: gold PRO pills
  // on the paywall) -- for the one row that's literally "go manage/buy
  // your Pro plan" (Subscription), not every premium-adjacent row, so it
  // stays meaningful rather than turning into visual noise across the
  // whole menu. See components/ProBadge.tsx.
  showProBadge?: boolean;
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
  iconColor,
  gradientColors,
  badgeCount,
  badgeDot,
  showProBadge,
}: ButtonOptionalProps) => {
  const isGradient = !!gradientColors?.length;
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
        <View style={[styles.iconWrap, isGradient && styles.iconWrapGradient]}>
          {/* REDESIGN, ROUND 2 (see gradientColors' own prop comment) — a
              colored rounded-square badge behind the icon again, per
              explicit product request with the iOS Settings app as the
              reference. Same "gradient as an absoluteFill sibling layer
              behind the real content, not as the layout container itself"
              pattern already established and fixed once before in this
              codebase (ActionCard.tsx's own gradient variant, Home
              banner's homeBannerFallback) — LinearGradient doesn't
              reliably size itself to wrap arbitrary content the way a
              plain View does, so it's never used AS iconWrap here, just
              painted to exactly fill iconWrap's own fixed 32x32 box
              (overflow: hidden on iconWrapGradient clips it to that box's
              rounded corners). */}
          {isGradient ? (
            <LinearGradient
              colors={gradientColors as [string, string, ...string[]]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}
          <Icon
            pack="assets"
            name={icon}
            style={{width: 20, height: 20, tintColor: isGradient ? '#FFFFFF' : iconColor ?? theme['text-basic-color']}}
          />
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
        {showProBadge ? <ProBadge style={{marginLeft: 8}} /> : null}
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
        // sub-screen" affordance for a settings list row. Product follow-up
        // ("the chevron icons color should be very light gray"): was
        // text-basic-color (near-black) -- color-basic-400 (#E0E0E0, this
        // app's own palest gray step) reads as a quiet trailing affordance
        // rather than competing with the row's icon/title for attention.
        <Icon
          pack="assets"
          name="chevronRight"
          style={[globalStyle.icon20, {tintColor: theme['color-basic-400']}]}
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
  // Fixed-size box around the icon glyph -- gives the row a consistent icon
  // column width/alignment whether or not a gradient badge is behind it,
  // and gives badgeCount/badgeDot below a stable box to corner-anchor
  // against.
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Gradient variant (see gradientColors' own comment) -- sized/rounded to
  // read as the iOS Settings app's own rounded-square icon badge.
  // overflow: 'hidden' is what clips the absolutely-filled LinearGradient
  // sibling to this box's own borderRadius.
  iconWrapGradient: {
    width: 32,
    height: 32,
    borderRadius: 9,
    overflow: 'hidden',
  },
  // Same corner-badge idea as HeaderHome.tsx's bell badge, re-tuned for the
  // plain 28x28 icon box above (was tuned for a 32x32 colored badge during
  // the since-reverted iOS-Settings redesign).
  badgeCount: {
    position: 'absolute',
    top: -4,
    right: -6,
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
    top: -1,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'color-danger-100',
    borderWidth: 2,
    borderColor: 'background-basic-color-1',
  },
});
