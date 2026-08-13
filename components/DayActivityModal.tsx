import React, { memo } from 'react';
import { Modal, View, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Icon, useTheme } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from './Text';
import Flex from './Flex';
import { globalStyle } from 'styles/globalStyle';
import * as dayActivityService from 'services/dayActivityService';
import { DayActivityItem, DayActivityItemType } from 'services/dayActivityService';

interface Props {
  visible: boolean;
  date: Date | null;
  onClose: () => void;
}

const ICON_BY_TYPE: Record<DayActivityItemType, string> = {
  mock_interview: 'mic-outline',
  practical_scenario: 'briefcase-outline',
  daily_challenge: 'flash-outline',
  daily_checkin_goal: 'flag-outline',
  daily_checkin_reflection: 'message-circle-outline',
  career_diary: 'edit-2-outline',
  learning_course: 'book-open-outline',
  job_application: 'paper-plane-outline',
  xp_earned: 'award-outline',
};

// Tap-a-calendar-day activity feed (product request item: "tapping any
// date/day should open a bottom sheet listing all career-related
// activities the user completed that day") — see WeekStrip.tsx's new
// onDayPress. Same bottom-sheet pattern as BadgesModal.tsx (slide-up,
// rounded top corners, flex-end backdrop).
const DayActivityModal = memo(({ visible, date, onClose }: Props) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation(['home', 'common']);
  const [items, setItems] = React.useState<DayActivityItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible || !date) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    dayActivityService.getDayActivity(date)
      .then(result => {
        if (!cancelled) setItems(result);
      })
      .catch((e: any) => {
        if (!cancelled) {
          setError(e?.message ?? t('common:try_again_later', { defaultValue: 'Please try again in a moment.' }));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, date, t]);

  // BUG FIX (product report, screenshot: modal header "Thursday, August 13"
  // still English regardless of in-app language) — `undefined` locale makes
  // toLocaleDateString fall back to the device's system locale instead of
  // the language picked inside the app; same root cause already fixed in
  // UpcomingSessionHomeCard.tsx (see its own comment) — i18n.language is
  // the same "es"/"fr"/"zh" code used elsewhere and is valid directly as a
  // BCP-47 locale here.
  const dateLabel = date
    ? date.toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme['background-basic-color-1'] }]}>
          <Flex justify="space-between" itemsCenter mb={16}>
            <Text category="h7" bold>
              {dateLabel}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon
                pack="eva"
                name="close-outline"
                style={[globalStyle.icon24, { tintColor: theme['text-basic-color'] }]}
              />
            </TouchableOpacity>
          </Flex>
          <ScrollView showsVerticalScrollIndicator={false}>
            {isLoading ? (
              <ActivityIndicator style={{ marginVertical: 32 }} color={theme['color-primary-500']} />
            ) : error ? (
              <Text category="h9-s" status="danger" center mt={16} mb={24}>
                {error}
              </Text>
            ) : items.length === 0 ? (
              <Text category="h9-s" status="placeholder" center mt={16} mb={24}>
                {t('home:day_activity_empty', { defaultValue: 'Nothing tracked for this day yet.' })}
              </Text>
            ) : (
              <View style={{ paddingBottom: 24 }}>
                {items.map((item, i) => (
                  <View key={`${item.type}-${i}`} style={styles.row}>
                    <View style={[styles.iconWrap, { backgroundColor: theme['background-basic-color-2'] }]}>
                      <Icon
                        pack="eva"
                        name={ICON_BY_TYPE[item.type] ?? 'checkmark-circle-2-outline'}
                        style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text category="h9" bold numberOfLines={2}>
                        {item.title}
                      </Text>
                      {item.subtitle ? (
                        <Text category="h10" status="placeholder" numberOfLines={3} mt={2}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

export default DayActivityModal;

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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
