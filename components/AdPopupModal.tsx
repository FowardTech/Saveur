import React from 'react';
import { Modal, View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Icon } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from './Text';
import { Images } from 'assets/images';
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

// Full-height admin ad popup (product bug report — "I want the pop up
// advert to have a full height", reference screenshot: a full-screen
// promo/paywall takeover with a hero illustration, bold headline, a big
// pill CTA button, and a plain "No thanks" skip link below it — NOT that
// reference app's own dark-navy/gold color scheme, same "match the layout,
// not the palette" direction as every other reference screenshot this
// reskin has used; this stays the app's own solid brand blue).
//
// Replaces the previous ModalRequest.tsx usage here, which was a small
// centered card (that component's own history: originally built for a
// plain "X accepted your interview request" acknowledgement, then reused
// as-is for the ad popup without a real redesign — hence it never looked
// like a real promo moment). ModalRequest had exactly one call site (this
// one), so a dedicated, purpose-built component is clearer than continuing
// to stretch a generically-named leftover to fit.
const AdPopupModal: React.FC<Props> = ({ visible, title, body, imageUrl, ctaLabel, onCta, onDismiss }) => {
  const { t } = useTranslation('common');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.container}>
        {/* Decorative sparkle accents (reference screenshot's own scattered
            star flourishes around the hero art) — purely cosmetic, no
            semantic meaning, so plain absolutely-positioned icons rather
            than anything data-driven. */}
        <Icon pack="eva" name="star" style={[styles.sparkle, styles.sparkleTopLeft]} />
        <Icon pack="eva" name="star" style={[styles.sparkle, styles.sparkleTopRight]} />
        <Icon pack="eva" name="star" style={[styles.sparkle, styles.sparkleMidRight]} />

        <View style={styles.heroWrap}>
          <Image
            source={imageUrl ? { uri: imageUrl } : Images.homeBannerAiCoach}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </View>

        <View style={styles.textBlock}>
          <Text category="h2" bold center style={styles.title}>
            {title}
          </Text>
          {body ? (
            <Text category="h9-s" center mt={12} style={styles.body}>
              {body}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity activeOpacity={0.85} onPress={onCta} style={styles.ctaButton}>
            <Text category="h8" bold center style={styles.ctaButtonText}>
              {ctaLabel ?? t('view_details', { defaultValue: 'View Details' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={onDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text category="h9" bold center mt={20} style={styles.dismissText}>
              {t('no_thanks', { defaultValue: 'No thanks' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default AdPopupModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  sparkle: {
    position: 'absolute',
    width: 18,
    height: 18,
    tintColor: 'rgba(255,255,255,0.55)',
  },
  sparkleTopLeft: {
    top: '12%',
    left: '10%',
  },
  sparkleTopRight: {
    top: '8%',
    right: '14%',
    width: 14,
    height: 14,
  },
  sparkleMidRight: {
    top: '30%',
    right: '8%',
    width: 22,
    height: 22,
  },
  heroWrap: {
    width: 220,
    height: 220,
    borderRadius: 110,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
    ...globalStyle.center,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  textBlock: {
    marginTop: 40,
    width: '100%',
  },
  title: {
    color: '#FFFFFF',
  },
  body: {
    color: 'rgba(255,255,255,0.85)',
  },
  actions: {
    width: '100%',
    marginTop: 48,
  },
  ctaButton: {
    width: '100%',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  ctaButtonText: {
    color: '#047857',
  },
  dismissText: {
    color: 'rgba(255,255,255,0.75)',
  },
});
