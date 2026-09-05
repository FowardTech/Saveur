import React from 'react';
import {View} from 'react-native';

// Shared by CodingProblemSolve.tsx and CodingInterview.tsx to wire a
// section up as one components/CoachMarkTour.tsx target: a ref for the
// tour's final measureInWindow spotlight, and an onLayout that caches this
// view's y-offset within components/Content.tsx's scroll content (see
// CoachMarkTour.tsx's own TourStep.offsetRef comment for why that's
// already the right coordinate space with no extra plumbing — every
// coach-marked section on those screens is a direct child of <Content>).
export default function useTourTarget() {
  const ref = React.useRef<View | null>(null);
  const offsetRef = React.useRef<number | undefined>(undefined);
  const onLayout = React.useCallback((e: {nativeEvent: {layout: {y: number}}}) => {
    offsetRef.current = e.nativeEvent.layout.y;
  }, []);
  return {ref, offsetRef, onLayout};
}
