import React, {memo} from 'react';
import {ImageBackground, TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import Text from 'components/Text';
import NavigationAction from 'components/NavigationAction';
import {
  TopNavigation,
  StyleService,
  useTheme,
  useStyleSheet,
  Icon,
} from '@ui-kitten/components';
import Container from 'components/Container';
import Content from 'components/Content';
import useLayout from 'hooks/useLayout';
import {globalStyle} from 'styles/globalStyle';
import {Images} from 'assets/images';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {AuthStackParamList} from 'navigation/types';

const SignupFirstStep = memo(() => {
  const {navigate} = useNavigation<NavigationProp<AuthStackParamList>>();
  const {t} = useTranslation(['auth', 'common']);
  const {width} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const DATA = React.useMemo(
    () => [
      {id: 0, title: t('auth:goal_new_job', {defaultValue: 'Land a New Job'}), icon: 'briefcase-outline'},
      {id: 1, title: t('auth:goal_career_change', {defaultValue: 'Career Change'}), icon: 'swap-outline'},
      {id: 2, title: t('auth:goal_promotion', {defaultValue: 'Promotion'}), icon: 'trending-up-outline'},
      {id: 3, title: t('auth:goal_return_to_work', {defaultValue: 'Return to Work'}), icon: 'log-in-outline'},
      {id: 4, title: t('auth:goal_internship', {defaultValue: 'Internship / Grad Job'}), icon: 'book-open-outline'},
      {id: 5, title: t('auth:goal_executive', {defaultValue: 'Executive Move'}), icon: 'star-outline'},
    ],
    [t],
  );
  const [isChoose, setChoose] = React.useState<number>();
  const sizeBG = 120 * (width / 375);
  const onChoose = React.useCallback(
    (i: number) => () => {
      setChoose(i);
      setTimeout(() => {
        navigate('SignupSecondStep', {goal: DATA[i].title});
      }, 1000);
    },
    [navigate, DATA],
  );
  return (
    <Container>
      <TopNavigation accessoryLeft={<NavigationAction />} />
      <Content padder>
        <Text mt={16}>{t('auth:heading_signup_1')}</Text>
        <Text mt={8} mb={40} category="h2">
          {t('auth:title_signup_1')}
        </Text>
        <View style={styles.content}>
          {DATA.map((item, i) => {
            return (
              <TouchableOpacity
                key={i}
                style={{
                  width: sizeBG + 28,
                  marginLeft: (i + 1) % 2 === 0 ? 24 : 0,
                  marginBottom: 24,
                  alignItems: 'center',
                }}
                onPress={onChoose(i)}
                activeOpacity={0.54}>
                <View
                  style={[isChoose === i ? globalStyle.shadowBtn : undefined]}>
                  <ImageBackground
                    source={isChoose === i ? Images.fillActive : Images.fill}
                    style={{
                      width: sizeBG,
                      height: sizeBG,
                      ...globalStyle.center,
                    }}
                    imageStyle={{width: sizeBG, height: sizeBG}}>
                    <Icon
                      pack="eva"
                      name={item.icon}
                      style={{
                        width: 48,
                        height: 48,
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
                  center
                  category="h8"
                  mt={16}
                  status={isChoose === i ? 'link' : 'placeholder'}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Content>
    </Container>
  );
});
export default SignupFirstStep;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
