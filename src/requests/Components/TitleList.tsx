import React from 'react';
import {StyleProp, ViewProps} from 'react-native';

import Text from 'components/Text';
import Flex, {FlexProps} from 'components/Flex';
import {useTranslation} from 'react-i18next';
import {globalStyle} from 'styles/globalStyle';
import {Icon} from '@ui-kitten/components';

interface TitleListProps extends FlexProps {
  current: boolean;
  dataLength: number;
  style?: StyleProp<ViewProps>;
  onSeeAll?(): void;
}

const TitleList = ({
  current,
  dataLength,
  style,
  onSeeAll,
  ...props
}: TitleListProps) => {
  const {t} = useTranslation(['request', 'common']);
  return (
    <Flex style={[style]} {...props}>
      <Flex justify="flex-start" mb={24}>
        <Text category="h6" bold>
          {current ? t('request:current') : t('request:past')}
        </Text>
        <Text category="para-m" mt={4} ml={8} status="placeholder">
          {dataLength > 0 ? dataLength : null}
        </Text>
      </Flex>
      {current === false ? (
        <Flex itemsCenter mb={24}>
          <Text category="h8" status={'link'} mr={4} onPress={onSeeAll} bold>
            {t('common:seeAll')}
          </Text>
          <Icon pack="assets" name="arrowRight" style={globalStyle.icon16} />
        </Flex>
      ) : null}
    </Flex>
  );
};

export default TitleList;
