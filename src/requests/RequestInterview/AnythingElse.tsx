import React, {memo} from 'react';
import {
  StyleService,
  useStyleSheet,
  Layout,
  Icon,
  Input,
} from '@ui-kitten/components';

import {useTranslation} from 'react-i18next';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import TitleStep from 'components/TitleStep';
import {Controller, useForm} from 'react-hook-form';
import Text from 'components/Text';

interface AnythingElseProps {
  step: number;
  totalStep: number;
}

const AnythingElse = memo(({step, totalStep}: AnythingElseProps) => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'creat_job', 'common']);
  const {
    control,
    handleSubmit,
    getValues,
    formState: {errors},
  } = useForm({
    defaultValues: {
      description: t('request:any-else-input'),
    },
  });

  const [length, setLength] = React.useState(getValues('description').length);
  return (
    <KeyboardAwareScrollView
      extraScrollHeight={100}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}>
      <Layout style={styles.container}>
        <TitleStep
          step={step}
          totalStep={totalStep}
          title={t('request:anything-else')}
          style={styles.step}
          description={t('request:any-else-des')}
        />
      </Layout>
      <Icon pack="assets" name="quote" style={styles.icon} />
      <Controller
        control={control}
        name="description"
        render={({field: {onChange, onBlur, value}}) => (
          <Input
            style={styles.description}
            value={value}
            onTouchStart={handleSubmit(() => {})}
            onTouchEnd={handleSubmit(() => {})}
            onChangeText={e => {
              onChange(e), setLength(e.length);
            }}
            placeholder={t('creat_job:des-pl-input')}
            onBlur={onBlur}
            keyboardType="email-address"
            maxLength={500}
            multiline
            appearance="arena"
            size="large"
            textStyle={styles.textStyle}
          />
        )}
      />
      <Text right status={'placeholder'} mt={24} mr={24}>
        {length}/500
      </Text>
    </KeyboardAwareScrollView>
  );
});

export default AnythingElse;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  step: {
    marginTop: 16,
  },
  description: {
    marginHorizontal: 24,
  },
  textStyle: {
    lineHeight: 22,
  },
  icon: {
    tintColor: 'color-basic-400',
    marginLeft: 24,
    marginTop: 40,
  },
});
