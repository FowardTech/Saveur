import React, { memo } from 'react';
import { PanResponder, ScrollView, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Rect } from 'react-native-svg';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
} from '@ui-kitten/components';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';

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
  const { goBack } = useNavigation();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find']);

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
        const { locationX, locationY } = evt.nativeEvent;
        activePathRef.current = `M${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setActivePathD(activePathRef.current);
      },
      onPanResponderMove: evt => {
        const { locationX, locationY } = evt.nativeEvent;
        activePathRef.current += ` L${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
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
        style={styles.canvas}
        onLayout={e => setCanvasWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}>
        <Svg width={canvasWidth || '100%'} height={CANVAS_HEIGHT}>
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
    marginBottom: 24,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'background-basic-color-3',
    overflow: 'hidden',
  },
});
