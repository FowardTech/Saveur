import React, { memo, useMemo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, useTheme } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';

export interface WeekStripProps {
  /** Whether today has already been checked in / practiced — the only
   * per-day signal this app actually has (see HomeSrc.tsx's `streak` state,
   * gamificationService.getStreak). Every other day in the strip is purely
   * a calendar label, not a claim about real activity that day — this app
   * doesn't have a per-date practice log to draw on, so the strip
   * deliberately doesn't fabricate checkmarks for past days. */
  checkedInToday?: boolean;
  /** Product request item: "tapping any date/day should open a bottom
   * sheet listing all career-related activities the user completed that
   * day" — see HomeSrc.tsx's DayActivityModal wiring. Optional so this
   * component still renders as a plain status strip (its original role)
   * anywhere a caller doesn't pass a handler. */
  onDayPress?: (date: Date) => void;
}

// Day-of-week calendar strip (product request item — visual reference: a
// light, clean fitness/wellness app screenshot showing "Mon Tue Wed Thu Fri
// Sat Sun" with today's cell highlighted). Tapping a cell opens that day's
// activity feed (see onDayPress above) — this used to be purely a "here's
// where we are in the week" status display with no tap behavior at all,
// per a since-superseded comment claiming "this app has no per-day
// calendar/scheduling meaning to attach to other cells"; the Career Diary,
// Daily Challenge, Daily Check-in, mock interviews, etc. all DO have
// real per-day data now, which is exactly what DayActivityModal surfaces.
const WeekStrip = memo(({ checkedInToday, onDayPress }: WeekStripProps) => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation('home');

  const days = useMemo(() => {
    const labels = [
      t('home:day_short_mon', { defaultValue: 'Mon' }),
      t('home:day_short_tue', { defaultValue: 'Tue' }),
      t('home:day_short_wed', { defaultValue: 'Wed' }),
      t('home:day_short_thu', { defaultValue: 'Thu' }),
      t('home:day_short_fri', { defaultValue: 'Fri' }),
      t('home:day_short_sat', { defaultValue: 'Sat' }),
      t('home:day_short_sun', { defaultValue: 'Sun' }),
    ];
    const now = new Date();
    // JS getDay(): 0=Sun..6=Sat. Convert to a Mon-first index (0=Mon..6=Sun)
    // to match the labels above, then walk backward/forward from today to
    // find each date in the CURRENT Mon-Sun week.
    const todayMonFirst = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - todayMonFirst);
    return labels.map((label, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return { label, date, dateNum: date.getDate(), isToday: i === todayMonFirst };
    });
  }, [t]);

  return (
    <View style={styles.row}>
      {days.map(d => (
        <TouchableOpacity
          key={d.label}
          style={styles.cell}
          activeOpacity={onDayPress ? 0.6 : 1}
          disabled={!onDayPress}
          onPress={() => onDayPress?.(d.date)}>
          <Text category="h10" status="placeholder" style={styles.dayLabel}>
            {d.label}
          </Text>
          <View
            style={[
              styles.dateCircle,
              d.isToday
                ? { backgroundColor: theme['color-primary-100'] }
                : { backgroundColor: theme['background-basic-color-3'] },
            ]}>
            <Text
              category="h9-s"
              bold
              style={{ color: d.isToday ? theme['text-primary-color'] : theme['text-basic-color'] }}>
              {d.dateNum}
            </Text>
          </View>
          {d.isToday && checkedInToday ? (
            <View style={[styles.checkDot, { backgroundColor: theme['text-completed-color'] }]} />
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  );
});

export default WeekStrip;

const themedStyles = StyleService.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
    // Product request ("give the date container a white background") —
    // this strip previously had no background at all, so it visually
    // blended into whatever the page underneath it was rendering (a gray
    // page, per Container.tsx). No shadow added, per the separate "remove
    // box shadows from every card" request elsewhere in this pass — just a
    // plain white fill + enough padding/radius to read as its own
    // container, same white as every other card's fill (background-basic-
    // color-2).
    backgroundColor: 'background-basic-color-2',
    // Google-style furnishing pass (see styles/globalStyle.ts's `card`) --
    // 14 -> 20.
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  cell: {
    alignItems: 'center',
    width: 36,
  },
  dayLabel: {
    marginBottom: 6,
  },
  dateCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 4,
  },
});
