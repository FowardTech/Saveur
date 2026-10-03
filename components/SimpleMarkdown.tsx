import React, {memo} from 'react';
import {View} from 'react-native';
import Text from 'components/Text';

// Minimal markdown renderer (headings, bullets, **bold**) so AI-written
// briefs don't show raw "###" and "**" characters.
const inline = (line: string, baseBold = false) => {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? (
      <Text key={i} category="h9-s" bold>
        {p.slice(2, -2)}
      </Text>
    ) : (
      <Text key={i} category="h9-s" bold={baseBold}>
        {p}
      </Text>
    ),
  );
};

const SimpleMarkdown = memo(({text}: {text: string}) => {
  const lines = (text || '').split('\n');
  return (
    <View>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={{height: 8}} />;
        const h = line.match(/^#{1,6}\s+(.*)$/);
        if (h) {
          return (
            <Text key={i} category="h8" bold mt={6} mb={2}>
              {h[1].replace(/\*\*/g, '')}
            </Text>
          );
        }
        const b = line.match(/^\s*[*-]\s+(.*)$/);
        if (b) {
          return (
            <View key={i} style={{flexDirection: 'row', marginTop: 2}}>
              <Text category="h9-s" style={{marginRight: 8}}>
                •
              </Text>
              <Text category="h9-s" style={{flex: 1}}>
                {inline(b[1])}
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} category="h9-s" style={{marginTop: 2}}>
            {inline(line)}
          </Text>
        );
      })}
    </View>
  );
});

export default SimpleMarkdown;
