import React, { memo, useEffect } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@ui-kitten/components';
import { globalStyle } from 'styles/globalStyle';

// Product request: "I want skeleton loader in app." This app had no
// skeleton-loader component at all before this — every screen either
// showed a bare Spinner or just popped content in once a fetch resolved.
// This is the shared primitive (SkeletonBlock) plus a couple of pre-shaped
// composites for the specific areas asked for (Home, Networking Assistant
// / Job Alerts, Learning Courses / Career Roadmap) — see each screen's own
// usage for the exact placeholder shape used there.
//
// Uses react-native-reanimated (already a dependency — see
// src/messages/VoiceCoachView.tsx's voice-orb pulse for the existing
// convention) rather than the plain RN Animated API: the shimmer opacity
// pulse runs entirely on the UI thread via a shared value, which matters
// here specifically because a skeleton LIST means many of these animating
// at once — a JS-driven Animated.loop per block would mean N separate
// bridge-crossing animations fighting for the same JS thread, while this
// is effectively free regardless of how many blocks are on screen.
export const SkeletonBlock = memo(({ style, radius = 8 }: {
  style?: StyleProp<ViewStyle>;
  radius?: number;
}) => {
  const theme = useTheme();
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          backgroundColor: theme['background-basic-color-3'],
          borderRadius: radius,
        },
        style,
        animatedStyle,
      ]}
    />
  );
});

// Compact single-row card skeleton — same size/shape as the white
// compact cards this mirrors (ContinueLearningCard / UpcomingSessionHomeCard
// / CareerFairEventCard on Home), so a skeleton row swaps out for the real
// card with no layout jump once its data actually arrives.
export const SkeletonHomeCardRow = memo(({ style }: { style?: StyleProp<ViewStyle> }) => {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 16,
          paddingVertical: 10,
          paddingHorizontal: 12,
          backgroundColor: theme['background-basic-color-2'],
        },
        // FULL RESKIN: matches globalStyle.card's own border->shadow
        // switch (see that file's comment) — a skeleton should mirror
        // exactly the surface treatment of the real card it's standing in
        // for, or the swap from skeleton to real content reads as a
        // visible style jump the instant data arrives.
        globalStyle.shadowFade,
        style,
      ]}
    >
      <SkeletonBlock style={{ width: 30, height: 30, marginRight: 10 }} radius={15} />
      <View style={{ flex: 1 }}>
        <SkeletonBlock style={{ width: '70%', height: 12, marginBottom: 6 }} radius={4} />
        <SkeletonBlock style={{ width: '45%', height: 10 }} radius={4} />
      </View>
    </View>
  );
});

// Full-width list-row skeleton — job alerts / career events / course list
// items. Three lines of varying width read as "title, then two shorter
// meta lines" without needing per-caller customization.
export const SkeletonListRow = memo(({ style }: { style?: StyleProp<ViewStyle> }) => {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          borderRadius: 16,
          padding: 14,
          marginBottom: 12,
          backgroundColor: theme['background-basic-color-2'],
        },
        globalStyle.shadowFade,
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <SkeletonBlock style={{ width: 36, height: 36, marginRight: 10 }} radius={10} />
        <View style={{ flex: 1 }}>
          <SkeletonBlock style={{ width: '75%', height: 13, marginBottom: 6 }} radius={4} />
          <SkeletonBlock style={{ width: '50%', height: 10 }} radius={4} />
        </View>
      </View>
      <SkeletonBlock style={{ width: '90%', height: 10, marginBottom: 6 }} radius={4} />
      <SkeletonBlock style={{ width: '60%', height: 10 }} radius={4} />
    </View>
  );
});

// Repeats a skeleton row N times — the common "show a few placeholder rows
// while the real list loads" case, so call sites don't each re-implement
// their own .map(Array(count)).
export const SkeletonList = memo(({ count = 3, Row = SkeletonListRow, rowStyle, style }: {
  count?: number;
  Row?: React.ComponentType<{ style?: StyleProp<ViewStyle> }>;
  rowStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) => (
  <View style={style}>
    {Array.from({ length: count }).map((_, i) => (
      <Row key={i} style={rowStyle} />
    ))}
  </View>
));
