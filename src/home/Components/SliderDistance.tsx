import React from 'react';
import { View, Image } from 'react-native';
import {
  useTheme,
  StyleService,
  useStyleSheet,
  Layout,
} from '@ui-kitten/components';
import Text from 'components/Text';
import Flex from 'components/Flex';
import { Images } from 'assets/images';
import Slider from '@react-native-community/slider';

interface SliderDistanceProps {
  valueSlider: number;
  setValueSlider: React.Dispatch<React.SetStateAction<number>>;
  mb?: number;
  dataValue?: Array<number>;
  maximumValue?: number;
}

const SliderDistance = ({
  valueSlider,
  setValueSlider,
  mb,
  dataValue = DATA,
  maximumValue,
}: SliderDistanceProps) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();

  const CustomThumb = React.useCallback(() => {
    return (
      <Flex justify="center" style={styles.thumbStyle}>
        <Image source={Images.handle} />
        <Text style={styles.value} category="h8">
          {valueSlider}
        </Text>
      </Flex>
    );
  }, [valueSlider]);
  return (
    <View style={{ marginBottom: mb }}>
      <Slider
        value={valueSlider}
        minimumValue={0}
        maximumValue={40}
        onValueChange={value => setValueSlider(value)}
        style={styles.slider}
        minimumTrackTintColor={theme['color-primary-100']}
        maximumTrackTintColor={theme['color-basic-400']}
        // renderThumbComponent={CustomThumb}
        thumbImage={Images.handle}
        step={1}
      />
      <Flex mt={8}>
        {dataValue
          ? dataValue.map((item, index) => {
              return (
                <Layout
                  key={index}
                  style={[
                    styles.line,
                    {
                      marginHorizontal: index == 2 ? -16 : 0,
                    },
                  ]}
                  level="3"
                />
              );
            })
          : null}
      </Flex>
      <Flex mt={8}>
        {dataValue
          ? dataValue.map((item, i) => {
              return (
                <Text
                  category="h9"
                  status="placeholder"
                  key={i}
                  ml={i == 1 ? 16 : 0}
                  mr={i == 3 ? 8 : 0}
                >
                  {item}
                </Text>
              );
            })
          : null}
      </Flex>
    </View>
  );
};

export default SliderDistance;

const themedStyles = StyleService.create({
  line: {
    height: 8,
    width: 1,
    backgroundColor: 'color-basic-400',
    zIndex: -10,
  },
  slider: {
    height: 4,
    zIndex: 10,
  },
  thumbStyle: {
    width: 32,
    height: 32,
    alignItems: 'center',
  },
  value: {
    position: 'absolute',
    alignSelf: 'center',
    top: 4,
  },
});
const DATA = [0, 10, 20, 30, 40];
