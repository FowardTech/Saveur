import React from 'react';
import {StyleProp, TouchableOpacity, View, ViewStyle} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import {Icon, useTheme} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from './Text';
import {globalStyle} from 'styles/globalStyle';

// Shared date-entry field: looks like an input, opens the native date picker.
//   format="iso"        -> stored/emitted as YYYY-MM-DD
//   format="monthYear"  -> stored/emitted as "Jan 2022" (resume start/end)
// allowPresent adds a "Present" pill (stored as the string "Present").
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseDateValue(value?: string | null): Date | null {
  if (!value) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const my = /^([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})$/.exec(value.trim());
  if (my) {
    const m = MONTHS.findIndex(x => x.toLowerCase() === my[1].toLowerCase());
    if (m >= 0) return new Date(Number(my[2]), m, 1);
  }
  return null;
}

export function formatDateValue(d: Date, format: 'iso' | 'monthYear'): string {
  if (format === 'monthYear') return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface Props {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  format?: 'iso' | 'monthYear';
  allowPresent?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  style?: StyleProp<ViewStyle>;
}

const DatePickerField = ({value, onChange, placeholder, format = 'iso', allowPresent, minimumDate, maximumDate, style}: Props) => {
  const theme = useTheme();
  const {t, i18n} = useTranslation(['common']);
  const [open, setOpen] = React.useState(false);
  const isPresent = (value ?? '').trim().toLowerCase() === 'present';
  const date = parseDateValue(value);
  const display = isPresent
    ? t('common:present', {defaultValue: 'Present'})
    : date
    ? format === 'monthYear'
      ? date.toLocaleDateString(i18n.language, {month: 'short', year: 'numeric'})
      : date.toLocaleDateString(i18n.language)
    : value || '';

  return (
    <View style={style}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
        style={[globalStyle.inputField, globalStyle.sheetInput, {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 48,
          paddingHorizontal: 14,
          borderColor: theme['border-input-color'],
        }]}>
        <Text category="h9" status={display ? 'basic' : 'placeholder'} numberOfLines={1} style={{flex: 1}}>
          {display || placeholder}
        </Text>
        <Icon pack="eva" name="calendar-outline" style={[globalStyle.icon20, {tintColor: theme['text-hint-color']}]} />
      </TouchableOpacity>
      {allowPresent ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onChange(isPresent ? '' : 'Present')}
          style={{alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
            backgroundColor: isPresent ? theme['color-primary-solid'] : theme['background-basic-color-4']}}>
          <Text category="h10" bold status={isPresent ? 'control' : 'basic'}>
            {t('common:present', {defaultValue: 'Present'})}
          </Text>
        </TouchableOpacity>
      ) : null}
      <DateTimePickerModal
        isVisible={open}
        mode="date"
        date={date ?? new Date()}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        onConfirm={d => {
          setOpen(false);
          onChange(formatDateValue(d, format));
        }}
        onCancel={() => setOpen(false)}
      />
    </View>
  );
};

export default DatePickerField;
