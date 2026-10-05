import React from 'react';
import {FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleProp, TouchableOpacity, View, ViewStyle} from 'react-native';
import {Icon, Input, useTheme} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from './Text';
import useLayout from 'hooks/useLayout';
import {globalStyle} from 'styles/globalStyle';
import {COUNTRIES, countryFlagEmoji} from 'constants/countries';
import {CITIES_BY_COUNTRY, CURRENCIES} from 'constants/locations';

// Dropdown-style selectors: an input-looking field that opens a searchable
// bottom sheet. Used for every place that used to ask the user to TYPE a
// country / city / currency.

interface Option {
  value: string;
  label: string;
  hint?: string;
}

interface SheetProps {
  visible: boolean;
  title: string;
  options: Option[];
  selected?: string;
  searchPlaceholder: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  onBack?: () => void;
  header?: React.ReactNode;
}

const SelectSheet = ({visible, title, options, selected, searchPlaceholder, onSelect, onClose, onBack, header}: SheetProps) => {
  const theme = useTheme();
  const {bottom} = useLayout();
  const [q, setQ] = React.useState('');
  React.useEffect(() => {
    if (!visible) setQ('');
  }, [visible]);
  const filtered = React.useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? options.filter(o => `${o.label} ${o.value} ${o.hint ?? ''}`.toLowerCase().includes(n)) : options;
  }, [q, options]);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{flex: 1, justifyContent: 'flex-end'}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)'}} onPress={onClose} />
        <View
          style={{
            height: '75%',
            backgroundColor: theme['background-basic-color-2'],
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 14,
            paddingHorizontal: 20,
            paddingBottom: Math.max(bottom, 16),
          }}>
          <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
            {onBack ? (
              <TouchableOpacity onPress={onBack} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}} style={{marginRight: 10}}>
                <Icon pack="eva" name="arrow-back-outline" style={[globalStyle.icon24, {tintColor: theme['text-basic-color']}]} />
              </TouchableOpacity>
            ) : null}
            <Text category="h7" bold style={{flex: 1}}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, {tintColor: theme['text-basic-color']}]} />
            </TouchableOpacity>
          </View>
          <Input
            placeholder={searchPlaceholder}
            value={q}
            onChangeText={setQ}
            autoCorrect={false}
            accessoryLeft={p => <Icon {...p} pack="eva" name="search-outline" />}
            style={[globalStyle.inputField, globalStyle.sheetInput, {marginBottom: 8}]}
            textStyle={globalStyle.inputText}
          />
          {header}
          <FlatList
            data={filtered}
            keyExtractor={o => o.value}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({item}) => {
              const on = item.value === selected;
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => onSelect(item.value)}
                  style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13}}>
                  <Text category="h9" bold={on} style={{flex: 1}}>
                    {item.label}
                  </Text>
                  {item.hint ? (
                    <Text category="h10" status="placeholder" mr={8}>
                      {item.hint}
                    </Text>
                  ) : null}
                  {on ? <Icon pack="eva" name="checkmark-circle-2" style={[globalStyle.icon20, {tintColor: '#7C5CFF'}]} /> : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

interface FieldProps {
  display?: string;
  placeholder: string;
  onPress: () => void;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}

const PickerTrigger = ({display, placeholder, onPress, icon = 'chevron-down-outline', style}: FieldProps) => {
  const theme = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        globalStyle.inputField,
        globalStyle.sheetInput,
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 48,
          paddingHorizontal: 14,
          borderColor: theme['border-input-color'],
        },
        style,
      ]}>
      <Text category="h9" status={display ? 'basic' : 'placeholder'} numberOfLines={1} style={{flex: 1}}>
        {display || placeholder}
      </Text>
      <Icon pack="eva" name={icon} style={[globalStyle.icon20, {tintColor: theme['text-hint-color']}]} />
    </TouchableOpacity>
  );
};

// ---- Currency ---------------------------------------------------------------

