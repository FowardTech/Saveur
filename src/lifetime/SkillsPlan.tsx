import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import {Icon, Input} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import {globalStyle} from 'styles/globalStyle';
import * as svc from 'services/lifetimeService';
import {LifetimeScreen, Card, H, Loading, PrimaryButton, Pill, useAsyncAction} from './Scaffold';

const SkillsPlan = () => {
  const {t} = useTranslation(['more', 'common']);
  const {busy, run} = useAsyncAction(t);
  const [plan, setPlan] = React.useState<svc.SkillPlan | null | undefined>(undefined);
  const [target, setTarget] = React.useState('');
  const [current, setCurrent] = React.useState('');
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    svc.getSkillPlan().then(setPlan).catch(() => setPlan(null));
  }, []);

  const typeLabel = (k: string) =>
    k === 'cert'
      ? t('more:lt_ms_cert', {defaultValue: 'Certification'})
      : k === 'project'
      ? t('more:lt_ms_project', {defaultValue: 'Project'})
      : k === 'network'
      ? t('more:lt_ms_network', {defaultValue: 'Networking'})
      : t('more:lt_ms_skill', {defaultValue: 'Skill'});

  const build = () =>
    run(async () => {
      setPlan(await svc.buildSkillPlan(target.trim(), current.trim(), 24));
      setEditing(false);
    });
  const toggle = (id: string, done: boolean) =>
    run(async () => {
      setPlan(await svc.setMilestone(id, done));
    });

  const form = (
    <Card>
      <Text category="h8" bold mb={8}>
        {t('more:lt_skills_form_title', {defaultValue: 'Which role do you want next?'})}
      </Text>
      <Input
        value={current}
        onChangeText={setCurrent}
        placeholder={String(t('more:lt_current_role', {defaultValue: 'Your current role'}))}
        style={[{marginBottom: 10}, globalStyle.sheetInput]}
      />
      <Input
        value={target}
        onChangeText={setTarget}
        placeholder={String(t('more:lt_target_role', {defaultValue: 'Target role (e.g. Engineering Manager)'}))}
        style={[{marginBottom: 12}, globalStyle.sheetInput]}
      />
      <PrimaryButton label={t('more:lt_skills_build', {defaultValue: 'Build my roadmap'})} loading={busy} disabled={!target.trim()} onPress={build} />
    </Card>
  );

  return (
    <LifetimeScreen title={t('more:lt_skills_title', {defaultValue: 'Skills & Certifications'})} avoidKeyboard>
      {plan === undefined ? (
        <Loading />
      ) : !plan || editing ? (
        form
      ) : (
        <>
          <Card>
            <Pill label={`${plan.current_role || t('more:lt_today', {defaultValue: 'Today'})} → ${plan.target_role}`} />
            <Text category="h9" mt={10} style={{lineHeight: 22}}>
              {plan.gap_summary}
            </Text>
            <TouchableOpacity onPress={() => setEditing(true)} style={{marginTop: 10}}>
              <Text category="h9" status="primary" bold>
                {t('more:lt_new_plan', {defaultValue: 'Plan for a different role'})}
              </Text>
            </TouchableOpacity>
          </Card>
          <H>{t('more:lt_milestones', {defaultValue: 'Milestones & reminders'})}</H>
          {plan.milestones.map(m => (
            <TouchableOpacity key={m.id} activeOpacity={0.7} onPress={() => toggle(m.id, !m.done)}>
              <Card style={{flexDirection: 'row', alignItems: 'center'}}>
                <Icon
                  pack="eva"
                  name={m.done ? 'checkmark-circle-2' : 'radio-button-off-outline'}
                  style={[globalStyle.icon24, {tintColor: m.done ? '#19B87A' : '#7C5CFF'}]}
                />
                <View style={{flex: 1, marginLeft: 12}}>
                  <Text category="h9" bold style={{textDecorationLine: m.done ? 'line-through' : 'none'}}>
                    {m.title}
                  </Text>
                  <Text category="h10" status="placeholder">
                    {t('more:lt_due_date', {defaultValue: 'Due {{date}}', date: m.due})} · {typeLabel(m.type)}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
          <H>{t('more:lt_skills_to_build', {defaultValue: 'Skills to build'})}</H>
          {plan.skills.map((s, i) => (
            <Card key={i}>
              <Text category="h9" bold>
                {s.name}
              </Text>
              <Text category="h9-s" status="placeholder" mt={2}>
                {s.why}
              </Text>
            </Card>
          ))}
          {plan.certifications.length ? (
            <>
              <H>{t('more:lt_certs', {defaultValue: 'Certifications worth considering'})}</H>
              {plan.certifications.map((c, i) => (
                <Card key={i}>
                  <Text category="h9" bold>
                    {c.name}
                  </Text>
                  <Text category="h10" status="placeholder">
                    {c.provider}
                    {c.est_weeks ? ` · ~${c.est_weeks} ${t('more:lt_weeks', {defaultValue: 'weeks'})}` : ''}
                  </Text>
                  <Text category="h9-s" mt={4}>
                    {c.why}
                  </Text>
                </Card>
              ))}
            </>
          ) : null}
        </>
      )}
    </LifetimeScreen>
  );
};

export default SkillsPlan;
