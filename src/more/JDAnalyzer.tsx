import React, { memo } from 'react';
import { View, Alert } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Input,
  Button,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import ProgressCard from 'src/find/Component/ProgressCard';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as jdService from 'services/jdService';
import { JDAnalysisResult } from 'services/jdService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';

// Job-description analyzer: paste a JD, get a match score + gap analysis via
// jdService, which calls POST /jd/analyze and POST /jd/match in parallel and
// merges them (see services/jdService.ts).
const JDAnalyzer = memo(() => {
  const { goBack, navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const { isPro } = React.useContext(AuthContext);

  const [jd, setJd] = React.useState('');
  const [result, setResult] = React.useState<JDAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  const onAnalyze = async () => {
    if (!jd.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const analysis = await jdService.analyzeJobDescription(jd);
      setResult(analysis);
    } catch (e: any) {
      Alert.alert(
        t('more:analysis_failed', { defaultValue: 'Analysis failed' }),
        e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isPro) {
    return (
      <ProLockGate
        title={t('more:jd_analyzer', { defaultValue: 'JD Analyzer' })}
        description={t('more:jd_analyzer_pro_gate_description', {
          defaultValue: "Paste a job description and see how your resume stacks up, with a matching resume generated for you — JD Analyzer is a Pro feature.",
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:jd_analyzer', { defaultValue: 'JD Analyzer' })}
        accessoryLeft={<NavigationAction onPress={goBack} />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h8" bold status="placeholder" mb={12}>
          {t('more:paste_job_description', { defaultValue: 'Paste a job description' })}
        </Text>
        <Input
          multiline
          scrollEnabled
          textStyle={styles.jdText}
          style={styles.jdInput}
          value={jd}
          onChangeText={setJd}
        />
        <Button
          children={
            isAnalyzing
              ? t('more:analyzing', { defaultValue: 'Analyzing…' })
              : t('more:analyze', { defaultValue: 'Analyze Match' })
          }
          onPress={onAnalyze}
          disabled={isAnalyzing || !jd.trim()}
          style={[globalStyle.shadowBtn, { marginTop: 24 }]}
        />

        {result ? (
          <>
            <Flex center vertical mt={40} mb={24}>
              <ProgressCard
                title={t('more:match_score', { defaultValue: 'Match Score' })}
                progress={result.score}
                d={140}
                strokeWidth={10}
                stokeColor={theme['background-basic-color-3']}
                progressStokeColor={
                  result.score >= 75
                    ? theme['color-success-500']
                    : result.score >= 50
                    ? theme['color-warning-500']
                    : theme['color-danger-500']
                }
              />
            </Flex>

            <Text category="h6" bold mb={16}>
              {t('more:missing_skills', { defaultValue: 'Missing Skills' })}
            </Text>
            <View style={styles.chipsWrap}>
              {result.missingSkills.map((skill, i) => (
                <View key={i} style={[styles.chip, { backgroundColor: theme['color-danger-transparent-200'] }]}>
                  <Text category="h9" status="danger" bold>
                    {skill}
                  </Text>
                </View>
              ))}
            </View>

            <Text category="h6" bold mt={24} mb={16}>
              {t('more:keyword_suggestions', { defaultValue: 'Keyword Suggestions' })}
            </Text>
            <View style={styles.chipsWrap}>
              {result.keywordSuggestions.map((word, i) => (
                <View key={i} style={[styles.chip, { backgroundColor: theme['color-success-transparent-200'] }]}>
                  <Text category="h9" status="success" bold>
                    {word}
                  </Text>
                </View>
              ))}
            </View>

            <Flex level="2" style={styles.buildResumeCard} vertical justify="flex-start" mt={32}>
              <Text category="h7" bold mb={4}>
                {t('more:build_matching_resume_title', { defaultValue: 'Want a resume tailored to this job?' })}
              </Text>
              <Text category="h9-s" status="placeholder" mb={16}>
                {t('more:build_matching_resume_description', {
                  defaultValue: "We'll draft a resume around this job's keywords and skills, ready to download.",
                })}
              </Text>
              <Button
                children={t('more:build_matching_resume_cta', { defaultValue: 'Build Resume' })}
                onPress={() =>
                  navigate('GenerateResume', {
                    keywordSuggestions: result.keywordSuggestions,
                    missingSkills: result.missingSkills,
                    jdText: jd,
                  })
                }
              />
            </Flex>
          </>
        ) : null}
      </Content>
    </Container>
  );
});

export default JDAnalyzer;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  jdInput: {
    borderRadius: 16,
    backgroundColor: 'background-basic-color-2',
    // Fixed height (not minHeight) so pasting a long job description makes
    // the text scroll inside the box instead of pushing the box itself
    // (and everything below it, including the Analyze button) further down
    // the screen every keystroke. A fixed height alone doesn't actually
    // clip a multiline TextInput's content though -- without
    // `scrollEnabled` on the Input (above) and `overflow: 'hidden'` here,
    // the text just kept rendering past the box's bottom edge instead of
    // scrolling inside it, which is what was actually happening before.
    height: 160,
    overflow: 'hidden',
  },
  jdText: {
    height: '100%',
    textAlignVertical: 'top',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 99,
    marginRight: 8,
    marginBottom: 8,
  },
  buildResumeCard: {
    borderRadius: 20,
    padding: 20,
  },
});
