import React, {memo} from 'react';
import {StyleProp, ViewStyle} from 'react-native';
import {Toggle} from '@ui-kitten/components';

import Text from 'components/Text';
import Flex, {FlexProps} from './Flex';
import {EvaStatus} from '@ui-kitten/components/devsupport';

interface IToggleProps extends FlexProps {
  onChange(): void;
  checked: boolean;
  title: string;
  containerStyle?: StyleProp<ViewStyle>;
  categoryText?:
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h5'
    | 'h6'
    | 'h6-s'
    | 'h7'
    | 'h7-s'
    | 'h8'
    | 'h8-s'
    | 'h9'
    | 'h9-s'
    | 'h10'
    | 'h10-s'
    | 'para-s'
    | 'para-m';
  statusText?: EvaStatus | 'primary';
}

const IToggle = memo(
  ({
    checked,
    onChange,
    title,
    categoryText,
    statusText,
    containerStyle,
    ...rest
  }: IToggleProps) => {
    return (
      <Flex {...rest} style={containerStyle} itemsCenter onPress={onChange}>
        <Text category={categoryText} status={statusText}>
          {title}
        </Text>
        <Toggle checked={checked} onChange={onChange} />
      </Flex>
    );
  },
);

export default IToggle;
