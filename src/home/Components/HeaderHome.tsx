import React, {memo} from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import Text from 'components/Text';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import UserAvatar from 'components/UserAvatar';
import {RootStackParamList} from 'navigation/types';
import {globalStyle} from 'styles/globalStyle';
import {useTranslation} from 'react-i18next';

interface HeaderHomeProps {
  name: string;
  avatarUrl?: string;
  email: string;
  notification?: number;
}

const HeaderHome = memo(
  ({email, avatarUrl, name, notification}: HeaderHomeProps) => {
    const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
    const styles = useStyleSheet(themedStyles);
    const _onProfile = () => {};
    const _onNotification = () => navigate('Notification');
    const {t} = useTranslation(['home', 'common']);
    return (
      <Flex itemsCenter mh={24} mt={24} mb={8}>
        <Flex itemsCenter justify="flex-start">
          <Flex onPress={_onProfile}>
            <UserAvatar uri={avatarUrl} name={name} style={styles.avatar} />
          </Flex>
          <View>
            <Text category="h8-s" mt={4}>
              {t('home:good_morning')}
            </Text>
            <Text category="h6" bold>
              {name}
            </Text>
          </View>
        </Flex>
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
  avatar: {
    marginRight: 16,
  },
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
    ...globalStyle.shadowFade,
    width: 40,
    height: 40,
    backgroundColor: 'background-basic-color-1',
    ...globalStyle.center,
    borderRadius: 12,
  },
});
