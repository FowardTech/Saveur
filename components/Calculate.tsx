import React from 'react';
import {TouchableOpacity} from 'react-native';
import {useTheme, StyleService, Icon} from '@ui-kitten/components';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Flex, {FlexProps} from './Flex';
import {globalStyle} from 'styles/globalStyle';

interface CalculateProps extends FlexProps {
  value: number;
  title: string;
  setValue: React.Dispatch<React.SetStateAction<number>>;
}

const Calculate = ({title, value, setValue, ...rest}: CalculateProps) => {
  const {width} = useLayout();
  const theme = useTheme();

  const [disable, setDisable] = React.useState(false);
  const onMinus = React.useCallback(() => {
    setValue(value - 1);
  }, [value]);
  const onPlus = React.useCallback(() => {
    setValue(value + 1);
  }, [value]);
  React.useEffect(() => {
    if (value <= 1) {
      setDisable(true);
    } else {
      setDisable(false);
    }
  }, [value]);
  return (
    <Flex {...rest} itemsCenter>
      <Text category="para-m" maxWidth={175 * (width / 375)}>
        {title}
      </Text>
      <Flex ml={16}>
        <TouchableOpacity
          activeOpacity={0.54}
          disabled={disable}
          onPress={onMinus}>
          <Icon
            pack="assets"
            name="minus"
            style={[
              globalStyle.icon40,
              {
                tintColor: disable
                  ? theme['text-placeholder-color']
                  : undefined,
              },
            ]}
          />
        </TouchableOpacity>
        <Text category="h6" center mh={8} mt={8} style={{width: 40}}>
          {value}
        </Text>
        <TouchableOpacity activeOpacity={0.54} onPress={onPlus}>
          <Icon pack="assets" name="plus" style={globalStyle.icon40} />
        </TouchableOpacity>
      </Flex>
    </Flex>
  );
};

export default Calculate;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
});
