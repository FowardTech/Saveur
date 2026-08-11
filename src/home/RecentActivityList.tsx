import React, { memo } from 'react';
import { View } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon, Spinner } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import Text from 'components/Text';
import { globalStyle } from 'styles/globalStyle';
import * as dayActivityService from 'services/dayActivityService';
import { DayActivityItem, DayActivityItemType } from 'services/dayActivityService';
import dayjs from 'utils/dayjs';

// Home redesign (product request, see QuickActionGrid.tsx's own module
// comment for the full context) -- the reference screenshots' third
// structural element, a "recent activity" list under the quick-action
// grid. Reuses the exact same GET /api/v1/activity/day endpoint (and icon
// mapping) components/DayActivityModal.tsx already calls for the "tap a
// calendar day" bottom sheet -- no new backend needed, this just surfaces
// the same real, typed activity feed inline on Home instead of only behind
// a calendar-day tap. Checks today first, falling back to yesterday if
// today has nothing yet (a brand-new session shouldn't show a blank list
// the moment someone opens the app in the morning before doing anything
// today), capped to the 5 most recent items, most-recent-first.
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

const MAX_ITEMS = 5;

const RecentActivityList = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const { t } = useTranslation(['home', 'common']);
  const [items, setItems] = React.useState<DayActivityItem[] | null>(null);

  const load = React.useCallback(() => {
    const today = new Date();
    dayActivityService.getDayActivity(today)
      .then(async todayItems => {
        if (todayItems.length > 0) return todayItems;
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return dayActivityService.getDayActivity(yesterday).catch(() => []);
      })
      // get_day_activity returns chronological (earliest first) --
      // reversed here since a "recent activity" feed reads most-recent-
      // first, unlike DayActivityModal's own day-scoped timeline view.
      .then(result => setItems([...result].reverse().slice(0, MAX_ITEMS)))
      .catch(() => setItems([]));
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.section}>
      <Text category="h8" bold mb={12}>
        {t('home:recent_activity_title', { defaultValue: 'Recent activity' })}
      </Text>
      {items === null ? (
        <Spinner size="small" />
      ) : items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text category="h9-s" status="placeholder" center>
            {t('home:recent_activity_empty', {
              defaultValue: "Nothing yet — practice an interview or chat with your coach to get started.",
            })}
          </Text>
        </View>
      ) : (
        <View style={styles.listCard}>
          {items.map((item, i) => (
            <View
              key={`${item.type}-${i}`}
              style={[styles.row, i === items.length - 1 ? styles.rowLast : null]}>
              <View style={styles.iconWrap}>
                <Icon
                  pack="eva"
                  name={ICON_BY_TYPE[item.type] ?? 'checkmark-circle-2-outline'}
                  style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]}
                />
              </View>
              <View style={globalStyle.flexOne}>
                <Text category="h9" bold numberOfLines={1}>
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text category="h10" status="placeholder" numberOfLines={1} mt={2}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>
              {item.time ? (
                <Text category="h10" status="placeholder">
                  {dayjs(item.time).fromNow()}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

export default RecentActivityList;

const themedStyles = StyleService.create({
  section: {
    marginTop: 20,
  },
  listCard: {
    ...globalStyle.card,
    backgroundColor: 'background-basic-color-1',
    paddingHorizontal: 14,
  },
  emptyCard: {
    ...globalStyle.card,
    backgroundColor: 'background-basic-color-1',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    // Same shared row-divider color already used elsewhere in this app
    // (InterviewReplay, Student Verification, etc.) -- see
    // globalStyle.divider's own comment.
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'color-primary-transparent-100',
  },
});
