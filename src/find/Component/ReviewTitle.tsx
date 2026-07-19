import React from 'react';
import {Icon} from '@ui-kitten/components';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import Flex, {FlexProps} from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';

interface ReviewTitleProps extends FlexProps {
  rate: number;
  reviews: number;
}

const ReviewTitle = ({rate, reviews, ...rest}: ReviewTitleProps) => {
  const {t} = useTranslation(['find', 'common']);
  return (
    <Flex itemsCenter {...rest}>
      <Icon pack="assets" name="rateFull" style={globalStyle.icon16} />
      <Text bold category="h8" ml={4}>
        {rate}
      </Text>
      <Text status={'placeholder'} category="h8" ml={2} mt={1}>
        ({reviews} {t('common:reviews')})
      </Text>
    </Flex>
  );
};

export default ReviewTitle;
