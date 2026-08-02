import React from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {StyleService, useStyleSheet} from '@ui-kitten/components';

import Text from 'components/Text';

import {useTranslation} from 'react-i18next';
import {Swipeable} from 'react-native-gesture-handler';

interface SwiperCardProps {
  id: number | string;
  onEdit?(): void;
  onDelete?(): void;
  widthAction?: number;
  containerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  // Override the default "Edit"/"Delete" swipe-action labels — e.g.
  // src/more/PaymentMethod.tsx reuses the edit slot for "Default" (setting a
  // saved card as the default) since you don't "edit" a saved card's
  // number, just its default/removed status.
  editLabel?: string;
  deleteLabel?: string;
  // BUG FIX ("payment method card has an extra card extension behind it —
  // looks like an extra card behind the outer card"): the Swipeable's
  // renderRightActions panel (the red Delete / yellow Default action
  // blocks below) is laid out as a real sibling row alongside `children`,
  // translated off-screen until the user swipes — nothing was ever
  // clipping it to the card's own rounded shape, so those solid-colored
  // action blocks peeked out from behind the rounded corners at rest,
  // reading as a second card sitting behind the real one. Can't just add
  // `overflow: 'hidden'` to the outer TouchableOpacity (`containerStyle`
  // below) — that's also the view casting this card's shadow, and
  // `overflow: 'hidden'` clips a view's own shadow on iOS too (same
  // shadow-vs-clip conflict already documented throughout this app's
  // other "two-layer split" cards). This prop lets the clip-only inner
  // wrapper match whatever radius the caller's `containerStyle` already
  // uses, so the clip and the shadow's rounding line up.
  borderRadius?: number;
}

const SwiperCard = ({
  id,
  containerStyle,
  onEdit,
  onDelete,
  widthAction,
  children,
  editLabel,
  deleteLabel,
  borderRadius = 12,
}: SwiperCardProps) => {
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['payment', 'common']);
  const AnimatedView = Animated.createAnimatedComponent(View);
  const refSwipeable = React.useRef<Swipeable>(null);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation,
    dragX: Animated.AnimatedInterpolation,
  ) => {
    const scaleDelete = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    const scaleEdit = dragX.interpolate({
      inputRange: [-110, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    return (
      <>
        <TouchableOpacity
          style={[{width: widthAction}]}
          activeOpacity={0.54}
          onPress={onDelete}>
          <AnimatedView
            style={[{transform: [{scale: scaleDelete}]}, styles.deleteAction]}>
            <Text category="h6" status={'primary'}>
              {deleteLabel ?? t('common:delete')}
            </Text>
          </AnimatedView>
        </TouchableOpacity>
        <TouchableOpacity
          style={[{width: widthAction}]}
          onPress={onEdit}
          activeOpacity={0.54}>
          <AnimatedView
            style={[{transform: [{scale: scaleEdit}]}, styles.editAction]}>
            <Text category="h6" status={'primary'}>
              {editLabel ?? t('common:edit')}
            </Text>
          </AnimatedView>
        </TouchableOpacity>
      </>
    );
  };
  const [isOpen, setIsOpen] = React.useState(false);
  const _open = () => {
    refSwipeable.current?.openRight();
    setIsOpen(true);
    console.log('open');
  };
  const _close = () => {
    refSwipeable.current?.close;
    setIsOpen(false);
    console.log('close');
  };

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={isOpen ? _close : _open}
      activeOpacity={0.54}>
      {/* Clip-only layer, separate from the shadow-casting TouchableOpacity
          above — see this component's `borderRadius` prop comment. */}
      <View style={{borderRadius, overflow: 'hidden'}}>
        <Swipeable
          id={`${id}`}
          ref={refSwipeable}
          friction={2}
          enableTrackpadTwoFingerGesture
          rightThreshold={50}
          renderRightActions={renderRightActions}>
          {children}
        </Swipeable>
      </View>
    </TouchableOpacity>
  );
};

export default SwiperCard;

const themedStyles = StyleService.create({
  deleteAction: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: 'text-danger-color',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAction: {
    backgroundColor: 'text-warning-color',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
