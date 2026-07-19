import React, {memo} from 'react';
import {TouchableOpacity} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Avatar,
  Input,
  Icon,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import {Images} from 'assets/images';
import {Controller, useForm} from 'react-hook-form';
import {RuleEmail, RuleName, RulePassword} from 'utils/rules';
import useToggle from 'hooks/useToggle';
import {RootStackParamList} from 'navigation/types';

import * as ImagePicker from 'react-native-image-picker';
import {ImagePickerResponse} from 'react-native-image-picker';
import {ActionPickerImage} from 'constants/Types';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

const EditProfile = memo(() => {
  const {goBack} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['auth', 'more', 'common']);

  const [response, setResponse] = React.useState<ImagePickerResponse>();
  const onButtonPress = React.useCallback((type, options) => {
    ImagePicker.launchImageLibrary(options, setResponse);
  }, []);
  const actions: ActionPickerImage = {
    type: 'capture',
    options: {
      saveToPhotos: true,
      mediaType: 'photo',
      includeBase64: false,
    },
  };
  const [invisible, setInvisible] = useToggle(true);

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm({
    defaultValues: {
      fullName: 'Edith Johnson',
      email: 'lehieuds@gmail.com',
      password: '12345678aA',
      phoneNumber: '965-954-9111',
      homeAddress: '128 Lincoln St #105, Boston, NY',
    },
  });

  const _onSave = () => goBack();
  const _onMap = () => {};
  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:edit-profile').toString()}
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          <Text category="h7" status={'link'} onPress={_onSave} bold mr={12}>
            {t('common:save')}
          </Text>
        }
      />
      <KeyboardAwareScrollView
        extraScrollHeight={40}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        {response?.assets ? (
          <Avatar
            source={{uri: response.assets[0].uri}}
            size="giant"
            shape="rounded"
            /* @ts-ignore */
            style={styles.avatar}
          />
        ) : (
          <Avatar
            shape="rounded"
            source={Images.avatar2}
            size="giant"
            /* @ts-ignore */
            style={styles.avatar}
          />
        )}
        <Text
          category="h8-s"
          status={'link'}
          center
          onPress={() => onButtonPress(actions.type, actions.options)}
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
              value={value}
              onChangeText={onChange}
              onTouchStart={handleSubmit(() => {})}
              onTouchEnd={handleSubmit(() => {})}
              onBlur={onBlur}
              keyboardType="email-address"
              caption={errors.fullName?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          rules={RuleEmail}
          render={({field: {onChange, onBlur, value}}) => (
            <Input
              label={t('auth:email').toString()}
              status={errors.email ? 'warning' : 'basic'}
              style={styles.email}
              value={value}
              onChangeText={onChange}
              onTouchStart={handleSubmit(() => {})}
              onTouchEnd={handleSubmit(() => {})}
              onBlur={onBlur}
              keyboardType="email-address"
              caption={errors.email?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          rules={RulePassword}
          render={({field: {onChange, onBlur, value}}) => (
            <Input
              label={t('common:password').toString()}
              status={errors.password ? 'warning' : 'basic'}
              style={styles.password}
              value={value}
              onChangeText={onChange}
              secureTextEntry={invisible}
              onTouchStart={handleSubmit(() => {})}
              onTouchEnd={handleSubmit(() => {})}
              onBlur={onBlur}
              keyboardType="email-address"
              caption={errors.password?.message}
              accessoryRight={props => (
                <TouchableOpacity activeOpacity={0.7} onPress={setInvisible}>
                  <Icon
                    {...props}
                    pack="assets"
                    name={!invisible ? 'eyeOn' : 'eyeOff'}
                  />
                </TouchableOpacity>
              )}
            />
          )}
        />
        <Controller
          control={control}
          name="phoneNumber"
          render={({field: {onChange, onBlur, value}}) => (
            <Input
              label={t('auth:phone-number').toString()}
              status={errors.phoneNumber ? 'warning' : 'basic'}
              style={styles.phoneNumber}
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
      </KeyboardAwareScrollView>
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
  fullName: {
    borderBottomWidth: 2,
  },
  email: {
    borderBottomWidth: 2,
    marginVertical: 24,
  },
  password: {
    borderBottomWidth: 2,
  },
  phoneNumber: {
    marginVertical: 24,
    borderBottomWidth: 2,
  },
  homeAddress: {
    borderBottomWidth: 2,
  },
  map: {
    tintColor: 'button-basic-color',
  },
});
