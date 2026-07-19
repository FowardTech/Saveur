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
  italic?: boolean;
}
const getLineHeight = (
  category:
    | 'h1'
    | 'h2'
    | 'h3'
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
  switch (category) {
    case 'h1':
      return 48;
    case 'h2':
      return 36;
    case 'h3':
      return 30;
    case 'h5':
      return 24;
    case 'h6':
      return 24;
    case 'h7':
      return 22;
    case 'h7-s':
      return 24;
    case 'h8':
      return 18;
    case 'h8-s':
      return 16;
    case 'h9':
      return 14;
    case 'h9-s':
      return 14;
    case 'para-s':
      return 22;
    case 'para-m':
      return 24;
    default:
      return 24;
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
    right,
    center,
    underline,
    bold,
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
            lineHeight: lineHeight || getLineHeight(category),
            textTransform: textTransform,
            textDecorationLine: textDecorationLine,
            fontStyle: fontStyle,
            fontWeight: bold ? 'bold' : '400',
          },
          style,
        ]}
        {...rest}>
        {children}
      </Text>
    );
  },
);