export const CurrencyPickerField = ({value, onChange, placeholder, style, optional}: {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  optional?: boolean;
}) => {
  const {t} = useTranslation(['common']);
  const [open, setOpen] = React.useState(false);
  const options = React.useMemo<Option[]>(() => CURRENCIES.map(c => ({value: c.code, label: `${c.code} · ${c.name}`})), []);
  const current = CURRENCIES.find(c => c.code === value);
  return (
    <>
      <PickerTrigger
        display={current ? `${current.code} · ${current.name}` : value}
        placeholder={placeholder ?? t('common:select_currency', {defaultValue: 'Select currency'})}
        onPress={() => setOpen(true)}
        style={style}
      />
      <SelectSheet
        visible={open}
        title={t('common:currency', {defaultValue: 'Currency'})}
        options={optional ? [{value: '', label: t('common:any_currency', {defaultValue: 'Any / local currency'})}, ...options] : options}
        selected={value}
        searchPlaceholder={t('common:search_currency', {defaultValue: 'Search currency'})}
        onSelect={v => {
          onChange(v);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

// ---- Country + city ---------------------------------------------------------
// Value format: "City, Country" (or just "Country").

export function splitLocation(value?: string | null): {country?: string; city?: string} {
  if (!value) return {};
  const idx = value.lastIndexOf(',');
  if (idx >= 0) {
    const country = value.slice(idx + 1).trim();
    if (COUNTRIES.includes(country)) return {country, city: value.slice(0, idx).trim()};
  }
  return COUNTRIES.includes(value.trim()) ? {country: value.trim()} : {};
}

export const LocationPickerField = ({value, onChange, placeholder, style, allowRemote}: {
  value: string;
  onChange: (location: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  allowRemote?: boolean;
}) => {
  const {t} = useTranslation(['common']);
  const [open, setOpen] = React.useState(false);
  const [country, setCountry] = React.useState<string | undefined>(undefined);
  const countryOptions = React.useMemo<Option[]>(
    () => COUNTRIES.filter(c => allowRemote || c !== 'Remote - Anywhere').map(c => ({
      value: c,
      label: `${countryFlagEmoji(c) ? countryFlagEmoji(c) + ' ' : ''}${c}`,
    })),
    [allowRemote],
  );
  const cityOptions = React.useMemo<Option[]>(
    () => (country ? (CITIES_BY_COUNTRY[country] ?? []).map(c => ({value: c, label: c})) : []),
    [country],
  );
  const openSheet = () => {
    setCountry(splitLocation(value).country);
    setOpen(true);
  };
  const finish = (loc: string) => {
    onChange(loc);
    setOpen(false);
  };
  const cur = splitLocation(value);
  const display = value
    ? cur.country
      ? `${countryFlagEmoji(cur.country) ? countryFlagEmoji(cur.country) + ' ' : ''}${value}`
      : value
    : '';
  const step2 = !!country && country !== 'Remote - Anywhere';
  return (
    <>
      <PickerTrigger
        display={display}
        placeholder={placeholder ?? t('common:select_location', {defaultValue: 'Select country and city'})}
        icon="map-pin-outline"
        onPress={openSheet}
        style={style}
      />
      <SelectSheet
        visible={open}
        title={step2 ? country! : t('common:select_country', {defaultValue: 'Select country'})}
        options={step2 ? cityOptions : countryOptions}
        selected={step2 ? cur.city : cur.country}
        searchPlaceholder={step2 ? t('common:search_city', {defaultValue: 'Search city'}) : t('common:search_country', {defaultValue: 'Search country'})}
        onBack={step2 ? () => setCountry(undefined) : undefined}
        header={
          step2 ? (
            <TouchableOpacity activeOpacity={0.7} onPress={() => finish(country!)} style={{paddingVertical: 10}}>
              <Text category="h9" status="link" bold>
                {t('common:use_country_only', {defaultValue: 'Use {{country}} only (no city)', country})}
              </Text>
            </TouchableOpacity>
          ) : null
        }
        onSelect={v => {
          if (!step2) {
            if (v === 'Remote - Anywhere' || !(CITIES_BY_COUNTRY[v]?.length)) finish(v);
            else setCountry(v);
          } else {
            finish(`${v}, ${country}`);
          }
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
};
