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
  // REDESIGN (product reference — a plain flat icon-list settings screen,
  // no colored circle/chip behind each row's icon at all, matching the
  // "iconBackgroundColor"/"iconBorderColor" era's opposite direction). This
  // row used to render its icon inside ButtonFill's circular, shadowed
  // squircle background — iconBackgroundColor/iconBorderColor controlled
  // that circle's fill/ring color. The circle is gone entirely now (see the
  // render below, a plain <Icon> with no wrapping container); these two
  // props are kept in the type (and MoreSrc.tsx's DATA_DETAILS/
  // DATA_APPLICATION entries still pass them) purely so that file didn't
  // need a separate sweep to strip 30+ now-inert values — they're simply
  // unused here now.
  iconBackgroundColor?: string;
  // Still meaningful — the plain icon's own tint color.
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
  iconColor,
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
      mt={24}
      onPress={onPress ? onPress : onNavigate}>
      <Flex justify="flex-start" itemsCenter>
        <View>
          {/* REDESIGN — was ButtonFill (a 40x40 shadowed circle behind the
              icon); now a plain, unwrapped icon glyph directly next to the
              label, matching the reference settings-list look (flat icon +
              text rows, no chip/background). */}
          <Icon
            pack="assets"
            name={icon}
            style={{width: 22, height: 22, tintColor: iconColor ?? theme['text-basic-color']}}
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
        {/* Product request: bold + a touch smaller than the previous
            para-m default, matching the reference settings list's text
            weight/size. */}
        <Text ml={16} category="para-s" bold>
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
  container: {},
  // Same 20x20/count-badge shape as HeaderHome.tsx's bell badge (see that
  // file's own sizing comment) — a small colored circle sitting on the
  // icon's top-right corner, offset just enough to look like it's
  // "attached" to the icon rather than floating. Offsets pushed out a
  // little further than before (-4/-4 -> -6/-8) now that the icon itself
  // shrank from a 40x40 circle to a plain 22x22 glyph — same relative
  // "corner badge" look on the smaller icon instead of swallowing half of it.
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
    top: -2,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'color-danger-100',
    borderWidth: 2,
    borderColor: 'background-basic-color-1',
  },
});
