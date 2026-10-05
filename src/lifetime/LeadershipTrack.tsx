import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import {Input} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import {globalStyle} from 'styles/globalStyle';
import * as svc from 'services/lifetimeService';
import {LifetimeScreen, Card, H, Bullets, PrimaryButton, Pill, useAsyncAction} from './Scaffold';

const KINDS = ['one_on_one', 'feedback_script', 'difficult_conversation'] as const;
const ROLEPLAY_FOR: Record<string, string> = {
  one_on_one: 'one_on_one',
  feedback_script: 'feedback_delivery',
  difficult_conversation: 'difficult_conversation',
};

const LeadershipTrack = () => {
  const {t} = useTranslation(['more', 'common']);
  const navigation = useNavigation<NavigationProp<any>>();
  const {busy, run} = useAsyncAction(t);
  const [kind, setKind] = React.useState<(typeof KINDS)[number]>('one_on_one');
  const [person, setPerson] = React.useState('');
  const [situation, setSituation] = React.useState('');
  const [prep, setPrep] = React.useState<svc.LeadershipPrep | null>(null);

  const labels: Record<string, string> = {
    one_on_one: t('more:lt_kind_1on1', {defaultValue: '1:1 prep'}),
    feedback_script: t('more:lt_kind_feedback', {defaultValue: 'Feedback script'}),
    difficult_conversation: t('more:lt_kind_difficult', {defaultValue: 'Difficult conversation'}),
  };

  const build = () =>
    run(async () => {
      setPrep(await svc.buildLeadershipPrep(kind, situation.trim(), person.trim()));
    });

  return (
    <LifetimeScreen title={t('more:lt_leadership_title', {defaultValue: 'Leadership Track'})} avoidKeyboard>
      <Text category="h9-s" status="placeholder" mb={12}>
        {t('more:lt_leadership_intro', {defaultValue: '1:1 prep, feedback scripts and difficult-conversation practice for new and aspiring managers.'})}
      </Text>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8}}>
        {KINDS.map(k => (
          <TouchableOpacity
            key={k}
            onPress={() => {
              setKind(k);
              setPrep(null);
            }}
            style={{marginRight: 8, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: kind === k ? '#7C5CFF' : 'rgba(124,92,255,0.25)', backgroundColor: kind === k ? 'rgba(124,92,255,0.12)' : 'transparent'}}>
            <Text category="h9" bold={kind === k}>
              {labels[k]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Input value={person} onChangeText={setPerson} placeholder={t('more:lt_person_placeholder', {defaultValue: 'Who is it with? (e.g. junior designer)'}).toString()} style={[{marginBottom: 10}, globalStyle.sheetInput]} />
      <Input
        multiline
        value={situation}
        onChangeText={setSituation}
        placeholder={t('more:lt_situation_placeholder', {defaultValue: 'Describe the situation or what you want to cover'}).toString()}
        textStyle={{minHeight: 90, textAlignVertical: 'top'}}
        style={[{marginBottom: 12}, globalStyle.sheetInput]}
      />
      <PrimaryButton label={t('more:lt_build', {defaultValue: 'Build my plan'})} loading={busy} disabled={!situation.trim()} onPress={build} style={{marginBottom: 12}} />
      {prep ? (
        <>
          <Card>
            <Pill label={prep.title || labels[kind]} />
            <Text category="h9" mt={10} style={{lineHeight: 22}}>
              {prep.goal}
            </Text>
          </Card>
          {prep.sections.map((s, i) => (
            <Card key={i}>
              <H>{s.heading}</H>
              <Bullets items={s.points} color="#7C5CFF" />
            </Card>
          ))}
          {prep.script ? (
            <Card style={{backgroundColor: 'rgba(124,92,255,0.12)'}}>
              <H>{t('more:lt_open_with', {defaultValue: 'How to open'})}</H>
              <Text category="h9" style={{lineHeight: 23}}>
                “{prep.script}”
              </Text>
            </Card>
          ) : null}
          {prep.avoid.length ? (
            <Card>
              <H>{t('more:lt_avoid', {defaultValue: 'Avoid'})}</H>
              <Bullets items={prep.avoid} color="#FF5FA2" />
            </Card>
          ) : null}
          <PrimaryButton
            label={t('more:lt_practice_this', {defaultValue: 'Practice this conversation'})}
            onPress={() =>
              navigation.navigate('RolePlay', {
                scenario: ROLEPLAY_FOR[kind],
                context: `${person ? 'Person: ' + person + '. ' : ''}${situation}`.slice(0, 1000),
                title: labels[kind],
              })
            }
          />
        </>
      ) : null}
    </LifetimeScreen>
  );
};

export default LeadershipTrack;
