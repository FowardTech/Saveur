import React from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';
import Text from 'components/Text';
import Flex from './Flex';
import {Icon} from '@ui-kitten/components';
import {globalStyle} from 'styles/globalStyle';

interface ReadMoreProps {
  text: string;
  maxCount: number;
  containerStyle?: ViewStyle;
}

const Readmore = ({text, maxCount, containerStyle}: ReadMoreProps) => {
  const [isReadmore, setReadMore] = React.useState(true);

  const displayString = text.slice(0, maxCount).concat('...');

  const onPressMore = () => setReadMore(!isReadmore);

  return (
    <View style={{...containerStyle, alignItems: 'flex-end'}}>
      <Text category="h7">{isReadmore ? displayString : text}</Text>
      <Flex onPress={onPressMore} justify="flex-start" itemsCenter>
        <Text category="h7" status={'info'} bold mr={4}>
          {isReadmore ? 'Show more' : 'Show less'}
        </Text>
        <Icon pack="assets" name="arrowRight" style={globalStyle.icon16} />
      </Flex>
    </View>
  );
};

export default React.memo(Readmore);
