import React, {memo} from 'react';
import {View, ImageBackground, TouchableOpacity} from 'react-native';
import {
  TopNavigation,
  useTheme,
  StyleService,
  useStyleSheet,
  Input,
  Icon,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import TabBar from 'components/TabBar';
import {Controller, useForm} from 'react-hook-form';
import Flex from 'components/Flex';
import {Images} from 'assets/images';
import {globalStyle} from 'styles/globalStyle';
import IFitBottom from 'components/IFitBottom';
import {CreateJobStackParamList} from 'navigation/types';
import TitleStep from 'components/TitleStep';

const HourlyRate = memo(() => {
  const {navigate} = useNavigation<NavigationProp<CreateJobStackParamList>>();
  const {width} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['creat_job', 'common']);

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

  const _onNext = () => {
    navigate('Qualifications');
  };
  const _onSave = () => {};

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          <Text bold status={'link'} mr={20} onPress={_onSave}>
            {t('common:save')}
          </Text>
        }
      />

      <Content padder contentContainerStyle={styles.content}>
        <TitleStep
          step={4}
          totalStep={5}
          title={t('creat_job:hourly-rate')}
          description={t('creat_job:hourly-rate-title')}
        />
        <TabBar
          selectedIndex={activeTab}
          onChange={setActiveTab}
          tabs={[t('creat_job:fixed'), t('creat_job:set-range')]}
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
      </Content>
      <IFitBottom
        title={t('creat_job:select-qualifications')}
        onPress={_onNext}
      />
    </Container>
  );
});

export default HourlyRate;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {},
  input: {
    borderBottomWidth: 2,
    flex: 1,
    marginTop: 24,
  },
  from: {
    marginRight: 32,
  },
});
const DATA_PAYMENT = [
  {title: 'Cash', icon: 'cash'},
  {title: 'Credit Card', icon: 'credit'},
];
