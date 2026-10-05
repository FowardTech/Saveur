import React from 'react';
import {Platform, View} from 'react-native';
import {Layout, useTheme} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import SimpleMarkdown from 'components/SimpleMarkdown';

interface ProjectFile {
  path: string;
  content: string;
}
interface Stage {
  n: number;
  title: string;
  task?: string;
  status?: string;
  feedback?: {score?: number; passed?: boolean; summary?: string; strengths?: string[]; improvements?: string[]; follow_up?: string};
}
interface State {
  persona?: {name?: string; title?: string};
  industry?: string;
  role?: string;
  stages?: Stage[];
}

const Chip = ({label, bg, color}: {label: string; bg: string; color: string}) => (
  <View style={{paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: bg, marginRight: 6, marginBottom: 6}}>
    <Text category="h10" bold style={{color}}>
      {label}
    </Text>
  </View>
);

const card = {borderRadius: 20, padding: 16, marginBottom: 12} as const;

/** Shared project viewer. Practical-scenario projects (identified by their
 * _project.json state file) render as a readable report; coding projects keep
 * the plain file listing. */
const SharedProjectView = ({name, files}: {name: string; files: ProjectFile[]}) => {
  const {t} = useTranslation(['more']);
  const theme = useTheme();
  const stateFile = files.find(f => f.path === '_project.json');
  let state: State | null = null;
  if (stateFile) {
    try {
      const v = JSON.parse(stateFile.content);
      state = v && typeof v === 'object' ? v : null;
    } catch {
      state = null;
    }
  }
  const get = (p: string) => files.find(f => f.path === p)?.content ?? '';

  if (!state) {
    return (
      <Layout level="2" style={{borderRadius: 20, padding: 14}}>
        <Text category="h7" bold mb={8}>{name}</Text>
        {files.map(f => (
          <View key={f.path} style={{marginBottom: 12}}>
            <Text category="h10" bold status="link" mb={4}>{f.path}</Text>
            {f.path.endsWith('.md') ? (
              <SimpleMarkdown text={f.content} />
            ) : (
              <Text category="h10" style={{fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'}}>{f.content}</Text>
            )}
          </View>
        ))}
        <Text category="h10" status="placeholder">{t('more:share_read_only', {defaultValue: 'Read-only view.'})}</Text>
      </Layout>
    );
  }

  const stages = state.stages ?? [];
  const done = stages.filter(s => s.status === 'done').length;
  const brief = get('BRIEF.md');
  const portfolio = get('PORTFOLIO.md');

  return (
    <View>
      <View style={{borderRadius: 24, padding: 18, marginBottom: 12, backgroundColor: 'rgba(0,99,248,0.10)'}}>
        <Text category="h6" bold>{name}</Text>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', marginTop: 10}}>
          {state.industry ? <Chip label={state.industry} bg="rgba(0,99,248,0.14)" color="#0063F8" /> : null}
          {state.role ? <Chip label={state.role} bg="rgba(124,92,255,0.16)" color="#7C5CFF" /> : null}
          {stages.length ? (
            <Chip
              label={t('more:share_stages_done', {defaultValue: '{{done}} of {{total}} stages complete', done, total: stages.length})}
              bg="rgba(25,184,122,0.16)"
              color="#19B87A"
            />
          ) : null}
        </View>
        {state.persona?.name ? (
          <Text category="h9-s" status="placeholder" mt={4}>
            {t('more:share_reviewed_by', {defaultValue: 'Reviewed by'})} {state.persona.name}
            {state.persona.title ? `, ${state.persona.title}` : ''}
          </Text>
        ) : null}
      </View>

      {brief ? (
        <Layout level="2" style={card}>
          <Text category="h8" bold mb={6}>{t('more:share_project_brief', {defaultValue: 'Project brief'})}</Text>
          <SimpleMarkdown text={brief} />
        </Layout>
      ) : null}

      {stages.map(st => {
        const fb = st.feedback;
        const work = get(`STAGE_${st.n}.md`);
        const good = fb?.passed ?? (fb?.score ?? 0) >= 60;
        return (
          <Layout key={st.n} level="2" style={card}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: typeof fb?.score === 'number' ? (good ? 'rgba(25,184,122,0.18)' : 'rgba(255,138,61,0.18)') : theme['background-basic-color-3'],
                }}>
                <Text category="h8" bold style={{color: typeof fb?.score === 'number' ? (good ? '#19B87A' : '#E0701F') : theme['text-hint-color']}}>
                  {typeof fb?.score === 'number' ? fb.score : st.n}
                </Text>
              </View>
              <View style={{flex: 1, marginLeft: 12}}>
                <Text category="h10" status="placeholder">{t('more:share_stage', {defaultValue: 'STAGE {{n}}', n: st.n})}</Text>
                <Text category="h8" bold>{st.title}</Text>
              </View>
              {st.status ? (
                <Chip
                  label={st.status === 'done' ? t('more:share_status_done', {defaultValue: 'Completed'}) : t('more:share_status_progress', {defaultValue: 'In progress'})}
                  bg={st.status === 'done' ? 'rgba(25,184,122,0.16)' : 'rgba(255,138,61,0.16)'}
                  color={st.status === 'done' ? '#19B87A' : '#E0701F'}
                />
              ) : null}
            </View>
            {st.task ? <Text category="h9-s" status="placeholder" mt={10}>{st.task}</Text> : null}
            {work ? (
              <View style={{marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: theme['background-basic-color-3']}}>
                <Text category="h10" bold status="placeholder" mb={6}>{t('more:share_submitted_work', {defaultValue: 'SUBMITTED WORK'})}</Text>
                <SimpleMarkdown text={work} />
              </View>
            ) : null}
            {fb ? (
              <View style={{marginTop: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme['border-basic-color-3']}}>
                <Text category="h10" bold status="placeholder" mb={6}>{t('more:share_ai_feedback', {defaultValue: 'AI FEEDBACK'})}</Text>
                {fb.summary ? <Text category="h9-s">{fb.summary}</Text> : null}
                {fb.strengths?.length ? (
                  <View style={{marginTop: 10}}>
                    <Text category="h9" bold style={{color: '#19B87A'}}>{t('more:share_strengths', {defaultValue: 'Strengths'})}</Text>
                    {fb.strengths.map((x, i) => (
                      <View key={i} style={{flexDirection: 'row', marginTop: 3}}>
                        <Text category="h9-s" bold style={{color: '#19B87A', marginRight: 8}}>+</Text>
                        <Text category="h9-s" style={{flex: 1}}>{x}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {fb.improvements?.length ? (
                  <View style={{marginTop: 10}}>
                    <Text category="h9" bold style={{color: '#0063F8'}}>{t('more:share_improvements', {defaultValue: 'Ways to improve'})}</Text>
                    {fb.improvements.map((x, i) => (
                      <View key={i} style={{flexDirection: 'row', marginTop: 3}}>
                        <Text category="h9-s" bold style={{color: '#0063F8', marginRight: 8}}>→</Text>
                        <Text category="h9-s" style={{flex: 1}}>{x}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {fb.follow_up ? (
                  <View style={{marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: 'rgba(0,99,248,0.10)'}}>
                    <Text category="h9-s" bold>“{fb.follow_up}”</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </Layout>
        );
      })}

      {portfolio ? (
        <Layout level="2" style={card}>
          <Text category="h8" bold mb={6}>{t('more:share_portfolio', {defaultValue: 'Portfolio write-up'})}</Text>
          <SimpleMarkdown text={portfolio} />
        </Layout>
      ) : null}
      <Text category="h10" status="placeholder">{t('more:share_read_only', {defaultValue: 'Read-only view.'})}</Text>
    </View>
  );
};

export default SharedProjectView;
