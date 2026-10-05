import React from 'react';
import {Alert, TouchableOpacity, View} from 'react-native';
import {Icon, Input, useTheme} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import DatePickerField from 'components/DatePickerField';
import {globalStyle} from 'styles/globalStyle';
import * as svc from 'services/lifetimeService';
import {LifetimeScreen, Card, Loading, PrimaryButton, useAsyncAction} from './Scaffold';

const KIND_META: Record<string, {color: string; icon: string}> = {
  win: {color: '#19B87A', icon: 'award-outline'},
  role: {color: '#7C5CFF', icon: 'briefcase-outline'},
  raise: {color: '#FF8A3D', icon: 'trending-up-outline'},
  certificate: {color: '#2F6BFF', icon: 'award-outline'},
  milestone: {color: '#FF5FA2', icon: 'flag-outline'},
  review: {color: '#F5B000', icon: 'file-text-outline'},
};
const KINDS = ['win', 'role', 'raise', 'certificate', 'milestone', 'review'];

const CareerTimeline = () => {
  const {t} = useTranslation(['more', 'common']);
  const theme = useTheme();
  const {busy, run} = useAsyncAction(t);
  const [events, setEvents] = React.useState<svc.TimelineEvent[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [detail, setDetail] = React.useState('');
  const [kind, setKind] = React.useState('win');
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));

  const load = React.useCallback(async () => {
    try {
      setEvents(await svc.getTimeline());
    } catch {
      setEvents([]);
    }
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  const kindLabel = (k: string) =>
    k === 'win'
      ? t('more:lt_tl_win', {defaultValue: 'Win'})
      : k === 'role'
      ? t('more:lt_tl_role', {defaultValue: 'New role'})
      : k === 'raise'
      ? t('more:lt_tl_raise', {defaultValue: 'Raise'})
      : k === 'certificate'
      ? t('more:lt_tl_certificate', {defaultValue: 'Certificate'})
      : k === 'review'
      ? t('more:lt_tl_review', {defaultValue: 'Review'})
      : t('more:lt_tl_milestone', {defaultValue: 'Milestone'});

  const save = () =>
    run(async () => {
      await svc.addTimeline({title: title.trim(), kind, date, detail: detail.trim() || undefined});
      setOpen(false);
      setTitle('');
      setDetail('');
      await load();
    });

  const remove = (e: svc.TimelineEvent) =>
    Alert.alert(String(t('more:lt_tl_delete', {defaultValue: 'Remove this entry?'})), e.title, [
      {text: String(t('common:cancel', {defaultValue: 'Cancel'})), style: 'cancel'},
      {
        text: String(t('common:delete', {defaultValue: 'Delete'})),
        style: 'destructive',
        onPress: () =>
          run(async () => {
            await svc.deleteTimeline(e.id);
            await load();
          }),
      },
    ]);

  const year = (e: svc.TimelineEvent) => e.date.slice(0, 4);

  return (
    <LifetimeScreen title={t('more:lt_timeline_title', {defaultValue: 'Career Timeline'})} avoidKeyboard>
      <Text category="h9-s" status="placeholder" mb={12}>
        {t('more:lt_timeline_intro', {defaultValue: 'Your wins, raises, roles and certificates over the years. Pay updates and certificates appear automatically.'})}
      </Text>
      {open ? (
        <Card>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8}}>
            {KINDS.map(k => (
              <TouchableOpacity
                key={k}
                onPress={() => setKind(k)}
                style={{
                  marginRight: 8,
                  marginBottom: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: kind === k ? KIND_META[k].color : theme['background-basic-color-4'],
                }}>
                <Text category="h10" bold style={{color: kind === k ? '#FFFFFF' : undefined}}>
                  {kindLabel(k)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder={String(t('more:lt_tl_title_placeholder', {defaultValue: 'What happened?'}))}
            style={[{marginBottom: 10}, globalStyle.sheetInput]}
          />
          <DatePickerField value={date} onChange={setDate} placeholder={String(t('more:lt_tl_date', {defaultValue: 'Date'}))} style={{marginBottom: 10}} />
          <Input
            multiline
            value={detail}
            onChangeText={setDetail}
            placeholder={String(t('more:lt_tl_detail_placeholder', {defaultValue: 'Details (optional)'}))}
            textStyle={{minHeight: 70, textAlignVertical: 'top'}}
            style={[{marginBottom: 12}, globalStyle.sheetInput]}
          />
          <PrimaryButton label={t('common:save', {defaultValue: 'Save'})} loading={busy} disabled={!title.trim()} onPress={save} style={{marginBottom: 8}} />
          <PrimaryButton label={t('common:cancel', {defaultValue: 'Cancel'})} onPress={() => setOpen(false)} />
        </Card>
      ) : (
        <PrimaryButton label={t('more:lt_tl_add', {defaultValue: 'Add to my timeline'})} onPress={() => setOpen(true)} style={{marginBottom: 16}} />
      )}
      {!events ? (
        <Loading />
      ) : events.length === 0 ? (
        <Text category="h9-s" status="placeholder" center mt={20}>
          {t('more:lt_timeline_empty', {defaultValue: 'Nothing here yet. Add your first win or role.'})}
        </Text>
      ) : (
        events.map((e, i) => {
          const m = KIND_META[e.kind] ?? KIND_META.milestone;
          const newYear = i === 0 || year(events[i - 1]) !== year(e);
          return (
            <View key={e.id}>
              {newYear ? (
                <Text category="h6" bold mt={i === 0 ? 0 : 12} mb={8}>
                  {year(e)}
                </Text>
              ) : null}
              <TouchableOpacity activeOpacity={e.deletable ? 0.7 : 1} onLongPress={() => e.deletable && remove(e)} style={{flexDirection: 'row'}}>
                <View style={{alignItems: 'center', marginRight: 12}}>
                  <View style={{width: 34, height: 34, borderRadius: 17, backgroundColor: m.color, alignItems: 'center', justifyContent: 'center'}}>
                    <Icon pack="eva" name={m.icon} style={[globalStyle.icon16, {tintColor: '#FFFFFF'}]} />
                  </View>
                  <View style={{flex: 1, width: 2, backgroundColor: theme['border-card-default'], marginTop: 2}} />
                </View>
                <View style={{flex: 1, paddingBottom: 18}}>
                  <Text category="h10" status="placeholder">
                    {e.date} · {kindLabel(e.kind)}
                  </Text>
                  <Text category="h9" bold mt={2}>
                    {e.title}
                  </Text>
                  {e.detail ? (
                    <Text category="h9-s" status="placeholder" mt={2}>
                      {e.detail}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            </View>
          );
        })
      )}
      {events && events.some(e => e.deletable) ? (
        <Text category="h10" status="placeholder" center mt={8}>
          {t('more:lt_tl_hint', {defaultValue: 'Long-press an entry you added to remove it.'})}
        </Text>
      ) : null}
    </LifetimeScreen>
  );
};

export default CareerTimeline;
