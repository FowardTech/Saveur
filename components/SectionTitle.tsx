import React from 'react';
import {StyleProp, StyleSheet, TextStyle} from 'react-native';

import Text from 'components/Text';

// App Store "Today"-style section heading: big, bold, sentence case. Use this
// for every screen section title so headings look the same across the app.
interface SectionTitleProps {
  children: React.ReactNode;
  mt?: number;
  mb?: number;
  ml?: number;
  style?: StyleProp<TextStyle>;
}

const SectionTitle: React.FC<SectionTitleProps> = ({children, mt = 8, mb = 14, ml, style}) => (
  <Text category="h5" bold mt={mt} mb={mb} ml={ml} style={[styles.title, style]}>
    {children}
  </Text>
);

export default SectionTitle;

const styles = StyleSheet.create({
  title: {fontSize: 24, lineHeight: 30, letterSpacing: -0.3},
});
