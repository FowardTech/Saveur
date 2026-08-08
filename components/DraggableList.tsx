import React from 'react';
import { Animated, LayoutAnimation, PanResponder, Platform, StyleSheet, UIManager, View } from 'react-native';
import { Icon, useTheme } from '@ui-kitten/components';
import { globalStyle } from 'styles/globalStyle';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ItemLayout {
  y: number;
  height: number;
}

export interface DraggableListProps<T> {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  onReorder: (next: T[]) => void;
  // Receives a `dragHandle` element to place wherever the item's own layout
  // wants a grip icon (renderItem is fully in control of layout — this
  // component only owns the drag mechanics, not the row's visual shape).
  renderItem: (item: T, index: number, dragHandle: React.ReactNode) => React.ReactNode;
  style?: any;
}

// Generic drag-to-reorder list.
//
// Deliberately built on React Native's own core Touch Responder System
// (PanResponder) + the core Animated API — NOT react-native-gesture-handler
// or Reanimated, and no new dependency was added for this. This app already
// hit a real, hard-to-debug native crash from a Gesture.Pan() + worklet
// combination on this exact React Native / Reanimated stack (see
// components/SystemDesignWhiteboard.tsx's own history — it was rewritten
// OFF gesture-handler/Reanimated entirely after root-causing the crash to
// two competing worklet runtimes fighting over function ownership). None of
// the lists this component reorders (a handful of resume bullets, work
// entries, etc.) are long enough to need a virtualized, natively-driven
// gesture library — so this reuses that same proven, zero-additional-risk
// approach rather than reintroducing that exact crash class for a feature
// that doesn't actually need it.
//
// Behavior: press-and-hold the drag handle, move up/down. The dragged row
// lifts (scale + shadow) and follows the finger; siblings stay put until
// release, at which point the final drop index is computed from the
// dragged row's last on-screen position against every other row's measured
// midpoint, and the array is reordered in one commit with a LayoutAnimation
// easing everything else into place.
export function DraggableList<T>({ data, keyExtractor, onReorder, renderItem, style }: DraggableListProps<T>) {
  const theme = useTheme();
  const itemLayouts = React.useRef<ItemLayout[]>([]);
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null);
  const dragY = React.useRef(new Animated.Value(0)).current;
  const dragStartY = React.useRef(0);

  const onItemLayout = (index: number) => (e: any) => {
    const { y, height } = e.nativeEvent.layout;
    itemLayouts.current[index] = { y, height };
  };

  const computeDropIndex = (currentTopY: number): number => {
    for (let i = 0; i < itemLayouts.current.length; i++) {
      const layout = itemLayouts.current[i];
      if (!layout) continue;
      const midpoint = layout.y + layout.height / 2;
      if (currentTopY < midpoint) return i;
    }
    return Math.max(0, data.length - 1);
  };

  const responders = React.useMemo(
    () =>
      data.map((_, index) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => {
            setDraggingIndex(index);
            dragStartY.current = itemLayouts.current[index]?.y ?? 0;
            dragY.setValue(0);
          },
          onPanResponderMove: Animated.event([null, { dy: dragY }], { useNativeDriver: false }),
          onPanResponderRelease: (_evt, gesture) => {
            const liveTopY = dragStartY.current + gesture.dy;
            const dropIndex = computeDropIndex(liveTopY);
            setDraggingIndex(null);
            dragY.setValue(0);
            if (dropIndex !== index) {
              const next = data.slice();
              const [moved] = next.splice(index, 1);
              next.splice(dropIndex, 0, moved);
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              onReorder(next);
            }
          },
          onPanResponderTerminate: () => {
            setDraggingIndex(null);
            dragY.setValue(0);
          },
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.length, data],
  );

  return (
    <View style={style}>
      {data.map((item, index) => {
        const isDragging = draggingIndex === index;
        const handle = (
          <View
            {...responders[index].panHandlers}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.handle}>
            <Icon
              pack="eva"
              name="grip-outline"
              style={[globalStyle.icon20, { tintColor: theme['text-hint-color'] ?? '#9AA3B2' }]}
            />
          </View>
        );
        return (
          <Animated.View
            key={keyExtractor(item, index)}
            onLayout={onItemLayout(index)}
            style={
              isDragging
                ? [
                    styles.dragging,
                    {
                      transform: [{ translateY: dragY }, { scale: 1.02 }],
                    },
                  ]
                : undefined
            }>
            {renderItem(item, index, handle)}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  handle: {
    padding: 6,
  },
  dragging: {
    zIndex: 10,
    elevation: 8,
    opacity: 0.97,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
});

export default DraggableList;
