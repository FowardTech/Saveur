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
  // BUG FIX (product report: "the pop up advert [is what's] freezing the
  // app... anytime it loads and i try to scroll it just freezes and
  // refuses to scroll" — traced by the user to this modal specifically):
  // this Modal was rendered with `transparent` even though its own content
  // is fully opaque (a solid #000 backdrop behind a full-bleed cover
  // Image) — `transparent` should only be used for a modal that's
  // genuinely meant to show the screen behind it dimmed through, which
  // this one never was (see the file header comment: "fills the entire
  // screen edge-to-edge"). A `transparent` RN Modal renders as a lighter-
  // weight overlay window (an Android Dialog with a transparent theme
  // under the hood, not a fully opaque new Activity-level surface), which
  // has a well-documented Android RN bug where touch/gesture events can
  // bleed through to the screen still mounted underneath instead of being
  // fully captured by the modal — with Home's ScrollView sitting right
  // there, that's exactly a recipe for two different responders (the
  // modal's own touch handling and Home's ScrollView) fighting over the
  // same touch stream, which reads to a user as "the screen just freezes
  // and won't scroll." Since this modal was never actually meant to be
  // see-through, dropping `transparent` here removes the buggy code path
  // entirely while changing nothing about how it looks (still a full,
  // solid #000 + image screen either way).
  const [imageFailed, setImageFailed] = React.useState(false);
  React.useEffect(() => {
    // Reset the fallback flag every time a new ad image comes in — a
    // previous ad's broken URL shouldn't permanently pin this to the local
    // fallback image for every ad shown afterward.
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={[styles.container, { width, height }]}>
        <Image
          // BUG FIX (same report): a broken/slow admin-uploaded imageUrl
          // used to just render blank, leaving the solid #000 backdrop as
          // the only visible thing on screen — indistinguishable from a
          // frozen black screen to a user who doesn't know an ad was even
          // supposed to be here. Falls back to the same local asset used
          // when no imageUrl is set at all, so a bad URL degrades to a
          // working (if generic) ad instead of an apparently-broken app.
          source={imageUrl && !imageFailed ? { uri: imageUrl } : Images.homeBannerAiCoach}
          onError={() => setImageFailed(true)}
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
            does, so title/body/CTA get a real dark gradient behind them for
            legibility over any image.
            BUG FIX (product report, screenshot: caption card not full
            width, visible image showing through below the caption): the
            box itself was already full-width and bottom-anchored (see
            styles.scrim below — left:0/right:0/bottom:0), so that wasn't
            actually the bug. The real issue was the gradient's own bottom
            stop: rgba(0,0,0,0.78) is still 22% see-through, so a bright
            admin-uploaded image remained faintly visible behind the caption
            text/CTA/dismiss row instead of reading as a solid container --
            exactly what looks like "a gap where the image shows through" in
            a screenshot. Now goes fully opaque (1) at the very bottom and
            stays solid, not fading, for the last third of the scrim (extra
            color stop at 0.55), so the lowest portion — where the CTA
            button and "No thanks" text sit — is a true solid card, while
            the transition into the image higher up stays a soft gradient. */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,1)']}
          locations={[0, 0.55, 1]}
          style={[styles.scrim, { paddingBottom: bottom + 24, minHeight: Math.round(height * 0.32) }]}>
          {/* BUG FIX (product report: "I dont want banner title, subtitle
              and detail screen body to be mandatory... sometimes I might
              not want a caption to show in the ads") — title used to
              render unconditionally, same class of bug `body` right below
              already avoided; an ad with no title left an empty (but still
              space-taking, per h4's line-height) heading over the image. */}
          {title ? (
            <Text category="h4" bold style={styles.title}>
              {title}
            </Text>
          ) : null}
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
