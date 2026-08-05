import React, {memo} from 'react';
import {Alert, TouchableOpacity} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Input,
  Icon,
  Spinner,
  Avatar,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import Flex from 'components/Flex';
import UserAvatar from 'components/UserAvatar';
import AvatarPickerModal from 'components/AvatarPickerModal';
import {Controller, useForm} from 'react-hook-form';
import {RuleName} from 'utils/rules';
import {RootStackParamList} from 'navigation/types';

import * as ImagePicker from 'react-native-image-picker';
import * as documentsService from 'services/documentsService';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {AuthContext} from '../../AuthContext';
import {globalStyle} from 'styles/globalStyle';

// Was entirely disconnected from the real account: hardcoded fake
// defaultValues ("Edith Johnson" / a fake email+password) and a photo picker
// that only ever set local component state — `_onSave` was just
// `() => goBack()`, so nothing here ever persisted. Now loads the real
// profile from AuthContext and actually saves both name and photo.
const EditProfile = memo(() => {
  const {goBack} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['auth', 'more', 'common']);
  const {profile, updateProfile} = React.useContext(AuthContext);

  // Optimistic local preview while the upload is in flight; falls back to
  // whatever's already persisted on the profile, then the static placeholder
  // art if the user has never set one.
  const [avatarUri, setAvatarUri] = React.useState<string | undefined>(profile?.avatarUrl);
  const [isUploadingPhoto, setIsUploadingPhoto] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Leaderboard-only avatar preset — deliberately separate state from
  // avatarUri/profile.avatarUrl above. Picking one of these must NEVER touch
  // the real profile photo (see UserProfileProps.leaderboardAvatarUrl's
  // comment in constants/Types.tsx for the full story: this used to
  // overwrite the same field as the real photo, which both clobbered a real
  // uploaded picture and defeated the leaderboard's anonymity design).
  const [leaderboardAvatarUri, setLeaderboardAvatarUri] = React.useState<string | undefined>(
    profile?.leaderboardAvatarUrl,
  );
  const [isLeaderboardPickerVisible, setIsLeaderboardPickerVisible] = React.useState(false);
  const [isSavingLeaderboardAvatar, setIsSavingLeaderboardAvatar] = React.useState(false);

  React.useEffect(() => {
    setAvatarUri(profile?.avatarUrl);
  }, [profile?.avatarUrl]);

  React.useEffect(() => {
    setLeaderboardAvatarUri(profile?.leaderboardAvatarUrl);
  }, [profile?.leaderboardAvatarUrl]);

  // Sets User.leaderboard_avatar_url ONLY — see app/api/users.py's update_me
  // and app/api/gamification.py's leaderboard() on the backend, which now
  // prefers this over the deterministic generated avatar when set. Does not
  // touch avatarUrl/picture_url in any way.
  const onSelectLeaderboardAvatar = React.useCallback(
    async (url: string) => {
      setIsLeaderboardPickerVisible(false);
      const previous = leaderboardAvatarUri;
      setLeaderboardAvatarUri(url);
      setIsSavingLeaderboardAvatar(true);
      try {
        await updateProfile({leaderboardAvatarUrl: url});
      } catch (e: any) {
        setLeaderboardAvatarUri(previous);
        Alert.alert(
          t('more:leaderboard_avatar_update_failed', {defaultValue: "Couldn't update leaderboard avatar"}),
          e?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
        );
      } finally {
        setIsSavingLeaderboardAvatar(false);
      }
    },
    [leaderboardAvatarUri, updateProfile, t],
  );

  const onPickFromLibrary = React.useCallback(() => {
    ImagePicker.launchImageLibrary(
      {mediaType: 'photo', includeBase64: false, selectionLimit: 1},
      async response => {
        const asset = response.assets?.[0];
        if (response.didCancel || !asset?.uri) return;
        setAvatarUri(asset.uri);
        setIsUploadingPhoto(true);
        try {
          // Generic file-storage endpoint (POST /api/v1/documents/upload,
          // already used elsewhere for resume/portfolio uploads) — returns a
          // real fetchable URL, which is what gets persisted as
          // profile.avatarUrl rather than the device-local picker URI.
          const doc = await documentsService.uploadDocument({
            uri: asset.uri,
            name: asset.fileName ?? `avatar_${Date.now()}.jpg`,
            mimeType: asset.type,
            sizeBytes: asset.fileSize,
            docType: 'avatar',
          });
          await updateProfile({avatarUrl: doc.url});
          setAvatarUri(doc.url);
        } catch (e: any) {
          setAvatarUri(profile?.avatarUrl);
          Alert.alert(
            t('more:update_photo_failed', {defaultValue: "Couldn't update photo"}),
            e?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
          );
        } finally {
          setIsUploadingPhoto(false);
        }
      },
    );
  }, [profile?.avatarUrl, updateProfile]);

  // "Edit photo" only ever uploads the user's real device photo now — the
  // curated preset grid (constants/avatarPresets.ts / AvatarPickerModal.tsx)
  // has its own separate control further down ("Leaderboard avatar"), since
  // it sets a completely different field (leaderboardAvatarUrl) and must
  // never be offered as an alternative way to set THIS photo (see
  // onSelectLeaderboardAvatar's comment above for why).
  const onPressEditPhoto = React.useCallback(() => {
    onPickFromLibrary();
  }, [onPickFromLibrary]);

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm({
    values: {
      fullName: profile?.name ?? '',
      phoneNumber: profile?.phoneNumber ?? '',
      homeAddress: profile?.homeAddress ?? '',
    },
  });

  const _onSave = handleSubmit(async values => {
    setIsSaving(true);
    try {
      // name/phoneNumber/homeAddress are now all real, backend-supported
      // fields (PATCH /api/users/me — see saveur-backend/app/api/users.py
      // and app/models/user.py's phone_number/home_address columns).
      // phoneNumber/homeAddress previously had no backend column at all, so
      // edits here silently never persisted and My Profile kept showing
      // hardcoded placeholder text no matter what was typed.
      const patch: Partial<typeof values> = {};
      if (values.fullName !== profile?.name) patch.fullName = values.fullName;
      if (values.phoneNumber !== (profile?.phoneNumber ?? '')) patch.phoneNumber = values.phoneNumber;
      if (values.homeAddress !== (profile?.homeAddress ?? '')) patch.homeAddress = values.homeAddress;
      if (Object.keys(patch).length > 0) {
        await updateProfile({
          ...(patch.fullName !== undefined ? {name: patch.fullName} : {}),
          ...(patch.phoneNumber !== undefined ? {phoneNumber: patch.phoneNumber} : {}),
          ...(patch.homeAddress !== undefined ? {homeAddress: patch.homeAddress} : {}),
        });
      }
      goBack();
    } catch (e: any) {
      Alert.alert(
        t('more:save_changes_failed', {defaultValue: "Couldn't save changes"}),
        e?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setIsSaving(false);
    }
  });
  const _onMap = () => {};
  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:edit-profile').toString()}
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          isSaving ? (
            <Spinner size="small" style={{marginRight: 16}} />
          ) : (
            <Text category="h7" status={'link'} onPress={_onSave} bold mr={12}>
              {t('common:save')}
            </Text>
          )
        }
      />
      <KeyboardAwareScrollView
        extraScrollHeight={40}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <Flex vertical center style={{position: 'relative'}}>
          <UserAvatar uri={avatarUri} name={profile?.name} size="giant" style={styles.avatar} />
          {isUploadingPhoto ? (
            <Flex center style={styles.avatarSpinnerOverlay}>
              <Spinner size="small" status="control" />
            </Flex>
          ) : null}
        </Flex>
        <Text
          category="h8-s"
          status={'link'}
          center
          onPress={isUploadingPhoto ? undefined : onPressEditPhoto}
          mt={24}
          mb={48}
          children={t('more:edit-photo')}
        />
        <Controller
          control={control}
          name="fullName"
          rules={RuleName}
          render={({field: {onChange, onBlur, value}}) => (
            <Input
              label={t('auth:full_name').toString()}
              status={errors.fullName ? 'warning' : 'basic'}
              style={styles.fullName}
              textStyle={globalStyle.inputText}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              caption={errors.fullName?.message}
            />
          )}
        />
        <Input
          label={t('auth:email').toString()}
          style={styles.email}
          textStyle={globalStyle.inputText}
          value={profile?.email ?? ''}
          disabled
        />
        <Controller
          control={control}
          name="phoneNumber"
          render={({field: {onChange, onBlur, value}}) => (
            <Input
              label={t('auth:phone-number').toString()}
              status={errors.phoneNumber ? 'warning' : 'basic'}
              style={styles.phoneNumber}
              textStyle={globalStyle.inputText}
              value={value}
              onChangeText={onChange}
              onTouchStart={handleSubmit(() => {})}
              onTouchEnd={handleSubmit(() => {})}
              onBlur={onBlur}
              keyboardType="numeric"
              caption={errors.phoneNumber?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="homeAddress"
          render={({field: {onChange, onBlur, value}}) => (
            <Input
              label={t('auth:home-address').toString()}
              status={errors.homeAddress ? 'warning' : 'basic'}
              style={styles.homeAddress}
              textStyle={globalStyle.inputText}
              value={value}
              onChangeText={onChange}
              onTouchStart={handleSubmit(() => {})}
              onTouchEnd={handleSubmit(() => {})}
              onBlur={onBlur}
              caption={errors.homeAddress?.message}
              accessoryRight={props => (
                <TouchableOpacity activeOpacity={0.7} onPress={_onMap}>
                  <Icon pack="assets" name={'map'} style={styles.map} />
                </TouchableOpacity>
              )}
            />
          )}
        />
        {/* Leaderboard avatar -- own dedicated control, deliberately not part
            of the "Edit photo" flow above. Product correction: this preset
            grid used to double as a replacement for the real profile photo,
            which is wrong (see onSelectLeaderboardAvatar's comment). This is
            purely cosmetic for how the user appears on the Leaderboard --
            their real name and photo are never shown there either way. */}
        <Flex justify="space-between" itemsCenter mt={32}>
          <Flex vertical style={{flex: 1, paddingRight: 16}}>
            <Text category="h8-s" bold>
              {t('more:leaderboard_avatar', {defaultValue: 'Leaderboard avatar'})}
            </Text>
            <Text category="c1" status="placeholder" mt={4}>
              {t('more:leaderboard_avatar_description', {
                defaultValue: "Shown next to your username on the Leaderboard only — separate from your profile photo.",
              })}
            </Text>
          </Flex>
          <TouchableOpacity
            activeOpacity={0.75}
            disabled={isSavingLeaderboardAvatar}
            onPress={() => setIsLeaderboardPickerVisible(true)}
            style={{position: 'relative'}}>
            {leaderboardAvatarUri ? (
              <Avatar source={{uri: leaderboardAvatarUri}} size="large" shape="rounded" />
            ) : (
              <Flex center style={styles.leaderboardAvatarPlaceholder}>
                <Icon pack="eva" name="plus-outline" style={styles.leaderboardAvatarPlaceholderIcon} />
              </Flex>
            )}
            {isSavingLeaderboardAvatar ? (
              <Flex center style={styles.avatarSpinnerOverlay}>
                <Spinner size="small" status="control" />
              </Flex>
            ) : null}
          </TouchableOpacity>
        </Flex>
      </KeyboardAwareScrollView>
      <AvatarPickerModal
        visible={isLeaderboardPickerVisible}
        currentUrl={leaderboardAvatarUri}
        onClose={() => setIsLeaderboardPickerVisible(false)}
        onSelect={onSelectLeaderboardAvatar}
      />
    </Container>
  );
});

export default EditProfile;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    marginTop: 40,
    paddingBottom: 80,
    paddingHorizontal: 24,
  },
  avatar: {
    alignSelf: 'center',
  },
  avatarSpinnerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  // Product request ("make text inputs all through the app consistent in
  // design") — matches the shared boxed border+background+radius-12 look
  // (globalStyle.inputField) used elsewhere, instead of a one-off
  // bottom-underline style.
  fullName: {
    ...globalStyle.inputField,
  },
  email: {
    ...globalStyle.inputField,
    marginVertical: 24,
  },
  phoneNumber: {
    marginVertical: 24,
    ...globalStyle.inputField,
  },
  homeAddress: {
    ...globalStyle.inputField,
  },
  map: {
    tintColor: 'button-basic-color',
  },
  leaderboardAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'border-basic-color-3',
    borderStyle: 'dashed',
  },
  leaderboardAvatarPlaceholderIcon: {
    width: 20,
    height: 20,
    tintColor: 'text-hint-color',
  },
});
