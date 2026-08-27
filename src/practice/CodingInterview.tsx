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
import { CodingAttempt, CodingLanguage, RunResult, TestRunResult } from 'services/codingService';
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

// "AI-graded" disclosure — shown whenever a result's `engine` says "ai", so
// a user never mistakes a predicted result for a real sandboxed execution.
// Product report ("the user dont need to see AI-graded-judge0 not connected
// yet. They dont need to know whats running the code behind the scene"):
// this used to literally name the backend's execution engine (Judge0) and
// its connection status — an internal implementation detail with no
// meaning to a candidate. Now just discloses THAT this result is an AI
// prediction rather than a real program run, with no mention of what does
// or doesn't power it.
function AiGradedBadge() {
  const { t } = useTranslation(['find', 'common']);
  return (
    <View style={editorChromeStyles.aiBadge}>
      <Icon pack="eva" name="activity-outline" style={[globalStyle.icon16, { tintColor: '#8B5CF6' }]} />
      <Text category="h10" bold style={{ color: '#8B5CF6', marginLeft: 6 }}>
        {t('find:ai_graded', { defaultValue: 'AI-graded result' })}
      </Text>
    </View>
  );
}

// Section header used to visually separate the Problem / Your Code / Output
// panels (product report: "the user dont know which one is the question and
// where to write the code... arrange it well so that users can know which
// one is the question and where to code and where the output appears").
function SectionHeader({ icon, label }: { icon: string; label: string }) {
  const theme = useTheme();
  return (
    <Flex justify="flex-start" itemsCenter mb={10}>
      <View style={[editorChromeStyles.sectionIconBadge, { backgroundColor: theme['color-primary-transparent-200'] }]}>
        <Icon pack="eva" name={icon} style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
      </View>
      <Text category="h8" bold ml={10}>
        {label}
      </Text>
    </Flex>
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

  const { sessionId, interviewType, durationMin } = route.params ?? {};

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

  // Fixes the product report: "the coding practice problems are not
  // diverse... it's always the same Two Sum problem with the same test
  // cases regardless of the session." See codingService.getProblem() for
  // the real ~8-problem bank this now pulls from — selected deterministically
  // per sessionId, so the SAME session always shows the SAME problem (no
  // surprise change on a re-render/resume) while DIFFERENT sessions land on
  // different problems. `problem` starts null; every render below falls
  // back to the old static Two Sum i18n strings/TEST_CASES until it loads,
  // so this never shows a blank problem panel.
  const [problem, setProblem] = React.useState<codingService.CodingProblem | null>(null);
  const [problemLoading, setProblemLoading] = React.useState(true);
  // Tracks whether the user has actually typed in the code editor, so the
  // problem-load effect below (which can resolve slightly after the editor
  // already has default starter code showing) never clobbers real work —
  // only auto-fills starter code while the user hasn't touched it yet.
  const codeEditedRef = React.useRef(false);

  // "Next Problem" (product report: "the AI interviewer is not supposed to
  // give just one problem it's supposed to be random problems until the
  // time elapses") — every slug served THIS session so far, so
  // getNextProblem's exclude list keeps a single timed session from
  // repeating a problem while cycling through the bank.
  const [seenSlugs, setSeenSlugs] = React.useState<string[]>([]);
  const [isLoadingNextProblem, setIsLoadingNextProblem] = React.useState(false);
  // Product follow-up ("build [scoring across multiple problems] out
  // too"): every problem's final code/test outcome once the user moves
  // PAST it via Next Problem — the one still on screen at Finish time is
  // added separately there (see onFinish below), so this only ever holds
  // problems the user is actually done with.
  const [priorAttempts, setPriorAttempts] = React.useState<CodingAttempt[]>([]);

  const problemStatement = problem
    ? `${problem.title}\n\n${problem.description}`
    : `${t('find:coding_prompt_title')}\n\n${t('find:coding_prompt_description')}`;

  // Session Length countdown (product report: "the selected session length
  // should be followed in the coding session time length... once the time
  // is up there should be a count down timer counting down. there should
  // be a pop up telling the user that time is up and then it should just
  // take them to the interview feedback"). Mirrors LiveInterviewSession's
  // own hard time-limit pattern. No timer at all when durationMin is
  // missing (e.g. an older nav call site that hasn't been updated) rather
  // than guessing a default — silently not enforcing a limit is safer than
  // enforcing a made-up one.
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(
    durationMin ? durationMin * 60 : null,
  );
  const hasAutoFinishedRef = React.useRef(false);

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

  const loadProblem = React.useCallback(async () => {
    setProblemLoading(true);
    try {
      const p = await codingService.getProblem(sessionId);
      setProblem(p);
      setSeenSlugs([p.slug]);
    } finally {
      setProblemLoading(false);
    }
  }, [sessionId]);

  React.useEffect(() => {
    loadProblem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Next Problem" — see seenSlugs' own comment above. Only meaningful once
  // a timer is actually running (durationMin was passed in) — the
  // untimed free-practice hub (CodingPracticeHub.tsx/CodingProblemSolve.tsx)
  // is its own separate screen with its own browse-and-pick flow, this is
  // specifically for cycling through MULTIPLE problems inside one timed
  // mock-interview session instead of being locked to a single one.
  const onNextProblem = async () => {
    if (isLoadingNextProblem) return;
    setIsLoadingNextProblem(true);
    try {
      const next = await codingService.getNextProblem(seenSlugs);
      // Bank the problem being left behind — whatever code/test outcome it
      // has right now is its FINAL state as far as this session's overall
      // score is concerned (see priorAttempts' own comment).
      if (problem) {
        setPriorAttempts(prev => [...prev, {
          problemSlug: problem.slug,
          problemTitle: problem.title,
          problemStatement,
          language: language.id,
          code,
          testsPassed: testResults ? testResults.filter(r => r.passed).length : undefined,
          testsTotal: testResults ? testResults.length : undefined,
        }]);
      }
      setSeenSlugs(prev => [...prev, next.slug]);
      codeEditedRef.current = false;
      setProblem(next);
      setStdin('');
      setRunResult(null);
      setTestResults(null);
      setTestEngine(undefined);
    } catch (e: any) {
      Alert.alert(
        t('find:next_problem_failed', { defaultValue: 'Could not load next problem' }),
        e?.message ?? t('common:something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' }),
      );
    } finally {
      setIsLoadingNextProblem(false);
    }
  };

  // Once the real problem loads, swap the editor's starter code from the
  // generic Two-Sum-shaped default (set by loadLanguages above, which
  // resolves independently and can land first) to the actual assigned
  // problem's starter code for whichever language is currently selected —
  // but only if the user hasn't started typing yet (codeEditedRef).
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
      const { results, engine } = await codingService.runTests(
        language.id,
        code,
        problem?.testCases ?? codingService.TEST_CASES,
      );
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

  // BUG FIX / product report ("The AI code review button should not be in
  // the coding session. It should be in the feedback screen because thats
  // where the user will see the AI feedback"): onGetCodeReview + its review
  // UI used to live entirely on this screen. Removed here — the same
  // codingService.getCodeReview call now lives on InterviewFeedback.tsx,
  // fed by the `code`/`language`/`problemStatement` this screen passes
  // through onFinish below, so the review appears where the rest of the
  // scored result does instead of being scattered across two screens.

  const onFinish = async (opts?: { timedOut?: boolean }) => {
    if (isFinishing) return;
    setIsFinishing(true);
    // Built once and reused for both completeSession (so the backend has
    // real work to grade — see that function's own comment) and the
    // navigate() call below (unchanged — InterviewFeedback's non-QA branch
    // already reads this straight from route params for its own local
    // test-summary display).
    //
    // Product follow-up ("build [scoring across multiple problems] out
    // too"): the top-level language/code/problemStatement/tests* fields
    // stay exactly what they always were (the CURRENT/last problem on
    // screen) for backward compatibility with anything only reading those
    // flat fields — `attempts` is the additive part, every problem
    // attempted this session INCLUDING this final one, only present at all
    // once there's more than one (a plain single-problem session sends
    // exactly the same wire shape as before this feature existed).
    const finalAttempt: codingService.CodingAttempt = {
      problemSlug: problem?.slug,
      problemTitle: problem?.title,
      problemStatement,
      language: language.id,
      code,
      testsPassed: testResults ? testResults.filter(r => r.passed).length : undefined,
      testsTotal: testResults ? testResults.length : undefined,
    };
    const allAttempts = [...priorAttempts, finalAttempt];
    const codingResult = {
      language: language.id,
      code,
      problemStatement,
      testsPassed: finalAttempt.testsPassed,
      testsTotal: finalAttempt.testsTotal,
      attempts: allAttempts.length > 1 ? allAttempts : undefined,
    };
    try {
      if (sessionId) {
        try {
          await interviewService.completeSession(sessionId, undefined, undefined, { codingResult });
        } catch (e: any) {
          // Same pattern as LiveInterviewSession.tsx: the coding work itself
          // already happened locally, so don't strand the user on this
          // screen over a sync failure — warn and still move on to
          // InterviewFeedback, which may just show partial/stale feedback.
          // Skipped for the timed-out path (below) since that already shows
          // its own "Time's up" alert and shouldn't stack a second one.
          if (!opts?.timedOut) {
            Alert.alert(
              t('find:finish_interview_sync_failed', { defaultValue: 'Could not sync interview' }),
              e?.message ?? t('find:finish_interview_sync_failed_body', { defaultValue: 'Your session ended locally but we could not reach the server to finalize it. Your feedback may be incomplete.' }),
            );
          }
        }
      }
    } finally {
      setIsFinishing(false);
      navigate('InterviewFeedback', {
        sessionId,
        interviewType,
        codingResult,
      });
    }
  };

  // Countdown tick + time's-up handling — see secondsLeft's own comment
  // above for why this is entirely a no-op when no durationMin was passed.
  React.useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      if (!hasAutoFinishedRef.current) {
        hasAutoFinishedRef.current = true;
        Alert.alert(
          t('find:coding_time_up_title', { defaultValue: "Time's up" }),
          t('find:coding_time_up_body', {
            defaultValue: 'Your session length has ended. Submitting what you have and moving to feedback.',
          }),
          [{ text: t('common:ok', { defaultValue: 'OK' }), onPress: () => onFinish({ timedOut: true }) }],
        );
      }
      return;
    }
    const id = setTimeout(() => setSecondsLeft(s => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const timerLabel = React.useMemo(() => {
    if (secondsLeft === null) return null;
    const clamped = Math.max(0, secondsLeft);
    const mm = Math.floor(clamped / 60).toString().padStart(2, '0');
    const ss = (clamped % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }, [secondsLeft]);

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:coding_interview')}
        accessoryLeft={<NavigationAction onPress={goBack} />}
        accessoryRight={
          timerLabel
            ? () => (
                <View style={[styles.timerPill, secondsLeft !== null && secondsLeft <= 60 ? styles.timerPillUrgent : null]}>
                  <Icon pack="eva" name="clock-outline" style={[globalStyle.icon16, { tintColor: secondsLeft !== null && secondsLeft <= 60 ? '#FF6B6B' : theme['text-basic-color'] }]} />
                  <Text category="h9" bold ml={6} style={secondsLeft !== null && secondsLeft <= 60 ? { color: '#FF6B6B' } : undefined}>
                    {timerLabel}
                  </Text>
                </View>
              )
            : undefined
        }
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        {/* Restructure (product report: "the user dont know which one is
            the question and where to write the code... arrange it well").
            Problem statement now lives in its own clearly-labeled, plainly-
            readable card, distinct from the dark IDE-style windows below it
            for code/input/output — same visual language interviewing tools
            like LeetCode/HackerRank use (light "read" panel vs dark "write"
            panel) so the two are never confused at a glance. */}
        <SectionHeader icon="message-square-outline" label={t('find:coding_problem_label', { defaultValue: 'Problem' })} />
        {problemLoading ? (
          <Flex justify="flex-start" itemsCenter mb={24}>
            <Spinner size="small" />
            <Text category="h9-s" status="placeholder" ml={8}>
              {t('find:loading_problem', { defaultValue: 'Loading problem…' })}
            </Text>
          </Flex>
        ) : (
          <View style={styles.problemCard}>
            <Text category="h7" bold mb={8}>
              {problem?.title ?? t('find:coding_prompt_title')}
            </Text>
            <Text category="h9-s" status="placeholder">
              {problem?.description ?? t('find:coding_prompt_description')}
            </Text>
          </View>
        )}

        {/* "Next Problem" / "More Practice" row (product report: "the AI
            interviewer is not supposed to give just one problem it's
            supposed to be random problems until the time elapses" +
            "why are you separating [the free-practice hub] from the main
            coding interface... A button 'More Practice' should be in the
            main coding screen that navigates there"). Next Problem only
            shows in the timed mock-interview flow (durationMin present) --
            cycles through the bank without touching the countdown. More
            Practice is always available and is the one link into the
            untimed browse-all-problems hub, so that screen is reachable
            FROM the main coding screen instead of only from the Add-ons
            page. */}
        <Flex justify="space-between" itemsCenter mt={12}>
          {durationMin ? (
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={isLoadingNextProblem || problemLoading}
              onPress={onNextProblem}
              style={styles.inlineLinkRow}>
              {isLoadingNextProblem ? (
                <Spinner size="tiny" />
              ) : (
                <Icon pack="eva" name="refresh-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
              )}
              <Text category="h10" bold ml={6} style={{ color: theme['color-primary-500'] }}>
                {t('find:next_problem_cta', { defaultValue: 'Next Problem' })}
              </Text>
            </TouchableOpacity>
          ) : <View />}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigate('CodingPracticeHub')}
            style={styles.inlineLinkRow}>
            <Text category="h10" bold style={{ color: theme['color-primary-500'] }}>
              {t('find:more_practice_cta', { defaultValue: 'More Practice' })}
            </Text>
            <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }, { marginLeft: 4 }]} />
          </TouchableOpacity>
        </Flex>

        <Text category="h8" bold status="placeholder" mt={24} mb={12}>
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

        <SectionHeader icon="code-outline" label={t('find:coding_your_code_label', { defaultValue: 'Your Code' })} />
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
          <>
            <SectionHeader icon="terminal-outline" label={t('find:coding_output_label', { defaultValue: 'Output' })} />
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
          </>
        ) : null}

        <SectionHeader icon="checkmark-square-2-outline" label={t('find:test_cases', { defaultValue: 'Test Cases' })} />
        {(problem?.testCases ?? codingService.TEST_CASES).map((tc, i) => {
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
          children={isFinishing ? t('find:finishing', { defaultValue: 'Finishing…' }) : t('find:finish_interview', { defaultValue: 'Finish Interview' })}
          disabled={isFinishing}
          status="success"
          onPress={() => onFinish()}
          style={[globalStyle.shadowBtn, { marginTop: 24 }]}
        />
        <Text category="h10" status="placeholder" center mt={10}>
          {t('find:coding_review_on_feedback_hint', {
            defaultValue: 'Get your AI code review and full result on the feedback screen after you finish.',
          })}
        </Text>
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
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  testBadge: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginLeft: 12,
  },
  // Redesign (product report: "arrange it well so that users can know
  // which one is the question") — a plain readable card for the problem
  // statement, deliberately NOT the dark IDE-chrome styling used for code/
  // input/output below, so "what to read" vs. "where to type" are visually
  // distinct at a glance.
  problemCard: {
    ...globalStyle.card,
    padding: 16,
    backgroundColor: 'background-basic-color-2',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: 'background-basic-color-2',
  },
  timerPillUrgent: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  inlineLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

// Fixed dark "editor window" chrome shared by the code/stdin/output panels
// above — plain (non-themed) StyleSheet since a code editor's dark theme is
// deliberately independent of the app's own light/dark mode (see
// editorText's own comment). Mirrors components/CodeBlock.tsx's colors.
const editorChromeStyles = StyleSheet.create({
  window: {
    backgroundColor: '#1E1E2E',
    // Google-style furnishing pass (see styles/globalStyle.ts's `card`) --
    // 14 -> 20.
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
