import React, { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Icon } from '@ui-kitten/components';

interface OnboardingClusterBadge {
  icon: string;
  bg: string;
}

// Small fixed decorative palette shared across every onboarding screen
// that uses this cluster — matches the reference's own mixed bright-color
// badge treatment (orange/pink/green, plus the app's real brand blue for
// at least one badge per screen so the cluster still reads as "this app,"
// not a generic stock illustration). Deliberately NOT drawn from the
// app's functional eva theme tokens (color-success/color-danger/etc.) —
// those carry semantic meaning (success/warning/danger) that has nothing
// to do with a decorative avatar/icon cluster.
export const CLUSTER_COLORS = {
  blue: '#0063F8',
  pink: '#EC4899',
  green: '#10B981',
  orange: '#F5A623',
} as const;

interface OnboardingClusterProps {
  // Exactly 2 real photo avatars (top + bottom of the cluster).
  avatarUris: [string, string];
  // Exactly 3 colored icon badges scattered around the avatars.
  badges: [OnboardingClusterBadge, OnboardingClusterBadge, OnboardingClusterBadge];
  // One small plain-color accent dot, no icon (matches the reference's own
  // loose "dot" filler pieces).
  accentColor: string;
  size?: number;
}

// SYMPHONY REDESIGN follow-up (explicit product correction, with 2
// reference screenshots of Symphony's own onboarding: "Cant you see the
// onboarding of symphony that it has photos like avatars and then it has
// icons that represents what the app it doing... it has 3 real images all
// in small avatars and then 2 icons in different color background"). This
// replaces BOTH the earlier "one full-bleed photo per slide" carousel
// treatment (src/onboarding/index.tsx's first pass) AND the "dashboard
// preview mock" treatment built for JobAlertsOnboarding/
// LearningCoursesOnboarding — the product owner's actual reference all
// along was this scattered cluster of small circular real-photo avatars
// mixed with colored rounded-icon badges, not a big photo and not a UI
// mockup. One shared component now used by all 3 onboarding surfaces
// (main carousel + Job Alerts + Learning Courses) so the visual language
// is identical everywhere, only the specific photos/icons per screen
// differ.
//
// Layout is a fixed, hand-placed scatter (not a grid/flex layout) inside a
// square canvas, same organic "orbiting cluster" feel as the reference:
// an avatar top-center, an avatar bottom-center, 3 icon badges filling the
// space between/around them at staggered heights, and one small plain
// color dot for extra visual texture (the reference's own small
// unlabeled dots). Positions are fractions of `size` so the whole cluster
// scales with the canvas rather than needing separate absolute layouts
// per screen size.
const OnboardingCluster = memo(({ avatarUris, badges, accentColor, size = 280 }: OnboardingClusterProps) => {
  const avatarSize = size * 0.24;
  const badgeSize = size * 0.2;
  const badgeSizeBig = size * 0.23;
  const dotSize = size * 0.1;

  return (
    <View style={{ width: size, height: size * 0.94 }}>
      {/* Top avatar */}
      <Image
        source={{ uri: avatarUris[0] }}
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            top: 0,
            left: (size - avatarSize) / 2,
          },
        ]}
      />
      {/* Plain accent dot, no icon */}
      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: accentColor,
            top: size * 0.17,
            left: size * 0.04,
          },
        ]}
      />
      {/* Left icon badge */}
      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize * 0.32,
            backgroundColor: badges[0].bg,
            top: size * 0.37,
            left: 0,
          },
        ]}>
        <Icon pack="eva" name={badges[0].icon} style={{ width: badgeSize * 0.46, height: badgeSize * 0.46, tintColor: '#FFFFFF' }} />
      </View>
      {/* Center icon badge (largest, focal point) */}
      <View
        style={[
          styles.badge,
          {
            width: badgeSizeBig,
            height: badgeSizeBig,
            borderRadius: badgeSizeBig * 0.32,
            backgroundColor: badges[1].bg,
            top: size * 0.44,
            left: (size - badgeSizeBig) / 2,
          },
        ]}>
        <Icon pack="eva" name={badges[1].icon} style={{ width: badgeSizeBig * 0.46, height: badgeSizeBig * 0.46, tintColor: '#FFFFFF' }} />
      </View>
      {/* Right icon badge */}
      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize * 0.32,
            backgroundColor: badges[2].bg,
            top: size * 0.34,
            left: size * 0.76,
          },
        ]}>
        <Icon pack="eva" name={badges[2].icon} style={{ width: badgeSize * 0.46, height: badgeSize * 0.46, tintColor: '#FFFFFF' }} />
      </View>
      {/* Bottom avatar */}
      <Image
        source={{ uri: avatarUris[1] }}
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            top: size * 0.74,
            left: (size - avatarSize) / 2,
          },
        ]}
      />
    </View>
  );
});

export default OnboardingCluster;

const styles = StyleSheet.create({
  avatar: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  dot: {
    position: 'absolute',
  },
});
