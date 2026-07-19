import React, {memo} from 'react';
import {View} from 'react-native';
import {Avatar} from '@ui-kitten/components';

import Text from 'components/Text';
import {UserProps} from 'constants/Types';
import Flex from 'components/Flex';
import OnlStatus from 'components/OnlStatus';

interface IFavoritesProps {
  item: UserProps;
}

const IFavorites = memo(({item}: IFavoritesProps) => {
  let first_name = item.name.split(' ');
  return (
    <Flex vertical mr={24}>
      <View>
        <OnlStatus status={item.onlineState} />
        <Avatar source={item.avatar} shape="square" size={'large'} />
      </View>
      <Text category="h9" mt={12} center>
        {first_name[0]}
      </Text>
    </Flex>
  );
});

export default IFavorites;
