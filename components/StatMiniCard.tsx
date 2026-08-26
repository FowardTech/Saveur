import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, Icon } from '@ui-kitten/components';

import Text from 'components/Text';
import { globalStyle } from 'styles/globalStyle';

// HOME REDESIGN (product reference — a pastel-tinted stat card pair sitting
// side by side below the mission hero: icon+title row, a big bold headline
// value, an optional progress bar, a one-line caption, and a small
// decorative illustration in the corner). Shared between HomeSrc.tsx's
// "Roadmap Progress"/"Current Streak" pair (see that file for how each is
// filled with real data) and meant for reuse anywhere else a similar
// small stat tile fits, per the "use this look and feel throughout the
// whole app" product direction.
export interface StatMiniCardProps {
  icon: string; // eva icon pack name
  iconTint: string;
  title: string;
  value: string;
  valueColor: string;
  caption: string;
  // Optional -- only shown when the caller has a real percentage to
  // report (see MissionHeroCard's own comment on the same convention).
  progressPercent?: number;
  progressColor?: string;
  backgroundColor: string;
  illustration?: React.ReactNode;
  onPress?: () => void;
  style?: any;
}

const StatMiniCard: React.FC<StatMiniCardProps> = ({
  icon,
  iconTint,
  title,
  value,
  valueColor,
  caption,
  progressPercent,
  progressColor,
  backgroundColor,
  illustration,
  onPress,
  style,
}) => {
  const styles = useStyleSheet(themedStyles);
  const showProgress = typeof progressPercent === 'number';
  const clampedPercent = Math.max(0, Math.min(100, progressPercent ?? 0));

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}
      style={[styles.card, { backgroundColor }, style]}
      onPress={onPress}>
      <View style={styles.headerRow}>
        <Icon pack="eva" name={icon} style={{ width: 16, height: 16, tintColor: iconTint }} />
        <Text category="h10" bold ml={6} style={{ color: iconTint }}>
          {title}
        </Text>
      </View>
      <Text category="h6" bold mt={8} style={{ color: valueColor }}>
        {value}
      </Text>
      {showProgress ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${clampedPercent}%`, backgroundColor: progressColor ?? valueColor }]} />
        </View>
      ) : null}
      <Text category="h10" status="placeholder" numberOfLines={2} mt={8} style={globalStyle.flexOne}>
        {caption}
      </Text>
      {illustration ? <View style={styles.artWrap}>{illustration}</View> : null}
    </TouchableOpacity>
  );
};

export default StatMiniCard;

const themedStyles = StyleService.create({
  card: {
    ...globalStyle.card,
    flex: 1,
    padding: 14,
    // Product precedent (MyProgress.tsx's own statCard/Subscription.tsx's
    // planCardHero, etc.) — a pastel-fill card doesn't want
    // globalStyle.card's neutral shadow, which reads as a muddy halo
    // against a saturated tint instead of a crisp colored tile.
    shadowOpacity: 0,
    elevation: 0,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
  },
  artWrap: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    opacity: 0.9,
  },
});
