import React, { memo } from 'react';
import { Alert, KeyboardAvoidingView, Modal, PanResponder, Platform, ScrollView, TouchableOpacity, View } from 'react-native';
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
// (already a project dependency) + PanResponder rather than pulling in a
// new whiteboard/drawing native library, per this project's history of
// native-dependency version pain (Reanimated/react-native-screens/
// vision-camera all needed careful pinning — see CLAUDE history). Not a
// full diagramming tool: freehand strokes + tap-to-place shape stamps
// (rectangle/circle/diamond/database/cloud-free "line"/arrow — the
// standard boxes-and-arrows system-design vocabulary) is enough to sketch
// a system design answer on camera/screen-share during a mock interview.
//
// BUG FIX (product report: "when user try to draw it just cleans off") —
// the empty-canvas placeholder ("Your sketch will appear here") used to
// render as a Flex (see components/Flex.tsx — Flex's root is ALWAYS a
// TouchableOpacity, even with no onPress) absolutely positioned directly
// ON TOP of the canvas, exactly while elements.length === 0 — i.e. exactly
// the moment a user's very first touch lands. That overlay's own Touchable
// could claim the touch responder before it ever reached this file's
// PanResponder underneath, so the very first stroke attempt silently did
// nothing (no path recorded, canvas stayed on the empty placeholder — read
// by the reporter as the canvas "cleaning off"). Fixed with
// pointerEvents="none" on that overlay below, so it's purely decorative
// and never competes for the touch responder.
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
  const { sessionId, interviewType, durationMin } = route.params ?? {};

  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(
    durationMin ? durationMin * 60 : null,
  );
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
  // BUG FIX (repeat product report, after two earlier rounds already
  // landed for different failure modes — touch-stealing overlay, then
  // zero-length-path/duplicate-id commits — and the drawing STILL didn't
  // appear at all): `locationX`/`locationY` on RN's touch events are a
  // long-documented Android reliability problem — they're computed by the
  // native layer relative to whichever view the OS decides is the current
  // touch target, and can silently report stale/wrong coordinates (or
  // coordinates relative to the wrong ancestor) once a gesture has been in
  // progress for more than an instant, especially on Android and especially
  // inside a nested touch-responder tree like this screen's. The
  // symptom this produces is exactly what got reported: onPanResponderGrant
  // still fires (so the first point of a stroke can register), but
  // onPanResponderMove's locationX/Y readings drift or freeze, so the path
  // string built from them draws nothing coherent (or nothing at all once
  // the earlier fix started requiring a real line segment before
  // committing). `pageX`/`pageY` (screen-absolute, always reliable) minus
  // the canvas's own on-screen origin (captured once via a real native
  // `.measure()` call, not derived from touch events at all) is the
  // standard, well-established fix for RN PanResponder drawing surfaces —
  // used by essentially every RN signature-pad/whiteboard library for
  // exactly this reason.
  const canvasOriginRef = React.useRef({ x: 0, y: 0 });
  const pointFromEvent = (evt: any) => {
    const { pageX, pageY } = evt.nativeEvent;
    return {
      x: pageX - canvasOriginRef.current.x,
      y: pageY - canvasOriginRef.current.y,
    };
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // BUG FIX hardening: without these, an ancestor could still steal the
      // responder mid-stroke (e.g. a future ScrollView wrap, or Android's
      // native swipe-back gesture treating a horizontal-ish stroke as a
      // back gesture) and drop the in-progress path entirely. A drawing
      // surface should never voluntarily give up the responder once a
      // stroke has started.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: evt => {
        const { x, y } = pointFromEvent(evt);
        activePathRef.current = `M${x.toFixed(1)} ${y.toFixed(1)}`;
        setActivePathD(activePathRef.current);
      },
      onPanResponderMove: evt => {
        const { x, y } = pointFromEvent(evt);
        activePathRef.current += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
        setActivePathD(activePathRef.current);
      },
      onPanResponderRelease: () => {
        // BUG FIX (repeat product report: drawings not staying on screen):
        // onPanResponderGrant always seeds activePathRef with a lone "M x y"
        // move-to command, even for a stationary tap with no
        // onPanResponderMove ever firing. The old `if (activePathRef.current)`
        // guard is truthy for that lone "M..." string too, so a plain tap
        // committed a ZERO-LENGTH, invisible Path into `elements` — nothing
        // draws, but elements.length becomes >0 so the "Your sketch will
        // appear here" placeholder disappears with nothing replacing it.
        // To the user this reads exactly as "I drew, and it cleared off."
        // Only commit when the path actually contains a real "L" (line-to)
        // segment, i.e. the finger genuinely moved.
        if (activePathRef.current.includes('L')) {
          setElements(prev => [
            ...prev,
            { id: nextElementId('path'), type: 'path', color: activeColorRef.current, d: activePathRef.current },
          ]);
        }
        activePathRef.current = '';
        setActivePathD(null);
      },
    }),
  ).current;

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
      navigate('InterviewFeedback', { sessionId, interviewType });
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
    const id = setTimeout(() => setSecondsLeft(s => (s === null ? null : s - 1)), 1000);
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
      {/* Horizontally scrollable (product report: "add more tools too" —
          7 shape/action tools no longer fit a fixed space-around row
          without squeezing every label). */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbar}>
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
        {t('find:whiteboard_hint', {defaultValue: 'Draw freehand with your finger, or tap a shape above to drop it onto the canvas.'})}
      </Text>

      <View
        ref={canvasRef}
        style={styles.canvas}
        onLayout={e => {
          setCanvasWidth(e.nativeEvent.layout.width);
          setCanvasHeight(e.nativeEvent.layout.height || CANVAS_HEIGHT);
          // Real native measurement of this view's on-screen position —
          // see canvasOriginRef's own comment above for why this replaces
          // locationX/locationY entirely rather than just supplementing it.
          // measure() must run after layout, which onLayout guarantees.
          canvasRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
            canvasOriginRef.current = { x: pageX, y: pageY };
          });
        }}
        {...panResponder.panHandlers}>
        {/* BUG FIX (repeat product report, after three earlier rounds already
            landed for other failure modes on this exact feature — the
            touch-stealing empty-state overlay, zero-length-path commits,
            locationX/Y drift — and drawing STILL registered nothing):
            react-native-svg's <Svg> renders its own native view UNDER the
            finger, and on Android in particular it can participate in touch
            hit-testing/responder negotiation on its own rather than staying
            purely decorative — several other RN whiteboard/signature-pad
            implementations hit this exact same "PanResponder never fires
            because the SVG underneath is intercepting first" issue.
            `pointerEvents="none"` makes this element (and everything drawn
            inside it) completely touch-transparent, guaranteeing every touch
            passes straight through to the parent View's PanResponder below,
            which is the only thing that should ever be deciding what a
            stroke does. */}
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
        {elements.length === 0 && !activePathD ? (
          // BUG FIX: pointerEvents="none" — see this file's top-of-component
          // comment. Without this, this overlay (a Flex, which always
          // renders a TouchableOpacity — see components/Flex.tsx) sat
          // directly on top of the canvas and could swallow the very first
          // touch meant for the PanResponder below.
          <Flex vertical center pointerEvents="none" style={globalStyle.absoluteBg}>
            <Text category="h9-s" status="placeholder">{t('find:whiteboard_empty', {defaultValue: 'Your sketch will appear here'})}</Text>
          </Flex>
        ) : null}
      </View>

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
  toolBtn: {
    alignItems: 'center',
    minWidth: 56,
    marginRight: 18,
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
