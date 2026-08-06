import React from 'react';
import { Modal, View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Icon } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';

import Text from './Text';
import { Images } from 'assets/images';
import useLayout from 'hooks/useLayout';
import { globalStyle } from 'styles/globalStyle';

interface Props {
  visible: boolean;
  title: string;
  body?: string;
  imageUrl?: string;
  ctaLabel?: string;
  onCta(): void;
  onDismiss(): void;
}

// Full-screen image-banner ad popup. Product follow-up on top of the
// earlier "full height" pass (see git history on this file): "I want the
// pop up the ad to be a full length ad not the one with a small card that
// just pop up on the middle... the ads are going to be images and mobile
// size banners" — this component was already rendered inside a flex:1
// Modal, but the AD ITSELF inside it was still a small 220x220 circular
// photo with a separate solid-color text block below, which still read as
// "a card in the middle" against the surrounding blue background. Now the
// admin-supplied image (services/adsService.ts's imageUrl, expected to be
// a full mobile-banner-shaped asset, portrait, matching the size/shape of
// the product-supplied Learning Courses onboarding banner) fills the
// entire screen edge-to-edge; title/body/CTA sit on a bottom gradient
// scrim over the image itself, since an arbitrary admin-uploaded photo
// can't be trusted to already have empty space there the way a purpose-
// built illustration can.
//
// BUG FIX: this component already existed with the "full height" redesign
// described above, but was never actually wired into HomeSrc.tsx, which
// kept rendering the OLDER small centered card (components/ModalRequest.tsx)
// for the real ad popup — this file was dead code. HomeSrc.tsx now renders
// this component instead (see that file's own comment at the swap site).
const AdPopupModal: React.FC<Props> = ({ visible, title, body, imageUrl, ctaLabel, onCta, onDismiss }) => {
  const { t } = useTranslation('common');
  const { width, height, top, bottom } = useLayout();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={[styles.container, { width, height }]}>
        <Image
          source={imageUrl ? { uri: imageUrl } : Images.homeBannerAiCoach}
          resizeMode="cover"
          style={[styles.image, { width, height }]}
        />

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={[styles.closeButton, { top: top + 16 }]}>
          <Icon pack="eva" name="close-outline" style={styles.closeIcon} />
        </TouchableOpacity>

        {/* Bottom scrim — an arbitrary admin-uploaded photo has no
            guaranteed empty region the way a purpose-built illustration
            does, so title/body/CTA get a real dark-to-transparent gradient
            behind them for legibility over any image. */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']}
          style={[styles.scrim, { paddingBottom: bottom + 24 }]}>
          <Text category="h4" bold style={styles.title}>
            {title}
          </Text>
          {body ? (
            <Text category="h9-s" mt={8} style={styles.body}>
              {body}
            </Text>
          ) : null}

          <TouchableOpacity activeOpacity={0.85} onPress={onCta} style={styles.ctaButton}>
            <Text category="h8" bold center style={styles.ctaButtonText}>
              {ctaLabel ?? t('view_details', { defaultValue: 'View Details' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={onDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text category="h9" bold center mt={16} style={styles.dismissText}>
              {t('no_thanks', { defaultValue: 'No thanks' })}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
};

export default AdPopupModal;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeIcon: {
    width: 22,
    height: 22,
    tintColor: '#FFFFFF',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  title: {
    color: '#FFFFFF',
  },
  body: {
    color: 'rgba(255,255,255,0.85)',
  },
  ctaButton: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: 24,
    ...globalStyle.shadowBtn,
  },
  ctaButtonText: {
    color: '#0063f8',
  },
  dismissText: {
    color: 'rgba(255,255,255,0.75)',
  },
});
