import React, {memo} from 'react';
import {Modal, View, TouchableOpacity, StyleSheet} from 'react-native';
import {Icon, useTheme} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from './Text';
import Flex from './Flex';
import CtaButton from './CtaButton';
import {globalStyle} from 'styles/globalStyle';
import {InterviewPersona} from 'services/configService';

interface Props {
  persona: InterviewPersona | null;
  isSelected: boolean;
  onClose: () => void;
  onSelect: () => void;
}

// Product request item: "A pop up with more detail on the interviewer
// personality when they click on it." Before this, MockInterviewSetup.tsx's
// persona cards only ever showed `name` + a 2-line-truncated `description`,
// and tapping a card immediately selected it — there was no way to actually
// read what a personality does before committing to it. `style` (the full,
// real prompt instruction already sent to the LLM server-side — see
// app_config_service.py's "interview_personas" section) was already shipped
// to mobile in the same config payload but never rendered anywhere
// (configService.ts's InterviewPersona type comment says as much); this
// modal is just finally showing content that already existed. Bottom-sheet,
// same pattern as BadgesModal.tsx/AvatarPickerModal.tsx.
const PersonaDetailModal = memo(({persona, isSelected, onClose, onSelect}: Props) => {
  const theme = useTheme();
  const {t} = useTranslation(['find', 'common']);

  return (
    <Modal visible={!!persona} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, {backgroundColor: theme['background-basic-color-1']}]}>
          <Flex justify="space-between" itemsCenter mb={16}>
            <Flex justify="flex-start" itemsCenter style={globalStyle.flexOne}>
              <View style={[styles.iconWrap, {backgroundColor: theme['background-basic-color-2']}]}>
                <Icon
                  pack="eva"
                  name={persona?.icon || 'person-outline'}
                  style={[globalStyle.icon20, {tintColor: theme['color-primary-500']}]}
                />
              </View>
              <Text category="h7" bold ml={12} style={globalStyle.flexOne} numberOfLines={2}>
                {persona?.name}
              </Text>
            </Flex>
            <TouchableOpacity onPress={onClose} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Icon
                pack="eva"
                name="close-outline"
                style={[globalStyle.icon24, {tintColor: theme['text-basic-color']}]}
              />
            </TouchableOpacity>
          </Flex>

          <Text category="h9" status="placeholder" mb={16}>
            {persona?.description}
          </Text>

          <Text category="h8" bold mb={8}>
            {t('find:interviewer_personality_detail_title', {defaultValue: 'What to expect'})}
          </Text>
          <Text category="h9" mb={24}>
            {persona?.style}
          </Text>

          <CtaButton
            onPress={() => {
              onSelect();
              onClose();
            }}>
            {isSelected
              ? t('find:interviewer_personality_deselect', {defaultValue: 'Remove This Personality'})
              : t('find:interviewer_personality_select', {defaultValue: 'Practice With This Personality'})}
          </CtaButton>
        </View>
      </View>
    </Modal>
  );
});

export default PersonaDetailModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
