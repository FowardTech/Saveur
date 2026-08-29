import React, {memo} from 'react';
import {TouchableOpacity, View, ViewStyle, StyleProp} from 'react-native';
import {StyleService, useStyleSheet, useTheme, Icon} from '@ui-kitten/components';

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
}

const ActionCard: React.FC<ActionCardProps> = memo(
  ({icon, iconPack = 'eva', title, subtitle, onPress, disabled, style, trailing}) => {
    const styles = useStyleSheet(themedStyles);
    const theme = useTheme();
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        disabled={disabled}
        style={[styles.card, style, disabled ? styles.disabled : undefined]}>
        <View style={styles.iconWrap}>
          <Icon
            pack={iconPack}
            name={icon}
            style={[globalStyle.icon16, {tintColor: theme['color-primary-100']}]}
          />
        </View>
        <View style={globalStyle.flexOne}>
          <Text category="h8" bold numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text category="h10" numberOfLines={1} mt={2} style={styles.subtitle}>
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
            style={[styles.chevron, {tintColor: theme['color-basic-400']}]}
          />
        )}
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
    borderWidth: 1,
    borderColor: 'border-card-default',
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
  subtitle: {
    color: 'text-hint-color',
  },
  chevron: {
    width: 18,
    height: 18,
    marginLeft: 6,
  },
});
