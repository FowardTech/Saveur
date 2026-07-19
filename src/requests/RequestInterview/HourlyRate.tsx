import React, {memo} from 'react';
import {View, TouchableOpacity, ImageBackground} from 'react-native';
import {
  useTheme,
  StyleService,
  useStyleSheet,
  Layout,
  Icon,
  Input,
} from '@ui-kitten/components';
import {useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import TitleStep from 'components/TitleStep';
import Flex from 'components/Flex';
import {Controller, useForm} from 'react-hook-form';
import {Images} from 'assets/images';
import {globalStyle} from 'styles/globalStyle';
import TabBar from 'components/TabBar';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

const HourlyRate = memo(() => {
  const {height, width, top, bottom} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'creat_job', 'common']);

  const [activeTab, setActiveTab] = React.useState(0);
  const [payment, setPayment] = React.useState(0);
  const onChoose = React.useCallback(
    i => () => {
      setPayment(i);
    },
    [],
  );
  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm({
    defaultValues: {
      hourlyRate: '15',
      from: '15',
      to: '25',
    },
  });
  const SIZE_BG = 80;

  return (
    <KeyboardAwareScrollView
      extraScrollHeight={40}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}>
      <Layout style={styles.container}>
        <TitleStep
          step={3}
          totalStep={4}
          title={t('creat_job:hourly-rate')}
          style={styles.step}
          description={t('request:hourly-rate-des')}
        />
        <TabBar
          selectedIndex={activeTab}
          onChange={setActiveTab}
          tabs={[t('creat_job:fixed'), t('creat_job:set-range')]}
          style={styles.tab}
        />

        {activeTab == 0 ? (
          <Controller
            control={control}
            name="hourlyRate"
            render={({field: {onChange, onBlur, value}}) => (
              <Input
                label={t('creat_job:enter-hourly-rate').toString()}
                status={errors.hourlyRate ? 'warning' : 'basic'}
                style={styles.input}
                value={value}
                onChangeText={onChange}
                onTouchStart={handleSubmit(() => {})}
                onTouchEnd={handleSubmit(() => {})}
                onBlur={onBlur}
                size="medium"
                keyboardType="numeric"
                caption={errors.hourlyRate?.message}
                accessoryLeft={<Icon pack="assets" name="dollar" />}
              />
            )}
          />
        ) : (
          <Flex>
            <Controller
              control={control}
              name="from"
              render={({field: {onChange, onBlur, value}}) => (
                <Input
                  label={t('creat_job:from').toString()}
                  status={errors.from ? 'warning' : 'basic'}
                  style={{...styles.from, ...styles.input}}
                  value={value}
                  onChangeText={onChange}
                  onTouchStart={handleSubmit(() => {})}
                  onTouchEnd={handleSubmit(() => {})}
                  onBlur={onBlur}
                  size="medium"
                  keyboardType="numeric"
                  caption={errors.hourlyRate?.message}
                  accessoryLeft={<Icon pack="assets" name="dollar" />}
                />
              )}
            />
            <Controller
              control={control}
              name="to"
              render={({field: {onChange, onBlur, value}}) => (
                <Input
                  label={t('creat_job:to').toString()}
                  status={errors.to ? 'warning' : 'basic'}
                  style={styles.input}
                  value={value}
                  onChangeText={onChange}
                  onTouchStart={handleSubmit(() => {})}
                  onTouchEnd={handleSubmit(() => {})}
                  onBlur={onBlur}
                  size="medium"
                  keyboardType="numeric"
                  caption={errors.to?.message}
                  accessoryLeft={<Icon pack="assets" name="dollar" />}
                />
              )}
            />
          </Flex>
        )}
        <Text category="h6" bold mt={32} mb={40}>
          {t('creat_job:payment-type')}
        </Text>
        <Flex>
          {DATA_PAYMENT.map((item, i) => {
            return (
              <TouchableOpacity
                key={i}
                style={{
                  width: 155 * (width / 375),
                  marginBottom: 12,
                  alignItems: 'center',
                }}
                onPress={onChoose(i)}
                activeOpacity={0.54}>
                <View
                  key={i}
                  style={[payment === i ? globalStyle.shadowBtn : undefined]}>
                  <ImageBackground
                    source={payment === i ? Images.fillActive : Images.fill}
                    style={{
                      width: SIZE_BG,
                      height: SIZE_BG,
                      ...globalStyle.center,
                    }}
                    imageStyle={{width: SIZE_BG, height: SIZE_BG}}>
                    <Icon
                      pack="assets"
                      name={item.icon}
                      style={{
                        width: 40,
                        height: 40,
                        tintColor:
                          payment === i
                            ? theme['text-primary-color']
                            : theme['text-placeholder-color'],
                        zIndex: 10,
                        alignSelf: 'center',
                      }}
                    />
                  </ImageBackground>
                </View>
                <Text
                  category="h8"
                  bold
                  status={i === payment ? 'link' : 'placeholder'}
                  mt={12}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Flex>
      </Layout>
    </KeyboardAwareScrollView>
  );
});

export default HourlyRate;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  step: {
    marginTop: 16,
  },
  from: {
    marginRight: 32,
  },
  input: {
    borderBottomWidth: 2,
  },
  tab: {
    marginTop: 40,
    marginBottom: 24,
  },
});
const DATA_PAYMENT = [
  {title: 'Cash', icon: 'cash'},
  {title: 'Credit Card', icon: 'credit'},
];
