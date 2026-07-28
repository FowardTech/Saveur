import {useTheme} from '@ui-kitten/components';
import dayjs from 'dayjs';
import React, {memo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {CalendarList, LocaleConfig} from 'react-native-calendars';

LocaleConfig.locales.fr = {
  monthNames: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  monthNamesShort: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ],
  dayNames: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
};
LocaleConfig.defaultLocale = 'fr';

interface CalendarProps {
  onPress?(): void;
  current?: string | Date | number;
  selected?: string;
}

const ProfileCalendar = memo(
  ({
    selected = '2021-11-05',
    current = '2021-11-05',
    onPress,
  }: CalendarProps) => {
    const [dateSelected, setDateSelected] = useState<any>(selected);
    const [active, setActive] = useState<boolean>(false);
    const [markedDates, setMarkedDates] = useState('');
    const theme = useTheme();
    const event = {
      key: 'event',
      color: theme['text-basic-color'],
      selectedDotColor: active
        ? theme['text-white-color']
        : theme['text-basic-color'],
    };
    const meeting = {
      key: 'meeting',
      color: theme['text-warning-color'],
      selectedDotColor: active ? 'white' : 'blue',
    };
    const community = {
      key: 'community',
      color: theme['text-warning-color'],
      selectedDotColor: active ? 'white' : 'blue',
    };
    const appointment = {
      key: 'appointment',
      color: theme['text-danger-color'],
      selectedDotColor: active ? 'white' : 'blue',
    };
    return (
      <View>
        <CalendarList
          style={styles.container}
          current={dayjs(current).format('YYYY/MM/DD')}
          renderHeader={() => null}
          onDayPress={day => {
            setMarkedDates(day.dateString);
            setDateSelected(day.dateString);
            setActive(true);
          }}
          markingType={'multi-dot'}
          hideExtraDays={true}
          horizontal={true}
          pagingEnabled={true}
          markedDates={{
            [markedDates]: {
              selected: true,
              customStyles: {
                container: {
                  width: 32,
                  height: 32,
                  borderRadius: 12,
                },
              },
            },
            '2021-11-05': {
              dots: [event, meeting],
              selected: dateSelected === '2021-11-05',
            },
            '2021-11-08': {
              marked: true,
              selected: dateSelected === '2021-11-08',
              dots: [event, meeting],
            },
            '2021-11-09': {
              marked: true,
              selected: dateSelected === '2021-11-09',
              dots: [event],
            },
            '2021-11-10': {
              marked: true,
              selected: dateSelected === '2021-11-10',
              dots: [event],
            },
            '2021-11-11': {
              marked: true,
              selected: dateSelected === '2021-11-11',
              dots: [event, meeting, appointment],
            },
            '2021-11-16': {
              marked: true,
              selected: dateSelected === '2021-11-16',
              dots: [event, meeting],
            },
            '2021-11-17': {
              marked: true,
              selected: dateSelected === '2021-11-17',
              dots: [event, appointment],
            },
          }}
          theme={{
            calendarBackground: 'transparent',
            selectedDayBackgroundColor: theme['button-basic-color'],
            textDayFontFamily: 'PlusJakartaSans-Medium',
            textDayHeaderFontWeight: '500',
            textDayFontWeight: '500',
            textDayHeaderFontSize: 12,
            textDayFontSize: 14,
            textDayHeaderFontFamily: 'PlusJakartaSans-Regular',
            textMonthFontSize: 14,
            textMonthFontWeight: '500',
            // todayTextColor: theme["color-malachite-100"],
            todayBackgroundColor: theme['text-link-color'],
            todayTextColor: 'red',
            arrowWidth: 12,
            arrowHeight: 12,
          }}
        />
      </View>
    );
  },
);

export default ProfileCalendar;

const styles = StyleSheet.create({
  container: {
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 12,
    shadowColor: 'rgba(141, 151, 158, 0.2)',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.58,
    shadowRadius: 16,
    paddingBottom: 32,
  },
});
