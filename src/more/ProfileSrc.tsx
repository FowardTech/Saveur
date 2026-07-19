import React, { memo } from 'react';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Avatar,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Content from 'components/Content';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import { MainBottomTabStackParamList } from 'navigation/types';
import { Images } from 'assets/images';
import ProfileTag from './components/ProfileTag';

const ProfileSrc = memo(() => {
  const { navigate } =
    useNavigation<NavigationProp<MainBottomTabStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'auth', 'common']);

  const _onEdit = () => navigate('Profile', { screen: 'EditProfile' });
  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:profiles').toString()}
        accessoryLeft={() => <NavigationAction />}
        accessoryRight={() => (
          <NavigationAction icon="edit" onPress={_onEdit} />
        )}
      />
      <Content contentContainerStyle={styles.content} padder>
        <Avatar
          source={Images.avatar2}
          shape="rounded"
          size={'giant'}
          /* @ts-ignore */
          style={styles.avatar}
        />
        <ProfileTag label={t('auth:full_name')} title="Edith Johnson" />
        <ProfileTag label={t('auth:email')} title="lehieuds@gmail.com" />
        <ProfileTag
          label={t('auth:password')}
          title="Edith Johnson"
          secureTextEntry
        />
        <ProfileTag label={t('auth:phone-number')} title="965-954-9111" />
        <ProfileTag
          label={t('auth:home-address')}
          title="128 Lincoln St #105, Boston, NY"
        />
      </Content>
    </Container>
  );
});

export default ProfileSrc;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    marginTop: 40,
  },
  avatar: {
    alignSelf: 'center',
    marginBottom: 48,
  },
});
