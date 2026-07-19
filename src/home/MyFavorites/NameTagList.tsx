import React, {memo} from 'react';
import {StyleService} from '@ui-kitten/components';

import Flex, {FlexProps} from 'components/Flex';
import NameTag from 'components/NameTag';
import TitleField from 'components/TitleField';

interface INameTagExpProp extends FlexProps {
  data: string[];
  title: string;
  onSeeAll?(): void;
}

const NameTagExp = memo(({data, title, onSeeAll, ...rest}: INameTagExpProp) => {
  return (
    <Flex vertical {...rest}>
      <TitleField title={title} onPress={onSeeAll} padder={false} />
      <Flex justify="flex-start">
        {data &&
          data.map((item, i) => {
            return <NameTag title={item} key={i} />;
          })}
      </Flex>
    </Flex>
  );
});

export default NameTagExp;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
});
