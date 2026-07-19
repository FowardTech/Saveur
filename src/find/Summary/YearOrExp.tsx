import React from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet} from '@ui-kitten/components';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import ExpItem, {ExpItemProp} from '../Component/ExpItem';
import Flex from 'components/Flex';

interface YearOrExpProps {
  data: ExpItemProp[];
}

const YearOrExp = ({data}: YearOrExpProps) => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['find', 'filter', 'common']);
  return (
    <View style={[styles.container, styles.underline]}>
      <Text category="h3" bold mt={56} mb={32}>
        {t('find:years_or_experience')}
      </Text>
      <Flex>
        {data.map((item, i) => {
          return (
            <ExpItem key={i} title={item.title} age={item.age} exp={item.exp} />
          );
        })}
      </Flex>
    </View>
  );
};

export default YearOrExp;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  underline: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: 'background-basic-color-3',
  },
});
