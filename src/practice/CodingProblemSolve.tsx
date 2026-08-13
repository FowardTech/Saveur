import React, {memo} from 'react';
import {Alert, Platform, StyleSheet, TouchableOpacity, View} from 'react-native';
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
import {NavigationProp, useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import {globalStyle} from 'styles/globalStyle';
import {renderCenteredLabel} from 'utils/buttonLabel';
import {RootStackParamList} from 'navigation/types';
import * as codingService from 'services/codingService';
import {CodingLanguage, RunResult, TestRunResult} from 'services/codingService';
import CtaButton from 'components/CtaButton';

// Free-practice solve screen (product follow-up: "add more features to
// the coding tool so that its worth the amount its paid for") — same
// dark-IDE editor chrome and Run/Run Tests/Get AI Code Review actions as
// CodingInterview.tsx (that screen is untouched; this is a second, non-
// timed entry point reached from CodingPracticeHub.tsx's browse list
// instead of a mock-interview session). Two real differences from
// CodingInterview.tsx: no countdown timer / no "Finish Interview" ->
// InterviewFeedback handoff (there's no interview session backing this at
// all — see route params, just a `slug`), and Run Tests now calls
// codingService.recordAttempt() so solved/attempted status persists on
// CodingProgress and shows back up on the hub the moment you go back.
const MONO_FONT = Platform.select({ios: 'Courier New', android: 'monospace', default: 'monospace'});
const EDITOR_DOT_COLORS = ['#FF5F56', '#FFBD2E', '#27C93F'];

function EditorTitleBar({label}: {label: string}) {
  return (
    <View style={editorChromeStyles.header}>
      <View style={{flexDirection: 'row'}}>
        {EDITOR_DOT_COLORS.map((c, i) => (
          <View key={c} style={[editorChromeStyles.dot, i > 0 && {marginLeft: 6}, {backgroundColor: c}]} />
        ))}
      </View>
      <Text category="h10" style={{color: '#8B8BA7', marginLeft: 12, fontFamily: MONO_FONT}}>
        {label}
      </Text>
    </View>
  );
}

function AiGradedBadge() {
  const {t} = useTranslation(['find', 'common']);
  return (
    <View style={editorChromeStyles.aiBadge}>
      <Icon pack="eva" name="activity-outline" style={[globalStyle.icon16, {tintColor: '#8B5CF6'}]} />
      <Text category="h10" bold style={{color: '#8B5CF6', marginLeft: 6}}>
        {t('find:ai_graded', {defaultValue: 'AI-graded result'})}
      </Text>
    </View>
  );
}

function SectionHeader({icon, label}: {icon: string; label: string}) {
  const theme = useTheme();
  return (
    <Flex justify="flex-start" itemsCenter mb={10}>
      <View style={[editorChromeStyles.sectionIconBadge, {backgroundColor: theme['color-primary-transparent-200']}]}>
        <Icon pack="eva" name={icon} style={[globalStyle.icon16, {tintColor: theme['color-primary-500']}]} />
      </View>
      <Text category="h8" bold ml={10}>
        {label}
      </Text>
    </Flex>
  );
}

const CodingProblemSolve = memo(() => {
  const {goBack} = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['find', 'common']);

  const {slug}: {slug: string} = route.params ?? {};

  const [languages, setLanguages] = React.useState<CodingLanguage[]>(codingService.DEFAULT_LANGUAGES);
  const [languagesLoading, setLanguagesLoading] = React.useState(true);
  const [language, setLanguage] = React.useState<CodingLanguage>(codingService.DEFAULT_LANGUAGES[0]);
  const [code, setCode] = React.useState(codingService.DEFAULT_LANGUAGES[0].starterCode ?? '');
  const [stdin, setStdin] = React.useState('');

  const [running, setRunning] = React.useState(false);
  const [runResult, setRunResult] = React.useState<RunResult | null>(null);

  const [runningTests, setRunningTests] = React.useState(false);
  const [testResults, setTestResults] = React.useState<TestRunResult[] | null>(null);
  const [testEngine, setTestEngine] = React.useState<'judge0' | 'ai' | undefined>(undefined);
  const [justSolved, setJustSolved] = React.useState(false);

  const [problem, setProblem] = React.useState<codingService.CodingProblem | null>(null);
  const [problemLoading, setProblemLoading] = React.useState(true);
  const [bookmarked, setBookmarked] = React.useState(false);
  const codeEditedRef = React.useRef(false);

  React.useEffect(() => {
    codingService.getLanguages().then(list => {
      setLanguages(list);
      if (list.length) {
        setLanguage(list[0]);
        setCode(list[0].starterCode ?? '');
      }
      setLanguagesLoading(false);
    });
  }, []);

  React.useEffect(() => {
    if (!slug) {
      setProblemLoading(false);
      return;
    }
    setProblemLoading(true);
    codingService
      .getProblem(undefined, slug)
      .then(setProblem)
      .finally(() => setProblemLoading(false));
    codingService
      .listProblems()
      .then(list => {
        const match = list.find(p => p.slug === slug);
        if (match) setBookmarked(match.bookmarked);
      })
      .catch(() => undefined);
  }, [slug]);

  React.useEffect(() => {
    if (!problem || codeEditedRef.current) return;
    const starter = problem.starterCode[language.id] ?? language.starterCode ?? '';
    if (starter) setCode(starter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem]);

  const onSelectLanguage = (lang: CodingLanguage) => {
    setLanguage(lang);
    codeEditedRef.current = false;
    setCode(problem?.starterCode[lang.id] ?? lang.starterCode ?? '');
    setRunResult(null);
    setTestResults(null);
    setTestEngine(undefined);
  };

  const onChangeCode = (v: string) => {
    codeEditedRef.current = true;
    setCode(v);
  };

  const onToggleBookmark = async () => {
    const next = !bookmarked;
    setBookmarked(next);
    try {
      await codingService.setBookmark(slug, next);
    } catch {
      setBookmarked(!next);
    }
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
        t('find:run_failed', {defaultValue: 'Run failed'}),
        e?.message ?? t('find:run_code_failed_body', {defaultValue: 'Could not run your code. Please try again.'}),
      );
    } finally {
      setRunning(false);
    }
  };

  const onRunTests = async () => {
    if (runningTests || !problem) return;
    setRunningTests(true);
    setTestResults(null);
    setJustSolved(false);
    try {
      const {results, engine} = await codingService.runTests(language.id, code, problem.testCases);
      setTestResults(results);
      setTestEngine(engine);
      const passedCount = results.filter(r => r.passed).length;
      // Persists this attempt's outcome (product follow-up: "add more
      // features to the coding tool so that its worth the amount its
      // paid for") — CodingInterview.tsx's Run Tests has no equivalent of
      // this; that flow only ever records to InterviewFeedback on
      // "Finish Interview". Free-practice has no such step, so this
      // fires right here, every Run Tests, not just once at the end.
      try {
        const {status} = await codingService.recordAttempt(problem.slug, language.id, passedCount, results.length);
        if (status === 'solved') setJustSolved(true);
      } catch {
        // Non-fatal — the run itself already succeeded and is visible on
        // screen; a failed progress-sync shouldn't block that feedback.
      }
    } catch (e: any) {
      Alert.alert(
        t('find:run_tests_failed', {defaultValue: 'Run tests failed'}),
        e?.message ?? t('find:run_tests_failed_body', {defaultValue: 'Could not run your test cases. Please try again.'}),
      );
    } finally {
      setRunningTests(false);
    }
  };

  const onGetReview = async () => {
    if (!problem) return;
    try {
      const review = await codingService.getCodeReview(code, language.id, `${problem.title}\n\n${problem.description}`);
      Alert.alert(
        t('find:coding_review_title', {defaultValue: 'AI Code Review'}),
        [review.complexityNote, ...review.feedback].filter(Boolean).join('\n\n'),
      );
    } catch (e: any) {
      Alert.alert(
        t('find:coding_review_failed', {defaultValue: "Couldn't get a review"}),
        e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={problem?.title ?? t('find:coding_interview')}
        accessoryLeft={<NavigationAction onPress={goBack} />}
        accessoryRight={() => (
          <TouchableOpacity onPress={onToggleBookmark} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon
              pack="eva"
              name={bookmarked ? 'star' : 'star-outline'}
              style={[globalStyle.icon24, {tintColor: bookmarked ? '#F59E0B' : theme['text-hint-color']}]}
            />
          </TouchableOpacity>
        )}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <SectionHeader icon="message-square-outline" label={t('find:coding_problem_label', {defaultValue: 'Problem'})} />
        {problemLoading ? (
          <Flex justify="flex-start" itemsCenter mb={24}>
            <Spinner size="small" />
            <Text category="h9-s" status="placeholder" ml={8}>
              {t('find:loading_problem', {defaultValue: 'Loading problem…'})}
            </Text>
          </Flex>
        ) : (
          <View style={styles.problemCard}>
            <Text category="h7" bold mb={8}>
              {problem?.title}
            </Text>
            <Text category="h9-s" status="placeholder">
              {problem?.description}
            </Text>
          </View>
        )}

        <Text category="h8" bold status="placeholder" mt={24} mb={12}>
          {t('find:language')}
        </Text>
        {languagesLoading ? (
          <Spinner size="small" />
        ) : (
          <Flex justify="flex-start" wrap mb={24}>
            {languages.map(lang => {
              const active = lang.id === language.id;
              return (
                <TouchableOpacity
                  key={lang.id}
                  activeOpacity={0.7}
                  onPress={() => onSelectLanguage(lang)}
                  style={[
                    styles.langChip,
                    {backgroundColor: active ? theme['color-primary-500'] : theme['background-basic-color-2']},
                  ]}>
                  <Text category="h9" bold status={active ? 'control' : 'basic'}>
                    {lang.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Flex>
        )}

        <SectionHeader icon="code-outline" label={t('find:coding_your_code_label', {defaultValue: 'Your Code'})} />
        <View style={editorChromeStyles.window}>
          <EditorTitleBar label={language.name} />
          <Input
            multiline
            textStyle={styles.editorText}
            style={styles.editorInput}
            value={code}
            onChangeText={onChangeCode}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor="#6B6B85"
          />
        </View>

        <Text category="h8" bold status="placeholder" mt={24} mb={8}>
          {t('find:stdin_optional', {defaultValue: 'Input (stdin) — optional'})}
        </Text>
        <View style={editorChromeStyles.window}>
          <EditorTitleBar label="stdin" />
          <Input
            multiline
            textStyle={styles.stdinText}
            style={styles.editorInput}
            value={stdin}
            onChangeText={setStdin}
            placeholder={t('find:stdin_placeholder', {defaultValue: 'Anything your program reads from stdin'}).toString()}
            placeholderTextColor="#6B6B85"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Button
          children={running ? t('find:running', {defaultValue: 'Running…'}) : t('find:run', {defaultValue: 'Run'})}
          disabled={running}
          status="basic"
          onPress={onRun}
          accessoryLeft={props => <Icon {...props} pack="assets" name="edit_full" />}
          style={{marginTop: 12}}
        />
        {runResult ? (
          <>
            <SectionHeader icon="terminal-outline" label={t('find:coding_output_label', {defaultValue: 'Output'})} />
            <View style={editorChromeStyles.window}>
              <EditorTitleBar label={t('find:stdout', {defaultValue: 'output'}).toString()} />
              <View style={{padding: 14}}>
                {runResult.engine === 'ai' ? <AiGradedBadge /> : null}
                <Text
                  category="h9"
                  bold
                  style={{
                    color: runResult.stderr ? '#FF6B6B' : '#5FE38E',
                    fontFamily: MONO_FONT,
                    marginTop: runResult.engine === 'ai' ? 10 : 0,
                  }}
                  mb={8}>
                  {runResult.status ?? (runResult.stderr ? t('find:error_status', {defaultValue: 'Error'}) : t('find:success_status', {defaultValue: 'Success'}))}
                </Text>
                {runResult.stdout ? (
                  <>
                    <Text category="h10" style={{color: '#8B8BA7', fontFamily: MONO_FONT}}>{t('find:stdout', {defaultValue: 'Output'})}</Text>
                    <Text category="h9-s" mb={runResult.stderr ? 8 : 0} style={{color: '#E4E4F0', fontFamily: MONO_FONT}}>{runResult.stdout}</Text>
                  </>
                ) : null}
                {runResult.stderr ? (
                  <>
                    <Text category="h10" style={{color: '#8B8BA7', fontFamily: MONO_FONT}}>{t('find:stderr', {defaultValue: 'Errors'})}</Text>
                    <Text category="h9-s" style={{color: '#FF6B6B', fontFamily: MONO_FONT}}>{runResult.stderr}</Text>
                  </>
                ) : null}
                {!runResult.stdout && !runResult.stderr ? (
                  <Text category="h9-s" style={{color: '#8B8BA7', fontFamily: MONO_FONT}}>{t('find:no_output', {defaultValue: '(no output)'})}</Text>
                ) : null}
              </View>
            </View>
          </>
        ) : null}

        <SectionHeader icon="checkmark-square-2-outline" label={t('find:test_cases', {defaultValue: 'Test Cases'})} />
        {(problem?.testCases ?? []).map((tc, i) => {
          const outcome = testResults?.[i];
          return (
            <Layout key={i} level="2" style={styles.testCaseRow}>
              <View style={globalStyle.flexOne}>
                <Text category="h10" status="placeholder">{t('find:coding_input_label', {defaultValue: 'Input'})}</Text>
                <Text category="h9-s" mb={6}>{tc.input}</Text>
                <Text category="h10" status="placeholder">{t('find:expected_output', {defaultValue: 'Expected Output'})}</Text>
                <Text category="h9-s">{tc.expectedOutput}</Text>
                {outcome?.actualOutput ? (
                  <>
                    <Text category="h10" status="placeholder" mt={6}>{t('find:actual_output', {defaultValue: 'Actual Output'})}</Text>
                    <Text category="h9-s">{outcome.actualOutput}</Text>
                  </>
                ) : null}
              </View>
              {outcome ? (
                <View style={[styles.testBadge, {backgroundColor: outcome.passed ? theme['color-success-500'] : theme['color-danger-500']}]}>
                  <Text category="h10" bold status="control">
                    {outcome.passed ? t('find:pass_badge', {defaultValue: 'PASS'}) : t('find:fail_badge', {defaultValue: 'FAIL'})}
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
          disabled={runningTests || !problem}
          onPress={onRunTests}
          accessoryLeft={props => <Icon {...props} pack="assets" name="edit_full" />}
          style={{marginTop: 8}}
        />
        {testResults ? (
          <Layout level="2" style={styles.resultBox}>
            {testEngine === 'ai' ? <AiGradedBadge /> : null}
            <Text
              category="h8"
              bold
              status={testResults.every(r => r.passed) ? 'success' : 'warning'}
              mt={testEngine === 'ai' ? 10 : 0}>
              {t('find:test_cases_passed', {
                defaultValue: `${testResults.filter(r => r.passed).length} / ${testResults.length} test cases passed`,
                passed: testResults.filter(r => r.passed).length,
                total: testResults.length,
              })}
            </Text>
            {justSolved ? (
              <View style={styles.solvedBanner}>
                <Icon pack="eva" name="checkmark-circle-2" style={[globalStyle.icon20, {tintColor: '#10B981'}]} />
                <Text category="h9" bold ml={8} style={{color: '#10B981'}}>
                  {t('find:coding_solved_banner', {defaultValue: 'Solved! Great work.'})}
                </Text>
              </View>
            ) : null}
          </Layout>
        ) : null}

        <Button
          children={t('find:coding_get_review_cta', {defaultValue: 'Get AI Code Review'})}
          status="basic"
          onPress={onGetReview}
          disabled={!problem}
          style={{marginTop: 20}}
        />
      </Content>
    </Container>
  );
});

export default CodingProblemSolve;

const themedStyles = StyleService.create({
  container: {flex: 1},
  content: {paddingBottom: 80},
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
  problemCard: {
    ...globalStyle.card,
    padding: 16,
    backgroundColor: 'background-basic-color-2',
  },
  solvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'border-basic-color-3',
  },
});

const editorChromeStyles = StyleSheet.create({
  window: {
    backgroundColor: '#1E1E2E',
    borderRadius: 20,
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
  sectionIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
