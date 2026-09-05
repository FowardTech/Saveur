import React, {memo} from 'react';
import {Modal, Pressable, StyleSheet, View, useWindowDimensions} from 'react-native';
import {useTheme, Layout} from '@ui-kitten/components';

import Text from './Text';
import Flex from './Flex';

// Spotlight, step-by-step in-app guide (product report: "I need you to
// implement a guide in the coding practice so that users can know how the
// coding practice works because its still confusing me. It should guide
// the user on how every section works"). Deliberately distinct from
// components/AppTour.tsx's own walkthrough: that one is a plain full-screen
// carousel with NO spotlight, by explicit design, because it walks through
// features spread across several independent stack navigators (see its own
// comment) where pointing at a live element isn't practical. Coding
// Practice is a single scrollable screen, so a real spotlight on the actual
// Problem/Language/Code/Run/Test Cases/Finish sections is both feasible and
// far more useful than a generic slideshow — a beginner sees exactly which
// part of the real screen each explanation is talking about.
export interface TourStep {
  key: string;
  title: string;
  body: string;
  // The real on-screen element this step explains. Wrap the target section
  // in a plain `<View ref={targetRef} collapsable={false}>` — collapsable
  // is required on Android, otherwise the view can be optimized out of the
  // native tree and measureInWindow silently stops working. Omit entirely
  // for a step with no single on-screen home (e.g. a closing "what happens
  // next" summary) — that step renders as a plain centered card with no
  // spotlight, same visual language as AppTour.
  targetRef?: React.RefObject<View | null>;
  // Written by the host screen's onLayout on that same wrapped View,
  // relative to the scrolling container's own content (i.e. exactly what a
  // direct child of components/Content.tsx's ScrollView reports in
  // onLayout's nativeEvent.layout.y — see this component's own usage
  // comment in CodingProblemSolve.tsx/CodingInterview.tsx for why that's
  // already the right coordinate space with zero extra plumbing). Used to
  // scroll this step's target into view before spotlighting it. Leave
  // unset for a step that shouldn't trigger a scroll (already-visible
  // target, or a targetRef-less closing step).
  offsetRef?: React.RefObject<number | undefined>;
}

interface CoachMarkTourProps {
  visible: boolean;
  steps: TourStep[];
  onClose(): void;
  // Ref to the host screen's components/Content.tsx instance (forwardRef),
  // used to call its imperative scrollToPosition/scrollTo so each step's
  // target scrolls into view before being spotlighted.
  scrollRef?: React.RefObject<any>;
  // How far below the screen's fixed TopNavigation to land a scrolled-to
  // target — matches this app's TopNavigation height + a little breathing
  // room. Every coding-practice screen this is used on shares the same
  // fixed header height, so one default covers both.
  topInset?: number;
  skipLabel?: string;
  backLabel?: string;
  nextLabel?: string;
  doneLabel?: string;
  stepLabel?: (current: number, total: number) => string;
}

const DEFAULT_TOP_INSET = 90;
// How long to wait after issuing scrollTo before re-measuring the target's
// final on-screen position. The scroll itself is animated (~300-350ms on
// both platforms for the short distances involved here) — measuring too
// early would spotlight where the target WAS about to be, not where it
// actually landed, especially once RN clamps a scroll near the top/bottom
// of the content.
const POST_SCROLL_MEASURE_DELAY = 380;

