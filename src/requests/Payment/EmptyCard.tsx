import React from 'react';
import {View, Image} from 'react-native';
import {StyleService, useStyleSheet, Button} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import {Images} from 'assets/images';
import {RootStackParamList} from 'navigation/types';

const EmptyCard = () => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['payment', 'common']);

  const _onAdd = () => {
    navigate('AddMorePayment');
  };
  return (
    <View style={styles.container}>
      <Image source={Images.noCard} />
      <Text category="h6" bold mb={16} mt={72}>
        {t('payment:no-card-yet')}
      </Text>
      <Text center mb={32} mh={12}>
        {t('payment:please-attach-card')}
      </Text>
      <Button children={t('payment:add-new-credit-card')} onPress={_onAdd} />
    </View>
  );
};

export default EmptyCard;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
