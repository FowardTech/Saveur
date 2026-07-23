import React, { memo } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import UserAvatar from 'components/UserAvatar';
import { MainBottomTabStackParamList } from 'navigation/types';
import ProfileTag from './components/ProfileTag';
import { AuthContext } from '../../AuthContext';

const ProfileSrc = memo(() => {
  const navigation =
    useNavigation<NavigationProp<MainBottomTabStackParamList>>();
  const { navigate } = navigation;
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const { t } = useTranslation(['more', 'auth', 'common']);
  const { profile, deleteAccount, isPro } = React.useContext(AuthContext);

  const _onEdit = () => navigate('Profile', { screen: 'EditProfile' });

  // Permanent account deletion — moved here from the main Settings list
  // (src/more/MoreSrc.tsx) so it's no longer a single careless tap away
  // from the top-level list. Reaching it now takes a deliberate "My
  // Profile" tap first, same DELETE /api/users/me flow as before (see
  // services/authService.ts / AuthContext.deleteAccount): deletes the
  // Firebase Auth account and immediately cancels any active Stripe
  // subscription rather than leaving it running after the account is gone.
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);
  const onDeleteAccount = React.useCallback(() => {
    Alert.alert(
      t('more:delete_account_confirm_title', {defaultValue: 'Permanently delete your account?'}),
      isPro
        ? t('more:delete_account_confirm_body_pro', {
            defaultValue:
              "This can't be undone. It will also cancel your subscription immediately — you'll lose access right away, not at the end of your billing period.",
          })
        : t('more:delete_account_confirm_body', {
            defaultValue: "This can't be undone. All of your data will be permanently deleted.",
          }),
      [
        {text: t('common:cancel', {defaultValue: 'Cancel'}), style: 'cancel'},
        {
          text: t('more:delete_account', {defaultValue: 'Delete Account'}),
          style: 'destructive',
          onPress: async () => {
            if (isDeletingAccount) return;
            setIsDeletingAccount(true);
            try {
              await deleteAccount();
              // 'AuthStack' lives at the root navigator, above this screen's
              // own MainBottomTabStackParamList-typed navigation — react-
              // navigation's navigate() bubbles up to find it at runtime
              // regardless of the local type, same shortcut MoreSrc.tsx used
              // for this exact call before the move.
              navigate('AuthStack' as never, {screen: 'Login'} as never);
            } catch (error: any) {
              Alert.alert(
                t('more:delete_account_failed_title', {defaultValue: "Couldn't delete your account"}),
                error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
              );
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ],
    );
  }, [deleteAccount, navigate, isDeletingAccount, isPro, t]);

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
        <UserAvatar uri={profile?.avatarUrl} name={profile?.name} size="giant" style={styles.avatar} />
        <ProfileTag
          label={t('auth:full_name')}
          title={profile?.name || t('more:default_user_name', {defaultValue: 'My Account'})}
        />
        <ProfileTag label={t('auth:email')} title={profile?.email ?? ''} />
        {/* Was hardcoded literal placeholder text ("965-954-9111" / "128
            Lincoln St #105, Boston, NY") shown to every user regardless of
            what they actually entered in Edit Profile — because
            phoneNumber/homeAddress had no backend field to round-trip
            through at all. Now reflects the real, persisted value (or a
            "Not set" placeholder if the user hasn't entered one yet). */}
        <ProfileTag
          label={t('auth:phone-number')}
          title={profile?.phoneNumber || t('more:not_set', {defaultValue: 'Not set'})}
        />
        <ProfileTag
          label={t('auth:home-address')}
          title={profile?.homeAddress || t('more:not_set', {defaultValue: 'Not set'})}
        />
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onDeleteAccount}
          disabled={isDeletingAccount}
          style={[styles.deleteRow, {opacity: isDeletingAccount ? 0.6 : 1}]}>
          <View style={[styles.deleteIconWrap, {backgroundColor: theme['color-danger-100']}]}>
            <Icon
              pack="eva"
              name="trash-2-outline"
              style={{width: 20, height: 20, tintColor: theme['color-danger-500']}}
            />
          </View>
          <Text ml={24} category="para-m" status="danger">
            {isDeletingAccount
              ? t('more:deleting_account', {defaultValue: 'Deleting account…'})
              : t('more:delete_account', {defaultValue: 'Delete Account'})}
          </Text>
        </TouchableOpacity>
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
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
  },
  deleteIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
