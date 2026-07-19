import React, {memo} from 'react';
import {View, TouchableOpacity, StyleProp, ViewStyle} from 'react-native';
import {
  useTheme,
  StyleService,
  useStyleSheet,
  Icon,
} from '@ui-kitten/components';

import Text from 'components/Text';
import Flex, {FlexProps} from './Flex';

interface ITotalizatorProps extends FlexProps {
  title: string;
  label?: string;
  value: number;
  setValue: React.Dispatch<React.SetStateAction<number>>;
  style?: StyleProp<ViewStyle>;
}

const Totalizator = memo(
  ({value, setValue, title, label, style, ...rest}: ITotalizatorProps) => {
    const theme = useTheme();
    const styles = useStyleSheet(themedStyles);
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
      <Flex justify="space-between" itemsCenter style={style} {...rest}>
        <View>
          <Text category="h7">{title}</Text>
          {label ? (
            <Text category="h10-s" status={'placeholder'}>
              {label}
            </Text>
          ) : null}
        </View>
        <Flex ml={16}>
          <TouchableOpacity
            activeOpacity={0.54}
            disabled={disable}
            onPress={onMinus}>
            <Icon
              pack="assets"
              name="minus"
              style={[
                styles.minus,
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
            <Icon pack="assets" name="plus" style={[styles.plus]} />
          </TouchableOpacity>
        </Flex>
      </Flex>
    );
  },
);

export default Totalizator;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  minus: {
    width: 40,
    height: 40,
  },
  plus: {
    width: 40,
    height: 40,
  },
});
