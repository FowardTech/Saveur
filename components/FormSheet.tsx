import React, {memo} from 'react';
import {KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TouchableOpacity, View} from 'react-native';
import {Icon, useTheme} from '@ui-kitten/components';

import Text from 'components/Text';
import useLayout from 'hooks/useLayout';

interface FormSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Shared bottom sheet for every form in the app: white sheet, rounded top
 * corners, grab handle, title row with close button, scrollable body that
 * lifts above the keyboard. Inputs inside inherit the light-gray bordered
 * look from the global Input theme (constants/theme/mapping.json).
 */
const FormSheet = memo(({visible, title, subtitle, onClose, children}: FormSheetProps) => {
  const theme = useTheme();
  const {bottom} = useLayout();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{flex: 1, justifyContent: 'flex-end'}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{...StyleSheetFill, backgroundColor: 'rgba(0,0,0,0.4)'}} onPress={onClose} />
        <View
          style={{
            maxHeight: '88%',
            backgroundColor: theme['background-basic-color-2'],
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 10,
            paddingHorizontal: 20,
            paddingBottom: Math.max(bottom, 16),
          }}>
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme['border-card-default'],
              marginBottom: 12,
            }}
          />
          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: subtitle ? 4 : 12}}>
            <Text category="h7" bold style={{flex: 1}}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Icon pack="eva" name="close-outline" style={{width: 24, height: 24, tintColor: theme['text-basic-color']}} />
            </TouchableOpacity>
          </View>
          {subtitle ? (
            <Text category="h9-s" status="placeholder" mb={12}>
              {subtitle}
            </Text>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const StyleSheetFill = {position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0};

export default FormSheet;
