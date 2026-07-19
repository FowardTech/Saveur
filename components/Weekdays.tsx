import React, {memo} from 'react';
import {
  StyleSheet,
  ImageBackground,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import Text from 'components/Text';
import Flex from 'components/Flex';
import {Images} from 'assets/images';
import {WeekdaysProps} from 'constants/Types';
import {useTheme} from '@ui-kitten/components';
import useToggle from 'hooks/useToggle';

interface DataProps {
  data: WeekdaysProps[];
  size?: 'medium' | 'large' | 'giant' | undefined;
  status?: 'basic' | 'primary' | undefined;
  style?: ViewStyle;
}

const Weekdays = memo(
  ({data, size = 'medium', status = 'basic', style}: DataProps) => {
    const theme = useTheme();

    const getColor = (status: 'basic' | 'primary' | undefined): string => {
      switch (status) {
        case 'basic':
          return theme['button-basic-color'];
        case 'primary':
          return theme['color-success-200'];
        default:
          return theme['button-basic-color'];
      }
    };
    const getSize = (
      size: 'giant' | 'large' | 'medium' | undefined,
    ): number => {
      switch (size) {
        case 'giant':
          return 40;
        case 'large':
          return 24;
        case 'medium':
          return 16;
        default:
          return 24;
      }
    };
    const RenderItem = React.useCallback(({item}) => {
      const [isActive, setIsActive] = useToggle(item.isActive);
      return (
        <TouchableOpacity onPress={setIsActive} activeOpacity={0.54}>
          <ImageBackground
            style={[
              styles.content,
              {
                width: getSize(size),
                height: getSize(size),
              },
            ]}
            imageStyle={[
              {
                width: getSize(size),
                height: getSize(size),
                tintColor: isActive === true ? getColor(status) : undefined,
              },
            ]}
            source={!isActive ? Images.dayInactive : Images.dayInactive}>
            <Text
              category={
                size === 'giant' ? 'h5' : size === 'large' ? 'h8' : 'h9'
              }
              status={!isActive ? 'placeholder' : 'control'}
              lineHeight={24}
              mt={size === 'medium' ? -4 : 0}
              center
              uppercase>
              {item.title.charAt(0)}
            </Text>
          </ImageBackground>
        </TouchableOpacity>
      );
    }, []);
    return (
      <Flex style={[styles.container, style]} itemsCenter>
        {data.map((item, i) => {
          return <RenderItem key={i} item={item} />;
        })}
      </Flex>
    );
  },
);

export default Weekdays;

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  content: {
    alignItems: 'center',
    textAlign: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
});
