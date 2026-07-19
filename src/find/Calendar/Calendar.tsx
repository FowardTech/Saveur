import React, { memo } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import {
  useTheme,
  StyleService,
  useStyleSheet,
  Layout,
} from '@ui-kitten/components';
import useLayout from 'hooks/useLayout';

import ProfileCalendar from '../Component/ProfileCalendar';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AvailableItem from './AvailableItem';
import { globalStyle } from 'styles/globalStyle';

const Calendar = memo(() => {
  const { height, width, top, bottom } = useLayout();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);

  const [maxHeight, setMaxHeight] = React.useState(0);
  const heightAnimated = useSharedValue(0);
  const startY = useSharedValue(0);
  const firstGetHeight = React.useRef(false);

  React.useEffect(() => {
    if (maxHeight > 0 && !firstGetHeight.current) {
      firstGetHeight.current = true;
      heightAnimated.value = withTiming((maxHeight - 48) / 3, {
        duration: 300,
        easing: Easing.linear,
      });
    }
  }, [maxHeight]);

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      startY.value = heightAnimated.value;
    })
    .onUpdate(event => {
      'worklet';
      const transYValue = (maxHeight - 48) / 3.5;
      const newValue = startY.value + event.translationY;

      if (newValue < transYValue) {
        heightAnimated.value = transYValue;
      } else if (newValue >= transYValue && newValue < maxHeight - 48) {
        heightAnimated.value = newValue;
      } else if (newValue >= maxHeight - 48) {
        heightAnimated.value = maxHeight - 48;
      }
    })
    .onEnd(event => {
      'worklet';
      if (event.velocityY >= 0) {
        heightAnimated.value = withTiming(maxHeight - 48, {
          duration: 200,
          easing: Easing.linear,
        });
      } else {
        heightAnimated.value = withTiming((maxHeight - 48) / 3, {
          duration: 200,
          easing: Easing.linear,
        });
      }
    });

  const animationStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: theme['background-basic-color-2'],
      transform: [
        {
          translateY: heightAnimated.value,
        },
      ],
    };
  });
  return (
    <View style={styles.container}>
      {/* Calendar */}
      <View
        style={{
          position: 'absolute',
        }}
        onLayout={event => {
          const { height } = event.nativeEvent.layout;
          if (height && maxHeight === 0) {
            setMaxHeight(height - (top + 48));
          }
        }}
      >
        <ProfileCalendar />
      </View>

      <Animated.View style={animationStyle}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.content]}>
            <View style={styles.animatedView}>
              <TouchableOpacity
                style={StyleSheet.absoluteFillObject}
                activeOpacity={0.54}
              >
                <View style={styles.buttonSwipe} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </GestureDetector>
        <View style={styles.shadowCalendar}>
          <Layout
            level={'2'}
            style={{ height: 10, ...globalStyle.shadowFade }}
          />
        </View>
        {/* Event content */}
        <Layout level={'2'}>
          {DATA_AVAILABLE.map((item, i) => {
            return (
              <AvailableItem
                data={item.data}
                startTime={item.startTime}
                endTime={item.endTime}
                key={i}
              />
            );
          })}
        </Layout>
      </Animated.View>
    </View>
  );
});

export default Calendar;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  buttonSwipe: {
    width: 36,
    height: 3,
    borderRadius: 2,
    position: 'absolute',
    backgroundColor: 'background-basic-color-4',
    bottom: 16,
    alignSelf: 'center',
  },
  animatedView: {
    ...StyleSheet.absoluteFillObject,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    zIndex: 10,
  },
  content: {
    zIndex: 10,
    height: 36,
    backgroundColor: 'background-basic-color-2',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  shadowCalendar: {
    height: 32,
  },
});
const DATA_AVAILABLE = [
  {
    startTime: new Date('2021-11-05'),
    endTime: new Date('2021-11-11'),
    data: [
      {
        id: '1',
        availableTime: {
          morning: true,
          afternoon: true,
        },
        date: new Date(1649135103000),
      },
    ],
  },
  {
    startTime: new Date('2021-11-12'),
    endTime: new Date('2021-11-18'),
    data: [
      {
        id: '1',
        availableTime: {
          morning: true,
          afternoon: true,
        },
        date: new Date('2021-11-12'),
      },
      {
        id: '2',
        availableTime: {
          morning: true,
          afternoon: false,
        },
        date: new Date('2021-11-13'),
      },
    ],
  },
  {
    startTime: new Date('2021-11-19'),
    endTime: new Date('2021-11-25'),
    data: [
      {
        id: '1',
        availableTime: {
          morning: true,
          afternoon: true,
        },
        date: new Date('2021-11-19'),
      },
      {
        id: '2',
        availableTime: {
          morning: true,
          afternoon: false,
        },
        date: new Date('2021-11-20'),
      },
    ],
  },
];
