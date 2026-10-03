import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import {Icon, useTheme} from '@ui-kitten/components';

// Visible-in-both-themes checkbox: bordered box when empty, solid fill with
// a white check when checked (UI Kitten's default is invisible on dark/white).
const TermsCheckBox = ({checked, onChange}: {checked: boolean; onChange: (v: boolean) => void}) => {
  const theme = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => onChange(!checked)}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? theme['color-primary-solid'] ?? '#18181b' : theme['text-hint-color'],
          backgroundColor: checked ? theme['color-primary-solid'] ?? '#18181b' : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {checked ? (
          <Icon pack="eva" name="checkmark-outline" style={{width: 16, height: 16, tintColor: '#FFFFFF'}} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

export default TermsCheckBox;
