import React, { memo } from 'react';
import { Image, Modal, TouchableOpacity, View } from 'react-native';
import { Icon, useTheme } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from './Text';
import Flex from './Flex';
import { Images } from 'assets/images';

interface Props {
  visible: boolean;
  onSubmit: (score: number, comment?: string) => Promise<void>;
  onDismiss: () => void;
}

// Redesign (product reference — a minimal MyFitnessPal-style prompt: app
// icon, "Enjoying <App>? Tap a star to rate it on the App Store", a plain
// star row, one "Not Now" button): was a heavier dialog with its own
// title/subtitle copy, a free-text comment box, and a separate "Submit
// Rating" button below the stars (see the superseded version this
// replaced). Tapping a star now submits immediately — the "tap a star"
// copy above it IS the instruction, so a second confirmation step is
// redundant. The comment box is gone entirely; this app doesn't route
// through the native App Store review sheet (no live App Store listing
// yet), so submitting still quietly records the score for the admin's QA
// view (services/appRatingService.ts), just without asking for extra
// typing first.
const AppRatingModal = memo(({ visible, onSubmit, onDismiss }: Props) => {
  const theme = useTheme();
  const { t } = useTranslation(['common']);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (visible) setIsSubmitting(false);
  }, [visible]);

  const onPressStar = async (score: number) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(score);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme['background-basic-color-1'] }]}>
          <View style={styles.iconWrap}>
            {/* BUG FIX (product report: "the S shaped design is not
                visible"): Images.logoMark's "S" artwork is drawn in the
                app's own brand blue on a transparent background (see
                assets/images/index.ts) — rendered with no tint here, it was
                the exact same blue as this circle's own backgroundColor
                right behind it, so the mark was blending straight into its
                own badge. Every other place this mark sits on a colored
                background (HomeSrc.tsx's home banner, BrandWordmark.tsx's
                markColor prop) already tints it white for this reason; this
                was the one spot that forgot to. */}
            <Image source={Images.logoMark} resizeMode="contain" tintColor="#fff" style={styles.icon} />
          </View>

          <Text category="h7" bold center mt={16}>
            {t('common:rating_modal_title', { defaultValue: 'Enjoying Saveur?' })}
          </Text>
          <Text category="h9-s" status="placeholder" center mt={6} mb={20}>
            {t('common:rating_modal_subtitle', {
              defaultValue: 'Tap a star to rate it on the App Store.',
            })}
          </Text>

          <Flex justify="center" mb={24}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity
                key={n}
                disabled={isSubmitting}
                onPress={() => onPressStar(n)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                style={{ marginHorizontal: 6, opacity: isSubmitting ? 0.5 : 1 }}>
                <Icon
                  pack="eva"
                  name="star-outline"
                  style={{ width: 32, height: 32, tintColor: theme['color-primary-500'] }}
                />
              </TouchableOpacity>
            ))}
          </Flex>

          <TouchableOpacity
            style={[styles.notNowButton, { backgroundColor: theme['background-basic-color-3'] }]}
            disabled={isSubmitting}
            onPress={onDismiss}>
            <Text category="h9" bold center>
              {t('common:rating_modal_later', { defaultValue: 'Not Now' })}
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
    // Google-style furnishing pass (see styles/globalStyle.ts's `card`) --
    // 14 -> 20.
    borderRadius: 16,
    padding: 24,
    alignItems: 'center' as const,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#0063f8',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  icon: {
    width: 40,
    height: 40,
  },
  notNowButton: {
    width: '100%' as const,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
};
