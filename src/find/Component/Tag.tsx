import React from 'react';
import {Layout} from '@ui-kitten/components';

import Text from 'components/Text';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';

interface TagProps {
  title: string;
}

const Tag = ({title}: TagProps) => {
  return (
    <Flex justify="flex-start" mb={12}>
      <Layout style={{...globalStyle.dot, marginTop: 10}} level="6" />
      <Text ml={4}>{title}</Text>
    </Flex>
  );
};

export default Tag;
