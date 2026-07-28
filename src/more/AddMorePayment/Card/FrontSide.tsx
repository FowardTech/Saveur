import React, {useRef, useState, useEffect, useContext} from 'react';
import {
  Animated,
  LayoutRectangle,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import CardIcon from '../CardIcon';
import PlaceholderText from './PlaceholderText';
import Text from '../Text';
import {CardFields, FormModel} from 'constants/Types';
import CreditCardContext from '../../../../CreditCardContext';

type Props = {
  model: FormModel;
  cardType?: string;
  focusedField: CardFields | null;
};

const FrontSide: React.FC<Props> = ({model, cardType, focusedField}) => {
  const {t} = useTranslation(['payment']);
  const {overrides, requiresName} = useContext(CreditCardContext);
  const [numberLayout, setNumberLayout] = useState<LayoutRectangle | null>(
    null,
  );
  const [nameLayout, setNameLayout] = useState<LayoutRectangle | null>(null);
  const [expirationLayout, setExpirationLayout] =
    useState<LayoutRectangle | null>(null);
  const {width: windowWidth} = useWindowDimensions();

  const positionAnim = useRef(new Animated.ValueXY()).current;

  const sizeAnim = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    function animate(layout: LayoutRectangle) {
      Animated.spring(positionAnim, {
        toValue: {
          x: layout.x - 4,
          y: layout.y + 8,
        },
        useNativeDriver: false,
      }).start();
      Animated.spring(sizeAnim, {
        toValue: {
          x: layout.width + 16,
          y: layout.height + 8,
        },
        useNativeDriver: false,
      }).start();
    }

    if (focusedField === null) {
      return;
    }

    const layout = [numberLayout, nameLayout, expirationLayout][focusedField];
    if (layout) {
      animate(layout);
    }
  }, [
    focusedField,
    numberLayout,
    nameLayout,
    expirationLayout,
    sizeAnim,
    positionAnim,
  ]);
  return (
    <>
      <View style={styles.header}>
        <View style={{flex: 1}}>
          <Text style={[styles.cardHolder, styles.textPlaceholder]}>
            {t('payment:card_holder', {defaultValue: 'Card holder'}).toUpperCase()}
          </Text>
          {requiresName && (
            <Text
              style={[styles.nameText, overrides.cardHolderPreview]}
              numberOfLines={1}
              onLayout={({nativeEvent}) => setNameLayout(nativeEvent.layout)}>
              {model.holderName.toUpperCase() || t('payment:name_surname', {defaultValue: 'Name surname'})}
            </Text>
          )}
        </View>
        <View style={styles.cardLogo}>
          <CardIcon cardNumber={model.cardNumber} />
        </View>
      </View>
      <PlaceholderText
        style={[
          styles.numberText,
          {
            fontSize: windowWidth < 390 ? 28 : 12,
          },
          overrides.cardPreview,
        ]}
        value={model.cardNumber}
        placeholder={
          cardType === 'american-express'
            ? '•••• ••••• •••••'
            : '•••• •••• •••• ••••'
        }
        onLayout={({nativeEvent}) => setNumberLayout(nativeEvent.layout)}
      />
      <View style={styles.labelContainer}>
        <Text style={[styles.textPlaceholder, overrides.labelText]}>
          {t('payment:exp_date', {defaultValue: 'EXP DATE'}).toUpperCase()}
        </Text>
      </View>
      <PlaceholderText
        style={[styles.expirationText, overrides.expirationPreview]}
        stylePlaceholder={styles.placeholderExp}
        value={model.expiration}
        placeholder="MM/YY"
        onLayout={({nativeEvent}) => setExpirationLayout(nativeEvent.layout)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginHorizontal: 24,
  },
  cardLogo: {
    marginRight: -24,
  },
  cardHolder: {
    marginTop: 12,
  },
  textPlaceholder: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 10,
    lineHeight: 9.57,
    color: '#FFFFFF',
    opacity: 0.6,
  },
  numberText: {
    position: 'absolute',
    top: 88,
    left: 24,
    color: '#FFFFFF',
    letterSpacing: 2,
    lineHeight: 33,
    fontFamily: 'DinCondensed-Bold',
  },
  topText: {
    position: 'absolute',
    top: 46,
    fontSize: 18,
    letterSpacing: 2,
    color: '#FFFFFF',
    alignSelf: 'flex-start',
    fontFamily: 'DinCondensed-Bold',
  },
  nameText: {
    position: 'absolute',
    left: 0,
    top: 36,
    color: '#FFF',
    width: '100%',
    fontFamily: 'DinCondensed-Bold',
    fontSize: 18,
  },
  expirationText: {
    right: 24,
    color: '#FFF',
    bottom: 16,
    left: 24,
    fontFamily: 'DinCondensed-Bold',
    fontSize: 18,
  },
  placeholderExp: {
    right: 24,
    color: '#FFF',
    bottom: 16,
    left: 24,
    fontFamily: 'DinCondensed-Bold',
    fontSize: 18,
  },
  labelContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  labelText: {
    fontSize: 18,
    color: '#FFF',
    letterSpacing: 2,
    lineHeight: 21,
    fontFamily: 'DinCondensed-Bold',
  },
  outline: {
    position: 'absolute',
    height: 38,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#f4d01a',
    borderRadius: 14,
  },
});

export default FrontSide;
