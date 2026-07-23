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
      <Swipeable
        id={`${id}`}
        ref={refSwipeable}
        friction={2}
        enableTrackpadTwoFingerGesture
        rightThreshold={50}
        renderRightActions={renderRightActions}>
        {children}
      </Swipeable>
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
