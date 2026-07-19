import React, {memo} from 'react';
import {View} from 'react-native';
import Text from 'components/Text';
import {Icon, Layout, StyleService, useStyleSheet} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';
import Flex from 'components/Flex';
import {UserProps} from 'constants/Types';
import {globalStyle} from 'styles/globalStyle';

interface PersonalProps {
  user: UserProps;
  moreInformation?: boolean;
  trustedFamily: boolean;
  carePro: boolean;
  mt?: number;
  mb?: number;
}
const Personal = memo(
  ({
    user,
    trustedFamily,
    carePro,
    mt,
    mb,
    moreInformation = false,
  }: PersonalProps) => {
    const {t} = useTranslation(['find', 'common']);
    const styles = useStyleSheet(themedStyles);
    return (
      <View style={[styles.container, {marginTop: mt, marginBottom: mb}]}>
        <Text category="h3" center mb={24} bold>
          {user.name}
        </Text>
        {moreInformation ? (
          <Flex itemsCenter mh={34} mb={16}>
            <Icon pack="assets" name={user.gender} style={styles.icon} />
            <Text>{user.age}</Text>
            <Layout style={globalStyle.dot} level="5" />
            <Text>{user.experience} exp</Text>
            <Layout style={globalStyle.dot} level="5" />
            <Text>Cared for {user.cared} families</Text>
          </Flex>
        ) : null}
        <Flex center mb={24}>
          {trustedFamily ? (
            <View style={styles.trusted}>
              <Icon pack="assets" name="bgCheck" />
              <Text mh={8} category="h9-s" status={'primary'}>
                {t('find:background_check')}
              </Text>
            </View>
          ) : null}
          {carePro ? (
            <View style={styles.carePro}>
              <Icon pack="assets" name="premiumAcc" />
              <Text mh={8} category="h9-s" status={'primary'}>
                {t('find:care_pro')}
              </Text>
            </View>
          ) : null}
        </Flex>
      </View>
    );
  },
);

export default Personal;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  trusted: {
    flexDirection: 'row',
    backgroundColor: 'color-success-200',
    marginRight: 8,
    borderRadius: 8,
    padding: 4,
    alignItems: 'center',
  },
  carePro: {
    flexDirection: 'row',
    backgroundColor: 'color-primary-300',
    borderRadius: 8,
    padding: 4,
    alignItems: 'center',
  },
  icon: {
    ...globalStyle.icon16,
    tintColor: 'text-placeholder-color',
  },
});
