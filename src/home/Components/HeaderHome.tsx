import React, {memo} from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import Text from 'components/Text';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
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
    const {t} = useTranslation(['home', 'common']);
    return (
      <Flex justify="space-between" itemsCenter mh={24} mt={24} mb={8}>
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
          <Text category="h2" bold>
            {t(greetingKey())}
            {name ? `, ${name}` : ''}
          </Text>
          {username ? (
            <Text category="h10" status="placeholder" mt={2}>
              @{username}
            </Text>
          ) : null}
        </View>
        <Flex onPress={_onNotification} style={styles.button}>
          <NavigationAction
            icon="notification"
            status="facebook"
            onPress={() => null}
            disabled
          />
          {notification ? (
            <Flex style={styles.notification} itemsCenter border={24}>
              <Text category="h9" status={'primary'} fontSize={11} lineHeight={13}>
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
  button: {
    width: 40,
    height: 40,
    backgroundColor: 'background-basic-color-1',
    borderWidth: 1,
    borderColor: 'border-card-default',
    ...globalStyle.center,
    borderRadius: 12,
  },
});
