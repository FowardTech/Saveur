import React, {memo} from 'react';
import {Modal, View, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform} from 'react-native';
import {Icon, useTheme, Input, Button} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from './Text';
import Flex from './Flex';
import {globalStyle} from 'styles/globalStyle';
import * as sharesService from 'services/sharesService';
import {SharedContentType} from 'services/sharesService';
import CtaButton from 'components/CtaButton';

interface Props {
  visible: boolean;
  onClose: () => void;
  contentType: SharedContentType;
  contentId: string | number;
}

// "Share to a Saveur user" composer (product request item: "The users can
// share it to other users of these app using their usernames") — a bottom
// sheet reached from a new action alongside the existing external Share
// button on InterviewFeedback.tsx, InterviewReplay.tsx, and
// JobAlertDetails.tsx. Same slide-up/backdrop pattern as
// AvatarPickerModal.tsx so this doesn't introduce a new interaction style.
// Deliberately separate from (not a replacement for) those screens'
// existing "regular" OS-share-sheet buttons — per the product request,
// both need to stay available side by side.
const ShareToUserModal = memo(({visible, onClose, contentType, contentId}: Props) => {
  const theme = useTheme();
  const {t} = useTranslation(['more', 'common']);

  const [username, setUsername] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [isRequesting, setIsRequesting] = React.useState(false);

  // "found_connected" = accepted connection already exists, normal Send
  // flow. "found_not_connected" = user is real but there's no accepted
  // connection yet — composer must offer "Send connection request" instead
  // of "Send" (product request item: "Before a user can share something
  // with another Saveur user they must send a request first and until the
  // other person accept it then they can now be able to send or share with
  // that user"). "request_sent" = a request now exists and is awaiting the
  // other person's accept/decline.
  type LookupState = 'idle' | 'checking' | 'found_connected' | 'found_not_connected' | 'request_sent' | 'not_found';
  const [lookupState, setLookupState] = React.useState<LookupState>('idle');

  React.useEffect(() => {
    if (!visible) {
      setUsername('');
      setMessage('');
      setLookupState('idle');
    }
  }, [visible]);

  React.useEffect(() => {
    const candidate = username.trim();
    if (!candidate) {
      setLookupState('idle');
      return;
    }
    setLookupState('checking');
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await sharesService.checkRecipientExists(candidate);
      if (cancelled) return;
      if (!result.exists) setLookupState('not_found');
      else setLookupState(result.connected ? 'found_connected' : 'found_not_connected');
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  const errorMessage = (code?: string): string => {
    switch (code) {
      case 'recipient_not_found':
        return t('more:share_user_not_found', {defaultValue: 'No Saveur user found with that username.'});
      case 'cannot_share_with_self':
        return t('more:share_cannot_share_self', {defaultValue: "You can't share with yourself."});
      case 'feedback_not_ready':
        return t('more:share_feedback_not_ready', {defaultValue: 'This feedback is not ready to share yet.'});
      case 'no_video':
        return t('more:share_no_video', {defaultValue: 'This session has no recorded video to share.'});
      case 'not_connected':
        return t('more:share_not_connected', {defaultValue: 'Send a connection request first — they need to accept before you can share.'});
      case 'already_connected':
        return t('more:share_already_connected', {defaultValue: "You're already connected with this user."});
      case 'request_already_sent':
        return t('more:share_request_already_sent', {defaultValue: "You've already sent a request to this user."});
      default:
        return t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'});
    }
  };

  const onSendRequest = React.useCallback(async () => {
    const candidate = username.trim();
    if (!candidate || isRequesting) return;
    setIsRequesting(true);
    try {
      const result = await sharesService.sendConnectionRequest(candidate);
      if (result.autoAccepted) {
        setLookupState('found_connected');
        Alert.alert(
          t('more:share_connected_title', {defaultValue: 'Connected!'}),
          t('more:share_connected_body', {defaultValue: 'You and @{{username}} can now share with each other.', username: candidate}),
        );
      } else {
        setLookupState('request_sent');
        Alert.alert(
          t('more:share_request_sent_title', {defaultValue: 'Request sent'}),
          t('more:share_request_sent_body', {defaultValue: "@{{username}} needs to accept before you can share with them.", username: candidate}),
        );
      }
    } catch (e: any) {
      const code = e?.response?.data?.error;
      if (code === 'request_already_sent') setLookupState('request_sent');
      if (code === 'already_connected') setLookupState('found_connected');
      Alert.alert(
        t('more:share_failed_title', {defaultValue: "Couldn't share"}),
        errorMessage(code),
      );
    } finally {
      setIsRequesting(false);
    }
  }, [username, isRequesting, t]);

  const onSend = React.useCallback(async () => {
    const candidate = username.trim();
    if (!candidate || isSending) return;
    setIsSending(true);
    try {
      await sharesService.shareContent({
        recipientUsername: candidate,
        contentType,
        contentId,
        message: message.trim() || undefined,
      });
      onClose();
      Alert.alert(
        t('more:share_sent_title', {defaultValue: 'Shared!'}),
        t('more:share_sent_body', {defaultValue: '@{{username}} will be notified.', username: candidate}),
      );
    } catch (e: any) {
      const code = e?.response?.data?.error;
      if (code === 'not_connected') setLookupState('found_not_connected');
      Alert.alert(
        t('more:share_failed_title', {defaultValue: "Couldn't share"}),
        errorMessage(code),
      );
    } finally {
      setIsSending(false);
    }
  }, [username, message, contentType, contentId, isSending, onClose, t]);

  const canSend = lookupState === 'found_connected' && !isSending;
  const canRequest = lookupState === 'found_not_connected' && !isRequesting;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Bug report: "the keyboard is covering the input field while
          typing" — a raw <Modal> (unlike Content's own KeyboardAwareScroll
          convention) does nothing on its own when the keyboard opens; the
          sheet stayed pinned to the bottom and the keyboard just slid up
          on top of it, covering the username field. Same fix/convention as
          AddMorePayment.tsx's own KeyboardAvoidingView. */}
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.sheet, {backgroundColor: theme['background-basic-color-1']}]}>
          <Flex justify="space-between" itemsCenter mb={16}>
            <Text category="h7" bold>
              {t('more:share_to_saveur_user', {defaultValue: 'Share with a Saveur user'})}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Icon
                pack="eva"
                name="close-outline"
                style={[globalStyle.icon24, {tintColor: theme['text-basic-color']}]}
              />
            </TouchableOpacity>
          </Flex>
          <Text category="h9-s" status="placeholder" mb={16}>
            {t('more:share_to_saveur_user_description', {
              defaultValue: "Send this to another Saveur user by their username — they'll get a notification.",
            })}
          </Text>
          <Input
            placeholder={t('more:share_username_placeholder', {defaultValue: 'their username'}).toString()}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            accessoryRight={
              lookupState === 'checking'
                ? () => <ActivityIndicator size="small" />
                : lookupState === 'found_connected'
                ? props => <Icon {...props} pack="eva" name="checkmark-circle-2-outline" style={[props?.style, {tintColor: theme['color-success-500']}]} />
                : lookupState === 'found_not_connected' || lookupState === 'request_sent'
                ? props => <Icon {...props} pack="eva" name="people-outline" style={[props?.style, {tintColor: theme['color-warning-500']}]} />
                : lookupState === 'not_found'
                ? props => <Icon {...props} pack="eva" name="close-circle-outline" style={[props?.style, {tintColor: theme['color-danger-500']}]} />
                : undefined
            }
          />
          {lookupState === 'not_found' ? (
            <Text category="h10" status="danger" mt={-16} mb={16}>
              {t('more:share_user_not_found', {defaultValue: 'No Saveur user found with that username.'})}
            </Text>
          ) : null}
          {lookupState === 'found_not_connected' ? (
            <Text category="h10" status="warning" mt={-16} mb={16}>
              {t('more:share_not_connected_hint', {defaultValue: 'Send a connection request first — they need to accept before you can share.'})}
            </Text>
          ) : null}
          {lookupState === 'request_sent' ? (
            <Text category="h10" status="warning" mt={-16} mb={16}>
              {t('more:share_request_pending_hint', {defaultValue: 'Request sent — waiting for them to accept.'})}
            </Text>
          ) : null}
          {lookupState === 'found_connected' ? (
            <>
              <Input
                placeholder={t('more:share_message_placeholder', {defaultValue: 'Add a note (optional)'}).toString()}
                value={message}
                onChangeText={setMessage}
                multiline
                textStyle={{minHeight: 60}}
                style={styles.input}
              />
              <CtaButton disabled={!canSend} onPress={onSend} style={{marginTop: 8}}>
                {isSending
                  ? `${t('more:share_send', {defaultValue: 'Send'})}…`
                  : t('more:share_send', {defaultValue: 'Send'})}
              </CtaButton>
            </>
          ) : (
            <Button
              disabled={!canRequest}
              onPress={onSendRequest}
              status="warning"
              style={{marginTop: 8}}>
              {lookupState === 'request_sent'
                ? t('more:share_request_pending', {defaultValue: 'Request pending'})
                : isRequesting
                ? `${t('more:share_send_request', {defaultValue: 'Send connection request'})}…`
                : t('more:share_send_request', {defaultValue: 'Send connection request'})}
            </Button>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

export default ShareToUserModal;

const styles = {
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end' as const,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  input: {
    marginBottom: 16,
  },
};
