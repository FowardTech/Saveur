import React, { memo } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Rect } from 'react-native-svg';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Input,
  Button,
  Layout,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList, SystemDesignWhiteboardScreenNavigationProp } from 'navigation/types';
import * as interviewService from 'services/interviewService';
import * as codingService from 'services/codingService';

// Freehand "sketch your system design" surface — built on react-native-svg
// (already a project dependency) + react-native-gesture-handler rather than
// pulling in a new whiteboard/drawing native library, per this project's
// history of native-dependency version pain (Reanimated/react-native-
// screens/vision-camera all needed careful pinning — see CLAUDE history).
// Not a full diagramming tool: freehand strokes + tap-to-place shape stamps
// (rectangle/circle/diamond/database/cloud-free "line"/arrow — the
// standard boxes-and-arrows system-design vocabulary), draggable after
// placement, is enough to sketch a system design answer on camera/
// screen-share during a mock interview.
//
// BUG FIX (repeat product report, after FOUR earlier rounds of fixes to
// this exact feature — a touch-stealing empty-state overlay, zero-length-
// path commits, duplicate React keys, locationX/Y drift, an SVG
// intercepting hit-testing — and drawing STILL registered nothing, plus
// "dragging elements inside the whiteboard" never worked at all): every
// one of those earlier fixes was a real, individually-correct fix to RN's
// legacy `PanResponder` API — but this app runs React Native 0.82 on the
// New Architecture (Fabric), where PanResponder's touch-event delivery is
// well documented to be unreliable, especially for a fast-moving gesture
// nested under a native SVG view: event coordinates can arrive stale,
// batched, or simply stop updating mid-stroke. `react-native-gesture-
// handler` (already a project dependency, already properly bootstrapped —
// see App.tsx's GestureHandlerRootView) is the modern, Fabric-native
// replacement Meta itself recommends for exactly this class of surface,
// and unlike PanResponder it reports gesture coordinates already relative
// to the view it's attached to — no more manual canvasOriginRef/.measure()
// bookkeeping needed at all. Rewritten on Gesture.Pan()/GestureDetector
// below. Dragging existing shapes is new: a "Move" tool (see activeTool
// below) that, when active, renders one small draggable overlay per
// stamped shape (DraggableShapeOverlay further down) — freehand strokes
// and shape drags are mutually exclusive per touch, the same standard
// "pen tool vs. select tool" split every real drawing/whiteboard app uses,
// since a touch landing on an existing shape is otherwise ambiguous
// between "start a new stroke here" and "grab this shape."
//
// The empty-canvas placeholder ("Your sketch will appear here") still
// needs pointerEvents="none" so it stays purely decorative — see where it
// renders below.
type ElementType = 'path' | 'rectangle' | 'circle' | 'diamond' | 'database' | 'line' | 'arrow';
interface CanvasElement {
  id: string;
  type: ElementType;
  color: string;
  d?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  cx?: number;
  cy?: number;
  r?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

const CANVAS_HEIGHT = 460;
const STROKE_COLOR = '#181b22';
// Product report: "you need to add more tools too" — a small stroke-color
// palette, applied to whatever's drawn/stamped next (freehand strokes and
// every shape stamp below all read `activeColor` at creation time). Same
// black default as before plus 4 common diagram-annotation colors.
const COLOR_SWATCHES = ['#181b22', '#E53E3E', '#3182CE', '#38A169', '#805AD5'];

// One invisible, draggable hit-target per stamped shape, rendered only
// while the "Move" tool is active (see SystemDesignWhiteboard's activeTool
// state and header comment). Kept as its OWN component — not an inline
// `.map()` closure — specifically so `Gesture.Pan()` is created exactly
// ONCE per shape (via useMemo, in this component's own instance) rather
// than a fresh gesture object every render: React preserves this
// component instance across re-renders via its `key={el.id}` at the call
// site, so the memoized gesture (and the mid-drag gesture state RNGH
// tracks against it) survives every `elements` update a drag itself
// causes, instead of being torn down and rebuilt mid-gesture.
const DraggableShapeOverlay: React.FC<{
  bounds: { left: number; top: number; width: number; height: number };
  onMove: (dx: number, dy: number) => void;
}> = ({ bounds, onMove }) => {
  // Ref so the memoized gesture below always calls the LATEST onMove
  // closure (which closes over the current element id) without needing to
  // recreate the gesture object itself on every render.
  const onMoveRef = React.useRef(onMove);
  onMoveRef.current = onMove;
  // BUG FIX (crash report: "[Worklets] Tried to synchronously call a
  // non-worklet function `dispatchSetState` on the UI thread") — see
  // drawGesture's identical `.runOnJS(true)` fix below for the full
  // explanation. onMoveRef.current(...) here ultimately calls moveElement,
  // which is a plain setElements(...) React state update — exactly the
  // same "non-worklet function called from a UI-thread worklet" violation,
  // just not yet hit by a real device with Reanimated actually enforcing
  // it. `.runOnJS(true)` makes this callback run on the JS thread like
  // every other event handler in this file, where a plain state setter is
  // always safe to call directly.
  const gesture = React.useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onUpdate(e => {
          onMoveRef.current(e.changeX, e.changeY);
        }),
    [],
  );
  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[
          dragOverlayStyle,
          { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
        ]}
      />
    </GestureDetector>
  );
};

