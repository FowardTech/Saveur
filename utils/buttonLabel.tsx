import React from 'react';
import {Text, StyleProp, TextStyle} from 'react-native';

// ---------------------------------------------------------------------------
// UI Kitten's <Button> only forwards color/fontFamily/fontSize/fontWeight/
// marginHorizontal down to its internal Text (see
// node_modules/@ui-kitten/components/ui/button/button.component.js's
// getComponentStyle) — nothing in that chain ever sets textAlign. A plain
// string passed as `children` therefore renders left-aligned inside a Text
// box that isn't guaranteed to be exactly as wide as the string itself (e.g.
// any Button that ends up stretched to fill its parent's width — either via
// an explicit `width: '100%'` or simply by sitting, with no width/alignSelf
// of its own, inside a plain View/ScrollView, whose default
// `alignItems: 'stretch'` stretches it automatically). The result looks like
// "the text isn't centered, there's a gap on the right" on any button with a
// long-ish label.
//
// Fix: render `children` as a function (Eva's own documented pattern for
// this exact kind of customization — see the Button doc comment's
// "ButtonStyling" example) and explicitly center + stretch the Text box.
// This is correct regardless of whether the Button ends up stretched or not.
//
// Usage: <Button>{renderCenteredLabel('Save changes')}</Button>
//
// `stretch` defaults to true (the original behavior above) for a plain
// icon-less button. Pass `stretch: false` for a button that ALSO has an
// accessoryLeft/accessoryRight icon — forcing the text to width: '100%'
// there asks Yoga for 100% of the button's width while the icon(s) also
// need room in that same row, which overflows/overlaps rather than
// centering anything. Without a forced width, the text just takes its own
// intrinsic size and centers itself within that (via textAlign), leaving
// the Button container's own `justifyContent: 'center'` (see
// button.component.js) to center the icon(s) + text as one evenly-spaced
// group instead.
// ---------------------------------------------------------------------------
export const renderCenteredLabel =
  (label: string, options?: {stretch?: boolean}) =>
  (props: {style?: StyleProp<TextStyle>}) => (
    <Text
      style={[
        props.style,
        {textAlign: 'center'},
        options?.stretch === false ? null : {width: '100%'},
      ]}>
      {label}
    </Text>
  );
