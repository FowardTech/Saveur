import React, {memo} from 'react';
import {Modal, View, TouchableOpacity, ScrollView, StyleSheet, Dimensions} from 'react-native';
import {Icon, useTheme, Avatar} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from './Text';
import Flex from './Flex';
import {globalStyle} from 'styles/globalStyle';
import {AVATAR_PRESETS} from 'constants/avatarPresets';

interface Props {
  visible: boolean;
  currentUrl?: string | null;
  onClose: () => void;
  onSelect: (url: string) => void;
}

const {width} = Dimensions.get('window');
const COLUMNS = 4;
const GAP = 14;
const THUMB_SIZE = (width - 40 - GAP * (COLUMNS - 1)) / COLUMNS;

// Bottom-sheet picker, same slide-up/backdrop pattern already used for
// document pickers elsewhere in the app (see ResumeBuilder.tsx's
// documentPickerFor Modal) so this doesn't introduce a new interaction style.
// Presents the 12 curated professional avatars (constants/avatarPresets.ts)
// as one evenly-mixed grid -- not split into labeled "male"/"female"
// sections, since the request was for a balanced set to choose from, not a
// gender picker.
const AvatarPickerModal = memo(({visible, currentUrl, onClose, onSelect}: Props) => {
  const theme = useTheme();
  const {t} = useTranslation(['more', 'common']);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, {backgroundColor: theme['background-basic-color-1']}]}>
          <Flex justify="space-between" itemsCenter mb={16}>
            <Text category="h7" bold>
              {t('more:choose_an_avatar', {defaultValue: 'Choose an avatar'})}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Icon
                pack="eva"
                name="close-outline"
                style={[globalStyle.icon24, {tintColor: theme['text-basic-color']}]}
              />
            </TouchableOpacity>
          </Flex>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.grid}>
              {AVATAR_PRESETS.map(preset => {
                const isSelected = preset.url === currentUrl;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    activeOpacity={0.75}
                    onPress={() => onSelect(preset.url)}
                    style={[
                      styles.thumbWrap,
                      {
                        width: THUMB_SIZE,
                        height: THUMB_SIZE,
                        borderColor: isSelected ? theme['color-primary-500'] : 'transparent',
                      },
                    ]}>
                    <Avatar source={{uri: preset.url}} style={styles.thumbImage} shape="rounded" />
                    {isSelected ? (
                      <View style={[styles.checkBadge, {backgroundColor: theme['color-primary-500']}]}>
                        <Icon pack="eva" name="checkmark-outline" style={styles.checkIcon} fill="#fff" />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

export default AvatarPickerModal;

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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingBottom: 24,
  },
  thumbWrap: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 2,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  checkBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    width: 12,
    height: 12,
  },
});
