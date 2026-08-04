import React, { memo } from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';
import { Icon, Input, useTheme } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from './Text';
import Flex from './Flex';
import { globalStyle } from 'styles/globalStyle';
import CtaButton from 'components/CtaButton';

interface Props {
  visible: boolean;
  onSubmit: (score: number, comment?: string) => Promise<void>;
  onDismiss: () => void;
}

// Regular (product-configured, default every 30 days — see
// Saveur-Backend's app_config_service.py's "app_rating" section) QA rating
// prompt: "how is Saveur helping you achieve your goals" on a 1-5 star
// scale plus an optional free-text comment. Centered dialog rather than the
// bottom-sheet pattern AvatarPickerModal/ResumeBuilder's document pickers
// use — this is a single-focus prompt, not a list to scroll/pick from.
const AppRatingModal = memo(({ visible, onSubmit, onDismiss }: Props) => {
  const theme = useTheme();
  const { t } = useTranslation(['common']);
  const [score, setScore] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset local state each time the modal is (re)shown, not just on first
  // mount — this component stays mounted (see HomeSrc.tsx) and is only
  // toggled visible/invisible.
  React.useEffect(() => {
    if (visible) {
      setScore(0);
      setComment('');
    }
  }, [visible]);

  const onPressSubmit = async () => {
    if (score === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(score, comment);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme['background-basic-color-1'] }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon
              pack="eva"
              name="close-outline"
              style={[globalStyle.icon24, { tintColor: theme['text-hint-color'] }]}
            />
          </TouchableOpacity>

          <Text category="h6" bold center mb={8}>
            {t('common:rating_modal_title', { defaultValue: 'How is Saveur helping you?' })}
          </Text>
          <Text category="h9-s" status="placeholder" center mb={20}>
            {t('common:rating_modal_subtitle', {
              defaultValue:
                "Rate how well Saveur is helping you reach your career goals. It only takes a second, and it genuinely shapes what we build next.",
            })}
          </Text>

          <Flex justify="center" mb={20}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => setScore(n)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                style={{ marginHorizontal: 4 }}>
                <Icon
                  pack="eva"
                  name={n <= score ? 'star' : 'star-outline'}
                  style={{
                    width: 32,
                    height: 32,
                    tintColor: n <= score ? theme['color-warning-500'] : theme['text-hint-color'],
                  }}
                />
              </TouchableOpacity>
            ))}
          </Flex>

          <Input
            multiline
            placeholder={t('common:rating_modal_comment_placeholder', {
              defaultValue: 'Anything specific we should know? (optional)',
            })}
            value={comment}
            onChangeText={setComment}
            style={styles.commentInput}
            textStyle={styles.commentInputInner}
          />

          <CtaButton
            style={{ marginTop: 20 }}
            disabled={score === 0 || isSubmitting}
            loading={isSubmitting}
            onPress={onPressSubmit}>
            {t('common:rating_modal_submit', { defaultValue: 'Submit Rating' })}
          </CtaButton>
          <TouchableOpacity onPress={onDismiss} disabled={isSubmitting} style={{ marginTop: 12 }}>
            <Text category="h9-s" status="placeholder" center>
              {t('common:rating_modal_later', { defaultValue: 'Maybe later' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

export default AppRatingModal;

const styles = {
  backdrop: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%' as const,
    borderRadius: 16,
    padding: 24,
  },
  closeButton: {
    alignSelf: 'flex-end' as const,
    marginBottom: 4,
  },
  commentInput: {
    borderRadius: 12,
    minHeight: 80,
  },
  commentInputInner: {
    minHeight: 60,
    textAlignVertical: 'top' as const,
  },
};
