import React, {memo} from 'react';
import {StyleProp, TextStyle} from 'react-native';
import {Text, TextProps} from '@ui-kitten/components';
import {EvaStatus} from '@ui-kitten/components/devsupport';

export interface MyTextProps extends TextProps {
  style?: StyleProp<TextStyle>;
  category?:
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'h6-s'
    | 'h7'
    | 'h7-s'
    | 'h8'
    | 'h8-s'
    | 'h9'
    | 'h9-s'
    | 'h10'
    | 'h10-s'
    | 'para-s'
    | 'para-m';
  status?: EvaStatus | 'primary';
  children?: any;
  ml?: number;
  mr?: number;
  mt?: number;
  mb?: number;
  mv?: number;
  mh?: number;
  opacity?: number;
  maxWidth?: number;
  fontSize?: number;
  lineHeight?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  capitalize?: boolean;
  none?: boolean;
  left?: boolean;
  right?: boolean;
  center?: boolean;
  underline?: boolean;
  bold?: boolean;
  // Mid-weight option (PlusJakartaSans-Medium, already bundled — see the
  // fontFamily switch below) for text that should read a touch heavier
  // than Regular without going all the way to Bold. Added for the Menu
  // list rows (see ButtonOptional.tsx/MoreSrc.tsx): product asked for the
  // label color to go back to full-strength text-basic-color (no more
  // opacity softening) but for the weight itself to come down a notch —
  // Bold read too heavy once the color was full-strength again, and plain
  // Regular read too light for a settings-row label, so Medium is the
  // actual middle ground. Ignored if `bold` is also passed (bold wins).
  medium?: boolean;
  italic?: boolean;
}
const getLineHeight = (
  category:
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'h6-s'
    | 'h7'
    | 'h7-s'
    | 'h8'
    | 'h8-s'
    | 'h9'
    | 'h9-s'
    | 'h10'
    | 'h10-s'
    | 'para-s'
    | 'para-m',
): number => {
  // Bumped alongside the font-size increases in constants/theme/mapping.json
  // (roughly +2px each) so line spacing keeps the same proportion to the
  // now-larger text instead of feeling cramped.
  switch (category) {
    case 'h1':
      return 54;
    case 'h2':
      return 42;
    case 'h3':
      return 36;
    case 'h4':
      return 38;
    case 'h5':
      return 30;
    case 'h6':
      return 30;
    case 'h6-s':
      return 30;
    case 'h7':
      return 28;
    case 'h7-s':
      return 30;
    case 'h8':
      return 24;
    case 'h8-s':
      return 22;
    case 'h9':
      return 20;
    case 'h9-s':
      return 20;
    case 'para-s':
      return 27;
    case 'para-m':
      return 29;
    default:
      return 26;
  }
};
export default memo(
  ({
    ml,
    mr,
    mb,
    mh,
    mt,
    mv,
    opacity,
    uppercase,
    lowercase,
    capitalize,
    none,
    left,
    lineHeight,
    fontSize,
    right,
    center,
    underline,
    bold,
    medium,
    italic,
    category = 'para-m',
    status = 'basic',
    children,
    maxWidth,
    style,
    ...rest
  }: MyTextProps) => {
    let textAlign: 'left' | 'center' | 'right' | 'auto' | 'justify' | 'left';

    left
      ? (textAlign = 'left')
      : right
      ? (textAlign = 'right')
      : center
      ? (textAlign = 'center')
      : (textAlign = 'left');

    let textTransform: 'uppercase' | 'lowercase' | 'capitalize' | 'none';

    uppercase
      ? (textTransform = 'uppercase')
      : lowercase
      ? (textTransform = 'lowercase')
      : capitalize
      ? (textTransform = 'capitalize')
      : none
      ? (textTransform = 'none')
      : (textTransform = 'none');

    let textDecorationLine:
      | 'none'
      | 'underline'
      | 'line-through'
      | 'underline line-through';
    underline
      ? (textDecorationLine = 'underline')
      : (textDecorationLine = 'none');

    let fontStyle: 'normal' | 'italic';
    italic ? (fontStyle = 'italic') : (fontStyle = 'normal');

    return (
      <Text
        category={category}
        status={status}
        style={[
          {
            marginLeft: ml,
            marginRight: mr,
            marginTop: mt,
            marginBottom: mb,
            marginVertical: mv,
            marginHorizontal: mh,
            opacity: opacity,
            textAlign: textAlign,
            maxWidth: maxWidth,
            // BUG FIX (product report: "the count digits are truncated
            // inside the rounded count container" after the app-wide
            // font-size increase): `fontSize` was declared on MyTextProps
            // but never actually applied to the style — it fell into
            // `...rest` and was spread as a bare, non-style prop onto the
            // underlying <Text>, which RN silently ignores. So every call
            // site passing an explicit `fontSize` override (e.g. the small
            // fixed-size notification/count badges across the app, which
            // pass fontSize={11} specifically to stay compact) was always
            // rendering at the full category size instead, while their
            // paired `lineHeight` override DID apply (that prop was always
            // wired correctly below). Before the font-size bump this went
            // unnoticed because category sizes happened to be close enough
            // to the intended override not to visibly clip; once category
            // sizes grew, the (still-ignored) fontSize override no longer
            // matched the shrunk `lineHeight` those badges pass alongside
            // it, so the now-larger glyphs no longer fit the smaller forced
            // line height — the actual clipping mechanism. Wiring fontSize
            // through here restores every existing explicit override
            // app-wide to what it always should have done, with no changes
            // needed at any individual badge/call site.
            fontSize: fontSize,
            lineHeight: lineHeight || getLineHeight(category),
            textTransform: textTransform,
            textDecorationLine: textDecorationLine,
            fontStyle: fontStyle,
            // Was `fontWeight: bold ? 'bold' : '400'` alone — relying on the
            // OS to synthesize a bold variant of whatever the current
            // fontFamily is. That works fine for a *system* font, but once
            // this app has its own bundled fontFamily (see below), asking
            // for `fontWeight: 'bold'` on a custom font is unreliable,
            // especially on Android, which generally won't fake-bold a
            // custom typeface the way it does the system font. Referencing
            // the actual bold TTF by name is the standard, reliable
            // cross-platform fix — see assets/fonts/PlusJakartaSans-*.ttf
            // (SIL Open Font License, via Google Fonts) and
            // react-native.config.js's asset link. Was Roboto before this;
            // switched at the user's request to more closely match a
            // reference (Google Sans-style) look, since Google Sans itself
            // is proprietary and not available for bundling.
            //
            // BUG FIX (custom fonts silently not rendering on Android): this
            // used to ALSO set `fontWeight: bold ? 'bold' : '400'` alongside
            // the family name above. Android's ReactFontManager resolves a
            // requested (family, style) pair by looking for an asset file
            // named "<family><suffix>.ttf" where suffix is "" for normal and
            // "_bold" for a bold style bit — it does NOT look at the family
            // name to know it already denotes a specific weight. So asking
            // for family "PlusJakartaSans-Bold" at style BOLD made it search
            // for a nonexistent "PlusJakartaSans-Bold_bold.ttf", fail, and
            // silently fall back to the system font — exactly the
            // "font style not taking effect on Android" symptom, and only on
            // Android since iOS resolves the family string directly by its
            // real PostScript name regardless of the weight flag. Always
            // passing fontWeight 'normal' keeps the style bit at its default
            // (no suffix) so the exact filename is found on both platforms —
            // the actual bold *look* still comes from loading the real
            // PlusJakartaSans-Bold.ttf file by name, not from the weight
            // flag.
            fontFamily: bold
              ? 'PlusJakartaSans-Bold'
              : medium
              ? 'PlusJakartaSans-Medium'
              : 'PlusJakartaSans-Regular',
            fontWeight: 'normal',
          },
          style,
        ]}
        {...rest}>
        {children}
      </Text>
    );
  },
);
