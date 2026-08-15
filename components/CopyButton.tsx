import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import { Icon, useTheme } from '@ui-kitten/components';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTranslation } from 'react-i18next';

import Text from './Text';

// Reusable "Copy" affordance (product request: "Some content in the app
// need to have the copy button to copy a result or analysis... the
// LinkedIn optimizer has no copy button so that users can copy the
// corrected results the AI gave. So add that and also in other places
// too that needs it"). A single shared component so every AI-output
// screen gets identical behavior/feedback instead of each screen
// re-inventing its own copy interaction.
//
// Feedback is inline (icon + label swap to a checkmark/"Copied" for 1.5s)
// rather than an Alert — this app already reserves Alert for things that
// need the user's attention/decision (errors, confirmations); a copy
// action is low-stakes and frequent enough that an intrusive modal would
// be annoying, especially when copying several bullets in a row.
interface CopyButtonProps {
  /** Text actually placed on the clipboard. If empty/whitespace-only, the
   * button still renders (so layout doesn't jump) but taps do nothing. */
  text: string | null | undefined;
  /** Visible label next to the icon, e.g. "Copy". Omit for an icon-only
   * button (e.g. a compact per-bullet copy affordance). Typed as
   * ReactNode (not `string`) so a raw `t(...)` call can be passed
   * directly — i18next's DefaultTFuncReturn type isn't assignable to
   * plain `string`, the same pre-existing mismatch already present at
   * dozens of other call sites app-wide (t() results are normally only
   * ever handed straight to Text's `any`-typed children, not to a
   * `string`-typed prop). */
  label?: React.ReactNode;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const CopyButton = memo(({ text, label, size = 16, style }: CopyButtonProps) => {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const onPress = useCallback(() => {
    if (!text || !text.trim()) return;
    Clipboard.setString(text);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }, [text]);

  const color = copied ? theme['color-success-500'] : theme['color-primary-500'];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[{ flexDirection: 'row', alignItems: 'center' }, style]}
    >
      <Icon
        pack="eva"
        name={copied ? 'checkmark-outline' : 'copy-outline'}
        style={{ width: size, height: size, tintColor: color }}
      />
      {label !== undefined ? (
        <Text category="h10" ml={4} style={{ color }}>
          {copied
            ? t('copied', { defaultValue: 'Copied' })
            : label || t('copy', { defaultValue: 'Copy' })}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
});

export default CopyButton;
