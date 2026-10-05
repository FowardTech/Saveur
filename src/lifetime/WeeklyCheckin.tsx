import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import {Icon, Input, useTheme} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import {globalStyle} from 'styles/globalStyle';
import * as svc from 'services/lifetimeService';
import {LifetimeScreen, Card, H, Bullets, Loading, PrimaryButton, Pill, useAsyncAction} from './Scaffold';

const WeeklyCheckin = () => {
  const {t} = useTranslation(['more', 'common']);
  const theme = useTheme();
  const {busy, run} = useAsyncAction(t);
  const [data, setData] = React.useState<{current_week_start: string; checkins: svc.WeeklyCheckin[]} | null>(null);
  const [reflection, setReflection] = React.useState('');

  const load = React.useCallback(async () => {
    try {
      setData(await svc.getWeekly());
    } catch {
      setData({current_week_start: '', checkins: []});
    }
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  const current = data?.checkins.find(c => c.week_start === data.current_week_start);
  const past = (data?.checkins ?? []).filter(c => c !== current);

  const generate = () =>
    run(async () => {
      await svc.generateWeekly(reflection.trim() || undefined);
      setReflection('');
      await load();
    });

  const toggleStep = (c: svc.WeeklyCheckin) =>
    run(async () => {
      await svc.setStepDone(c.id, !c.next_step_done);
      await load();
    });

  return (
    <LifetimeScreen title={t('more:lt_weekly_title', {defaultValue: 'Weekly Check-in'})} avoidKeyboard>
      {!data ? (
        <Loading />
      ) : (
        <>
          {current ? (
            <>
              <Card>
                <Text category="h9-s" status="placeholder">
                  {t('more:lt_week_of', {defaultValue: 'Week of {{date}}', date: current.week_start})}
                </Text>
                <Text category="h8" mt={6} style={{lineHeight: 24}}>
                  {current.summary}
                </Text>
                {current.wins.length ? (
                  <>
                    <H>{t('more:lt_wins', {defaultValue: 'Wins'})}</H>
                    <Bullets items={current.wins} color="#19B87A" />
                  </>
                ) : null}
                {current.learnings.length ? (
                  <>
                    <H>{t('more:lt_learnings', {defaultValue: 'What you learned'})}</H>
                    <Bullets items={current.learnings} color="#7C5CFF" />
                  </>
                ) : null}
                {current.focus_next_week ? (
                  <>
                    <H>{t('more:lt_focus', {defaultValue: 'Focus for next week'})}</H>
                    <Text category="h9-s">{current.focus_next_week}</Text>
                  </>
                ) : null}
              </Card>
              <Card style={{backgroundColor: '#7C5CFF'}}>
                <Pill label={t('more:lt_next_step', {defaultValue: 'Your one next step'})} color="#FFFFFF" />
                <Text category="h7" bold mt={10} style={{color: '#FFFFFF'}}>
                  {current.next_step.title}
                </Text>
                <Text category="h9-s" mt={6} style={{color: 'rgba(255,255,255,0.9)', lineHeight: 21}}>
                  {current.next_step.why}
                </Text>
                <Text category="h9-s" mt={8} style={{color: '#FFFFFF', lineHeight: 21}}>
                  {current.next_step.action}
                </Text>
                <TouchableOpacity
                  onPress={() => toggleStep(current)}
                  style={{flexDirection: 'row', alignItems: 'center', marginTop: 14}}>
                  <Icon
                    pack="eva"
                    name={current.next_step_done ? 'checkmark-circle-2' : 'radio-button-off-outline'}
                    style={[globalStyle.icon24, {tintColor: '#FFFFFF'}]}
                  />
                  <Text category="h9" bold ml={8} style={{color: '#FFFFFF'}}>
                    {current.next_step_done
                      ? t('more:lt_step_done', {defaultValue: 'Done - nice work'})
                      : t('more:lt_mark_done', {defaultValue: 'Mark as done'})}
                  </Text>
                </TouchableOpacity>
              </Card>
              {current.encouragement ? (
                <Text category="h9-s" status="placeholder" center mb={12}>
                  {current.encouragement}
                </Text>
              ) : null}
            </>
          ) : (
            <Card>
              <Text category="h8" bold>
                {t('more:lt_checkin_intro_title', {defaultValue: 'Two minutes to review your week'})}
              </Text>
              <Text category="h9-s" status="placeholder" mt={6} mb={12}>
                {t('more:lt_checkin_intro_body', {
                  defaultValue: "We'll use your Career Diary, goals and wins, then give you one concrete next step. Anything else on your mind? (optional)",
                })}
              </Text>
              <Input
                multiline
                value={reflection}
                onChangeText={setReflection}
                placeholder={t('more:lt_reflection_placeholder', {defaultValue: 'What went well? What was hard?'}).toString()}
                textStyle={{minHeight: 80, textAlignVertical: 'top'}}
                style={[{marginBottom: 12}, globalStyle.sheetInput]}
              />
              <PrimaryButton label={t('more:lt_start_checkin', {defaultValue: 'Start my check-in'})} loading={busy} onPress={generate} />
            </Card>
          )}
          {current ? (
            <PrimaryButton label={t('more:lt_redo_checkin', {defaultValue: 'Redo this week’s check-in'})} loading={busy} onPress={generate} style={{marginBottom: 12}} />
          ) : null}
          {past.length ? (
            <>
              <H>{t('more:lt_previous', {defaultValue: 'Previous weeks'})}</H>
              {past.map(c => (
                <Card key={c.id}>
                  <Text category="h10" status="placeholder">
                    {t('more:lt_week_of', {defaultValue: 'Week of {{date}}', date: c.week_start})}
                  </Text>
                  <Text category="h9-s" mt={4}>
                    {c.summary}
                  </Text>
                  <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8}}>
                    <Icon
                      pack="eva"
                      name={c.next_step_done ? 'checkmark-circle-2' : 'radio-button-off-outline'}
                      style={[globalStyle.icon16, {tintColor: c.next_step_done ? '#19B87A' : theme['text-hint-color']}]}
                    />
                    <Text category="h10" ml={6} style={{flex: 1}}>
                      {c.next_step.title}
                    </Text>
                  </View>
                </Card>
              ))}
            </>
          ) : null}
        </>
      )}
    </LifetimeScreen>
  );
};

export default WeeklyCheckin;
