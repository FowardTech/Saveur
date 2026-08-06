import React, {memo} from 'react';
import {ActivityIndicator, Alert, TouchableOpacity} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
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
import * as authService from 'services/authService';
import * as configService from 'services/configService';
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
  const theme = useTheme();
  const {t} = useTranslation(['auth', 'more', 'common']);
  const {profile, updateProfile, refreshProfile} = React.useContext(AuthContext);

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

  // Product request: "the user should be able to edit and update the auto
  // generated username the app gives to them by themselves" — until now the
  // only place to change it was ChooseUsername.tsx, a one-time signup step
  // (post-signup users could never reach it again). Reuses that screen's
  // exact validation UX (debounced live availability check via
  // authService.checkUsernameAvailability, same three failure reasons,
  // "Generate another" via authService.regenerateUsername) rather than
  // inventing a second pattern, since authService/the backend already fully
  // support editing a username at any time — PATCH /api/users/me already
  // accepts `username`, this screen's own form/save flow just never offered
  // it as a field.
  // Admin toggle (product request: "make all those new features
  // configurable in the admin") — off hides the field and skips its
  // effects/save-path entirely, same as if this whole feature had never
  // shipped. Read once per mount rather than via a hook: this is a static
  // remote-config value already cached at app startup (see
  // services/configService.ts), not something that changes mid-session.
  const usernameEditingEnabled = configService.isFeatureEnabled('username_editing');
  const [username, setUsername] = React.useState(profile?.username ?? '');
  React.useEffect(() => {
    setUsername(profile?.username ?? '');
  }, [profile?.username]);
  const [isRegeneratingUsername, setIsRegeneratingUsername] = React.useState(false);
  type UsernameCheckState = 'idle' | 'checking' | 'available' | 'invalid_format' | 'looks_like_name' | 'taken';
  const [usernameCheckState, setUsernameCheckState] = React.useState<UsernameCheckState>('idle');

  React.useEffect(() => {
    const candidate = username.trim();
    // No live check needed if it's just the untouched value already on the
    // profile — only a *change* needs re-validating against the backend.
    if (!usernameEditingEnabled || !candidate || candidate === profile?.username) {
      setUsernameCheckState('idle');
      return;
    }
    setUsernameCheckState('checking');
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await authService.checkUsernameAvailability(candidate);
        if (cancelled) return;
        setUsernameCheckState(result.available ? 'available' : (result.reason as UsernameCheckState) ?? 'taken');
      } catch {
        if (!cancelled) setUsernameCheckState('idle');
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, profile?.username, usernameEditingEnabled]);

  const usernameChanged = usernameEditingEnabled && username.trim() !== (profile?.username ?? '');
  const usernameBlocksSave = usernameChanged && usernameCheckState !== 'available';

  const onRegenerateUsername = React.useCallback(async () => {
    if (isRegeneratingUsername) return;
    setIsRegeneratingUsername(true);
    try {
      const next = await authService.regenerateUsername();
      setUsername(next);
      await refreshProfile();
    } catch (e: any) {
      Alert.alert(
        t('more:update_username_failed', {defaultValue: "Couldn't generate a new username"}),
        e?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setIsRegeneratingUsername(false);
    }
  }, [isRegeneratingUsername, refreshProfile, t]);

  const usernameStatusCopy = (): {text: string; tone: 'placeholder' | 'success' | 'danger'} | null => {
    switch (usernameCheckState) {
      case 'checking':
        return {text: t('auth:username_checking', {defaultValue: 'Checking availability…'}), tone: 'placeholder'};
      case 'available':
        return {text: t('auth:username_available', {defaultValue: 'Username available'}), tone: 'success'};
      case 'taken':
        return {text: t('auth:username_taken', {defaultValue: 'That username has already been taken'}), tone: 'danger'};
      case 'looks_like_name':
        return {
          text: t('auth:username_looks_like_name', {
            defaultValue: "That looks too close to your real name — pick something more anonymous.",
          }),
          tone: 'danger',
        };
      case 'invalid_format':
        return {
          text: t('auth:username_invalid_format', {
            defaultValue: '3-20 characters, starting with a letter — letters, numbers, and underscores only.',
          }),
          tone: 'danger',
        };
      default:
        return null;
    }
  };
  const usernameStatus = usernameStatusCopy();

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
    // Guard the whole save, not just skip the username field, if they've
    // typed a new username that isn't confirmed available yet (still
    // checking, taken, or invalid) — saving fullName/phone/address while
    // silently dropping an unconfirmed username change would be confusing.
    if (usernameBlocksSave) {
      Alert.alert(
        t('more:update_username_failed', {defaultValue: "Couldn't update username"}),
        usernameStatus?.text ?? t('auth:username_checking', {defaultValue: 'Checking availability…'}),
      );
      return;
    }
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
      if (Object.keys(patch).length > 0 || usernameChanged) {
        await updateProfile({
          ...(patch.fullName !== undefined ? {name: patch.fullName} : {}),
          ...(patch.phoneNumber !== undefined ? {phoneNumber: patch.phoneNumber} : {}),
          ...(patch.homeAddress !== undefined ? {homeAddress: patch.homeAddress} : {}),
          ...(usernameChanged ? {username: username.trim()} : {}),
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
            <Text
              category="h7"
              status={usernameCheckState === 'checking' ? 'placeholder' : 'link'}
              onPress={usernameCheckState === 'checking' ? undefined : _onSave}
              bold
              mr={12}>
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
        {usernameEditingEnabled ? (
          <>
            <Input
              label={t('auth:choose_username_title', {defaultValue: 'Username'}).toString()}
              caption={t('more:username_field_caption', {
                defaultValue: 'The only name other Saveur users see — on the Leaderboard and when sharing content.',
              })}
              placeholder={t('auth:username_placeholder', {defaultValue: 'yourusername'}).toString()}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              status={usernameStatus?.tone === 'danger' ? 'warning' : usernameStatus?.tone === 'success' ? 'success' : 'basic'}
              style={styles.username}
              textStyle={globalStyle.inputText}
              accessoryRight={() => (
                <Flex itemsCenter>
                  {usernameCheckState === 'checking' ? (
                    <ActivityIndicator size="small" />
                  ) : usernameCheckState === 'available' ? (
                    <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon20, {tintColor: theme['color-success-500']}]} />
                  ) : usernameCheckState === 'taken' || usernameCheckState === 'looks_like_name' || usernameCheckState === 'invalid_format' ? (
                    <Icon pack="eva" name="close-circle-outline" style={[globalStyle.icon20, {tintColor: theme['color-danger-500']}]} />
                  ) : null}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={isRegeneratingUsername}
                    onPress={onRegenerateUsername}
                    style={{marginLeft: 12}}>
                    {isRegeneratingUsername ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Icon pack="eva" name="refresh-outline" style={[globalStyle.icon20, {tintColor: theme['text-hint-color']}]} />
                    )}
                  </TouchableOpacity>
                </Flex>
              )}
            />
            {usernameStatus ? (
              <Text category="h10" status={usernameStatus.tone} mt={-16} mb={16}>
                {usernameStatus.text}
              </Text>
            ) : null}
          </>
        ) : null}
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
  username: {
    ...globalStyle.inputField,
    marginBottom: 8,
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
