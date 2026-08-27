import React, { memo } from 'react';
import { View } from 'react-native';
import { StyleService, useStyleSheet, Icon, Spinner } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';

import Text from 'components/Text';
import Flex from 'components/Flex';
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

// PRODUCT FOLLOW-UP ("make it look the best of the best" after being asked
// directly whether Home read as modern) -- every row used to share the
// exact same blue icon regardless of what actually happened, which made a
// list of nine possible activity types visually indistinguishable from
// each other. A well-designed activity feed color-codes by event type (the
// same idea GitHub/Linear-style timelines use) so the feed is scannable at
// a glance, not just readable line by line -- one deliberately distinct hue
// per type, matching the same vivid palette QuickActionGrid.tsx's tiles
// just adopted (blue/teal/amber/purple/pink family) rather than introducing
// yet another color language.
const COLOR_BY_TYPE: Record<DayActivityItemType, string> = {
  mock_interview: '#0063f8',
  practical_scenario: '#0D9488',
  daily_challenge: '#F59E0B',
  daily_checkin_goal: '#EC4899',
  daily_checkin_reflection: '#7C3AED',
  career_diary: '#F97316',
  learning_course: '#6366F1',
  job_application: '#10B981',
  xp_earned: '#EAB308',
};

const MAX_ITEMS = 5;

const RecentActivityList = memo(() => {
  const styles = useStyleSheet(themedStyles);
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
      <Flex justify="flex-start" itemsCenter mb={14}>
        {/* REVERTED (product ask: "remove the backgrounds from the
            icons... give the icons themselves the platform blue") -- this
            cycled through a color-primary-transparent-100 tint circle and
            a GradientIconBadge; no badge/background now, plain glyph
            tinted platform blue, now brand green as part of the blue-to-
            green primary rebrand (#32ad84). */}
        <Icon pack="eva" name="activity-outline" style={[globalStyle.icon16, { tintColor: '#32ad84' }]} />
        <Text category="h7" bold ml={10}>
          {t('home:recent_activity_title', { defaultValue: 'Recent activity' })}
        </Text>
      </Flex>
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
          {items.map((item, i) => {
            const color = COLOR_BY_TYPE[item.type] ?? '#0063f8';
            return (
              <View
                key={`${item.type}-${i}`}
                style={[styles.row, i === items.length - 1 ? styles.rowLast : null]}>
                {/* REDESIGN, then REVERTED (product ask: "use that same
                    icon style in some other key notable screens" ->
                    "remove the backgrounds from the icons... give the
                    icons themselves [color]") -- cycled through a light
                    per-type tint circle and a GradientIconBadge behind the
                    glyph; no badge/background now, the same per-type
                    `color` this row already computes above (COLOR_BY_TYPE)
                    goes straight onto the glyph itself instead -- the
                    color-coding-by-activity-type idea this list exists for
                    is untouched, just without a colored shape behind it. */}
                <Icon
                  pack="eva"
                  name={ICON_BY_TYPE[item.type] ?? 'checkmark-circle-2-outline'}
                  style={[globalStyle.icon20, styles.iconWrap, { tintColor: color }]}
                />
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
                  <Text category="h10" status="placeholder" style={styles.time}>
                    {dayjs(item.time).fromNow()}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
});

export default RecentActivityList;

const themedStyles = StyleService.create({
  section: {
    marginTop: 22,
  },
  // BUG FIX (product report, with screenshot: "these cards should be
  // white") — see src/home/DailyTipsBanner.tsx's own comment on this same
  // fix: `background-basic-color-1` is a faint off-white almost invisible
  // against the page background; `background-basic-color-2` is real
  // `#FFFFFF`.
  // Radius bumped 20 -> 24 (Google-style pass, see QuickActionGrid.tsx's
  // own comment) to match the grid tiles' larger, softer corner language.
  listCard: {
    ...globalStyle.card,
    backgroundColor: 'background-basic-color-2',
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  emptyCard: {
    ...globalStyle.card,
    backgroundColor: 'background-basic-color-2',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  // PRODUCT FOLLOW-UP ("best of the best") -- hard borderBottom dividers
  // between every row read as a dated, dense list-view treatment. Dropped
  // in favor of consistent vertical rhythm (each row's own paddingVertical)
  // plus the color-coded icon circles above doing the visual separation
  // instead -- the same "grouping through spacing and color, not lines"
  // convention most current activity/timeline feeds use.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowLast: {
    paddingBottom: 16,
  },
  // Just the spacing now -- GradientIconBadge owns its own size/shape via
  // its `size`/`radius` props at the call site.
  iconWrap: {
    marginRight: 12,
  },
  time: {
    marginLeft: 8,
  },
});
