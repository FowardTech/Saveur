import React, {memo} from 'react';
import {Alert, View} from 'react-native';
import {StyleService, useStyleSheet} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {Images} from 'assets/images';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {RootStackParamList} from 'navigation/types';
import HeaderMoreOption from './components/HeaderMoreOption';
import ButtonOptional, { ButtonOptionalProps } from './components/ButtonOptional';
import ThemeContext from '../../ThemeContext';
import * as emailService from 'services/emailService';

const MoreSrc = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'payment', 'common']);

  // Was local-only state before (a Toggle that flipped its own visual state
  // but never touched the app's actual theme) — now wired to the real
  // ThemeContext so this switch actually changes the app's light/dark theme.
  const {theme, toggleTheme} = React.useContext(ThemeContext);
  const darkMode = theme === 'dark';
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();

  // POST /api/v1/email/resend-welcome — see services/emailService.ts. A
  // `useRef` busy-guard (not state) is enough here since this row doesn't
  // need to visually reflect "sending" — the Alert on completion is the
  // only feedback needed for an occasional-use action like this.
  const isResendingWelcomeRef = React.useRef(false);
  const onResendWelcomeEmail = React.useCallback(async () => {
    if (isResendingWelcomeRef.current) return;
    isResendingWelcomeRef.current = true;
    try {
      await emailService.resendWelcomeEmail();
      Alert.alert(
        t('more:welcome_email_resent_title', {defaultValue: 'Email sent'}),
        t('more:welcome_email_resent_body', {defaultValue: 'Check your inbox for the welcome email.'}),
      );
    } catch (error: any) {
      Alert.alert(
        t('more:welcome_email_resend_failed_title', {defaultValue: "Couldn't send that"}),
        error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      isResendingWelcomeRef.current = false;
    }
  }, [t]);

  // Account & career-prep tools.
  const DATA_DETAILS: ButtonOptionalProps[] = [
    {
      title: t('more:resume_builder', {defaultValue: 'Resume Builder'}),
      icon: 'myPost',
      status: 'facebook',
      onPress: () => navigate('ResumeBuilder'),
    },
    {
      title: t('more:jd_analyzer', {defaultValue: 'JD Analyzer'}),
      icon: 'edit_full',
      status: 'twitter-3',
      onPress: () => navigate('JDAnalyzer'),
    },
    {
      title: t('more:my-documents', {defaultValue: 'My Documents'}),
      icon: 'stats',
      status: 'warning',
      navigateSrc: 'MyChildren',
    },
    {
      title: t('more:career_goal', {defaultValue: 'Career Goal'}),
      icon: 'changeJob',
      status: 'neutral',
      onPress: () => navigate('ChangeCareType'),
    },
    {
      title: t('more:learning_courses', {defaultValue: 'Learning Courses'}),
      icon: 'tutoring',
      status: 'twitter',
      onPress: () => navigate('LearningCourses'),
    },
    {
      title: t('more:networking_assistant', {defaultValue: 'Networking Assistant'}),
      icon: 'share',
      status: 'green',
      onPress: () => navigate('NetworkingAssistant'),
    },
    {
      title: t('more:subscription', {defaultValue: 'Subscription'}),
      icon: 'premiumAcc',
      status: 'success',
      onPress: () => navigate('Subscription'),
    },
    {
      title: t('more:payment_methods', {defaultValue: 'Payment Methods'}),
      icon: 'payment',
      status: 'facebook',
      navigateSrc: 'PaymentMethod',
    },
  ];
  // General / support.
  const DATA_APPLICATION: ButtonOptionalProps[] = [
    {
      title: t('more:about-caren'),
      icon: 'stats',
      status: 'basic',
      onPress: () => navigate("AboutScreen"),
    },
    {
      title: t('more:help-&-faq'),
      icon: 'helpWhite',
      status: 'placeholder',
      onPress: () => navigate("FaqScreen"),
    },
    {
      title: t('more:privacy-of-policy'),
      icon: 'term',
      status: 'green',
      navigateSrc: 'ReferFriend',
      onPress: () => navigate("PolicyScreen"),
    },
    {
      title: t('more:resend_welcome_email', {defaultValue: 'Resend welcome email'}),
      icon: 'send',
      status: 'facebook',
      onPress: onResendWelcomeEmail,
    },
  ];
  return (
    <Container style={styles.container}>
      <Content padder contentContainerStyle={styles.content}>
        <HeaderMoreOption
          name={'Edith Johnson'}
          avatar={Images.avatar2}
          email={'lehieuds@gmail.com'}
        />
        <View style={styles.details}>
          <Text category="h6" bold>
            {t('more:myDetails')}
          </Text>
          {DATA_DETAILS.map((item, i) => {
            return (
              <ButtonOptional
                icon={item.icon}
                title={item.title}
                status={item.status}
                key={i}
                onPress={item.onPress}
                navigateSrc={item.navigateSrc}
              />
            );
          })}
        </View>
        <View style={styles.application}>
          <Text category="h6" bold>
            {t('more:application')}
          </Text>
          {DATA_APPLICATION.map((item, i) => {
            return (
              <ButtonOptional
                icon={item.icon}
                title={item.title}
                status={item.status}
                onPress={item.onPress}
                key={i}
                navigateSrc={item.navigateSrc}
              />
            );
          })}
          <ButtonOptional
            withToggle
            icon="darkMode"
            title={t('more:switch-dark-mode')}
            status={'danger'}
            checked={darkMode}
            onPress={toggleTheme}
            navigateSrc={undefined}
          />
          <ButtonOptional
            title={t('more:refer-friend-&-family')}
            icon={'share'}
            status={'twitter'}
            navigateSrc={'ReferFriend'}
          />
        </View>
      </Content>
    </Container>
  );
});

export default MoreSrc;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 24,
    paddingBottom: 80,
  },

  details: {
    marginBottom: 48,
  },
  application: {},
});
