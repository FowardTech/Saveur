import React, {memo} from 'react';
import {Image, ImageStyle, TouchableOpacity, View, ViewStyle, StyleProp, ImageSourcePropType} from 'react-native';
import {StyleService, useStyleSheet, useTheme, Icon} from '@ui-kitten/components';
import LinearGradient from 'react-native-linear-gradient';

import Text from 'components/Text';
import {globalStyle} from 'styles/globalStyle';

// SYMPHONY REDESIGN — the simple, full-width "launcher" card the reference
// app builds its Home and Settings screens out of almost entirely: a
// leading icon in a soft blue-tinted circle, a bold title + one-line muted
// subtitle, and an optional trailing badge/toggle/chevron. One shared
// component (product request: "the same look and feel throughout the whole
// app... including... every single screen") so Home's launcher cards
// (src/home/HomeSrc.tsx) and the Settings screen's menu rows
// (src/more/MoreSrc.tsx) render with the exact same shape instead of two
// different card styles.
//
// Deliberately minimal — no meta rows, no progress bars, no illustrations
// (see MissionHeroCard.tsx for that richer treatment, still used
// separately) — matching the explicit ask: "just have 3 or 4 horizontal
// cards, that's enough."
export interface ActionCardProps {
  icon: string;
  // 'eva' (lucide-backed, assets/LucideEvaIconsPack.tsx) for new call
  // sites; 'assets' for this app's older bespoke PNG icon set (MoreSrc.tsx
  // rows still use their own existing 'assets' icon names — no need to
  // re-author 30+ icons for this pass).
  iconPack?: 'eva' | 'assets';
  // SYMPHONY REDESIGN follow-up (product request, with reference images:
  // "replace the icons used for the daily challenge, AI Career Coach,
  // Practice and Explore with these icons") -- these are full-color
  // gradient illustrations (assets/images/index.ts's iconX entries), not
  // single-color glyphs, so they can't go through the tinted `icon`/
  // `iconPack` Icon below (tintColor would flatten them to one solid
  // color). When set, this takes over the icon slot entirely, rendered as
  // a plain untinted Image instead -- `icon`/`iconPack` are ignored.
  iconImage?: ImageSourcePropType;
  title: string;
  subtitle?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  // Trailing slot — a chevron by default, but a caller can pass its own
  // (a Toggle, a "PRO" pill, a badge dot) instead. Keeping this as a
  // slot rather than baking in every possible trailing widget keeps this
  // component simple while still covering MoreSrc.tsx's existing
  // toggle/badge/pro-badge rows.
  trailing?: React.ReactNode;
  // Product request (Practice card, with an exact CSS spec: "linear-
  // gradient(15deg, #45009d 20%, #8c00e5)") — opt-in only; every other
  // ActionCard call site keeps its plain themed background untouched.
  // `gradientLocations` mirrors CSS's per-stop percentages (e.g. the
  // "20%" above) — react-native-linear-gradient's own `locations` prop,
  // same length as `gradientColors`, each a 0-1 fraction. When set, this
  // card's title/subtitle/chevron automatically switch to light/white-ish
  // tones instead of the theme's normal dark text — a custom saturated
  // gradient like this is being used specifically to stand out, so it's
  // always dark enough that default dark-on-transparent text would be
  // low-contrast.
  gradientColors?: string[];
  gradientLocations?: number[];
}

// Converts a CSS `linear-gradient(<angle>deg, ...)` angle into the
// start/end fractional points react-native-linear-gradient actually takes
// (it has no angle prop of its own). CSS angles are clockwise from
// "straight up" (0deg = to top, 90deg = to right); this rotates that
// direction vector, scales it to fit a 0-1 box, then re-centers it —
// standard CSS-angle-to-vector conversion, not RN-specific guesswork.
function cssAngleToGradientPoints(angleDeg: number): {start: {x: number; y: number}; end: {x: number; y: number}} {
  const rad = (angleDeg * Math.PI) / 180;
  const x2 = Math.sin(rad);
  const y2 = -Math.cos(rad);
  const scale = 1 / Math.max(Math.abs(x2), Math.abs(y2), 0.0001);
  const ex = x2 * scale;
  const ey = y2 * scale;
  return {
    start: {x: (-ex + 1) / 2, y: (-ey + 1) / 2},
    end: {x: (ex + 1) / 2, y: (ey + 1) / 2},
  };
}

