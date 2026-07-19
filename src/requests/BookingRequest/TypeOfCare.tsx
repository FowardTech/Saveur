import React, {memo} from 'react';
import {View, TouchableOpacity, ImageBackground} from 'react-native';
import {
  useTheme,
  StyleService,
  useStyleSheet,
  Icon,
} from '@ui-kitten/components';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import {useTranslation} from 'react-i18next';
import TitleStep from 'components/TitleStep';
import {DATA_TYPE_OF_CARE} from 'constants/Data';
import {globalStyle} from 'styles/globalStyle';
import {Images} from 'assets/images';

const TypeOfCare = memo(() => {
  const {width} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['creat_job', 'common']);

  const SIZE_BG = 80 * (width / 375);

  const [isChoose, setIsChoose] = React.useState(0);
  const onChoose = React.useCallback(
    i => () => {
      setIsChoose(i);
    },
    [],
  );
  return (
    <View style={styles.container}>
      <TitleStep
        step={1}
        totalStep={5}
        title={t('creat_job:type-of-care')}
        description={t('creat_job:type-of-care-title')}
      />
      <View style={styles.content}>
        {DATA_TYPE_OF_CARE.map((item, i) => {
          return (
            <TouchableOpacity
              key={i}
              style={{
                width: 155 * (width / 375),
                marginBottom: 12,
                alignItems: 'center',
              }}
              onPress={onChoose(i)}
              activeOpacity={0.54}>
              <View
                key={i}
                style={[isChoose === i ? globalStyle.shadowBtn : undefined]}>
                <ImageBackground
                  source={isChoose === i ? Images.fillActive : Images.fill}
                  style={{
                    width: SIZE_BG,
                    height: SIZE_BG,
                    ...globalStyle.center,
                  }}
                  imageStyle={{width: SIZE_BG, height: SIZE_BG}}>
                  <Icon
                    pack="assets"
                    name={item.icon}
                    style={{
                      width: 40,
                      height: 40,
                      tintColor:
                        isChoose === i
                          ? theme['text-primary-color']
                          : theme['text-placeholder-color'],
                      zIndex: 10,
                      alignSelf: 'center',
                    }}
                  />
                </ImageBackground>
              </View>
              <Text
                category="h8"
                bold
                status={i === isChoose ? 'link' : 'placeholder'}
                mt={12}>
                {item.title}
              </Text>
              <Text category="h10" status={'placeholder'} mt={4}>
                ex: {item.ex}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

export default TypeOfCare;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 40,
  },
});
