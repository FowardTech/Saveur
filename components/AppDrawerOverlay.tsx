import React, {memo} from 'react';
import {Dimensions, PanResponder, Pressable, StyleSheet} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// SYMPHONY REDESIGN (drawer nav shell) — see navigation/DrawerContext.tsx's
// own top comment for the full "why not @react-navigation/drawer" story.
// This is the actual sliding panel + backdrop, driven by Reanimated's
// current, still-supported APIs (useSharedValue/useAnimatedStyle/
// withTiming) — deliberately NOT react-native-gesture-handler's Gesture
// API either, even though that's the officially-current replacement for
// the deprecated useAnimatedGestureHandler hook this whole component
// exists to avoid. This app has separate, real crash history from
// Reanimated 4 + gesture-handler Gesture.Pan() combinations (see
// components/DraggableList.tsx and src/practice/SystemDesignWhiteboard.tsx's
// own comments, both of which deliberately use React Native core's plain
// PanResponder instead for exactly that reason) — same precedent applies
// here. PanResponder callbacks run on the JS thread and assign straight
// into a Reanimated shared value (`translateX.value = ...`), which is a
// always-supported, version-independent way to drive a UI-thread-animated
// style from a JS-thread gesture, without touching gesture-handler at all.
const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 320);
// How far left (in px) a swipe has to travel before releasing counts as
// "close it" rather than snapping back open.
const CLOSE_THRESHOLD = DRAWER_WIDTH * 0.3;

interface AppDrawerOverlayProps {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
}

const AppDrawerOverlay = memo(({visible, onRequestClose, children}: AppDrawerOverlayProps) => {
  // 0 = fully open, -DRAWER_WIDTH = fully closed (off-screen to the left).
  const translateX = useSharedValue(-DRAWER_WIDTH);
  // Mirrors `visible` but only flips AFTER the close animation finishes,
  // so the backdrop/panel can still render (and animate out) for one more
  // frame after the caller already set visible=false, instead of
  // vanishing instantly mid-slide.
  const [mounted, setMounted] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      translateX.value = withTiming(0, {duration: 240});
    } else {
      // withTiming's completion callback runs on the UI thread —
      // setMounted (a JS-thread React state setter) can't be called
      // directly from there. `runOnJS` is Reanimated's own bridge for
      // exactly this case.
      translateX.value = withTiming(-DRAWER_WIDTH, {duration: 200}, finished => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_evt, gesture) => {
          // Only allow dragging further CLOSED (negative) — this is a
          // close gesture, not a way to over-open past the panel's own
          // resting position.
          const next = Math.min(0, Math.max(-DRAWER_WIDTH, gesture.dx));
          translateX.value = next;
        },
        onPanResponderRelease: (_evt, gesture) => {
          if (gesture.dx < -CLOSE_THRESHOLD) {
            onRequestClose();
          } else {
            translateX.value = withTiming(0, {duration: 180});
          }
        },
      }),
    [onRequestClose, translateX],
  );

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{translateX: translateX.value}],
  }));
  const backdropStyle = useAnimatedStyle(() => {
    // Fade the backdrop in lockstep with how far open the panel is,
    // rather than a separate binary on/off — matches the panel's own
    // drag-to-close feel (the dimming eases out as you drag the panel
    // away, not just at the very end).
    const progress = 1 - Math.abs(translateX.value) / DRAWER_WIDTH;
    return {opacity: progress * 0.4};
  });

  if (!mounted) return null;

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents={visible ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} />
      </Animated.View>
      <Animated.View
        style={[styles.panel, {width: DRAWER_WIDTH}, panelStyle]}
        {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </>
  );
});

export default AppDrawerOverlay;

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 20,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 21,
    // Shadow on the panel's own trailing (right) edge — the one visible
    // seam between the drawer and whatever's behind it.
    shadowColor: '#000',
    shadowOffset: {width: 4, height: 0},
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
  },
});
