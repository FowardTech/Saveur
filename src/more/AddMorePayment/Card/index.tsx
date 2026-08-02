import {CardFields, FormModel} from 'constants/Types';
import CreditCardContext from '../../../../CreditCardContext';
import React, {useContext, useEffect, useRef} from 'react';
import {Image, StyleSheet} from 'react-native';
import {globalStyle} from 'styles/globalStyle';
import FlipCard from './FlipCard';

import BackSide from './BackSide';
import FrontSide from './FrontSide';

type Props = {
  focusedField: CardFields | null;
  cardType?: string;
  model: FormModel;
};

function usePrevious(value: any) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

const background = require('assets/images/img_credit_card.png');

const Card: React.FC<Props> = ({model, cardType, focusedField}) => {
  const {backgroundImage} = useContext(CreditCardContext);
  const previousFocused = usePrevious(focusedField);
  const cardRef = useRef<FlipCard>();

  useEffect(() => {
    const switchToBack =
      focusedField === CardFields.CVV && previousFocused !== CardFields.CVV;
    const switchToFront =
      focusedField !== CardFields.CVV && previousFocused === CardFields.CVV;

    if (switchToBack || switchToFront) {
      cardRef.current?.flip();
    }
  }, [focusedField, previousFocused]);

  return (
    <>
      {/* @ts-ignore */}
      <FlipCard style={styles.container} ref={cardRef}>
        <>
          {backgroundImage || (
            <Image style={styles.background} source={background} />
          )}
          <FrontSide
            model={model}
            cardType={cardType}
            focusedField={focusedField}
          />
        </>
        <>
          {backgroundImage || (
            <Image style={styles.background} source={background} />
          )}
          <BackSide model={model} cardType={cardType} />
        </>
      </FlipCard>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    ...globalStyle.card,
    // `card` carries a real elevation on Android (see globalStyle.ts's own
    // note on this), which needs an opaque backgroundColor on this exact
    // View to compute a proper rounded shadow — otherwise Android draws a
    // flat gray block behind the card instead of a soft shadow (same bug
    // class already fixed in ButtonFill.tsx/MockInterviewSetup.tsx/
    // PaymentMethod.tsx). This View's own fill is never actually seen
    // (FrontSide/BackSide's <Image style={styles.background} .../> covers
    // it edge-to-edge with the same borderRadius), so the exact color just
    // needs to be opaque and close to img_credit_card.png's dominant blue
    // for the brief moment before/around that image.
    backgroundColor: '#0B63D6',
    width: '100%',
    height: 200,
    paddingVertical: 24,
    borderRadius: 12,
  },
  background: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
});

export default Card;
