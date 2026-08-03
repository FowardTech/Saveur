import React from 'react';
import {StyleService, useStyleSheet, Icon} from '@ui-kitten/components';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import Flex, {FlexProps} from 'components/Flex';

interface TitleFiledProp extends FlexProps {
  onPress?(): void;
  title: string;
  padder?: boolean;
  mt?: number;
}

const TitleField = ({
  onPress,
  title,
  padder = true,
  ...rest
}: TitleFiledProp) => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['home', 'common']);
  return (
    <Flex justify="space-between" mb={24} mh={padder ? 24 : 0} {...rest}>
      <Text category="h6" bold>
        {title}
      </Text>
      <Flex itemsCenter onPress={onPress}>
        <Text status={'info'} category="h8" bold mr={4}>
          {t('common:see_all', { defaultValue: 'See all' })}
        </Text>
        <Icon name="arrowRight" pack="assets" style={styles.icon} />
      </Flex>
    </Flex>
  );
};

export default TitleField;

const themedStyles = StyleService.create({
  icon: {
    width: 16,
    height: 16,
  },
});
