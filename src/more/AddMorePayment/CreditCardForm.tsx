import React, {useRef, useState, useEffect} from 'react';
import {Keyboard, Platform, ScrollView, StyleSheet, View} from 'react-native';
import {useFormContext} from 'react-hook-form';
import cardValidator from 'card-validator';
import FormTextField from './FormTextField';

import CardIcon from './CardIcon';
import Conditional from './Conditional';
import FormCard from './FormCard';
import {Button, Input} from '@ui-kitten/components';
import {CardFields, LibraryProps} from 'constants/Types';
import CreditCardContext from '../../../CreditCardContext';
import {cardNumberFormatter, expirationDateFormatter} from 'utils/formatters';
import useLayout from 'hooks/useLayout';
import useKeyboard from 'hooks/useKeyboard';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const CreditCardForm: React.FC<LibraryProps> = props => {
  const {
    horizontalStart = true,
    translations: parentTranslations,
    overrides,
    requiresName = true,
  } = props;
  const {trigger, watch} = useFormContext();
  const cardNumber = watch('cardNumber');
  const {card} = cardValidator.number(cardNumber);
  const isAmex = card?.type === 'american-express';
  const cvvLength = isAmex ? 4 : 3;

  const [isHorizontal, setIsHorizontal] = useState(
    horizontalStart && Platform.OS === 'ios',
  );

  const {width, height} = useLayout();
  // input has 36*2 padding
  const inputWidth = width - 48;

  const scrollRef = useRef<ScrollView>(null);
  const holderNameRef = useRef<Input>(null);
  const cardNumberRef = useRef<Input>(null);
  const expirationRef = useRef<Input>(null);
  const cvvRef = useRef<Input>(null);

  const [focusedField, setFocusedField] = useState<CardFields | null>(null);

  useEffect(() => {
    if (cardNumberRef?.current) {
      cardNumberRef.current.focus();
    }
  }, [cardNumberRef]);

  const textFieldStyle = isHorizontal
    ? [
        styles.textField,
        {
          width: inputWidth,
        },
      ]
    : styles.regularField;

  async function goNext() {
    if (focusedField === null) return;

    const field = ['cardNumber', 'holderName', 'expiration', 'cvv'][
      focusedField
    ];

    if (isHorizontal) {
      const result = await trigger(field);
      if (!result) return;
      scrollRef.current?.scrollTo({x: (focusedField + 1) * inputWidth});
    }

    if (focusedField === CardFields.CardNumber && !requiresName) {
      expirationRef?.current?.focus();
      return;
    }

    if (focusedField === CardFields.CVV) {
      setFocusedField(null);
      setIsHorizontal(false);
      Keyboard.dismiss();
      return;
    }

    const ref = [cardNumberRef, holderNameRef, expirationRef, cvvRef][
      focusedField + 1
    ];
    ref.current?.focus();
  }

  const {keyboardShow} = useKeyboard();

  const shareValue = useSharedValue(0);
  React.useEffect(() => {
    keyboardShow ? (shareValue.value = 1) : (shareValue.value = 0);
  }, [keyboardShow]);

  const BottomStyle = useAnimatedStyle(() => {
    const slideBottom = interpolate(
      shareValue.value,
      [0, 1],
      [height / 1.2, height / 2.2],
    );
    return {
      height: withSpring(slideBottom, {stiffness: 100, damping: 24}),
    };
  }, [shareValue]);
  const {bottom} = useLayout();
  return (
    <CreditCardContext.Provider
      value={{
        ...props,
        overrides: overrides || {},
        requiresName,
      }}>
      <Animated.View style={BottomStyle}>
        <View style={[styles.container]}>
          <Conditional condition={!props.formOnly}>
            <FormCard cardType={card?.type} focusedField={focusedField} />
          </Conditional>
          <ScrollView
            ref={scrollRef}
            style={isHorizontal && {maxHeight: 120}}
            pagingEnabled={isHorizontal}
            horizontal={isHorizontal}
            scrollEnabled={!isHorizontal}
            keyboardShouldPersistTaps="handled">
            <FormTextField
              style={textFieldStyle}
              ref={cardNumberRef}
              name="cardNumber"
              label={'Card Number'}
              keyboardType="number-pad"
              autoComplete="cc-number"
              maxLength={19}
              validationLength={isAmex ? 18 : 19}
              rules={{
                required: 'Card number is required.',
                validate: {
                  isValid: (value: string) => {
                    return (
                      cardValidator.number(value).isValid ||
                      'This card number looks invalid.'
                    );
                  },
                },
              }}
              formatter={cardNumberFormatter}
              endEnhancer={<CardIcon cardNumber={cardNumber} />}
              onFocus={() => setFocusedField(CardFields.CardNumber)}
              onValid={goNext}
            />
            {requiresName && (
              <FormTextField
                style={textFieldStyle}
                ref={holderNameRef}
                name="holderName"
                autoComplete="name"
                label={'Cardholder Name'}
                rules={{
                  required: 'Cardholder name is required.',
                  validate: {
                    isValid: (value: string) => {
                      return (
                        cardValidator.cardholderName(value).isValid ||
                        'This expiration date looks invalid.'
                      );
                    },
                  },
                }}
                autoCorrect={false}
                onSubmitEditing={goNext}
                onFocus={() => setFocusedField(CardFields.CardHolderName)}
              />
            )}
            <View style={styles.row}>
              <FormTextField
                style={[
                  textFieldStyle,
                  {
                    marginRight: isHorizontal ? 0 : 24,
                  },
                ]}
                ref={expirationRef}
                name="expiration"
                label={'EXP DATE'}
                keyboardType="number-pad"
                autoComplete="cc-exp"
                maxLength={5}
                validationLength={5}
                rules={{
                  required: 'Expiration date is required.',
                  validate: {
                    isValid: (value: string) => {
                      return (
                        cardValidator.expirationDate(value).isValid ||
                        'This expiration date looks invalid.'
                      );
                    },
                  },
                }}
                formatter={expirationDateFormatter}
                onFocus={() => setFocusedField(CardFields.Expiration)}
                onValid={goNext}
              />
              <FormTextField
                style={textFieldStyle}
                ref={cvvRef}
                name="cvv"
                label={'CVV'}
                keyboardType="number-pad"
                autoComplete="cc-csc"
                maxLength={cvvLength}
                validationLength={cvvLength}
                rules={{
                  required: 'Security code is required.',
                  validate: {
                    isValid: (value: string) => {
                      return (
                        cardValidator.cvv(value, cvvLength).isValid ||
                        'This security date looks invalid.'
                      );
                    },
                  },
                }}
                onFocus={() => setFocusedField(CardFields.CVV)}
                onValid={goNext}
              />
            </View>
          </ScrollView>
        </View>
        <Conditional condition={isHorizontal}>
          <Button
            style={[
              {
                width: width - 48,
                position: 'absolute',
                bottom: bottom + 8,
              },
              overrides?.button,
            ]}
            children={focusedField === CardFields.CVV ? 'Save' : 'Next'}
            onPress={goNext}
          />
        </Conditional>
      </Animated.View>
    </CreditCardContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    marginBottom: 36,
  },
  textField: {
    marginTop: 24,
    height: 100,
  },
  regularField: {
    flex: 1,
    marginTop: 24,
  },
});

export default CreditCardForm;
