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
import {useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CoachMarkTour, {TourStep} from 'components/CoachMarkTour';
import useTourTarget from 'hooks/useTourTarget';
import {globalStyle} from 'styles/globalStyle';
import {renderCenteredLabel} from 'utils/buttonLabel';
import {EKeyAsyncStorage} from 'constants/Types';
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
      <Icon pack="eva" name="activity-outline" style={[globalStyle.icon16, {tintColor: '#52525b'}]} />
      <Text category="h10" bold style={{color: '#52525b', marginLeft: 6}}>
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

  // In-app guide (product report: "I need you to implement a guide in the
  // coding practice so that users can know how the coding practice works
  // because its still confusing me. It should guide the user on how every
  // section works") — a spotlight tour over this screen's real Problem/
  // Language/Your Code/Run/Test Cases/Run Tests/Get AI Code Review
  // sections. See components/CoachMarkTour.tsx for the mechanics.
  const contentRef = React.useRef<any>(null);
  const tourProblem = useTourTarget();
  const tourLanguage = useTourTarget();
  const tourCode = useTourTarget();
  const tourRun = useTourTarget();
  const tourTestCases = useTourTarget();
  const tourRunTests = useTourTarget();
  const tourReview = useTourTarget();
  const [showTour, setShowTour] = React.useState(false);

  // Auto-show once, the first time a user reaches EITHER coding-practice
  // screen (see EKeyAsyncStorage.codingPracticeTourSeen's own comment for
  // why this flag is shared with CodingInterview.tsx). Waits for the
  // problem to finish loading so every step's target actually exists in
  // the tree before the tour tries to measure it.
  React.useEffect(() => {
    if (problemLoading) return;
    AsyncStorage.getItem(EKeyAsyncStorage.codingPracticeTourSeen).then(seen => {
      if (!seen) setShowTour(true);
    });
  }, [problemLoading]);

  const onCloseTour = React.useCallback(() => {
    setShowTour(false);
    AsyncStorage.setItem(EKeyAsyncStorage.codingPracticeTourSeen, '1').catch(() => undefined);
  }, []);

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
    // Product report: leaving the editor empty and hitting "Run Tests"
    // came back with every test case marked as passed. Grading currently
    // routes through the AI-judge fallback (see codingService.runTests /
    // backend code_validator_service.py), which self-reports a pass/fail
    // boolean rather than diffing real program output -- it can hallucinate
    // a pass for code that was never actually traced. Blocking blank/
    // whitespace-only submissions here closes the most confusing version
    // of that gap; the backend also rejects this defensively (see
    // Saveur-Backend app/api/coding.py's run_tests()).
    if (!code || !code.trim()) {
      Alert.alert(
        t('find:no_code_written', {defaultValue: 'Write some code first'}).toString(),
        t('find:no_code_written_body', {defaultValue: 'Your editor is empty — add your solution before running the tests.'}).toString(),
      );
      return;
    }
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
      // BUG FIX (product report: "the AI review did not tell me that my
      // code was incomplete... even when truly i did not get it
      // correctly") -- ground the review in whatever real Run Tests
      // result is already sitting in state, if any, so it can actually
      // say "this doesn't pass" instead of only ever commenting on style.
      const review = await codingService.getCodeReview(
        code,
        language.id,
        `${problem.title}\n\n${problem.description}`,
        testResults ? testResults.filter(r => r.passed).length : undefined,
        testResults ? testResults.length : undefined,
      );
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

  const tourSteps: TourStep[] = [
    {
      key: 'problem',
      targetRef: tourProblem.ref,
      offsetRef: tourProblem.offsetRef,
      title: t('find:tour_solve_problem_title', {defaultValue: 'The Problem'}).toString(),
      body: t('find:tour_solve_problem_body', {defaultValue: "Read this first. It's the exact task you need to solve — what your code should take in and what it should return."}).toString(),
    },
    {
      key: 'language',
      targetRef: tourLanguage.ref,
      offsetRef: tourLanguage.offsetRef,
      title: t('find:tour_language_title', {defaultValue: 'Pick a language'}).toString(),
      body: t('find:tour_language_body', {defaultValue: 'Choose whichever language you want to solve the problem in. Switching languages resets the editor to a starter template for that language.'}).toString(),
    },
    {
      key: 'code',
      targetRef: tourCode.ref,
      offsetRef: tourCode.offsetRef,
      title: t('find:tour_code_title', {defaultValue: 'Write your solution here'}).toString(),
      body: t('find:tour_code_body', {defaultValue: "This is your editor. Replace the starter code with your own solution — you don't need to write any input-reading boilerplate, just the logic that solves the problem."}).toString(),
    },
    {
      key: 'run',
      targetRef: tourRun.ref,
      offsetRef: tourRun.offsetRef,
      title: t('find:tour_run_title', {defaultValue: '"Run" — a quick sanity check'}).toString(),
      body: t('find:tour_run_body', {defaultValue: 'Run just executes your code once with whatever you type into the optional input box above it, so you can see the raw output or any error. It does NOT check whether your solution is correct — for that, use Run Tests below.'}).toString(),
    },
    {
      key: 'testCases',
      targetRef: tourTestCases.ref,
      offsetRef: tourTestCases.offsetRef,
      title: t('find:tour_test_cases_title', {defaultValue: 'Test Cases'}).toString(),
      body: t('find:tour_test_cases_body', {defaultValue: 'Each row is a real example the grader checks your code against: an input and the output it must produce. After you run tests, each row shows PASS or FAIL plus what your code actually returned.'}).toString(),
    },
    {
      key: 'runTests',
      targetRef: tourRunTests.ref,
      offsetRef: tourRunTests.offsetRef,
      title: t('find:tour_run_tests_title', {defaultValue: '"Run Tests" — this is what grades you'}).toString(),
      body: t('find:tour_run_tests_body', {defaultValue: "This checks your code against every test case above and tells you exactly how many passed. This is the real signal for whether you've actually solved the problem — a problem only counts as solved once every test case passes here."}).toString(),
    },
    {
      key: 'review',
      targetRef: tourReview.ref,
      offsetRef: tourReview.offsetRef,
      title: t('find:tour_review_title', {defaultValue: 'Get AI Code Review'}).toString(),
      body: t('find:tour_review_body', {defaultValue: "Once you've run your tests, tap this for a written review of your code — it will tell you plainly whether your solution is correct or still has bugs, plus feedback on style and efficiency."}).toString(),
    },
  ];

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={problem?.title ?? t('find:coding_interview')}
        // BUG FIX (GO_BACK dev warning): removed the explicit
        // onPress={goBack} override -- it bypassed NavigationAction's own
        // canGoBack() guard entirely. Let it use its guarded default.
        accessoryLeft={<NavigationAction />}
        accessoryRight={() => (
          <Flex justify="flex-start" itemsCenter>
            {/* In-app guide entry point (product report: "implement a
                guide... so users can know how the coding practice works") —
                always available to replay the tour, independent of whether
                it already auto-showed once. */}
            <TouchableOpacity
              onPress={() => setShowTour(true)}
              hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              style={{marginRight: 16}}>
              <Icon
                pack="eva"
                name="question-mark-circle-outline"
                style={[globalStyle.icon24, {tintColor: theme['text-hint-color']}]}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={onToggleBookmark} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
              <Icon
                pack="eva"
                name={bookmarked ? 'star' : 'star-outline'}
                style={[globalStyle.icon24, {tintColor: bookmarked ? '#F59E0B' : theme['text-hint-color']}]}
              />
            </TouchableOpacity>
          </Flex>
        )}
      />
      <Content ref={contentRef} padder avoidKeyboard contentContainerStyle={styles.content}>
        <View ref={tourProblem.ref} onLayout={tourProblem.onLayout} collapsable={false}>
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
        </View>

        <View ref={tourLanguage.ref} onLayout={tourLanguage.onLayout} collapsable={false}>
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
        </View>

        <View ref={tourCode.ref} onLayout={tourCode.onLayout} collapsable={false}>
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
        <View ref={tourRun.ref} onLayout={tourRun.onLayout} collapsable={false}>
          <Button
            children={running ? t('find:running', {defaultValue: 'Running…'}) : t('find:run', {defaultValue: 'Run'})}
            disabled={running}
            status="basic"
            onPress={onRun}
            accessoryLeft={props => <Icon {...props} pack="assets" name="edit_full" />}
            style={{marginTop: 12}}
          />
        </View>
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

        <View ref={tourTestCases.ref} onLayout={tourTestCases.onLayout} collapsable={false}>
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
        </View>
        <View ref={tourRunTests.ref} onLayout={tourRunTests.onLayout} collapsable={false}>
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
        </View>
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

        <View ref={tourReview.ref} onLayout={tourReview.onLayout} collapsable={false}>
          <Button
            children={t('find:coding_get_review_cta', {defaultValue: 'Get AI Code Review'})}
            status="basic"
            onPress={onGetReview}
            disabled={!problem}
            style={{marginTop: 20}}
          />
        </View>
      </Content>
      <CoachMarkTour
        visible={showTour}
        steps={tourSteps}
        onClose={onCloseTour}
        scrollRef={contentRef}
        skipLabel={t('find:tour_skip', {defaultValue: 'Skip'}).toString()}
        backLabel={t('find:tour_back', {defaultValue: 'Back'}).toString()}
        nextLabel={t('find:tour_next', {defaultValue: 'Next'}).toString()}
        doneLabel={t('find:tour_done', {defaultValue: 'Got it'}).toString()}
      />
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
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  testBadge: {
    borderRadius: 16,
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
    borderRadius: 16,
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
