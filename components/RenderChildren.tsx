import React, {memo} from 'react';
import {Icon, Layout} from '@ui-kitten/components';

import Text from 'components/Text';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';
import ICheckbox from 'components/ICheckbox';
import useToggle from 'hooks/useToggle';
import {CreatPostChildren} from 'constants/Types';

const RenderChildren = memo(({name, typeAge, checked}: CreatPostChildren) => {
  const [active, setActive] = useToggle(checked);

  return (
    <Flex mb={24} onPress={setActive}>
      <Flex justify="flex-start" itemsCenter>
        <Icon pack="assets" name="babyActive" style={globalStyle.icon24} />
        <Text bold ml={12}>
          {name}
        </Text>
        <Layout style={globalStyle.dot} level="4" />
        <Text mt={4}>{typeAge}</Text>
      </Flex>
      <ICheckbox checked={active} title={''} onChange={setActive} />
    </Flex>
  );
});

export default RenderChildren;
