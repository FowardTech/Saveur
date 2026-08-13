import React, {memo} from 'react';
import {Alert} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, Input} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import * as applicationsService from 'services/applicationsService';

// Premium Job Tracker feature (product follow-up: "auto-detect status
// changes by scanning the user's inbox... the direct answer to 'why pay for
// this instead of a spreadsheet'"). Real inbox scanning needs a Gmail/
// Outlook OAuth integration the user has to register themselves (a manual
// console step, plus Google's read-email-scope consent review can take
// days to weeks) — this screen is the agreed interim: the user forwards or
// pastes the email text here, and the AI (Saveur-Backend's
// POST /tracker/applications/parse-email) does the classification/
// extraction work an inbox-scan would have done automatically. See that
// endpoint's own module comment in app/api/tracker.py for the fuller
// rationale.
const AddFromEmail = memo(() => {
  const {goBack, navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['request', 'common']);

  const [emailText, setEmailText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const onSubmit = async () => {
    const text = emailText.trim();
    if (!text || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await applicationsService.parseEmailAndTrack(text);
      goBack();
      // Land the user straight on the (new-or-updated) application so they
      // can immediately see what got tracked/changed, rather than leaving
      // them to hunt for it back in the list.
      navigate('RequestStack', {screen: 'ApplicationDetails', params: {id: result.application.id}});
    } catch (e: any) {
      Alert.alert(
        t('request:add_from_email_failed_title', {defaultValue: "Couldn't read that email"}),
        e?.response?.data?.message ??
          e?.message ??
          t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction icon={'back'} onPress={goBack} />}
        title={<Text center category="h6" bold>{t('request:add_from_email_title', {defaultValue: 'Add from email'})}</Text>}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={16}>
          {t('request:add_from_email_body', {
            defaultValue:
              'Forward or paste an application confirmation, interview invite, rejection, or offer email below — we’ll figure out which application it belongs to and update it for you.',
          })}
        </Text>
        <Input
          multiline
          scrollEnabled
          textStyle={styles.emailText}
          style={styles.emailInput}
          placeholder={t('request:add_from_email_placeholder', {
            defaultValue: 'Paste the email text here…',
          }).toString()}
          value={emailText}
          onChangeText={setEmailText}
          autoFocus
        />
        <CtaButton
          disabled={!emailText.trim() || isSubmitting}
          onPress={onSubmit}
          style={{marginTop: 20}}>
          {isSubmitting
            ? t('request:add_from_email_submitting', {defaultValue: 'Reading email…'})
            : t('request:add_from_email_submit', {defaultValue: 'Track this application'})}
        </CtaButton>
      </Content>
    </Container>
  );
});

export default AddFromEmail;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  // Same "Input's own style prop doesn't reach the bordered TextInput box"
  // constraint JDAnalyzer.tsx's jdInput hit (see its own comment) —
  // minHeight lives on textStyle (reaches the real native TextInput),
  // border/background/radius stay on style (reaches the wrapper).
  emailInput: {
    ...globalStyle.inputField,
    minHeight: 220,
    alignItems: 'flex-start',
  },
  emailText: {
    minHeight: 200,
    textAlignVertical: 'top',
  },
});
