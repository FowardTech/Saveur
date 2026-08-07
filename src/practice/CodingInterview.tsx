import React, { memo } from 'react';
import { Alert, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
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
import { renderCenteredLabel } from 'utils/buttonLabel';
import { CodingInterviewScreenNavigationProp, RootStackParamList } from 'navigation/types';
import * as interviewService from 'services/interviewService';
import * as codingService from 'services/codingService';
import { CodingLanguage, RunResult, TestRunResult } from 'services/codingService';
import CtaButton from 'components/CtaButton';

// Cross-platform monospace — no monospace font asset is bundled in this app
// (only the PlusJakartaSans family — see components/Text.tsx), but both
// OSes ship a real fixed-width system font under these names.
const MONO_FONT = Platform.select({ios: 'Courier New', android: 'monospace', default: 'monospace'});
const EDITOR_DOT_COLORS = ['#FF5F56', '#FFBD2E', '#27C93F'];

// Dark "editor window" title bar (product report: the Code Practice editor
// "should look like a code editor design") — same 3-traffic-light-dots +
// label chrome as components/CodeBlock.tsx (the read-only version used for
// lesson code snippets), reimplemented locally here since this screen wraps
// an editable <Input> rather than static text.
function EditorTitleBar({ label }: { label: string }) {
  return (
    <View style={editorChromeStyles.header}>
      <View style={{ flexDirection: 'row' }}>
        {EDITOR_DOT_COLORS.map((c, i) => (
          <View key={c} style={[editorChromeStyles.dot, i > 0 && { marginLeft: 6 }, { backgroundColor: c }]} />
        ))}
      </View>
      <Text category="h10" style={{ color: '#8B8BA7', marginLeft: 12, fontFamily: MONO_FONT }}>
        {label}
      </Text>
    </View>
  );
}

// "AI-graded" disclosure (product context: Judge0 isn't subscribed right
// now, so results come from AI validation instead of a real sandboxed run
// — see Saveur-Backend's app/api/coding.py's _active_provider() and
// app/services/code_validator_service.py). Shown whenever a result's
// `engine` says "ai", so a user never mistakes a predicted result for a
// real execution.
function AiGradedBadge() {
  const { t } = useTranslation(['find', 'common']);
  return (
    <View style={editorChromeStyles.aiBadge}>
      <Icon pack="eva" name="activity-outline" style={[globalStyle.icon16, { tintColor: '#8B5CF6' }]} />
      <Text category="h10" bold style={{ color: '#8B5CF6', marginLeft: 6 }}>
        {t('find:ai_graded', { defaultValue: 'AI-graded — Judge0 not connected yet' })}
      </Text>
    </View>
  );
}

// Real coding-interview screen: "Run" / "Run Tests" / "Get AI Code Review"
// hit the real Judge0-backed sandbox when it's configured (services/
// codingService.ts), or fall back to AI validation automatically
// otherwise — see AiGradedBadge above.
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
  const [testEngine, setTestEngine] = React.useState<'judge0' | 'ai' | undefined>(undefined);

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
      setLanguagesError(e?.message ?? t('find:load_languages_generic_failed', {defaultValue: 'Could not load supported languages.'}));
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
    setTestEngine(undefined);
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
        e?.message ?? t('find:run_code_failed_body', { defaultValue: 'Could not run your code. Please try again.' }),
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
      const { results, engine } = await codingService.runTests(language.id, code);
      setTestResults(results);
      setTestEngine(engine);
    } catch (e: any) {
      Alert.alert(
        t('find:run_tests_failed', { defaultValue: 'Run tests failed' }),
        e?.message ?? t('find:run_tests_failed_body', { defaultValue: 'Could not run your test cases. Please try again.' }),
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
        e?.message ?? t('find:review_failed_body', { defaultValue: 'Could not get an AI code review. Please try again.' }),
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
            e?.message ?? t('find:finish_interview_sync_failed_body', { defaultValue: 'Your session ended locally but we could not reach the server to finalize it. Your feedback may be incomplete.' }),
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
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
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

        <View style={editorChromeStyles.window}>
          <EditorTitleBar label={language.name} />
          <Input
            multiline
            textStyle={styles.editorText}
            style={styles.editorInput}
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor="#6B6B85"
          />
        </View>

        <Text category="h8" bold status="placeholder" mt={24} mb={8}>
          {t('find:stdin_optional', { defaultValue: 'Input (stdin) — optional' })}
        </Text>
        <View style={editorChromeStyles.window}>
          <EditorTitleBar label="stdin" />
          <Input
            multiline
            textStyle={styles.stdinText}
            style={styles.editorInput}
            value={stdin}
            onChangeText={setStdin}
            placeholder={t('find:stdin_placeholder', { defaultValue: 'Anything your program reads from stdin' }).toString()}
            placeholderTextColor="#6B6B85"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Button
          children={running ? t('find:running', { defaultValue: 'Running…' }) : t('find:run', { defaultValue: 'Run' })}
          disabled={running}
          status="basic"
          onPress={onRun}
          accessoryLeft={props => <Icon {...props} pack="assets" name="edit_full" />}
          style={{ marginTop: 12 }}
        />
        {runResult ? (
          <View style={editorChromeStyles.window}>
            <EditorTitleBar label={t('find:stdout', { defaultValue: 'output' }).toString()} />
            <View style={{ padding: 14 }}>
              {runResult.engine === 'ai' ? <AiGradedBadge /> : null}
              <Text
                category="h9"
                bold
                style={{ color: runResult.stderr ? '#FF6B6B' : '#5FE38E', fontFamily: MONO_FONT, marginTop: runResult.engine === 'ai' ? 10 : 0 }}
                mb={8}>
                {runResult.status ?? (runResult.stderr ? t('find:error_status', { defaultValue: 'Error' }) : t('find:success_status', { defaultValue: 'Success' }))}
              </Text>
              {runResult.stdout ? (
                <>
                  <Text category="h10" style={{ color: '#8B8BA7', fontFamily: MONO_FONT }}>{t('find:stdout', { defaultValue: 'Output' })}</Text>
                  <Text category="h9-s" mb={runResult.stderr ? 8 : 0} style={{ color: '#E4E4F0', fontFamily: MONO_FONT }}>{runResult.stdout}</Text>
                </>
              ) : null}
              {runResult.stderr ? (
                <>
                  <Text category="h10" style={{ color: '#8B8BA7', fontFamily: MONO_FONT }}>{t('find:stderr', { defaultValue: 'Errors' })}</Text>
                  <Text category="h9-s" style={{ color: '#FF6B6B', fontFamily: MONO_FONT }}>{runResult.stderr}</Text>
                </>
              ) : null}
              {!runResult.stdout && !runResult.stderr ? (
                <Text category="h9-s" style={{ color: '#8B8BA7', fontFamily: MONO_FONT }}>{t('find:no_output', { defaultValue: '(no output)' })}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <Text category="h8" bold status="placeholder" mt={24} mb={12}>
          {t('find:test_cases', { defaultValue: 'Test Cases' })}
        </Text>
        {codingService.TEST_CASES.map((tc, i) => {
          const outcome = testResults?.[i];
          return (
            <Layout key={i} level="2" style={styles.testCaseRow}>
              <View style={globalStyle.flexOne}>
                <Text category="h10" status="placeholder">{t('find:coding_input_label', { defaultValue: 'Input' })}</Text>
                <Text category="h9-s" mb={6}>{tc.input}</Text>
                <Text category="h10" status="placeholder">{t('find:expected_output', { defaultValue: 'Expected Output' })}</Text>
                <Text category="h9-s">{tc.expectedOutput}</Text>
                {outcome?.actualOutput ? (
                  <>
                    <Text category="h10" status="placeholder" mt={6}>{t('find:actual_output', { defaultValue: 'Actual Output' })}</Text>
                    <Text category="h9-s">{outcome.actualOutput}</Text>
                  </>
                ) : null}
              </View>
              {outcome ? (
                <View style={[styles.testBadge, { backgroundColor: outcome.passed ? theme['color-success-500'] : theme['color-danger-500'] }]}>
                  <Text category="h10" bold status="control">
                    {outcome.passed ? t('find:pass_badge', { defaultValue: 'PASS' }) : t('find:fail_badge', { defaultValue: 'FAIL' })}
                  </Text>
                </View>
              ) : null}
            </Layout>
          );
        })}
        <CtaButton
          children={renderCenteredLabel(
            runningTests ? t('find:running_tests') : t('find:run_tests'),
            {stretch: false},
          )}
          disabled={runningTests}
          onPress={onRunTests}
          accessoryLeft={props => <Icon {...props} pack="assets" name="edit_full" />}
          style={{ marginTop: 8 }}
        />
        {testResults ? (
          <Layout level="2" style={styles.resultBox}>
            {testEngine === 'ai' ? <AiGradedBadge /> : null}
            <Text category="h8" bold status={testResults.every(r => r.passed) ? 'success' : 'warning'} mt={testEngine === 'ai' ? 10 : 0}>
              {t('find:test_cases_passed', {
                defaultValue: `${testResults.filter(r => r.passed).length} / ${testResults.length} test cases passed`,
                passed: testResults.filter(r => r.passed).length,
                total: testResults.length,
              })}
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
                <Icon pack="assets" name="quote" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
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
  editorInput: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  // Product report: "in the code practice too it should look like a code
  // editor design" — dark background + light monospace text (was the
  // app's plain sans-serif brand font on the default card color), matching
  // components/CodeBlock.tsx's read-only lesson-code treatment. Color
  // literals (not theme tokens) deliberately — a code editor reads as a
  // code editor because it's ALWAYS dark, independent of the app's own
  // light/dark mode, same as every real IDE/editor's default dark theme.
  editorText: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    minHeight: 200,
    textAlignVertical: 'top',
    color: '#E4E4F0',
  },
  stdinText: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    minHeight: 52,
    textAlignVertical: 'top',
    color: '#E4E4F0',
  },
  resultBox: {
    ...globalStyle.card,
    marginTop: 16,
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
    ...globalStyle.card,
    marginTop: 16,
    padding: 16,
  },
});

// Fixed dark "editor window" chrome shared by the code/stdin/output panels
// above — plain (non-themed) StyleSheet since a code editor's dark theme is
// deliberately independent of the app's own light/dark mode (see
// editorText's own comment). Mirrors components/CodeBlock.tsx's colors.
const editorChromeStyles = StyleSheet.create({
  window: {
    backgroundColor: '#1E1E2E',
    borderRadius: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#26263B',
    borderBottomWidth: 1,
    borderBottomColor: '#33334A',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
});