const CoachMarkTour = memo(({
  visible,
  steps,
  onClose,
  scrollRef,
  topInset = DEFAULT_TOP_INSET,
  skipLabel = 'Skip',
  backLabel = 'Back',
  nextLabel = 'Next',
  doneLabel = 'Got it',
  stepLabel,
}: CoachMarkTourProps) => {
  const theme = useTheme();
  const {width, height} = useWindowDimensions();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [rect, setRect] = React.useState<{x: number; y: number; width: number; height: number} | null>(null);
  const measureTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const goToStep = React.useCallback((idx: number) => {
    const target = steps[idx];
    if (!target) return;
    if (measureTimerRef.current) clearTimeout(measureTimerRef.current);

    if (!target.targetRef?.current) {
      // No live element for this step (e.g. a closing summary) — plain
      // centered card, no spotlight, no scroll attempt.
      setRect(null);
      return;
    }

    const offset = target.offsetRef?.current;
    if (scrollRef?.current && typeof offset === 'number') {
      const y = Math.max(0, offset - topInset);
      const node: any = scrollRef.current;
      if (typeof node.scrollToPosition === 'function') {
        node.scrollToPosition(0, y, true);
      } else if (typeof node.scrollTo === 'function') {
        node.scrollTo({y, animated: true});
      }
    }

    measureTimerRef.current = setTimeout(() => {
      target.targetRef?.current?.measureInWindow((x, y, w, h) => {
        setRect({x, y, width: w, height: h});
      });
    }, POST_SCROLL_MEASURE_DELAY);
  }, [steps, scrollRef, topInset]);

  // Reset to the first step and (re)position every time the tour is opened
  // — mirrors AppTour's own reset-on-open behavior, needed here too since
  // both the auto-first-time-show and the manual "?" replay reuse the same
  // mounted instance rather than remounting it.
  React.useEffect(() => {
    if (visible) {
      setStepIndex(0);
      goToStep(0);
    } else if (measureTimerRef.current) {
      clearTimeout(measureTimerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  React.useEffect(() => {
    return () => {
      if (measureTimerRef.current) clearTimeout(measureTimerRef.current);
    };
  }, []);

  const onNext = () => {
    if (isLast) {
      onClose();
      return;
    }
    const next = stepIndex + 1;
    setStepIndex(next);
    goToStep(next);
  };

  const onBack = () => {
    const prev = Math.max(0, stepIndex - 1);
    setStepIndex(prev);
    goToStep(prev);
  };

  if (!step) return null;

  // Tooltip card placement: below the spotlighted rect if there's room,
  // otherwise above it. With no rect at all (closing/no-target step), fall
  // back to a plain centered card, same as AppTour.
  const CARD_MARGIN = 16;
  const CARD_ESTIMATED_HEIGHT = 230;
  let cardStyle: any = {position: 'absolute', left: CARD_MARGIN, right: CARD_MARGIN};
  if (rect) {
    const spaceBelow = height - (rect.y + rect.height);
    if (spaceBelow >= CARD_ESTIMATED_HEIGHT || spaceBelow >= rect.y) {
      cardStyle.top = Math.min(rect.y + rect.height + 14, height - CARD_ESTIMATED_HEIGHT - CARD_MARGIN);
    } else {
      cardStyle.top = Math.max(CARD_MARGIN, rect.y - CARD_ESTIMATED_HEIGHT - 14);
    }
  } else {
    cardStyle = {alignSelf: 'center'};
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Dimmed frame around the spotlighted rect (4 strips), or one
            full-screen dim when there's nothing to spotlight this step. */}
        {rect ? (
          <>
            <View style={[styles.dim, {top: 0, left: 0, right: 0, height: Math.max(0, rect.y)}]} />
            <View style={[styles.dim, {top: rect.y + rect.height, left: 0, right: 0, bottom: 0}]} />
            <View style={[styles.dim, {top: rect.y, left: 0, width: Math.max(0, rect.x), height: rect.height}]} />
            <View style={[styles.dim, {top: rect.y, left: rect.x + rect.width, right: 0, height: rect.height}]} />
            <View
              pointerEvents="none"
              style={[
                styles.spotlightBorder,
                {
                  top: rect.y - 4,
                  left: rect.x - 4,
                  width: rect.width + 8,
                  height: rect.height + 8,
                  borderColor: theme['color-primary-500'],
                },
              ]}
            />
          </>
        ) : (
          <View style={[styles.dim, StyleSheet.absoluteFillObject]} />
        )}

        <Pressable style={StyleSheet.absoluteFill} onPress={() => undefined} />

        <View style={cardStyle}>
          <Layout level="1" style={styles.card}>
            <Flex justify="space-between" itemsCenter>
              <Text category="h10" status="placeholder">
                {stepLabel ? stepLabel(stepIndex + 1, steps.length) : `${stepIndex + 1} / ${steps.length}`}
              </Text>
              <Text category="h10" status="placeholder" onPress={onClose} style={{padding: 4}}>
                {skipLabel}
              </Text>
            </Flex>

            <Text category="h7" bold mt={10}>
              {step.title}
            </Text>
            <Text category="h9-s" status="placeholder" mt={8}>
              {step.body}
            </Text>

            <Flex justify="center" itemsCenter mt={16} mb={4}>
              {steps.map((s, i) => (
                <View
                  key={s.key}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i === stepIndex
                        ? theme['color-primary-500']
                        : theme['background-basic-color-3'],
                    },
                  ]}
                />
              ))}
            </Flex>

            <Flex justify="space-between" itemsCenter mt={12}>
              <Text
                category="h9"
                status={stepIndex === 0 ? 'placeholder' : 'basic'}
                onPress={stepIndex === 0 ? undefined : onBack}
                style={{padding: 8, opacity: stepIndex === 0 ? 0.4 : 1}}
              >
                {backLabel}
              </Text>
              <Text category="h9" bold status="link" onPress={onNext} style={{padding: 8}}>
                {isLast ? doneLabel : nextLabel}
              </Text>
            </Flex>
          </Layout>
        </View>
      </View>
    </Modal>
  );
});

export default CoachMarkTour;

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(30, 31, 42, 0.86)',
  },
  spotlightBorder: {
    position: 'absolute',
    borderWidth: 2.5,
    borderRadius: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
});
