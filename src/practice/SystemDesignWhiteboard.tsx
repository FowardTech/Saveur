import React, { memo } from 'react';
import { PanResponder, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Rect } from 'react-native-svg';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
} from '@ui-kitten/components';
import { useNavigation } from '@react-navigation/native';

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
// full diagramming tool: freehand strokes + a few tap-to-place shape
// stamps (rectangle/circle/arrow) is enough to sketch boxes-and-arrows
// system design answers on camera/screen-share during a mock interview.
type ElementType = 'path' | 'rectangle' | 'circle' | 'arrow';
interface CanvasElement {
  id: string;
  type: ElementType;
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

const SystemDesignWhiteboard = memo(() => {
  const { goBack } = useNavigation();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);

  const [elements, setElements] = React.useState<CanvasElement[]>([]);
  const [activePathD, setActivePathD] = React.useState<string | null>(null);
  const activePathRef = React.useRef('');
  const stampCountRef = React.useRef(0);
  const [canvasWidth, setCanvasWidth] = React.useState(0);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
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
        if (activePathRef.current) {
          setElements(prev => [...prev, { id: `path_${Date.now()}`, type: 'path', d: activePathRef.current }]);
        }
        activePathRef.current = '';
        setActivePathD(null);
      },
    }),
  ).current;

  const onStampShape = (type: 'rectangle' | 'circle' | 'arrow') => {
    const n = stampCountRef.current;
    stampCountRef.current += 1;
    const offset = (n % 5) * 36;
    const baseX = 40 + offset;
    const baseY = 40 + offset;
    if (type === 'rectangle') {
      setElements(prev => [
        ...prev,
        { id: `rect_${Date.now()}`, type: 'rectangle', x: baseX, y: baseY, width: 120, height: 72 },
      ]);
    } else if (type === 'circle') {
      setElements(prev => [
        ...prev,
        { id: `circle_${Date.now()}`, type: 'circle', cx: baseX + 50, cy: baseY + 50, r: 46 },
      ]);
    } else {
      setElements(prev => [
        ...prev,
        { id: `arrow_${Date.now()}`, type: 'arrow', x1: baseX, y1: baseY + 100, x2: baseX + 140, y2: baseY + 100 },
      ]);
    }
  };

  const onUndo = () => setElements(prev => prev.slice(0, -1));
  const onClear = () => {
    setElements([]);
    stampCountRef.current = 0;
  };

  const renderArrow = (el: CanvasElement) => {
    const { x1 = 0, y1 = 0, x2 = 0, y2 = 0 } = el;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLength = 14;
    const p1x = x2 - headLength * Math.cos(angle - Math.PI / 6);
    const p1y = y2 - headLength * Math.sin(angle - Math.PI / 6);
    const p2x = x2 - headLength * Math.cos(angle + Math.PI / 6);
    const p2y = y2 - headLength * Math.sin(angle + Math.PI / 6);
    return (
      <React.Fragment key={el.id}>
        <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={STROKE_COLOR} strokeWidth={3} />
        <Polygon points={`${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`} fill={STROKE_COLOR} />
      </React.Fragment>
    );
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title="System Design Whiteboard"
        accessoryLeft={<NavigationAction onPress={goBack} />}
      />
      <View style={styles.toolbar}>
        <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={() => onStampShape('rectangle')}>
          <View style={styles.rectSwatch} />
          <Text category="h10" mt={4}>Rectangle</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={() => onStampShape('circle')}>
          <View style={styles.circleSwatch} />
          <Text category="h10" mt={4}>Circle</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={() => onStampShape('arrow')}>
          <Icon pack="assets" name="arrowRight" style={[globalStyle.icon20, { tintColor: STROKE_COLOR }]} />
          <Text category="h10" mt={4}>Arrow</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={onUndo} disabled={elements.length === 0}>
          <Icon pack="eva" name="corner-up-left-outline" style={[globalStyle.icon20, { tintColor: elements.length ? STROKE_COLOR : theme['text-hint-color'] }]} />
          <Text category="h10" mt={4}>Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={styles.toolBtn} onPress={onClear} disabled={elements.length === 0}>
          <Icon pack="eva" name="trash-2-outline" style={[globalStyle.icon20, { tintColor: elements.length ? theme['color-danger-500'] : theme['text-hint-color'] }]} />
          <Text category="h10" mt={4} status={elements.length ? 'danger' : 'placeholder'}>Clear</Text>
        </TouchableOpacity>
      </View>

      <Text category="h9-s" status="placeholder" center mt={4} mb={12}>
        Draw freehand with your finger, or tap a shape above to drop it onto the canvas.
      </Text>

      <View
        style={styles.canvas}
        onLayout={e => setCanvasWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}>
        <Svg width={canvasWidth || '100%'} height={CANVAS_HEIGHT}>
          {elements.map(el => {
            if (el.type === 'path') {
              return <Path key={el.id} d={el.d} stroke={STROKE_COLOR} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
            }
            if (el.type === 'rectangle') {
              return <Rect key={el.id} x={el.x} y={el.y} width={el.width} height={el.height} rx={8} stroke={STROKE_COLOR} strokeWidth={2.5} fill="none" />;
            }
            if (el.type === 'circle') {
              return <Circle key={el.id} cx={el.cx} cy={el.cy} r={el.r} stroke={STROKE_COLOR} strokeWidth={2.5} fill="none" />;
            }
            return renderArrow(el);
          })}
          {activePathD ? <Path d={activePathD} stroke={STROKE_COLOR} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
        </Svg>
        {elements.length === 0 && !activePathD ? (
          <Flex vertical center style={globalStyle.absoluteBg}>
            <Text category="h9-s" status="placeholder">Your sketch will appear here</Text>
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
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toolBtn: {
    alignItems: 'center',
    minWidth: 56,
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
  canvas: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'background-basic-color-3',
    overflow: 'hidden',
  },
});