const dragOverlayStyle = {
  position: 'absolute' as const,
  // A faint fill (rather than fully invisible) so it's obvious which
  // shapes are grabbable while the Move tool is active — without this, a
  // user has no visual cue that touching an empty-looking rectangle
  // outline actually has a draggable hit area under it.
  backgroundColor: 'rgba(0, 99, 248, 0.08)',
  borderWidth: 1,
  borderColor: 'rgba(0, 99, 248, 0.35)',
  borderStyle: 'dashed' as const,
  borderRadius: 6,
};

const SystemDesignWhiteboard = memo(() => {
  const { goBack, navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<SystemDesignWhiteboardScreenNavigationProp>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);

  // Optional session context (product report: "the system design should
  // also be added as part of the tools too" + session-length timer + AI
  // review — see navigation/types.tsx's own comment on this route). All
  // undefined when reached the old way (the standalone sandbox icon), which
  // is still fully supported — every session-specific block below is
  // gated on `sessionId` being present.
  //
  // endsAt/designPrompt (product report: "the count down timer... should
  // continue counting down until the user finishes... and then the overall
  // feedback of both the two interview should now be generated") — set
  // instead of durationMin when this screen is reached as a mid-interview
  // handoff from LiveInterviewSession.tsx rather than a fresh start: endsAt
  // is an absolute deadline carried over from however much of the original
  // selected duration was left, so the countdown genuinely continues rather
  // than restarting at a full new duration; designPrompt is the AI
  // interviewer's own handoff instruction, shown as a brief so the
  // candidate knows what to sketch instead of landing on a blank canvas.
  const { sessionId, interviewType, durationMin, endsAt, designPrompt } = route.params ?? {};

  // endsAt is an absolute epoch-ms deadline (not "seconds remaining from
  // mount"), so this recomputes from it on every tick below rather than
  // just decrementing a locally-seeded counter — that keeps the countdown
  // accurate even accounting for however long it took this screen to
  // actually mount after LiveInterviewSession's navigate() call fired.
  const computeSecondsLeft = React.useCallback((): number | null => {
    if (endsAt) return Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    if (durationMin) return durationMin * 60;
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, durationMin]);

  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(computeSecondsLeft);
  const hasAutoFinishedRef = React.useRef(false);
  const [isFinishing, setIsFinishing] = React.useState(false);

  const [isReviewModalVisible, setIsReviewModalVisible] = React.useState(false);
  const [designNotes, setDesignNotes] = React.useState('');
  const [isReviewing, setIsReviewing] = React.useState(false);
  const [reviewResult, setReviewResult] = React.useState<{ summary: string; feedback: string[] } | null>(null);

  const [elements, setElements] = React.useState<CanvasElement[]>([]);
  const [activePathD, setActivePathD] = React.useState<string | null>(null);
  const [activeColor, setActiveColor] = React.useState(COLOR_SWATCHES[0]);
  const activeColorRef = React.useRef(activeColor);
  activeColorRef.current = activeColor;
  const activePathRef = React.useRef('');
  const stampCountRef = React.useRef(0);
  // BUG FIX (repeat product report: "the drawing drawn does not stay on the
  // screen it just clears off", after an earlier fix for a DIFFERENT first-
  // touch bug already landed): `id: \`path_${Date.now()}\`` etc. below only
  // has millisecond resolution — two elements created in the same
  // millisecond (a fast double-tap on a shape tool, or two strokes started
  // back-to-back) got duplicate React `key`s, and React's reconciler does
  // not guarantee both render correctly when siblings share a key — one can
  // silently fail to mount/update even though both objects are genuinely
  // present in `elements` state. A monotonic counter guarantees uniqueness
  // regardless of timing.
  const nextElementIdRef = React.useRef(0);
  const nextElementId = (prefix: string) => {
    nextElementIdRef.current += 1;
    return `${prefix}_${nextElementIdRef.current}`;
  };
  const [canvasWidth, setCanvasWidth] = React.useState(0);
  const [canvasHeight, setCanvasHeight] = React.useState(CANVAS_HEIGHT);
  const canvasRef = React.useRef<View>(null);
  // "Draw" (freehand strokes) vs "Move" (drag existing shapes) — see this
  // file's header comment for why these are separate, mutually-exclusive
  // tools rather than one gesture trying to guess intent.
  const [activeTool, setActiveTool] = React.useState<'draw' | 'move'>('draw');

  // Freehand drawing gesture (see header comment: rewritten from
  // PanResponder onto react-native-gesture-handler). `e.x`/`e.y` on a Pan
  // gesture are already relative to the View the GestureDetector below
  // wraps — no manual pageX-minus-canvas-origin math needed at all, unlike
  // PanResponder's raw touch events. `.enabled(activeTool === 'draw')`
  // means a touch on the canvas while the Move tool is active does nothing
  // here at all, leaving it free for DraggableShapeOverlay's own gesture
  // below. Recreated (via useMemo) whenever activeTool flips so
  // GestureDetector always holds the current enabled/disabled gesture —
  // cheap, and gestures aren't meant to be mutated in place after creation.
  // BUG FIX (crash report, screenshot: "[Worklets] Tried to synchronously
  // call a non-worklet function `dispatchSetState` on the UI thread" —
  // pointing straight at this gesture's onBegin/onUpdate, the
  // setActivePathD calls specifically): react-native-gesture-handler's
  // Gesture.Pan() callbacks (onBegin/onUpdate/onEnd/onFinalize) run as
  // REANIMATED WORKLETS on the UI thread by default whenever Reanimated is
  // installed (it is here — see App.tsx's GestureHandlerRootView and this
  // file's own header comment on why RNGH was chosen over PanResponder in
  // the first place). A worklet runs on a separate native thread with its
  // own restricted JS runtime; it can't just call an arbitrary "normal" JS
  // function like a React state setter (setActivePathD) or freely mutate a
  // plain useRef the way this file does throughout (activePathRef.current
  // = ...) — those only exist on the JS thread, and calling into them
  // synchronously from the UI thread is exactly what Worklets' own runtime
  // check caught and threw on here. None of this file's drawing logic
  // (building up an SVG path string in a ref, committing it to state)
  // needs UI-thread-level performance in the first place — it was never
  // written with worklets/runOnJS/shared values in mind at all, just
  // ordinary refs and setState the same as the old PanResponder version.
  // `.runOnJS(true)` is RNGH's documented escape hatch for exactly this:
  // it forces every callback on this gesture to run on the JS thread
  // instead, where plain refs and state setters are always safe to touch
  // directly, without needing to rewrite this file's logic around
  // worklets/runOnJS calls at every single ref/state access.
  const drawGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .enabled(activeTool === 'draw')
        .minDistance(0)
        .onBegin(e => {
          activePathRef.current = `M${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
          setActivePathD(activePathRef.current);
        })
        .onUpdate(e => {
          activePathRef.current += ` L${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
          setActivePathD(activePathRef.current);
        })
        .onEnd(() => {
          // BUG FIX (repeat product report: drawings not staying on
          // screen): onBegin always seeds activePathRef with a lone
          // "M x y" move-to command, even for a stationary tap with no
          // onUpdate ever firing. Only commit when the path actually
          // contains a real "L" (line-to) segment, i.e. the finger
          // genuinely moved — otherwise a plain tap would commit an
          // invisible zero-length Path, which reads to the user as "I drew
          // and it cleared off" (elements.length goes above 0, so the
          // empty-state placeholder disappears with nothing to replace it).
          if (activePathRef.current.includes('L')) {
            setElements(prev => [
              ...prev,
              { id: nextElementId('path'), type: 'path', color: activeColorRef.current, d: activePathRef.current },
            ]);
          }
          activePathRef.current = '';
          setActivePathD(null);
        })
        .onFinalize(() => {
          // Safety net for a gesture that gets CANCELLED rather than
          // cleanly ending (e.g. an OS-level interruption) — onEnd already
          // covers the normal path, this just guarantees activePathD never
          // gets stuck showing a half-finished stroke.
          activePathRef.current = '';
          setActivePathD(null);
        }),
    [activeTool],
  );

  // Bounding box for one stamped shape, in the same canvas-local coordinate
  // space its SVG element renders in — used both to position
  // DraggableShapeOverlay's invisible hit-target and to know how big to
  // make it. Freehand paths ('path') return a zero box and are filtered out
  // of the draggable list below — an arbitrary stroke has no single
  // rectangular "handle" to grab the way a stamped shape does.
  const getShapeBounds = (el: CanvasElement) => {
    if (el.type === 'rectangle' || el.type === 'diamond' || el.type === 'database') {
      return { left: el.x ?? 0, top: el.y ?? 0, width: el.width ?? 0, height: el.height ?? 0 };
    }
    if (el.type === 'circle') {
      const r = el.r ?? 0;
      return { left: (el.cx ?? 0) - r, top: (el.cy ?? 0) - r, width: r * 2, height: r * 2 };
    }
    if (el.type === 'line' || el.type === 'arrow') {
      const x1 = el.x1 ?? 0, y1 = el.y1 ?? 0, x2 = el.x2 ?? 0, y2 = el.y2 ?? 0;
      const pad = 16; // room for the arrowhead + an easier grab target on a thin line
      return {
        left: Math.min(x1, x2) - pad,
        top: Math.min(y1, y2) - pad,
        width: Math.abs(x2 - x1) + pad * 2,
        height: Math.abs(y2 - y1) + pad * 2,
      };
    }
    return { left: 0, top: 0, width: 0, height: 0 };
  };

  // Translates one element's stored coordinates by (dx, dy) — called from
  // DraggableShapeOverlay's onUpdate with each frame's incremental delta
  // (Pan gesture's changeX/changeY, not the cumulative translationX/Y, so
  // this just adds rather than needing to remember a drag-start position).
  const moveElement = (id: string, dx: number, dy: number) => {
    setElements(prev =>
      prev.map(el => {
        if (el.id !== id) return el;
        if (el.type === 'rectangle' || el.type === 'diamond' || el.type === 'database') {
          return { ...el, x: (el.x ?? 0) + dx, y: (el.y ?? 0) + dy };
        }
        if (el.type === 'circle') {
          return { ...el, cx: (el.cx ?? 0) + dx, cy: (el.cy ?? 0) + dy };
        }
        if (el.type === 'line' || el.type === 'arrow') {
          return { ...el, x1: (el.x1 ?? 0) + dx, y1: (el.y1 ?? 0) + dy, x2: (el.x2 ?? 0) + dx, y2: (el.y2 ?? 0) + dy };
        }
        return el;
      }),
    );
  };

  const onStampShape = (type: 'rectangle' | 'circle' | 'diamond' | 'database' | 'line' | 'arrow') => {
    const n = stampCountRef.current;
    stampCountRef.current += 1;
    const offset = (n % 5) * 36;
    const baseX = 40 + offset;
    const baseY = 40 + offset;
    const color = activeColor;
    if (type === 'rectangle') {
      setElements(prev => [
        ...prev,
        { id: nextElementId('rect'), type: 'rectangle', color, x: baseX, y: baseY, width: 120, height: 72 },
      ]);
    } else if (type === 'circle') {
      setElements(prev => [
        ...prev,
        { id: nextElementId('circle'), type: 'circle', color, cx: baseX + 50, cy: baseY + 50, r: 46 },
      ]);
    } else if (type === 'diamond') {
      // Decision-node shape (product report: "add more tools too" — the
      // standard system-design/flowchart vocabulary beyond plain boxes).
      setElements(prev => [
        ...prev,
        { id: nextElementId('diamond'), type: 'diamond', color, x: baseX, y: baseY, width: 110, height: 80 },
      ]);
    } else if (type === 'database') {
      // Cylinder — the conventional "this box is a database" symbol.
      setElements(prev => [
        ...prev,
        { id: nextElementId('db'), type: 'database', color, x: baseX, y: baseY, width: 90, height: 76 },
      ]);
    } else if (type === 'line') {
      // Plain connector — same geometry as arrow but no arrowhead, for a
      // relationship that isn't directional.
      setElements(prev => [
        ...prev,
        { id: nextElementId('line'), type: 'line', color, x1: baseX, y1: baseY + 100, x2: baseX + 140, y2: baseY + 100 },
      ]);
    } else {
      setElements(prev => [
        ...prev,
        { id: nextElementId('arrow'), type: 'arrow', color, x1: baseX, y1: baseY + 100, x2: baseX + 140, y2: baseY + 100 },
      ]);
    }
  };

  const onUndo = () => setElements(prev => prev.slice(0, -1));
  const onClear = () => {
    setElements([]);
    stampCountRef.current = 0;
  };

  // Product report: "the system design hands on practice should also have
  // a AI code review too and result." The whiteboard itself is a purely
  // visual freehand canvas with nothing exportable as text (see
  // codingService.getSystemDesignFeedback's own comment), so this asks the
  // candidate to briefly explain what they sketched — that explanation is
  // what actually gets reviewed, same as talking through a design on a
  // real whiteboard interview.
  const onGetReview = async () => {
    if (isReviewing) return;
    if (!designNotes.trim()) {
      Alert.alert(
        t('find:system_design_notes_required_title', { defaultValue: 'Describe your design first' }),
        t('find:system_design_notes_required_body', {
          defaultValue: 'Briefly explain what you sketched (components, data flow, tradeoffs) so the AI has something to review.',
        }),
      );
      return;
    }
    setIsReviewing(true);
    try {
      const result = await codingService.getSystemDesignFeedback(designNotes);
      setReviewResult(result);
    } catch (e: any) {
      Alert.alert(
        t('find:review_failed', { defaultValue: 'Review failed' }),
        e?.message ?? t('find:review_failed_body', { defaultValue: 'Could not get an AI code review. Please try again.' }),
      );
    } finally {
      setIsReviewing(false);
    }
  };

  const onFinish = async (opts?: { timedOut?: boolean }) => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      if (sessionId) {
        try {
          // BUG FIX (product report: "make sure the system design practice
          // ... give an interview feedback and it must be correct
          // feedbacks"): the backend has nothing else to grade a whiteboard
          // session on (the drawing itself has no exportable text — see
          // codingService.getSystemDesignFeedback's own comment) — passing
          // whatever explanation the candidate already typed into the "Get
          // AI Review" box (designNotes) is the only real signal available,
          // same text that box's own on-demand review already uses. Sent
          // even if empty; the backend leaves feedback blank rather than
          // fabricating an assessment when there's genuinely nothing here.
          await interviewService.completeSession(sessionId, undefined, undefined, { designNotes });
        } catch (e: any) {
          if (!opts?.timedOut) {
            Alert.alert(
              t('find:finish_interview_sync_failed', { defaultValue: 'Could not sync interview' }),
              e?.message ?? t('find:finish_interview_sync_failed_body', { defaultValue: 'Your session ended locally but we could not reach the server to finalize it. Your feedback may be incomplete.' }),
            );
          }
        }
      }
    } finally {
      setIsFinishing(false);
      // See isPracticeSandbox's own comment in navigation/types.tsx — only
      // the pure no-interviewer sandbox (reached with no endsAt, e.g.
      // FindScreen's Tools tile) sets this; a real-interview handoff from
      // LiveInterviewSession always carries an endsAt, so it correctly gets
      // InterviewFeedback's full Q&A layout instead of the simplified one.
      navigate('InterviewFeedback', { sessionId, interviewType, isPracticeSandbox: !endsAt });
    }
  };

  // Countdown tick + time's-up handling — same pattern as
  // CodingInterview.tsx's own timer (see that file's comment); a no-op
  // whenever no durationMin was passed.
  React.useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      if (!hasAutoFinishedRef.current) {
        hasAutoFinishedRef.current = true;
        Alert.alert(
          t('find:coding_time_up_title', { defaultValue: "Time's up" }),
          t('find:coding_time_up_body', {
            defaultValue: 'Your session length has ended. Submitting what you have and moving to feedback.',
          }),
          [{ text: t('common:ok', { defaultValue: 'OK' }), onPress: () => onFinish({ timedOut: true }) }],
        );
      }
      return;
    }
    const id = setTimeout(() => {
      setSecondsLeft(prev => {
        if (prev === null) return null;
        // See computeSecondsLeft's own comment — when we have a real
        // endsAt deadline, recompute from it (self-correcting) rather than
        // just decrementing, so this can never drift from the interview's
        // actual remaining time.
        return endsAt ? computeSecondsLeft() : prev - 1;
      });
    }, 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const timerLabel = React.useMemo(() => {
    if (secondsLeft === null) return null;
    const clamped = Math.max(0, secondsLeft);
    const mm = Math.floor(clamped / 60).toString().padStart(2, '0');
    const ss = (clamped % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }, [secondsLeft]);

  const renderArrow = (el: CanvasElement) => {
    const { x1 = 0, y1 = 0, x2 = 0, y2 = 0, color } = el;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 14;
    const p1x = x2 - headLength * Math.cos(angle - Math.PI / 6);
    const p1y = y2 - headLength * Math.sin(angle - Math.PI / 6);
    const p2x = x2 - headLength * Math.cos(angle + Math.PI / 6);
    const p2y = y2 - headLength * Math.sin(angle + Math.PI / 6);
    return (
      <React.Fragment key={el.id}>
        <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={3} />
        <Polygon points={`${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`} fill={color} />
      </React.Fragment>
    );
  };

  const renderDiamond = (el: CanvasElement) => {
    const { x = 0, y = 0, width = 0, height = 0, color } = el;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const points = `${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}`;
    return <Polygon key={el.id} points={points} stroke={color} strokeWidth={2.5} fill="none" />;
  };

  // Cylinder ("database") — a rect body with an ellipse cap top and bottom,
  // the standard flowchart/system-design symbol for a data store.
  const renderDatabase = (el: CanvasElement) => {
    const { x = 0, y = 0, width = 0, height = 0, color } = el;
    const rx = width / 2;
    const ry = Math.min(12, height / 4);
    const cx = x + rx;
    return (
      <React.Fragment key={el.id}>
        <Path
          d={`M${x} ${y + ry} L${x} ${y + height - ry} A${rx} ${ry} 0 0 0 ${x + width} ${y + height - ry} L${x + width} ${y + ry}`}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
        />
        <Ellipse cx={cx} cy={y + ry} rx={rx} ry={ry} stroke={color} strokeWidth={2.5} fill="none" />
      </React.Fragment>
    );
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:system_design_whiteboard', {defaultValue: 'System Design Whiteboard'})}
        accessoryLeft={<NavigationAction onPress={goBack} />}
        accessoryRight={
          timerLabel
            ? () => (
                <View style={[styles.timerPill, secondsLeft !== null && secondsLeft <= 60 ? styles.timerPillUrgent : null]}>
                  <Icon pack="eva" name="clock-outline" style={[globalStyle.icon16, { tintColor: secondsLeft !== null && secondsLeft <= 60 ? '#FF6B6B' : theme['text-basic-color'] }]} />
                  <Text category="h9" bold ml={6} style={secondsLeft !== null && secondsLeft <= 60 ? { color: '#FF6B6B' } : undefined}>
                    {timerLabel}
                  </Text>
                </View>
              )
            : undefined
        }
      />
      {/* Design-brief banner (product report: "the AI interviewer can ask
          the user to create some design in the whiteboard as part of the
          interview questions... the app should automatically navigate the
          user to the system design whiteboard") — only present on a
          mid-interview handoff from LiveInterviewSession.tsx (see
          designPrompt's own comment above); the standalone sandbox entry
          points (FindScreen's Tools tile, the old manual jump-to-whiteboard
          icon) never set this, so this banner simply doesn't render there. */}
      {designPrompt ? (
        <View style={styles.designBrief}>
          <Icon pack="eva" name="message-square-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
          <Text category="h9-s" ml={8} style={[globalStyle.flexOne, { color: theme['text-basic-color'] }]}>
            {designPrompt}
          </Text>
        </View>
      ) : null}
      {/* Horizontally scrollable (product report: "add more tools too" —
          7 shape/action tools no longer fit a fixed space-around row
          without squeezing every label). */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbar}>
        {/* Draw / Move — see activeTool's own comment. Two mutually
            exclusive tools (segmented-control style, same active/inactive
            visual language as the color swatches below) rather than a
            single ambiguous gesture. */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.toolBtn, activeTool === 'draw' && styles.toolBtnActive]}
          onPress={() => setActiveTool('draw')}>
          <Icon pack="eva" name="edit-2-outline" style={[globalStyle.icon20, { tintColor: activeTool === 'draw' ? theme['color-primary-500'] : STROKE_COLOR }]} />
          <Text category="h10" mt={4} style={activeTool === 'draw' ? { color: theme['color-primary-500'] } : undefined}>
            {t('find:whiteboard_draw', { defaultValue: 'Draw' })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.toolBtn, activeTool === 'move' && styles.toolBtnActive]}
          onPress={() => setActiveTool('move')}
          disabled={elements.filter(el => el.type !== 'path').length === 0}>
          <Icon
            pack="eva"
            name="swap-outline"
            style={[
              globalStyle.icon20,
              { tintColor: activeTool === 'move' ? theme['color-primary-500'] : elements.some(el => el.type !== 'path') ? STROKE_COLOR : theme['text-hint-color'] },
            ]}
          />
          <Text
            category="h10"
            mt={4}
            style={
              activeTool === 'move'
                ? { color: theme['color-primary-500'] }
                : !elements.some(el => el.type !== 'path')
                ? { color: theme['text-hint-color'] }
                : undefined
            }>
            {t('find:whiteboard_move', { defaultValue: 'Move' })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={() => onStampShape('rectangle')}>
          <View style={[styles.rectSwatch, { borderColor: activeColor }]} />
          <Text category="h10" mt={4}>{t('find:whiteboard_rectangle', {defaultValue: 'Rectangle'})}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={() => onStampShape('circle')}>
          <View style={[styles.circleSwatch, { borderColor: activeColor }]} />
          <Text category="h10" mt={4}>{t('find:whiteboard_circle', {defaultValue: 'Circle'})}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={() => onStampShape('diamond')}>
          <View style={[styles.diamondSwatch, { borderColor: activeColor }]} />
          <Text category="h10" mt={4}>{t('find:whiteboard_diamond', {defaultValue: 'Diamond'})}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={() => onStampShape('database')}>
          <Icon pack="eva" name="layers-outline" style={[globalStyle.icon20, { tintColor: activeColor }]} />
          <Text category="h10" mt={4}>{t('find:whiteboard_database', {defaultValue: 'Database'})}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={() => onStampShape('line')}>
          {/* BUG FIX (crash report, screenshot: "Icon: 'minus-outline' icon
              is not registered in pack 'eva'") — same class of bug as the
              earlier "tools-outline" crash on the maintenance gate icon:
              'minus-outline' isn't a real Eva Icons name, so this threw a
              hard render error every time the whiteboard mounted. Drawn as
              a plain View instead, matching the rectangle/circle/diamond
              swatches right above it, rather than guessing at another Eva
              icon name that might not exist either. */}
          <View style={[styles.lineSwatch, { backgroundColor: activeColor }]} />
          <Text category="h10" mt={4}>{t('find:whiteboard_line', {defaultValue: 'Line'})}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={() => onStampShape('arrow')}>
          <Icon pack="assets" name="arrowRight" style={[globalStyle.icon20, { tintColor: activeColor }]} />
          <Text category="h10" mt={4}>{t('find:whiteboard_arrow', {defaultValue: 'Arrow'})}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={onUndo} disabled={elements.length === 0}>
          <Icon pack="eva" name="corner-up-left-outline" style={[globalStyle.icon20, { tintColor: elements.length ? STROKE_COLOR : theme['text-hint-color'] }]} />
          <Text category="h10" mt={4}>{t('find:whiteboard_undo', {defaultValue: 'Undo'})}</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={onClear} disabled={elements.length === 0}>
          <Icon pack="eva" name="trash-2-outline" style={[globalStyle.icon20, { tintColor: elements.length ? theme['color-danger-500'] : theme['text-hint-color'] }]} />
          <Text category="h10" mt={4} status={elements.length ? 'danger' : 'placeholder'}>{t('find:whiteboard_clear', {defaultValue: 'Clear'})}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Color palette — applies to whatever's drawn/stamped next. */}
      <Flex justify="center" itemsCenter mb={4}>
        {COLOR_SWATCHES.map(c => (
          <TouchableOpacity
            key={c}
            activeOpacity={0.7}
            onPress={() => setActiveColor(c)}
            style={[
              styles.colorSwatch,
              { backgroundColor: c },
              c === activeColor && styles.colorSwatchActive,
            ]}
          />
        ))}
      </Flex>

      <Text category="h9-s" status="placeholder" center mt={4} mb={12}>
        {activeTool === 'move'
          ? t('find:whiteboard_hint_move', { defaultValue: 'Drag a dashed shape to reposition it. Tap Draw to sketch again.' })
          : t('find:whiteboard_hint', { defaultValue: 'Draw freehand with your finger, tap a shape above to drop it onto the canvas, or switch to Move to drag shapes around.' })}
      </Text>

      <GestureDetector gesture={drawGesture}>
        <View
          ref={canvasRef}
          style={styles.canvas}
          onLayout={e => {
            setCanvasWidth(e.nativeEvent.layout.width);
            setCanvasHeight(e.nativeEvent.layout.height || CANVAS_HEIGHT);
          }}>
          {/* SVG hit-testing: react-native-svg's <Svg> renders its own
              native view under the finger and can participate in touch
              hit-testing on its own — pointerEvents="none" keeps it purely
              decorative so every touch passes straight to the
              GestureDetector above (in Draw mode) or to a
              DraggableShapeOverlay below (in Move mode), never to the SVG
              itself. */}
          <Svg pointerEvents="none" width={canvasWidth || '100%'} height={canvasHeight}>
            {elements.map(el => {
              if (el.type === 'path') {
                return <Path key={el.id} d={el.d} stroke={el.color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
              }
              if (el.type === 'rectangle') {
                return <Rect key={el.id} x={el.x} y={el.y} width={el.width} height={el.height} rx={8} stroke={el.color} strokeWidth={2.5} fill="none" />;
              }
              if (el.type === 'circle') {
                return <Circle key={el.id} cx={el.cx} cy={el.cy} r={el.r} stroke={el.color} strokeWidth={2.5} fill="none" />;
              }
              if (el.type === 'diamond') {
                return renderDiamond(el);
              }
              if (el.type === 'database') {
                return renderDatabase(el);
              }
              if (el.type === 'line') {
                const { x1 = 0, y1 = 0, x2 = 0, y2 = 0, color } = el;
                return <Line key={el.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={3} />;
              }
              return renderArrow(el);
            })}
            {activePathD ? <Path d={activePathD} stroke={activeColor} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
          </Svg>
          {/* Draggable hit-targets — only exist in Move mode (see
              activeTool), and only for shapes that HAVE a rectangular
              bounding box to grab (freehand 'path' elements are excluded —
              see getShapeBounds). Rendered as plain siblings of the Svg
              above, NOT inside it, so they can be pointerEvents-interactive
              (the Svg itself stays pointerEvents="none" always). */}
          {activeTool === 'move'
            ? elements
                .filter(el => el.type !== 'path')
                .map(el => (
                  <DraggableShapeOverlay
                    key={el.id}
                    bounds={getShapeBounds(el)}
                    onMove={(dx, dy) => moveElement(el.id, dx, dy)}
                  />
                ))
            : null}
          {elements.length === 0 && !activePathD ? (
            // pointerEvents="none" — this overlay (a Flex, which always
            // renders a TouchableOpacity — see components/Flex.tsx) would
            // otherwise sit directly on top of the canvas and could swallow
            // the very first touch meant for drawGesture above.
            <Flex vertical center pointerEvents="none" style={globalStyle.absoluteBg}>
              <Text category="h9-s" status="placeholder">{t('find:whiteboard_empty', {defaultValue: 'Your sketch will appear here'})}</Text>
            </Flex>
          ) : null}
        </View>
      </GestureDetector>

      {/* Product report: "the system design hands on practice should also
          have a AI code review too and result" — always available (not
          just within a scored session), since this is a genuinely useful
          practice-time tool on its own. "Finish" only shows up when this
          screen was actually reached as part of a real interview session
          (sessionId present) — the standalone sandbox entry point has no
          session to finish or feedback to show. */}
      <View style={styles.footerBar}>
        <Button
          children={t('find:get_ai_code_review', { defaultValue: 'Get AI Review' })}
          status="info"
          size="small"
          onPress={() => setIsReviewModalVisible(true)}
          accessoryLeft={props => <Icon {...props} pack="assets" name="quote" />}
          style={globalStyle.flexOne}
        />
        {sessionId ? (
          <Button
            children={isFinishing ? t('find:finishing', { defaultValue: 'Finishing…' }) : t('find:finish_interview', { defaultValue: 'Finish Interview' })}
            disabled={isFinishing}
            status="success"
            size="small"
            onPress={() => onFinish()}
            style={[globalStyle.flexOne, { marginLeft: 10 }]}
          />
        ) : null}
      </View>

      <Modal
        visible={isReviewModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsReviewModalVisible(false)}>
        {/* BUG FIX (product report: "the keypad is covering the 'Get AI
            code Review' Input field") — this bottom sheet had no keyboard
            awareness at all, same class of bug already fixed once on
            components/DailyCheckInSheet.tsx (see that file's own comment):
            the moment the multiline Input actually gets focus, the on-
            screen keyboard covers the bottom of the screen — including the
            Input itself and the "Get AI Review" submit button below it —
            with nothing to push the sheet up out from under it.
            KeyboardAvoidingView's 'padding' (iOS) / 'height' (Android)
            behavior shrinks this view's available height by the keyboard's
            height, so the bottom-anchored sheet rises to clear it instead
            of sitting underneath. */}
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalSheet, { backgroundColor: theme['background-basic-color-1'] }]}>
            <Flex justify="space-between" itemsCenter mb={16}>
              <Text category="h7" bold style={globalStyle.flexOne}>
                {t('find:get_ai_code_review', { defaultValue: 'Get AI Review' })}
              </Text>
              <TouchableOpacity
                onPress={() => setIsReviewModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, { tintColor: theme['text-basic-color'] }]} />
              </TouchableOpacity>
            </Flex>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text category="h9-s" status="placeholder" mb={12}>
                {t('find:system_design_notes_label', {
                  defaultValue: 'Briefly explain what you sketched — the components, how data flows between them, and any tradeoffs you made. The AI reviews this explanation, the way an interviewer listens to you talk through a design.',
                })}
              </Text>
              <Input
                multiline
                textStyle={{ minHeight: 90, textAlignVertical: 'top' }}
                style={globalStyle.inputField}
                value={designNotes}
                onChangeText={setDesignNotes}
                placeholder={t('find:system_design_notes_placeholder', { defaultValue: 'e.g. A load balancer routes requests to stateless API servers, which read/write to a sharded database with a cache in front for hot reads…' }).toString()}
              />
              <Button
                children={isReviewing ? t('find:reviewing_code', { defaultValue: 'Reviewing…' }) : t('find:get_ai_code_review', { defaultValue: 'Get AI Review' })}
                disabled={isReviewing}
                status="info"
                onPress={onGetReview}
                style={{ marginTop: 12 }}
              />
              {reviewResult ? (
                <Layout level="2" style={styles.reviewBox}>
                  <Text category="h9" bold status="link" mb={8}>
                    {reviewResult.summary}
                  </Text>
                  {reviewResult.feedback.map((line, i) => (
                    <Flex key={i} justify="flex-start" itemsCenter mt={i === 0 ? 0 : 8}>
                      <Icon pack="assets" name="quote" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                      <Text category="h9-s" ml={10} style={globalStyle.flexOne}>{line}</Text>
                    </Flex>
                  ))}
                </Layout>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Container>
  );
});

export default SystemDesignWhiteboard;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // Design-brief banner — see designPrompt's own comment above.
  designBrief: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 99, 248, 0.08)',
  },
  toolBtn: {
    alignItems: 'center',
    minWidth: 56,
    marginRight: 18,
  },
  // Draw/Move segmented-control active state (see the JSX comment at those
  // two buttons) — a light tinted pill behind the icon+label, same
  // "currently selected tool" affordance as colorSwatchActive below uses
  // for the color palette.
  toolBtnActive: {
    backgroundColor: 'rgba(0, 99, 248, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
  },
  rectSwatch: {
    width: 22,
    height: 16,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: STROKE_COLOR,
  },
  circleSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: STROKE_COLOR,
  },
  diamondSwatch: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderColor: STROKE_COLOR,
    transform: [{ rotate: '45deg' }],
  },
  lineSwatch: {
    width: 22,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: STROKE_COLOR,
    transform: [{ rotate: '-20deg' }],
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginHorizontal: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: STROKE_COLOR,
  },
  canvas: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'background-basic-color-3',
    overflow: 'hidden',
  },
  footerBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: 'background-basic-color-2',
  },
  timerPillUrgent: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  reviewBox: {
    ...globalStyle.card,
    marginTop: 16,
    padding: 16,
  },
});
