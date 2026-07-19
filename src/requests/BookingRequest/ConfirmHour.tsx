import React, {memo} from 'react';
import {View, TouchableOpacity} from 'react-native';
import {
  TopNavigation,
  useTheme,
  StyleService,
  useStyleSheet,
  Toggle,
  Icon,
  Input,
  Button,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import Flex from 'components/Flex';
import dayjs from 'dayjs';
import {globalStyle} from 'styles/globalStyle';
import {Controller, useForm} from 'react-hook-form';
import {RootStackParamList} from 'navigation/types';
import Weekdays from 'components/Weekdays';

const ConfirmHour = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'success', 'common']);

  const HOURLY_RATE = 15;
  const DISCOUNT = 0;
  const [totalHour, setTotalHour] = React.useState(15);
  const [disableMinus, setDisableMinus] = React.useState(false);
  const [durationPerDay, setDuration] = React.useState<number>(1);

  const onMinus = React.useCallback(() => {
    setDuration(durationPerDay - 1);
  }, [durationPerDay]);
  const onPlus = React.useCallback(() => {
    setDuration(durationPerDay + 1);
  }, [durationPerDay]);

  React.useEffect(() => {
    if (durationPerDay <= 1) {
      setDisableMinus(true);
    } else {
      setDisableMinus(false);
    }
  }, [durationPerDay]);

  const makeAPayment = React.useCallback(() => {
    navigate('RequestStack', {screen: 'SelectCard'});
  }, []);

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('request:confirm-hour').toString()}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        <Weekdays data={DATA} size="giant" />
        <View style={styles.centerField}>
          <Flex mt={32}>
            <Text category="h7" mb={32} bold>
              {t('request:startDate')}
            </Text>
            <Text category="para-m" status={'link'}>
              {dayjs(new Date()).format('ddd, MMM DD')}
            </Text>
          </Flex>
          <Flex>
            <Text category="h7" bold>
              {t('request:startTime')}
            </Text>
            <Text category="para-m" status={'link'}>
              08:00
            </Text>
          </Flex>
          <Flex itemsCenter mt={24}>
            <Text category="h7" bold>
              {t('request:durationPerDay')}
            </Text>
            <Flex ml={16}>
              <TouchableOpacity
                activeOpacity={0.54}
                disabled={disableMinus}
                onPress={onMinus}>
                <Icon
                  pack="assets"
                  name="minus"
                  style={[
                    globalStyle.icon40,
                    {
                      tintColor: disableMinus
                        ? theme['text-placeholder-color']
                        : undefined,
                    },
                  ]}
                />
              </TouchableOpacity>
              <Text category="h6" center mh={8} mt={8} style={{width: 40}}>
                {durationPerDay}{' '}
              </Text>
              <TouchableOpacity activeOpacity={0.54} onPress={onPlus}>
                <Icon pack="assets" name="plus" style={[globalStyle.icon40]} />
              </TouchableOpacity>
            </Flex>
          </Flex>
          <Flex mt={32}>
            <Text bold>{t('request:total-hour')}</Text>
            <Text>{totalHour} hrs</Text>
          </Flex>
          <Flex mt={32}>
            <Text bold>{t('request:hourly-rate')}</Text>
            <Text>${HOURLY_RATE}</Text>
          </Flex>
          <Flex mt={32}>
            <Text bold>{t('request:service-total')}</Text>
            <Text>${totalHour * HOURLY_RATE}</Text>
          </Flex>
          <Flex justify="flex-end" itemsCenter mt={20}>
            <Icon pack="assets" name="dollar" style={styles.dollar} />
            <Text status={'link'} ml={8} bold>
              {t('request:add-tips')}
            </Text>
          </Flex>
          <Flex mt={32}>
            <Text bold>{t('request:discount')}</Text>
            <Text>${DISCOUNT}</Text>
          </Flex>
        </View>
        <Flex mt={32}>
          <Text bold mt={8}>
            {t('request:service-total')}
          </Text>
          <Text category="h2" bold>
            ${DISCOUNT}
          </Text>
        </Flex>
      </Content>
      <Button
        children={t('request:make-a-payment').toString()}
        style={styles.buttonConfirm}
        onPress={makeAPayment}
      />
    </Container>
  );
});

export default ConfirmHour;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 32,
    paddingBottom: 40,
  },
  centerField: {
    borderBottomWidth: 1,
    borderBottomColor: 'background-basic-color-3',
    paddingBottom: 40,
  },
  buttonConfirm: {
    marginHorizontal: 24,
    ...globalStyle.shadowBtn,
  },
  dollar: {
    ...globalStyle.icon16,
    tintColor: 'text-placeholder-color',
  },
});
const DATA = [
  {
    title: 'Sun',
    isActive: false,
  },
  {
    title: 'Mon',
    isActive: false,
  },
  {
    title: 'Tue',
    isActive: true,
  },
  {
    title: 'Wed',
    isActive: true,
  },
  {
    title: 'Thu',
    isActive: true,
  },
  {
    title: 'Fri',
    isActive: false,
  },
  {
    title: 'Sat',
    isActive: false,
  },
];
