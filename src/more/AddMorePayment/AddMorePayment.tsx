import React, { memo } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Button,
} from '@ui-kitten/components';
import { useNavigation } from '@react-navigation/native';
import useLayout from 'hooks/useLayout';
import { useTranslation } from 'react-i18next';

import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { FormProvider, useForm } from 'react-hook-form';
import LottieView from 'lottie-react-native';
import { FormModel } from 'constants/Types';
import CreditCardForm from './CreditCardForm';
import CtaButton from 'components/CtaButton';

const AddMorePayment = memo(() => {
  const { goBack } = useNavigation();
  const { height, width, top, bottom } = useLayout();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['payment', 'common']);

  const formMethods = useForm<FormModel>({
    // to trigger the validation on the blur event
    mode: 'onBlur',
    defaultValues: {
      holderName: '',
      cardNumber: '',
      expiration: '',
      cvv: '',
    },
  });
  const { handleSubmit, formState } = formMethods;

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={() => <NavigationAction />}
        title={t('payment:add-new-credit-card').toString()}
      />
      <FormProvider {...formMethods}>
        <View style={styles.container}>
          <KeyboardAvoidingView
            style={styles.avoider}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <CreditCardForm
              LottieView={LottieView}
              horizontalStart
              overrides={{
                labelText: {
                  marginTop: 16,
                },
              }}
            />
          </KeyboardAvoidingView>
          {formState.isValid && (
            <CtaButton
              style={[styles.button]}
              children={'Save'}
              onPress={handleSubmit(goBack)}
            />
          )}
        </View>
      </FormProvider>
    </Container>
  );
});

export default AddMorePayment;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  cardNumber: {
    borderBottomWidth: 2,
  },
  logoBank: {
    width: 48,
    height: 48,
  },
  avoider: {
    flex: 1,
    padding: 24,
  },
  button: {
    ...globalStyle.shadowBtn,
    marginHorizontal: 24,
  },
});
