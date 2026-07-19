import React, {memo} from 'react';
import {View, ImageBackground, TouchableOpacity} from 'react-native';
import {
  TopNavigation,
  useTheme,
  StyleService,
  useStyleSheet,
  Input,
  Icon,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import useLayout from 'hooks/useLayout';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import {CreateJobStackParamList} from 'navigation/types';
import NavigationAction from 'components/NavigationAction';
import IFitBottom from 'components/IFitBottom';
import {Controller, useForm} from 'react-hook-form';
import {RuleName} from 'utils/rules';
import IToggle from 'components/IToggle';
import useToggle from 'hooks/useToggle';
import {Images} from 'assets/images';
import {globalStyle} from 'styles/globalStyle';

const AboutYourChild = memo(() => {
  const {goBack, navigate} =
    useNavigation<NavigationProp<CreateJobStackParamList>>();
  const {width} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['creat_job', 'common']);

  const SIZE_BG = 80 * (width / 375);
  const [saveToChild, setSaveToChild] = useToggle(true);

  const {
    control,
    handleSubmit,
    getValues,
    formState: {errors},
  } = useForm({
    defaultValues: {
      name: 'John',
    },
  });
  const [activeIndex, setActiveIndex] = React.useState(1);
  const [typeAge, setTypeAge] = React.useState<string>('Toddler');

  const _onAddChild = () => {
    navigate('AboutYourFamily', {
      children: [{name: getValues('name'), typeAge: typeAge, checked: true}],
    });
  };
  const onChoose = React.useCallback(
    ({item, i}) =>
      () => {
        setActiveIndex(i), setTypeAge(item.title);
      },
    [],
  );
  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction icon="close" />}
        accessoryRight={
          <Text bold status={'link'} onPress={goBack} mr={16}>
            {t('common:cancel')}
          </Text>
        }
      />
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h2" bold mt={8}>
          {t('creat_job:about-your-child')}
        </Text>
        <Text category="h8" mt={16} mb={40}>
          {t('creat_job:about-your-child-title')}
        </Text>
        <Controller
          control={control}
          name="name"
          rules={RuleName}
          render={({field: {onChange, onBlur, value}}) => (
            <Input
              label={t('common:name').toString()}
              status={errors.name ? 'warning' : 'basic'}
              style={styles.name}
              value={value}
              onChangeText={onChange}
              onTouchStart={handleSubmit(() => {})}
              onTouchEnd={handleSubmit(() => {})}
              onBlur={onBlur}
              keyboardType="email-address"
              caption={errors.name?.message}
              autoFocus
            />
          )}
        />

        <IToggle
          title={t('creat_job:save-to-my-children')}
          onChange={setSaveToChild}
          checked={saveToChild}
          mt={24}
          mb={40}
        />
        <Text category="h6" bold mb={32}>
          {t('creat_job:age-of-children')}
        </Text>
        <View style={styles.containerAge}>
          {DATA_AGE_CHILDREN.map((item, i) => {
            return (
              <TouchableOpacity
                activeOpacity={0.54}
                onPress={onChoose({i, item})}
                style={[
                  styles.item,
                  {
                    width: 108 * (width / 375),
                  },
                ]}
                key={i}>
                <ImageBackground
                  source={i === activeIndex ? Images.fillActive : Images.fill}
                  style={[
                    {
                      width: SIZE_BG,
                      height: SIZE_BG,
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    activeIndex === i ? {...globalStyle.shadowBtn} : undefined,
                  ]}>
                  <Icon
                    pack="assets"
                    name={item.icon}
                    style={{
                      ...globalStyle.icon40,
                      tintColor:
                        activeIndex === i
                          ? theme['text-primary-color']
                          : theme['text-placeholder-color'],
                      zIndex: 10,
                      alignSelf: 'center',
                    }}
                  />
                </ImageBackground>
                <Text
                  category="h8"
                  bold
                  status={i === activeIndex ? 'link' : 'placeholder'}
                  mt={12}>
                  {item.title}
                </Text>
                <Text category="h10" status={'placeholder'} mt={4}>
                  {item.des}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Content>
      <IFitBottom title={t('creat_job:add-child')} onPress={_onAddChild} />
    </Container>
  );
});

export default AboutYourChild;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  name: {
    borderBottomWidth: 1,
  },
  containerAge: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  item: {
    paddingHorizontal: 9,
    alignItems: 'center',
    marginBottom: 24,
  },
});
const DATA_AGE_CHILDREN = [
  {id: 0, title: 'Infant', des: 'Age 0-11 month', icon: 'infant'},
  {id: 1, title: 'Toddler', des: 'Age 1-3 yrs', icon: 'toddler'},
  {id: 2, title: 'Pre-School', des: 'Age 4-5 yrs', icon: 'preSchool'},
  {id: 3, title: 'Elementary', des: 'Age 6-10 yrs', icon: 'tutoring'},
  {id: 4, title: 'Junior-High', des: 'Age 11+ yrs', icon: 'junior'},
];
