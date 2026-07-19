import React, {memo} from 'react';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Icon,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Content from 'components/Content';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import {RootStackParamList} from 'navigation/types';
import {DATA_PAYMENT} from 'constants/Data';
import Flex from 'components/Flex';
import Text from 'components/Text';
import {View} from 'react-native';
import {globalStyle} from 'styles/globalStyle';
import SwiperCard from 'components/SwiperCard';

const PaymentMethod = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['payment', 'common']);

  const onAdd = () => navigate('AddMorePayment');

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('payment:payment-method')}
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          <NavigationAction icon="plusImg" size="small" onPress={onAdd} />
        }
      />
      <Content style={styles.content}>
        {DATA_PAYMENT.map((item, i) => {
          return (
            <SwiperCard
              key={i}
              id={`${i + item.last4number}`}
              containerStyle={styles.swiperContainer}
              widthAction={75}>
              <Flex level="2" pv={24} ml={24} justify="flex-start" border={12}>
                <Icon pack="assets" name="master" style={styles.iconLogoBank} />
                <View>
                  <Text category="h6">{item.nameCard}</Text>
                  <Text category="h8" mt={8} status="placeholder">
                    xxxx - xxxx - xxxx - {item.last4number}
                  </Text>
                </View>
              </Flex>
            </SwiperCard>
          );
        })}
      </Content>
    </Container>
  );
});

export default PaymentMethod;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 32,
  },
  iconLogoBank: {
    width: 48,
    height: 48,
    alignSelf: 'center',
    marginHorizontal: 16,
  },
  swiperContainer: {
    ...globalStyle.shadow,
    marginBottom: 24,
    borderRadius: 12,
    marginRight: 24,
  },
});
