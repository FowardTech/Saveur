import React from 'react';
import {Alert, View} from 'react-native';

import Text from 'components/Text';
import {
  useStyleSheet,
  StyleService,
  Icon,
  Toggle,
  useTheme,
} from '@ui-kitten/components';
import Flex from 'components/Flex';
import ButtonFill from 'components/ButtonFill';
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
  // Passed straight through to ButtonFill's own `backgroundColor` override —
  // see that component for why this exists (MoreSrc.tsx's icon rows).
  iconBackgroundColor?: string;
  // Passed straight through to ButtonFill's `iconColor` / `borderColor` —
  // MoreSrc.tsx's "subtle blue background, dark blue border" icon rows.
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
  status,
  onPress,
  withToggle,
  checked,
  navigateSrc,
  iconBackgroundColor,
  iconColor,
  iconBorderColor,
  badgeCount,
  badgeDot,
}: ButtonOptionalProps) => {
  const theme = useTheme();
  const {navigate, goBack} =
    useNavigation<NavigationProp<MainBottomTabStackParamList>>();

  const onNavigate = React.useCallback(() => {
    if (navigateSrc === undefined) {
      Alert.alert('Warning', 'This feature is not available yet');
    } else {
      navigate('Profile', {screen: navigateSrc});
    }
  }, [navigateSrc]);
  const styles = useStyleSheet(themedStyles);
  return (
    <Flex
      style={styles.container}
      itemsCenter
      mt={24}
      onPress={onPress ? onPress : onNavigate}>
      <Flex justify="flex-start" itemsCenter>
        <View>
          <ButtonFill
            icon={icon}
            status={status}
            size="medium"
            backgroundColor={iconBackgroundColor}
            iconColor={iconColor}
            borderColor={iconBorderColor}
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
        <Text ml={24} category="para-m">
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
        <Icon
          pack="assets"
          name="arrowRight"
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
  // icon square's top-right corner, offset just enough to look like it's
  // "attached" to the icon rather than floating.
  badgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
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
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'color-danger-100',
    borderWidth: 2,
    borderColor: 'background-basic-color-1',
  },
});
