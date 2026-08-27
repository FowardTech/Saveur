import React from 'react';
import { Modal, View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Icon } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from './Text';
import { Images } from 'assets/images';
import useLayout from 'hooks/useLayout';
import { globalStyle } from 'styles/globalStyle';

interface Props {
  visible: boolean;
  title?: string;
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
// entire screen edge-to-edge.
//
// BUG FIX (product report, screenshot of the popup with "AI Career Coach"
// text overlaid at the bottom: "I said I dont want captions on any ads.
// This is not a webapp or a website. Cant you see that the caption overlay
// is making the ads banner look awful?") — a previous pass made title/body
// individually OPTIONAL (only render if set), but per this report that
// wasn't the actual ask: NO caption text should ever be drawn over the ad
// image, period, regardless of whether the admin filled those fields in.
// `title`/`body` props are kept (typed optional now, and still accepted
// from callers) purely because AdDetails.tsx still shows them as the full
// write-up on its own separate screen after tapping through — they're just
// never rendered here, on the image itself, anymore. Along with them, the
// tall bottom gradient scrim that existed ONLY to keep that text legible
// over an arbitrary photo is gone too — replaced by a single compact CTA
// pill that sits on its own small opaque background, the way a real native
// mobile ad unit (App Store/Play Store featured banners, Instagram/
// Facebook image ads) looks: an image, and one small tappable affordance,
// nothing captioned over the artwork itself.
//
// BUG FIX: this component already existed with the "full height" redesign
// described above, but was never actually wired into HomeSrc.tsx, which
// kept rendering the OLDER small centered card (components/ModalRequest.tsx)
// for the real ad popup — this file was dead code. HomeSrc.tsx now renders
// this component instead (see that file's own comment at the swap site).
const AdPopupModal: React.FC<Props> = ({ visible, imageUrl, ctaLabel, onCta, onDismiss }) => {
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

        {/* No caption, no gradient scrim — just the image and one small
            tappable CTA pill sitting directly on it, its own opaque
            background (not a fade over the artwork) providing all the
            contrast it needs. Tapping anywhere else on the image also
            opens the ad's detail screen, same destination as the pill, so
            the whole banner reads as one tappable unit the way a real
            native ad does — the pill is a visible affordance, not the only
            hit area. Rendered BEFORE the close button and CTA pill below
            (not after) so this full-bleed layer never sits on top of them
            and steals their taps — React Native stacks siblings in JSX
            order, later = on top. */}
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={onCta}
          style={StyleSheet.absoluteFillObject}
        />

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={[styles.closeButton, { top: top + 16 }]}>
          <Icon pack="eva" name="close-outline" style={styles.closeIcon} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onCta}
          style={[styles.ctaPill, { bottom: bottom + 20 }]}>
          <Text category="h9" bold center style={styles.ctaPillText}>
            {ctaLabel ?? t('view_details', { defaultValue: 'View Details' })}
          </Text>
        </TouchableOpacity>
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
  // Compact pill — replaces the old full-width bottom scrim (see the JSX
  // comment above where this renders). Centered, own opaque white fill and
  // shadow, sized to its own text rather than stretching edge-to-edge, so
  // it reads as a small floating control over the artwork instead of a
  // caption bar.
  ctaPill: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    // Product request: solid CTA pills app-wide -> border radius 5.
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    ...globalStyle.shadowBtn,
  },
  ctaPillText: {
    color: '#0063f8',
  },
});
