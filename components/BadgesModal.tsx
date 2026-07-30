import React, {memo} from 'react';
import {Modal, View, TouchableOpacity, ScrollView, StyleSheet} from 'react-native';
import {Icon, useTheme} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from './Text';
import Flex from './Flex';
import {globalStyle} from 'styles/globalStyle';
import {DATA_BADGES} from 'constants/Data';

interface Props {
  visible: boolean;
  unlockedBadgeIds: Set<string>;
  onClose: () => void;
}

// Bottom-sheet, same pattern as AvatarPickerModal.tsx. Product-neutral home
// for the FULL badge grid (all of DATA_BADGES, locked and unlocked) — split
// out of HomeSrc.tsx's dashboard (UI cleanup pass) where it used to render
// inline, unconditionally, taking up roughly 3-4 full rows on every visit
// regardless of how many badges the user actually cared to look at. Home now
// just shows a compact "X/Y unlocked" preview that opens this.
const BadgesModal = memo(({visible, unlockedBadgeIds, onClose}: Props) => {
  const theme = useTheme();
  const {t} = useTranslation(['home', 'common']);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, {backgroundColor: theme['background-basic-color-1']}]}>
          <Flex justify="space-between" itemsCenter mb={16}>
            <Text category="h7" bold>
              {t('home:badges', {defaultValue: 'Badges'})} · {unlockedBadgeIds.size}/{DATA_BADGES.length}
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
              {DATA_BADGES.map(badge => {
                const unlocked = unlockedBadgeIds.has(badge.id);
                return (
                  <View key={badge.id} style={[styles.badgeCard, !unlocked && styles.badgeCardLocked]}>
                    <View
                      style={[
                        styles.badgeIconWrap,
                        {backgroundColor: unlocked ? theme['color-primary-500'] : theme['background-basic-color-3']},
                      ]}>
                      <Icon
                        pack={badge.iconPack ?? 'assets'}
                        name={badge.icon}
                        style={[globalStyle.icon20, {tintColor: unlocked ? theme['text-primary-color'] : theme['text-hint-color']}]}
                      />
                    </View>
                    <Text category="h10" bold center mt={8} numberOfLines={2} status={unlocked ? 'basic' : 'placeholder'}>
                      {t(`home:badge_${badge.id}_title`, {defaultValue: badge.title})}
                    </Text>
                    <Text category="h10" center mt={2} status="placeholder" numberOfLines={2}>
                      {t(`home:badge_${badge.id}_desc`, {defaultValue: badge.description})}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

export default BadgesModal;

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
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  badgeCard: {
    width: '31%',
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.08)',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  badgeCardLocked: {
    opacity: 0.55,
  },
  badgeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
