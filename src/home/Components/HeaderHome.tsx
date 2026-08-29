import React, {memo} from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet, useTheme, Icon} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import Text from 'components/Text';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import DrawerMenuButton from 'components/DrawerMenuButton';
import {RootStackParamList} from 'navigation/types';
import {globalStyle} from 'styles/globalStyle';
import {useTranslation} from 'react-i18next';

// Was hardcoded to "Good morning!" regardless of actual time of day.
// Standard 3-way split: before noon / before 6pm / after — uses the
// device's local clock (Date, not UTC), same as every other on-device
// timestamp already displayed in this app.
function greetingKey(): 'home:good_morning' | 'home:good_afternoon' | 'home:good_evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'home:good_morning';
  if (hour < 18) return 'home:good_afternoon';
  return 'home:good_evening';
}

interface HeaderHomeProps {
  name: string;
  // Random, non-identifying handle (see Saveur-Backend's
  // app/services/username_service.py) — shown under the real name here,
  // one of only two places besides the leaderboard where it's surfaced.
  username?: string;
  avatarUrl?: string;
  email: string;
  notification?: number;
}

const HeaderHome = memo(
  ({email, avatarUrl, name, username, notification}: HeaderHomeProps) => {
    const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
    const styles = useStyleSheet(themedStyles);
    const _onNotification = () => navigate('Notification');
    // Product request: "remove the referral pill from the for you pill and
    // place a gift icon beside the notification bell that navigates to the
    // referral screen" -- same gift-outline glyph the referral screen
    // itself already used before its own illustrated-gift-box redesign
    // (see ReferralProgram.tsx/DailyChallengeCard.tsx's own use of this
    // exact icon).
    const _onReferral = () => navigate('ReferralProgram');
    const {t} = useTranslation(['home', 'common']);
    const theme = useTheme();
    return (
      <Flex justify="space-between" itemsCenter mh={24} mt={24} mb={8}>
        {/* SYMPHONY REDESIGN (drawer nav shell) — Home is one of the 3
            drawer root screens (Home/Chat/More); this is its own way to
            open the drawer now that there's no bottom tab bar. See
            components/DrawerMenuButton.tsx's own comment. */}
        <DrawerMenuButton />
        {/* Redesign (product follow-up, ZipRecruiter reference screenshot —
            "Good evening, Ayotunde" as one big bold greeting, no avatar
            circle at all on this screen). Was a small h8-s "Good morning"
            line + a separate h6 bold name line next to a UserAvatar circle
            — the avatar's own onPress was already a no-op stub (`_onProfile
            = () => {}`), so it wasn't a real affordance to begin with, and
            the account/profile screen is already one tap away on the Menu
            tab. h2 (26px) is this app's biggest available heading size
            below h1 (see components/Text.tsx's category union — there's no
            h3/h4 gap to fill, h1 at 34px reads too large for a two-line
            wrapped greeting on a narrow screen). */}
        <View style={globalStyle.flexOne}>
          {/* SYMPHONY REDESIGN follow-up (product report: "the greeting is
              too big you need to reduce it to at least 17px") -- was 26px
              (see the bug-fix history above, itself a pin-back from an
              even larger 30px app-wide bump). Matches the reference app's
              own modest, single-line greeting size instead of a big bold
              hero headline. category="h2"/bold kept (weight/family), only
              the explicit size/line-height overridden -- same override
              mechanism the previous pin-back already established. */}
          <Text category="h2" bold fontSize={17} lineHeight={24}>
            {t(greetingKey())}
            {name ? `, ${name}` : ''}
          </Text>
          {username ? (
            <Text category="h10" status="placeholder" mt={2}>
              @{username}
            </Text>
          ) : null}
        </View>
        {/* Product request: "Remove the trophy icon beside the gift icon" --
            was `_onLeaderboard` navigating to Leaderboard.tsx; that
            destination is still reachable from the "For You" row's own
            Leaderboard pill (see HomeSrc.tsx), so nothing is lost, just
            this one duplicate entry point here. */}
        <Flex onPress={_onReferral} style={[styles.button, styles.headerIconButton]}>
          <Icon pack="eva" name="gift-outline" style={[styles.headerIcon, {tintColor: theme['text-basic-color']}]} />
        </Flex>
        <Flex onPress={_onNotification} style={styles.button}>
          {/* Bug fix (product report: "change the bell icon color to
              black too") -- status="facebook" tinted this with
              text-link-color (a blue), inconsistent with the gift icon
              right next to it, which is deliberately tinted
              text-basic-color (this app's "black" ink color, see that
              icon's own comment). "basic" resolves to icon-basic-color,
              which is set to the exact same value as text-basic-color in
              both themes (constants/theme/light.json, dark.json) -- same
              black in light mode, same off-white in dark mode, so the two
              icons now always match. */}
          <NavigationAction
            icon="notification"
            status="basic"
            onPress={() => null}
            disabled
          />
          {notification ? (
            <Flex style={styles.notification} itemsCenter border={24}>
              {/* Was status="primary" -- that used to render white only
                  because text-primary-color used to equal white; it's now
                  blue (see the light.json "search the web" fix), so this
                  count went blue-on-red instead of white-on-red.
                  status="control" is the token this app uses elsewhere for
                  "always white on a colored surface". */}
              <Text category="h9" status={'control'} fontSize={11} lineHeight={13}>
                {notification > 9 ? '9+' : notification}
              </Text>
            </Flex>
          ) : null}
        </Flex>
      </Flex>
    );
  },
);

export default HeaderHome;

const themedStyles = StyleService.create({
  notification: {
    // Was 14x14 with a 14px-font label -- the digit(s) were larger than
    // their own badge, so counts (especially "9+") clipped. 20x20 is the
    // standard moderate size for a two-character count badge.
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: 'color-danger-100',
    justifyContent: 'center',
    right: -6,
    top: -6,
  },
  // Google-style furnishing pass (see src/home/QuickActionGrid.tsx's own
  // comment on this app-wide direction) -- was a white square with a
  // hairline border, then a Material 3 tonal-fill circle (gray
  // background-basic-color-3, no border). Product follow-up: "remove the
  // gray background from the notification bell and trophy icon" -- back
  // to a plain, unfilled tap target: just the icon itself, sized/centered
  // the same as before so the touch target doesn't shrink. `border-radius:
  // width/2` kept (harmless with no visible fill) in case a future pass
  // wants a fill or ripple back.
  button: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
    ...globalStyle.center,
    borderRadius: 20,
  },
  headerIconButton: {
    marginRight: 10,
  },
  headerIcon: {
    width: 22,
    height: 22,
  },
});
