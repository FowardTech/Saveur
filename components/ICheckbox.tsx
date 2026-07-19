import React, {memo} from 'react';
import {CheckBoxProps, CheckBox} from '@ui-kitten/components';

import Text from 'components/Text';
import Flex from './Flex';
import {StyleProp, ViewStyle} from 'react-native';

interface ICheckboxProps extends CheckBoxProps {
  title: string;
  checked?: boolean;
  onChange?(): void;
  marginBottom?: number;
  style?: StyleProp<ViewStyle>;
}

const ICheckbox = memo(
  ({
    title,
    onChange,
    checked = false,
    marginBottom,
    onPress,
    style,
    ...rest
  }: ICheckboxProps) => {
    return (
      <Flex style={style} onPress={onChange} itemsCenter mb={marginBottom}>
        <Text category="h7" center>
          {title}
        </Text>
        <CheckBox
          {...rest}
          checked={checked}
          appearance="success"
          status={'primary'}
          onChange={onChange}
        />
      </Flex>
    );
  },
);

export default ICheckbox;
