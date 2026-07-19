import React, {memo} from 'react';
import {View, ImageBackground, TouchableOpacity} from 'react-native';
import {
  TopNavigation,
  useTheme,
  StyleService,
  useStyleSheet,
  Icon,
  Layout,
  Button,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import {Images} from 'assets/images';
import {globalStyle} from 'styles/globalStyle';
import {CreateJobStackParamList} from 'navigation/types';
import TitleStep from 'components/TitleStep';

const TypeOfCare = memo(() => {
  const {navigate} = useNavigation<NavigationProp<CreateJobStackParamList>>();
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
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          <Text bold status={'link'} mr={20}>
            {t('common:save')}
          </Text>
        }
      />
      <Content padder>
        <TitleStep
          step={1}
          totalStep={7}
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
      </Content>
      <Layout style={styles.bottom}>
        <Button
          children={t('creat_job:frequency-&-date')}
          style={globalStyle.shadowBtn}
          onPress={() => navigate('FrequencyDate')}
        />
      </Layout>
    </Container>
  );
});

export default TypeOfCare;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginTop: 32,
  },
  bottom: {
    marginHorizontal: 24,
    paddingBottom: 8,
  },
});
const DATA_TYPE_OF_CARE = [
  {title: 'Occasional', ex: 'Backup care', icon: 'occasional'},
  {
    title: 'Regularly Scheduled',
    ex: 'After school',
    icon: 'regular_schedule',
  },
  {title: 'One time', ex: 'Upcoming event', icon: 'one_time'},
  {title: 'Nanny', ex: 'Backup care', icon: 'nanny'},
  {title: 'Need ASAP', ex: 'Urgent event', icon: 'asap'},
];
