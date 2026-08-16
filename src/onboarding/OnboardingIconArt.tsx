import React from 'react';
import { Image, ImageSourcePropType, ImageStyle, StyleSheet, View } from 'react-native';

interface OnboardingIconArtProps {
  primaryIcon: ImageSourcePropType;
  accentIcon: ImageSourcePropType;
  tintColor: string;
  size: number;
  pageBackgroundColor: string;
}

// Onboarding redesign (product request: "In the app onboarding I want you
// to replace those illustrations with the appropriate icons from this [icon
// pack]... or even a combination of icons just to illustrate appropriately")
// -- replaces the old single full-bleed "phone mockup + floating card" hero
// PNG per slide (see index.tsx's own long module comment for that
// illustration's history) with a lightweight icon-cluster composition
// instead: a soft brand-tinted circular backdrop, the slide's main
// illustrated icon centered inside it, and a second, smaller icon
// overlapping the bottom-right edge in its own circular badge -- the same
// "big icon + small corner badge" language iOS app icons/a lot of
// onboarding flows use to combine two related ideas into one visual (e.g.
// slide 1 pairs a chat-bubble icon, the interview conversation, with an
// AI-sparkle badge, the "AI coach" half of that same sentence). No custom
// SVG/design-kit artwork this time (see index.tsx's history of that whole
// approach) -- these are the product owner's own real downloaded icons8
// PNGs (assets/images/index.ts), just arranged into a two-icon cluster
// instead of used one at a time.
const OnboardingIconArt: React.FC<OnboardingIconArtProps> = ({
  primaryIcon,
  accentIcon,
  tintColor,
  size,
  pageBackgroundColor,
}) => {
  const badgeSize = size * 0.42;
  // The badge overlaps the main circle's bottom-right edge -- outer
  // wrapper needs a little extra room on that side so the badge's own
  // shadow doesn't get clipped by a parent that's sized exactly to the
  // main circle.
  const wrapperSize = size + badgeSize * 0.3;
  return (
    <View style={{ width: wrapperSize, height: wrapperSize }}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: tintColor },
        ]}>
        <Image
          source={primaryIcon}
          resizeMode="contain"
          style={{ width: size * 0.5, height: size * 0.5 } as ImageStyle}
        />
      </View>
      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            right: 0,
            bottom: 0,
            backgroundColor: pageBackgroundColor,
            borderColor: pageBackgroundColor,
          },
        ]}>
        <Image
          source={accentIcon}
          resizeMode="contain"
          style={{ width: badgeSize * 0.6, height: badgeSize * 0.6 } as ImageStyle}
        />
      </View>
    </View>
  );
};

export default OnboardingIconArt;

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    // A same-color-as-page border creates a "cutout ring" separating the
    // badge from the main circle behind it (the badge sits on a solid page
    // background here, not literally on the main circle, so a matching
    // border reads as breathing room rather than a visible seam).
    borderWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
