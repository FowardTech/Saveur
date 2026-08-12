import React, {memo} from 'react';
import {TouchableOpacity} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Input,
  Icon,
  Button,
} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {Controller, useForm} from 'react-hook-form';
import {RulePassword, RuleResetCode} from 'utils/rules';
import useToggle from 'hooks/useToggle';
import NavigationAction from 'components/NavigationAction';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {RootStackParamList} from 'navigation/types';
import {globalStyle} from 'styles/globalStyle';
import CtaButton from 'components/CtaButton';

const NewPassword = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['auth', 'common', 'success']);

  const [invisible, setInvisible] = useToggle(true);
  const {
    control,
    handleSubmit,
    getValues,
    formState: {errors},
  } = useForm({
    defaultValues: {
      code: 'ASR325',
      password: '123456Aab',
      confirmPassword: '123456Aab',
    },
  });
  const [canContinue, setCanContinue] = React.useState(false);
  const [validation, setValidation] = React.useState(false);

  React.useEffect(() => {
    if (getValues('confirmPassword') === getValues('password')) {
      setValidation(true);
    } else {
      setValidation(false);
    }
  }, [getValues('confirmPassword'), getValues('password')]);
  React.useEffect(() => {
    if (
      validation === true &&
      errors.confirmPassword === undefined &&
      errors.password === undefined
    ) {
      setCanContinue(true);
    } else {
      setCanContinue(false);
    }
  }, [validation, errors.password, errors.confirmPassword]);

  const handleFinish = React.useCallback(() => {
    navigate('SuccessScr', {
      successScr: {
        title: t('success:title'),
        description: t('success:success_change_password'),
        children: [
          {
            title: t('auth:login_btn'),
            onPress: () => navigate('AuthStack', {screen: 'Login'}),
            status: 'basic',
          },
        ],
        buttonsViewStyle: {alignSelf: 'center'},
      },
    });
  }, []);
  return (
    <Container style={styles.container}>
      <TopNavigation accessoryLeft={<NavigationAction />} />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h2" mb={8}>
          {t('auth:recovery_password')}
        </Text>
        <Text category="h8-s" mb={60}>
          {t('auth:recovery_password_description')}
        </Text>
        <Controller
          control={control}
          name="code"
          rules={RuleResetCode()}
          render={({field: {onChange, onBlur, value}}) => (
            <Input
              label={t('auth:code').toString()}
              status={errors.code ? 'warning' : 'basic'}
              style={styles.code}
              textStyle={globalStyle.inputText}
              value={value}
              onTouchStart={handleSubmit(() => {})}
              onTouchEnd={handleSubmit(() => {})}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="email-address"
              caption={errors.password?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          rules={RulePassword()}
          render={({field: {onChange, onBlur, value}}) => (
            <Input
              label={t('auth:password').toString()}
              status={errors.password ? 'warning' : 'basic'}
              style={styles.password}
              textStyle={globalStyle.inputText}
              value={value}
              onTouchStart={handleSubmit(() => {})}
              onTouchEnd={handleSubmit(() => {})}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="email-address"
              caption={errors.password?.message}
              secureTextEntry={invisible}
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
          name="confirmPassword"
          rules={RulePassword()}
          render={({field: {onChange, onBlur, value}}) => (
            <Input
              label={t('auth:confirm_password').toString()}
              status={errors.confirmPassword ? 'warning' : 'basic'}
              style={styles.confirmPassword}
              textStyle={globalStyle.inputText}
              value={value}
              onTouchStart={handleSubmit(() => {})}
              onTouchEnd={handleSubmit(() => {})}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="email-address"
              caption={errors.confirmPassword?.message}
              secureTextEntry={invisible}
            />
          )}
        />
        <CtaButton
          onPress={handleFinish}
          disabled={!canContinue}
          style={globalStyle.shadowBtn}>
          {t('auth:change_password').toString()}
        </CtaButton>
      </Content>
    </Container>
  );
});

export default NewPassword;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    marginTop: 16,
  },
  // Product request ("make text inputs all through the app consistent in
  // design") — matches the shared boxed border+background+radius-12 look
  // (globalStyle.inputField) used elsewhere, instead of a one-off
  // bottom-underline style.
  code: {
    ...globalStyle.inputField,
    marginBottom: 24,
  },
  password: {
    ...globalStyle.inputField,
    marginBottom: 24,
  },
  confirmPassword: {
    ...globalStyle.inputField,
    marginBottom: 32,
  },
});