const ActionCard: React.FC<ActionCardProps> = memo(
  ({icon, iconPack = 'eva', iconImage, title, subtitle, onPress, disabled, style, trailing, gradientColors, gradientLocations}) => {
    const styles = useStyleSheet(themedStyles);
    const theme = useTheme();
    const isGradient = !!gradientColors?.length;
    const content = (
      <>
        <View style={[styles.iconWrap, isGradient ? styles.iconWrapOnGradient : undefined]}>
          {iconImage ? (
            <Image source={iconImage} resizeMode="contain" style={styles.iconImage as ImageStyle} />
          ) : (
            <Icon
              pack={iconPack}
              name={icon}
              style={[globalStyle.icon16, {tintColor: isGradient ? '#FFFFFF' : theme['color-primary-100']}]}
            />
          )}
        </View>
        <View style={globalStyle.flexOne}>
          <Text category="h8" bold numberOfLines={1} style={isGradient ? styles.titleOnGradient : undefined}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              category="h10"
              numberOfLines={1}
              mt={2}
              style={isGradient ? styles.subtitleOnGradient : styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing !== undefined ? (
          trailing
        ) : (
          <Icon
            pack="eva"
            name="chevron-right-outline"
            style={[styles.chevron, {tintColor: isGradient ? 'rgba(255,255,255,0.85)' : theme['color-basic-400']}]}
          />
        )}
      </>
    );
    if (isGradient) {
      const {start, end} = cssAngleToGradientPoints(15);
      return (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onPress}
          disabled={disabled}
          style={[style, disabled ? styles.disabled : undefined]}>
          <LinearGradient
            colors={gradientColors as [string, string, ...string[]]}
            locations={gradientLocations}
            start={start}
            end={end}
            style={[styles.card, styles.cardNoBorder]}>
            {content}
          </LinearGradient>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        disabled={disabled}
        style={[styles.card, style, disabled ? styles.disabled : undefined]}>
        {content}
      </TouchableOpacity>
    );
  },
);

export default ActionCard;

const themedStyles = StyleService.create({
  card: {
    ...globalStyle.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'background-basic-color-2',
    // borderWidth: 1,
    // BUG FIX (product report: "the cards in the homescreen should have
    // the default blue border") -- was 'border-card-default', a neutral
    // gray token (see constants/theme/appTheme.json/dark.json) shared with
    // plain, unhighlighted cards elsewhere in the app. These 4 Home
    // launcher cards now always use the app's real primary blue
    // (color-primary-500, #0063f8) as their border, unconditionally --
    // not just as a conditional "active/selected" state the way other
    // screens use this same token (see e.g. PaymentMethod.tsx/AddOns.tsx),
    // since the product ask here was for it to be every card's normal,
    // resting look.
    borderColor: 'color-primary-500',
  },
  // Gradient variant (see gradientColors' own comment) supplies its own
  // saturated fill via LinearGradient instead — the default blue border
  // above would clash with/barely show against it.
  cardNoBorder: {
    borderWidth: 0,
  },
  disabled: {
    opacity: 0.6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    backgroundColor: 'color-primary-transparent-100',
  },
  // Gradient variant: a soft translucent-white tint reads as a raised
  // "glass" icon chip against the saturated purple fill, the same way
  // color-primary-transparent-100 does against the normal light card
  // background above.
  iconWrapOnGradient: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  titleOnGradient: {
    color: '#FFFFFF',
  },
  subtitleOnGradient: {
    color: 'rgba(255,255,255,0.78)',
  },
  // SYMPHONY REDESIGN follow-up -- see `iconImage` prop's own comment.
  // Sized a touch smaller than iconWrap's 40x40 box so these full-color
  // gradient illustrations sit with a little breathing room, matching how
  // the same iconX images are inset within their own circular wraps
  // elsewhere (e.g. Chat.tsx's coachAvatar).
  iconImage: {
    width: 28,
    height: 28,
  },
  subtitle: {
    color: 'text-hint-color',
  },
  chevron: {
    width: 18,
    height: 18,
    marginLeft: 6,
  },
});
