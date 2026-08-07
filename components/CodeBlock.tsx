import React, {memo} from 'react';
import {Platform, ScrollView, View} from 'react-native';
import Text from './Text';

interface Props {
  code: string;
  language?: string;
  style?: any;
  /** Minimum height for the scrollable code area — used by CodingInterview.tsx
   * to reserve the same editor size the old plain Input had. */
  minHeight?: number;
}

// Cross-platform monospace — no custom monospace font is bundled in this
// app (assets/fonts/ only has the PlusJakartaSans family, see Text.tsx),
// but both OSes ship a real fixed-width system font under these names, so
// no new font asset/native rebuild is needed.
const MONO_FONT = Platform.select({ios: 'Courier New', android: 'monospace', default: 'monospace'});
const DOT_COLORS = ['#FF5F56', '#FFBD2E', '#27C93F'];

// "Real code editor" chrome (product report: lesson code snippets AND the
// Code Practice editor "should look like a real code editor design") — a
// dark, macOS-terminal-style window: 3 traffic-light dots + a language
// label in the header, monospace body text, horizontally scrollable so
// long lines don't force-wrap mid-token (the standard code-editor
// behavior, unlike prose).
//
// Deliberately NOT full tokenized syntax highlighting — no highlighting
// library exists in this app yet (confirmed nothing like Prism/CodeMirror/
// react-native-syntax-highlighter is installed), and a naive regex-based
// highlighter across a dozen possible languages risks mis-coloring code
// worse than not coloring it at all. The dark-window + monospace-font
// treatment is what actually reads as "a real editor" at a glance —
// token-level coloring is a reasonable follow-up if wanted, but is its own
// separate, higher-risk piece of work.
const CodeBlock = memo(({code, language, style, minHeight}: Props) => {
  return (
    <View style={[{backgroundColor: '#1E1E2E', borderRadius: 12, overflow: 'hidden'}, style]}>
      <View style={headerStyle}>
        <View style={{flexDirection: 'row'}}>
          {DOT_COLORS.map((c, i) => (
            <View key={c} style={[dotStyle, i > 0 && {marginLeft: 6}, {backgroundColor: c}]} />
          ))}
        </View>
        {language ? (
          <Text category="h10" style={{color: '#8B8BA7', marginLeft: 12, fontFamily: MONO_FONT}}>
            {language}
          </Text>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text
          selectable
          style={{
            color: '#E4E4F0',
            fontFamily: MONO_FONT,
            fontSize: 13,
            lineHeight: 20,
            padding: 14,
            minHeight,
          }}>
          {code}
        </Text>
      </ScrollView>
    </View>
  );
});

const headerStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  paddingHorizontal: 12,
  paddingVertical: 8,
  backgroundColor: '#26263B',
  borderBottomWidth: 1,
  borderBottomColor: '#33334A',
};
const dotStyle = {width: 10, height: 10, borderRadius: 5};

export default CodeBlock;
