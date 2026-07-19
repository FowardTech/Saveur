import React, { memo } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Input,
  Button,
  Layout,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { CodingInterviewScreenNavigationProp, RootStackParamList } from 'navigation/types';
import * as interviewService from 'services/interviewService';
import * as codingService from 'services/codingService';
import { CodingLanguage, RunResult, TestRunResult } from 'services/codingService';

// Real coding-interview screen: a plain text area stands in for a real
// syntax-highlighted code editor (TODO: integrate a real code editor, e.g.
// Monaco / CodeMirror via WebView), but "Run" / "Run Tests" / "Get AI Code
// Review" all now hit the real Judge0-backed sandbox via services/codingService.ts
// instead of returning mocked results.
const CodingInterview = memo(() => {
  const { goBack, navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<CodingInterviewScreenNavigationProp>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);

  const { sessionId, interviewType } = route.params ?? {};

  const [languages, setLanguages] = React.useState<CodingLanguage[]>(codingService.DEFAULT_LANGUAGES);
  const [languagesLoading, setLanguagesLoading] = React.useState(true);
  const [languagesError, setLanguagesError] = React.useState<string | null>(null);
  const [language, setLanguage] = React.useState<CodingLanguage>(codingService.DEFAULT_LANGUAGES[0]);
  const [code, setCode] = React.useState(codingService.DEFAULT_LANGUAGES[0].starterCode ?? '');
  const [stdin, setStdin] = React.useState('');

  const [running, setRunning] = React.useState(false);
  const [runResult, setRunResult] = React.useState<RunResult | null>(null);

  const [runningTests, setRunningTests] = React.useState(false);
  const [testResults, setTestResults] = React.useState<TestRunResult[] | null>(null);

  const [isFinishing, setIsFinishing] = React.useState(false);
  const [isReviewing, setIsReviewing] = React.useState(false);
  const [review, setReview] = React.useState<{ complexityNote: string; feedback: string[] } | null>(null);

  const problemStatement = `${t('find:coding_prompt_title')}\n\n${t('find:coding_prompt_description')}`;

  const loadLanguages = React.useCallback(async () => {
    setLanguagesLoading(true);
    setLanguagesError(null);
    try {
      const list = await codingService.getLanguages();
      setLanguages(list);
      if (list.length) {
        setLanguage(list[0]);
        setCode(list[0].starterCode ?? '');
      }
    } catch (e: any) {
      // getLanguages() already falls back to a cached/default list internally
      // and shouldn't normally throw — this is a last-resort guard.
      setLanguagesError(e?.message ?? 'Could not load supported languages.');
    } finally {
      setLanguagesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadLanguages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSelectLanguage = (lang: CodingLanguage) => {
    setLanguage(lang);
    setCode(lang.starterCode ?? '');
    setRunResult(null);
    setTestResults(null);
    setReview(null);
  };

  const onRun = async () => {
    if (running) return;
    setRunning(true);
    setRunResult(null);
    try {
      const result = await codingService.runCode(language.id, code, stdin || undefined);
      setRunResult(result);
    } catch (e: any) {
      Alert.alert(
        t('find:run_failed', { defaultValue: 'Run failed' }),
        e?.message ?? 'Could not run your code. Please try again.',
      );
    } finally {
      setRunning(false);
    }
  };

  const onRunTests = async () => {
    if (runningTests) return;
    setRunningTests(true);
    setTestResults(null);
    try {
      const { results } = await codingService.runTests(language.id, code);
      setTestResults(results);
    } catch (e: any) {
      Alert.alert(
        t('find:run_tests_failed', { defaultValue: 'Run tests failed' }),
        e?.message ?? 'Could not run your test cases. Please try again.',
      );
    } finally {
      setRunningTests(false);
    }
  };

  const onGetCodeReview = async () => {
    if (isReviewing) return;
    setIsReviewing(true);
    try {
      const result = await codingService.getCodeReview(code, language.id, problemStatement);
      setReview(result);
    } catch (e: any) {
      Alert.alert(
        t('find:review_failed', { defaultValue: 'Review failed' }),
        e?.message ?? 'Could not get an AI code review. Please try again.',
      );
    } finally {
      setIsReviewing(false);
    }
  };

  const onFinish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      if (sessionId) {
        try {
          await interviewService.completeSession(sessionId);
        } catch (e: any) {
          // Same pattern as LiveInterviewSession.tsx: the coding work itself
          // already happened locally, so don't strand the user on this
          // screen over a sync failure — warn and still move on to
          // InterviewFeedback, which may just show partial/stale feedback.
          Alert.alert(
            t('find:finish_interview_sync_failed', { defaultValue: 'Could not sync interview' }),
            e?.message ?? 'Your session ended locally but we could not reach the server to finalize it. Your feedback may be incomplete.',
          );
        }
      }
    } finally {
      setIsFinishing(false);
      navigate('InterviewFeedback', { sessionId, interviewType });
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:coding_interview')}
        accessoryLeft={<NavigationAction onPress={goBack} />}
        accessoryRight={<NavigationAction icon="edit_full" onPress={() => navigate('SystemDesignWhiteboard')} />}
      />
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h7" bold mb={8}>
          {t('find:coding_prompt_title')}
        </Text>
        <Text category="h9-s" status="placeholder" mb={24}>
          {t('find:coding_prompt_description')}
        </Text>

        <Text category="h8" bold status="placeholder" mb={12}>
          {t('find:language')}
        </Text>
        {languagesLoading ? (
          <Flex justify="flex-start" itemsCenter mb={24}>
            <Spinner size="small" />
            <Text category="h9-s" status="placeholder" ml={8}>
              {t('find:loading_languages', { defaultValue: 'Loading languages…' })}
            </Text>
          </Flex>
        ) : (
          <>
            <Flex justify="flex-start" wrap mb={languagesError ? 8 : 24}>
              {languages.map(lang => {
                const active = lang.id === language.id;
                return (
                  <TouchableOpacity
                    key={lang.id}
                    activeOpacity={0.7}
                    onPress={() => onSelectLanguage(lang)}
                    style={[
                      styles.langChip,
                      {
                        backgroundColor: active ? theme['color-primary-500'] : theme['background-basic-color-2'],
                      },
                    ]}>
                    <Text category="h9" bold status={active ? 'control' : 'basic'}>
                      {lang.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </Flex>
            {languagesError ? (
              <Text category="h10" status="danger" mb={16}>
                {t('find:load_languages_failed', {
                  defaultValue: 'Using a default language list — could not reach the server.',
                })}
              </Text>
            ) : null}
          </>
        )}

        <Layout level="3" style={styles.editorWrap}>
          <Input
            multiline
            textStyle={styles.editorText}
            style={styles.editorInput}
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Layout>

        <Text category="h8" bold status="placeholder" mt={24} mb={8}>
          {t('find:stdin_optional', { defaultValue: 'Input (stdin) — optional' })}
        </Text>
        <Layout level="3" style={styles.stdinWrap}>
          <Input
            multiline
            textStyle={styles.stdinText}
            style={styles.editorInput}
            value={stdin}
            onChangeText={setStdin}
            placeholder={t('find:stdin_placeholder', { defaultValue: 'Anything your program reads from stdin' }).toString()}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Layout>
        <Button
          children={running ? t('find:running', { defaultValue: 'Running…' }) : t('find:run', { defaultValue: 'Run' })}
          disabled={running}
          status="basic"
          onPress={onRun}
          accessoryLeft={props => <Icon {...props} pack="assets" name="edit_full" />}
          style={{ marginTop: 12 }}
        />
        {runResult ? (
          <Layout level="2" style={styles.resultBox}>
            <Text category="h9" bold status={runResult.stderr ? 'danger' : 'success'} mb={8}>
              {runResult.status ?? (runResult.stderr ? 'Error' : 'Success')}
            </Text>
            {runResult.stdout ? (
              <>
                <Text category="h10" status="placeholder">{t('find:stdout', { defaultValue: 'Output' })}</Text>
                <Text category="h9-s" mb={runResult.stderr ? 8 : 0} style={styles.mono}>{runResult.stdout}</Text>
              </>
            ) : null}
            {runResult.stderr ? (
              <>
                <Text category="h10" status="placeholder">{t('find:stderr', { defaultValue: 'Errors' })}</Text>
                <Text category="h9-s" status="danger" style={styles.mono}>{runResult.stderr}</Text>
              </>
            ) : null}
            {!runResult.stdout && !runResult.stderr ? (
              <Text category="h9-s" status="placeholder">{t('find:no_output', { defaultValue: '(no output)' })}</Text>
            ) : null}
          </Layout>
        ) : null}

        <Text category="h8" bold status="placeholder" mt={24} mb={12}>
          {t('find:test_cases', { defaultValue: 'Test Cases' })}
        </Text>
        {codingService.TEST_CASES.map((tc, i) => {
          const outcome = testResults?.[i];
          return (
            <Layout key={i} level="2" style={styles.testCaseRow}>
              <View style={globalStyle.flexOne}>
                <Text category="h10" status="placeholder">Input</Text>
                <Text category="h9-s" mb={6}>{tc.input}</Text>
                <Text category="h10" status="placeholder">Expected Output</Text>
                <Text category="h9-s">{tc.expectedOutput}</Text>
                {outcome?.actualOutput ? (
                  <>
                    <Text category="h10" status="placeholder" mt={6}>Actual Output</Text>
                    <Text category="h9-s">{outcome.actualOutput}</Text>
                  </>
                ) : null}
              </View>
              {outcome ? (
                <View style={[styles.testBadge, { backgroundColor: outcome.passed ? theme['color-success-500'] : theme['color-danger-500'] }]}>
                  <Text category="h10" bold status="control">
                    {outcome.passed ? 'PASS' : 'FAIL'}
                  </Text>
                </View>
              ) : null}
            </Layout>
          );
        })}
        <Button
          children={runningTests ? t('find:running_tests') : t('find:run_tests')}
          disabled={runningTests}
          onPress={onRunTests}
          accessoryLeft={props => <Icon {...props} pack="assets" name="edit_full" />}
          style={{ marginTop: 8 }}
        />
        {testResults ? (
          <Layout level="2" style={styles.resultBox}>
            <Text category="h8" bold status={testResults.every(r => r.passed) ? 'success' : 'warning'}>
              {testResults.filter(r => r.passed).length} / {testResults.length} test cases passed
            </Text>
          </Layout>
        ) : null}

        <Button
          children={isReviewing ? t('find:reviewing_code', { defaultValue: 'Reviewing…' }) : t('find:get_ai_code_review', { defaultValue: 'Get AI Code Review' })}
          disabled={isReviewing}
          status="info"
          onPress={onGetCodeReview}
          accessoryLeft={props => <Icon {...props} pack="assets" name="quote" />}
          style={{ marginTop: 16 }}
        />
        {review ? (
          <Layout level="2" style={styles.reviewBox}>
            <Text category="h9" bold status="link" mb={8}>
              {review.complexityNote}
            </Text>
            {review.feedback.map((line, i) => (
              <Flex key={i} justify="flex-start" itemsCenter mt={i === 0 ? 0 : 8}>
                <Icon pack="assets" name="quote" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
                <Text category="h9-s" ml={10} style={globalStyle.flexOne}>{line}</Text>
              </Flex>
            ))}
          </Layout>
        ) : null}

        <Button
          children={isFinishing ? t('find:finishing', { defaultValue: 'Finishing…' }) : t('find:finish_interview', { defaultValue: 'Finish Interview' })}
          disabled={isFinishing}
          status="success"
          onPress={onFinish}
          style={[globalStyle.shadowBtn, { marginTop: 16 }]}
        />
      </Content>
    </Container>
  );
});

export default CodingInterview;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  langChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 99,
    marginRight: 8,
    marginBottom: 8,
  },
  editorWrap: {
    borderRadius: 16,
    padding: 8,
    minHeight: 220,
  },
  editorInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  editorText: {
    fontFamily: 'GothamPro',
    fontSize: 13,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  stdinWrap: {
    borderRadius: 16,
    padding: 8,
    minHeight: 60,
  },
  stdinText: {
    fontFamily: 'GothamPro',
    fontSize: 13,
    minHeight: 52,
    textAlignVertical: 'top',
  },
  mono: {
    fontFamily: 'GothamPro',
  },
  resultBox: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  testCaseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  testBadge: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginLeft: 12,
  },
  reviewBox: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
});
