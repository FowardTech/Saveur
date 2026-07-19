import React from 'react';
import {View, Image, ImageBackground} from 'react-native';
import {
  useTheme,
  StyleService,
  useStyleSheet,
  Layout,
  Icon,
} from '@ui-kitten/components';
import Text from 'components/Text';
import Flex from 'components/Flex';
import {Images} from 'assets/images';
import Slider from '@react-native-community/slider';
import {globalStyle} from 'styles/globalStyle';
import useLayout from 'hooks/useLayout';

interface ISliderProps {
  valueSlider: number 
  setValueSlider: React.Dispatch<React.SetStateAction<number | number[]>>;
  mb?: number;
  dataValue?: Array<number>;
  maximumValue?: number;
  step?: number;
}

const ISlider = ({
  valueSlider,
  setValueSlider,
  mb,
  dataValue = DATA,
  maximumValue,
  step,
}: ISliderProps) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {width} = useLayout();

  const CustomThumb = React.useCallback(() => {
    return (
      <View style={styles.customThumb}>
        <Image
          source={Images.handle}
          /* @ts-ignore */
          style={styles.img}
        />
        <Text category="h8" center mb={2}>
          {valueSlider}
        </Text>
      </View>
    );
  }, [valueSlider]);
  return (
    <View style={{marginBottom: mb}}>
      <Slider
        value={valueSlider}
        minimumValue={0}
        maximumValue={maximumValue}
        onValueChange={value => setValueSlider(value)}
        style={{...styles.slider, width: 321 * (width / 375)}}
        minimumTrackTintColor={theme['color-primary-100']}
        maximumTrackTintColor={theme['color-basic-400']}
        thumbImage={Images.handle}
        step={step}
      />
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 10,
          width: 321 * (width / 375),
        }}>
        {dataValue
          ? dataValue.map((item, index) => {
              return (
                <View key={index} style={{opacity: index % 2 === 0 ? 1 : 0}}>
                  <Layout
                    style={[
                      styles.line,
                      {
                        position: 'absolute',
                        top: 0,
                        right:
                          index === dataValue.length - 1
                            ? 0
                            : index !== 0 && index !== dataValue.length - 1
                            ? 6
                            : undefined,
                        left: index < 5 && index !== 0 ? 12 : undefined,
                      },
                    ]}
                    level="3"
                  />
                  <Text category="h9" status="danger" mt={12}>
                    {item}
                  </Text>
                </View>
              );
            })
          : null}
      </View>
    </View>
  );
};

export default ISlider;

const themedStyles = StyleService.create({
  line: {
    height: 8,
    width: 1,
    zIndex: -10,
    backgroundColor: 'green',
  },
  slider: {
    height: 4,
    zIndex: 10,
  },
  thumbStyle: {},
  value: {
    position: 'absolute',
    alignSelf: 'center',
    top: 4,
  },
  img: {
    position: 'absolute',
  },
  customThumb: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
const DATA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
