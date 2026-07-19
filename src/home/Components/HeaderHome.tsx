import React, {memo} from 'react';
import {View, ImageRequireSource} from 'react-native';
import {StyleService, useStyleSheet, Avatar} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import Text from 'components/Text';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import {RootStackParamList} from 'navigation/types';
import {globalStyle} from 'styles/globalStyle';
import {useTranslation} from 'react-i18next';

interface HeaderHomeProps {
  name: string;
  avatar: ImageRequireSource;
  email: string;
  notification?: number;
}

const HeaderHome = memo(
  ({email, avatar, name, notification}: HeaderHomeProps) => {
    const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
    const styles = useStyleSheet(themedStyles);
    const _onProfile = () => {};
    const _onNotification = () => navigate('Notification');
    const {t} = useTranslation(['home', 'common']);
    return (
      <Flex itemsCenter mh={24} mt={24} mb={8}>
        <Flex itemsCenter justify="flex-start">
          <Flex onPress={_onProfile}>
            <Avatar
              source={avatar}
              /* @ts-ignore */
              style={styles.avatar}
              shape="rounded"
            />
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
          <Flex style={styles.notification} itemsCenter border={24}>
            <Text category="h9" status={'primary'} mt={1}>
              {notification}
            </Text>
          </Flex>
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
    position: 'absolute',
    width: 14,
    height: 14,
    backgroundColor: 'color-danger-100',
    justifyContent: 'center',
    right: -4,
    top: -4,
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
