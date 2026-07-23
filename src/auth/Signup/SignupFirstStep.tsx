import React, {memo} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import i18n from 'i18next';
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
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {AuthStackParamList} from 'navigation/types';
import {SUPPORTED_LANGUAGES} from 'constants/languages';

const SignupFirstStep = memo(() => {
  const {navigate} = useNavigation<NavigationProp<AuthStackParamList>>();
  const {t} = useTranslation(['auth', 'common']);
  const {width} = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);

  // Preferred language, picked first — before any of the goal/country/role
  // copy below is even read — so the rest of signup (SecondStep, ThirdStep,
  // the SuccessScr) renders in it too. Carried forward via route params
  // (see SignupSecondStep → SignupThirdStep) into signUp()/updateProfile()
  // as UserProfileProps.locale (constants/languages.ts, services/authService.ts),
  // the same field Settings → Language writes to later.
  const [locale, setLocale] = React.useState(i18n.language?.startsWith('es') ? 'es' : 'en');
  const onSelectLocale = React.useCallback((code: string) => {
    setLocale(code);
    i18n.changeLanguage(code);
  }, []);

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
        navigate('SignupSecondStep', {goal: DATA[i].title, locale});
      }, 1000);
    },
    [navigate, DATA, locale],
  );
  return (
    <Container>
      <TopNavigation accessoryLeft={<NavigationAction />} />
      <Content padder>
        <Text mt={16}>{t('auth:heading_signup_1')}</Text>
        <Text mt={8} mb={24} category="h2" bold style={{fontWeight: '800'}}>
          {t('auth:title_signup_1')}
        </Text>

        <Text category="h7" bold mb={12}>
          {t('auth:preferred_language_title', {defaultValue: 'Preferred language'})}
        </Text>
        <View style={styles.languageRow}>
          {SUPPORTED_LANGUAGES.map(lang => {
            const selected = lang.code === locale;
            return (
              <TouchableOpacity
                key={lang.code}
                activeOpacity={0.7}
                onPress={() => onSelectLocale(lang.code)}
                style={[
                  styles.languageChip,
                  {
                    backgroundColor: selected
                      ? theme['color-primary-500']
                      : theme['background-basic-color-2'],
                  },
                ]}>
                <Text category="h8" status={selected ? 'control' : 'basic'} bold={selected}>
                  {lang.nativeLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text mt={24} mb={16} category="h7" bold>
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
                  {/* Was an ImageBackground over assets/images/img_fill.png /
                      img_fillActive.png — flat PNGs with the "unselected"
                      one baked in as light gray, which never adapted to
                      dark mode (a hardcoded light-mode card behind the icon
                      regardless of theme). A plain themed View reproduces
                      the same rounded-square "chip" using the same theme
                      tokens the language chips above already use, so it
                      actually flips with the theme. */}
                  <View
                    style={{
                      width: sizeBG,
                      height: sizeBG,
                      borderRadius: sizeBG * 0.32,
                      backgroundColor:
                        isChoose === i
                          ? theme['color-primary-500']
                          : theme['background-basic-color-2'],
                      ...globalStyle.center,
                    }}>
                    <Icon
                      pack="eva"
                      name={item.icon}
                      style={{
                        width: 48,
                        height: 48,
                        tintColor:
                          isChoose === i
                            ? theme['text-control-color']
                            : theme['text-placeholder-color'],
                        zIndex: 10,
                        alignSelf: 'center',
                      }}
                    />
                  </View>
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
  languageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  languageChip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 99,
    marginRight: 10,
    marginBottom: 10,
  },
});
