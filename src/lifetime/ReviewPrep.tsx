import React from 'react';
import {Share, TouchableOpacity, View} from 'react-native';
import {Input} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import {globalStyle} from 'styles/globalStyle';
import * as svc from 'services/lifetimeService';
import {LifetimeScreen, Card, H, Bullets, Loading, PrimaryButton, Pill, useAsyncAction} from './Scaffold';

const ReviewPrep = () => {
  const {t} = useTranslation(['more', 'common']);
  const navigation = useNavigation<NavigationProp<any>>();
  const {busy, run} = useAsyncAction(t);
  const [kind, setKind] = React.useState<'performance_review' | 'promotion'>('performance_review');
  const [role, setRole] = React.useState('');
  const [target, setTarget] = React.useState('');
  const [prep, setPrep] = React.useState<svc.ReviewPrep | null | undefined>(undefined);

  React.useEffect(() => {
    svc.getReviewPrep().then(setPrep).catch(() => setPrep(null));
  }, []);

  const build = () =>
    run(async () => {
      setPrep(await svc.buildReviewPrep(kind, role.trim(), target.trim()));
    });

  const rehearse = () =>
    navigation.navigate('RolePlay', {
      scenario: kind === 'promotion' ? 'promotion_ask' : 'performance_review',
      context: `${role ? 'My role: ' + role + '. ' : ''}${target ? 'Target: ' + target + '. ' : ''}${prep?.talking_points?.join(' ') ?? ''}`.slice(0, 1000),
      title: t('more:lt_rehearse_manager', {defaultValue: 'Rehearse with your manager'}),
    });

  return (
    <LifetimeScreen title={t('more:lt_review_title', {defaultValue: 'Review & Promotion Prep'})} avoidKeyboard>
      <Text category="h9-s" status="placeholder" mb={12}>
        {t('more:lt_review_intro', {defaultValue: 'Gathers your evidence, drafts your self-review and lets you rehearse the conversation with your manager.'})}
      </Text>
      <View style={{flexDirection: 'row', marginBottom: 12}}>
        {(['performance_review', 'promotion'] as const).map(k => (
          <TouchableOpacity
            key={k}
            onPress={() => setKind(k)}
            style={{marginRight: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: kind === k ? '#7C5CFF' : 'rgba(124,92,255,0.25)', backgroundColor: kind === k ? 'rgba(124,92,255,0.12)' : 'transparent'}}>
            <Text category="h9" bold={kind === k}>
              {k === 'promotion' ? t('more:lt_kind_promotion', {defaultValue: 'Promotion'}) : t('more:lt_kind_review', {defaultValue: 'Performance review'})}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Input value={role} onChangeText={setRole} placeholder={t('more:lt_current_role', {defaultValue: 'Your current role'}).toString()} style={[{marginBottom: 10}, globalStyle.sheetInput]} />
      {kind === 'promotion' ? (
        <Input value={target} onChangeText={setTarget} placeholder={t('more:lt_target_role_optional', {defaultValue: 'Role you are aiming for'}).toString()} style={[{marginBottom: 10}, globalStyle.sheetInput]} />
      ) : null}
      <PrimaryButton label={t('more:lt_build_prep', {defaultValue: 'Build my prep'})} loading={busy} onPress={build} style={{marginBottom: 12}} />
      {prep === undefined ? (
        <Loading />
      ) : prep ? (
        <>
          <Card>
            <Pill label={t('more:lt_self_review', {defaultValue: 'Self-review draft'})} />
            <Text category="h9" mt={10} style={{lineHeight: 23}}>
              {prep.self_review}
            </Text>
            <TouchableOpacity onPress={() => Share.share({message: prep.self_review})} style={{marginTop: 10}}>
              <Text category="h9" status="link" bold>
                {t('more:lt_share', {defaultValue: 'Share / copy'})}
              </Text>
            </TouchableOpacity>
          </Card>
          {prep.evidence.length ? (
            <Card>
              <H>{t('more:lt_evidence', {defaultValue: 'Your evidence'})}</H>
              {prep.evidence.map((e, i) => (
                <View key={i} style={{marginTop: 8}}>
                  <Text category="h9" bold>
                    {e.claim}
                  </Text>
                  <Text category="h9-s" status="placeholder">
                    {e.proof}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}
          <Card>
            <H>{t('more:lt_talking_points', {defaultValue: 'Talking points'})}</H>
            <Bullets items={prep.talking_points} color="#7C5CFF" />
            {prep.ask ? (
              <Text category="h9" bold mt={12}>
                {t('more:lt_the_ask', {defaultValue: 'Your ask'})}: <Text category="h9-s">{prep.ask}</Text>
              </Text>
            ) : null}
          </Card>
          {prep.likely_questions.length ? (
            <Card>
              <H>{t('more:lt_likely_questions', {defaultValue: 'Questions to expect'})}</H>
              {prep.likely_questions.map((q, i) => (
                <View key={i} style={{marginTop: 8}}>
                  <Text category="h9" bold>
                    {q.question}
                  </Text>
                  <Text category="h9-s" status="placeholder">
                    {q.tip}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}
          {prep.gaps.length ? (
            <Card>
              <H>{t('more:lt_gaps', {defaultValue: 'Evidence still to collect'})}</H>
              <Bullets items={prep.gaps} color="#FF8A3D" />
            </Card>
          ) : null}
          <PrimaryButton label={t('more:lt_rehearse_manager', {defaultValue: 'Rehearse with your manager'})} onPress={rehearse} />
        </>
      ) : null}
    </LifetimeScreen>
  );
};

export default ReviewPrep;
