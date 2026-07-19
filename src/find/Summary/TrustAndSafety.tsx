import React from 'react';
import {View} from 'react-native';
import {
  useTheme,
  StyleService,
  useStyleSheet,
  Icon,
} from '@ui-kitten/components';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import Flex from 'components/Flex';

interface TrustAndSafetyProps {
  backgroundCheck: boolean;
  vehicleRecordsCheck: boolean;
  firstAidCertification: boolean;
  cprCertification: boolean;
}

const TrustAndSafety = ({
  backgroundCheck,
  vehicleRecordsCheck,
  firstAidCertification,
  cprCertification,
}: TrustAndSafetyProps) => {
  const {height, width, top, bottom} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['find', 'common']);
  const Item = React.useCallback(({completed, icon, title}) => {
    return (
      <Flex justify="flex-start" itemsCenter mb={24}>
        <Icon pack="assets" name={icon} style={styles.icon} />
        <View>
          <Text bold category="h7" center>
            {title}
          </Text>
          {completed ? (
            <Text category="h10" status={'placeholder'}>
              {t('common:completed')}
            </Text>
          ) : null}
        </View>
      </Flex>
    );
  }, []);
  return (
    <View style={styles.container}>
      <Text category="h3" bold mt={56} mb={24}>
        {t('find:years_or_experience')}
      </Text>
      <Item
        title={t('find:background_check')}
        icon="bgCheck"
        completed={backgroundCheck}
      />
      <Item
        title={t('find:vrc')}
        icon="vehicleCheck"
        completed={vehicleRecordsCheck}
      />
      <Item
        title={t('find:first_aid_certification')}
        icon="first_aid"
        completed={firstAidCertification}
      />
      <Item title={t('find:cpr')} icon="cpr" completed={cprCertification} />
    </View>
  );
};

export default TrustAndSafety;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: 'background-basic-color-3',
  },
  icon: {
    width: 40,
    height: 40,
    marginRight: 16,
  },
});
