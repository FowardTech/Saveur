import React from 'react';
import {View} from 'react-native';
import {Input} from '@ui-kitten/components';
import {RouteProp, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import {globalStyle} from 'styles/globalStyle';
import * as svc from 'services/lifetimeService';
import {LifetimeScreen, Card, H, Bullets, PrimaryButton, useAsyncAction} from './Scaffold';

type Params = {RolePlay: {scenario: string; context?: string; title?: string}};

// Rehearse a conversation with an AI playing the other person, then get feedback.
const RolePlay = () => {
  const {t} = useTranslation(['more', 'common']);
  const {params} = useRoute<RouteProp<Params, 'RolePlay'>>();
  const scenario = params?.scenario ?? 'performance_review';
  const context = params?.context ?? '';
  const {busy, run} = useAsyncAction(t);
  const [msgs, setMsgs] = React.useState<{role: 'user' | 'ai'; text: string}[]>([]);
  const [draft, setDraft] = React.useState('');
  const [feedback, setFeedback] = React.useState<svc.RoleplayFeedback | null>(null);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    run(async () => {
      const reply = await svc.roleplayReply(scenario, context, []);
      setMsgs([{role: 'ai', text: reply}]);
    });
  }, [run, scenario, context]);

  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    const next = [...msgs, {role: 'user' as const, text}];
    setMsgs(next);
    setDraft('');
    run(async () => {
      const reply = await svc.roleplayReply(scenario, context, next);
      setMsgs(prev => [...prev, {role: 'ai', text: reply}]);
    });
  };

  const finish = () =>
    run(async () => {
      setFeedback(await svc.roleplayFeedback(scenario, context, msgs));
    });

  return (
    <LifetimeScreen title={params?.title ?? t('more:lt_roleplay_title', {defaultValue: 'Practice conversation'})} avoidKeyboard>
      {feedback ? (
        <>
          <Card>
            <Text category="h3" bold>
              {feedback.score}/100
            </Text>
            <Text category="h9" mt={6} style={{lineHeight: 22}}>
              {feedback.summary}
            </Text>
            <H>{t('more:lt_strengths', {defaultValue: 'What worked'})}</H>
            <Bullets items={feedback.strengths} color="#19B87A" />
            <H>{t('more:lt_improve', {defaultValue: 'To improve'})}</H>
            <Bullets items={feedback.improvements} color="#FF8A3D" />
          </Card>
          {feedback.better_phrasing.map((b, i) => (
            <Card key={i}>
              <Text category="h10" status="placeholder">
                {t('more:lt_you_said', {defaultValue: 'You said'})}
              </Text>
              <Text category="h9-s" mt={2}>
                “{b.you_said}”
              </Text>
              <Text category="h10" status="placeholder" mt={8}>
                {t('more:lt_try_instead', {defaultValue: 'Try instead'})}
              </Text>
              <Text category="h9" bold mt={2}>
                “{b.try}”
              </Text>
            </Card>
          ))}
          <PrimaryButton
            label={t('more:lt_practice_again', {defaultValue: 'Practice again'})}
            onPress={() => {
              setFeedback(null);
              setMsgs([]);
              started.current = false;
              run(async () => setMsgs([{role: 'ai', text: await svc.roleplayReply(scenario, context, [])}]));
            }}
          />
        </>
      ) : (
        <>
          <Text category="h10" status="placeholder" mb={10}>
            {t('more:lt_roleplay_hint', {defaultValue: 'Answer as you would in real life. Tap “Finish” for feedback.'})}
          </Text>
          {msgs.map((m, i) => (
            <View key={i} style={{alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10}}>
              <View
                style={{
                  maxWidth: '88%',
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: m.role === 'user' ? '#7C5CFF' : undefined,
                  borderWidth: m.role === 'user' ? 0 : 1,
                  borderColor: 'rgba(124,92,255,0.35)',
                }}>
                <Text category="h9" style={{lineHeight: 22, color: m.role === 'user' ? '#FFFFFF' : undefined}}>
                  {m.text}
                </Text>
              </View>
            </View>
          ))}
          {busy ? (
            <Text category="h10" status="placeholder">
              {t('more:lt_thinking', {defaultValue: 'Thinking…'})}
            </Text>
          ) : null}
          <Input
            multiline
            value={draft}
            onChangeText={setDraft}
            placeholder={t('more:lt_your_reply', {defaultValue: 'Your reply…'}).toString()}
            textStyle={{minHeight: 70, textAlignVertical: 'top'}}
            style={[{marginTop: 12, marginBottom: 10}, globalStyle.sheetInput]}
          />
          <PrimaryButton label={t('more:lt_send', {defaultValue: 'Send'})} disabled={!draft.trim() || busy} onPress={send} style={{marginBottom: 8}} />
          <PrimaryButton label={t('more:lt_finish', {defaultValue: 'Finish and get feedback'})} disabled={msgs.filter(m => m.role === 'user').length < 1 || busy} onPress={finish} />
        </>
      )}
    </LifetimeScreen>
  );
};

export default RolePlay;
