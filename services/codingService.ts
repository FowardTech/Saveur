import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import {EKeyAsyncStorage} from 'constants/Types';
import apiClient from './apiClient';

// `language` per the backend's contract — constants/languages.ts,
// docs/BACKEND_SPEC_ADDENDUM_2026-07.md §16. Only added to the two
// natural-language-feedback endpoints below (review/system-design) — run/
// run-tests just return raw stdout from Judge0, nothing to localize there.
function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// codingService — real backend implementation (formerly codeReviewService.ts,
// renamed since it now covers the whole Coding Interview / Judge0 domain, not
// just the AI review call).
//
// Backs src/practice/CodingInterview.tsx's language picker, "Run", "Run
// Tests", and "Get AI Code Review" actions against the real Judge0-backed
// sandbox described for this task:
//   GET  /api/v1/coding/languages
//   POST /api/v1/coding/run
//   POST /api/v1/coding/run-tests
//   POST /api/v1/coding/review
//   POST /api/v1/coding/system-design
//
// Wire format note: like authService.ts/resumeService.ts, snake_case wire
// fields are translated to/from camelCase app types only in this file.
// AsyncStorage is kept only as an offline-read fallback cache for the
// language list (so the picker still renders something if the very first
// launch happens offline), never the source of truth.
// ---------------------------------------------------------------------------

export interface CodingLanguage {
  /** Value to send back as `language` in /run, /run-tests, /review requests. */
  id: string;
  name: string;
  starterCode?: string;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
}
export interface TestRunResult extends TestCase {
  passed: boolean;
  actualOutput?: string;
  stderr?: string;
}
export interface RunTestsSummary {
  results: TestRunResult[];
  passedCount: number;
  totalCount: number;
  /** "judge0" = a real sandboxed execution; "ai" = AI-predicted, since
   * Judge0 isn't configured/active right now — see Saveur-Backend's
   * app/api/coding.py's _active_provider(). Lets the UI show an
   * "AI-graded" disclosure instead of implying a real run happened. */
  engine?: 'judge0' | 'ai';
}
export interface RunResult {
  stdout: string;
  stderr: string;
  status?: string;
  exitCode?: number | null;
  timeMs?: number | null;
  memoryKb?: number | null;
  engine?: 'judge0' | 'ai';
}
export interface CodeReviewResult {
  complexityNote: string;
  feedback: string[];
}
export interface SystemDesignFeedbackResult {
  summary: string;
  feedback: string[];
}

// Test cases for the "Two Sum" prompt CodingInterview.tsx currently shows.
// TODO (BACKEND): a real implementation would key this off the actual
// problem assigned for the session (see interviewService.startSession).
export const TEST_CASES: TestCase[] = [
  {input: 'nums = [2,7,11,15], target = 9', expectedOutput: '[0,1]'},
  {input: 'nums = [3,2,4], target = 6', expectedOutput: '[1,2]'},
  {input: 'nums = [3,3], target = 6', expectedOutput: '[0,1]'},
];

// Local fallback so the language picker + editor still render something
// useful if GET /coding/languages fails (first launch offline, backend
// hiccup, etc). Mirrors the display names the screen showed before this was
// backend-driven.
export const DEFAULT_LANGUAGES: CodingLanguage[] = [
  {id: 'javascript', name: 'JavaScript', starterCode: `function twoSum(nums, target) {\n  // your code here\n}`},
  {id: 'python', name: 'Python', starterCode: `def two_sum(nums, target):\n    # your code here\n    pass`},
  {id: 'java', name: 'Java', starterCode: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // your code here\n    }\n}`},
  {id: 'cpp', name: 'C++', starterCode: `vector<int> twoSum(vector<int>& nums, int target) {\n    // your code here\n}`},
  {id: 'go', name: 'Go', starterCode: `func twoSum(nums []int, target int) []int {\n\t// your code here\n}`},
];

interface LanguageWire {
  id?: string;
  slug?: string;
  key?: string;
  value?: string;
  name?: string;
  label?: string;
  starter_code?: string;
  starterCode?: string;
}

function fromLanguageWire(wire: LanguageWire | string): CodingLanguage {
  if (typeof wire === 'string') {
    return {id: wire, name: wire};
  }
  const id = wire.id ?? wire.slug ?? wire.key ?? wire.value ?? wire.name ?? '';
  const name = wire.name ?? wire.label ?? id;
  return {id, name, starterCode: wire.starter_code ?? wire.starterCode};
}

const readLanguagesCache = async (): Promise<CodingLanguage[] | null> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.codingLanguages);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CodingLanguage[];
  } catch {
    return null;
  }
};

const writeLanguagesCache = async (languages: CodingLanguage[]): Promise<CodingLanguage[]> => {
  await AsyncStorage.setItem(EKeyAsyncStorage.codingLanguages, JSON.stringify(languages));
  return languages;
};

/**
 * GET /api/v1/coding/languages — the backend's supported-languages list for
 * the Judge0 sandbox, replacing the hardcoded LANGUAGES/STARTER_CODE constants
 * CodingInterview.tsx used to define locally. Falls back to the last-known
 * cache, then to DEFAULT_LANGUAGES, so the picker never renders empty.
 */
export async function getLanguages(): Promise<CodingLanguage[]> {
  try {
    const {data} = await apiClient.get<LanguageWire[] | {languages?: LanguageWire[]}>(
      '/api/v1/coding/languages',
    );
    const list = Array.isArray(data) ? data : data.languages ?? [];
    const languages = list.map(fromLanguageWire).filter(l => l.id);
    if (!languages.length) throw new Error('Empty language list');
    return writeLanguagesCache(languages);
  } catch {
    const cached = await readLanguagesCache();
    return cached && cached.length ? cached : DEFAULT_LANGUAGES;
  }
}

/**
 * POST /api/v1/coding/run — a single real execution of the submitted code
 * against optional stdin (Judge0-style: no expected output, just raw
 * stdout/stderr back). Backs CodingInterview.tsx's "Run" action.
 */
export async function runCode(
  language: string,
  code: string,
  stdin?: string,
): Promise<RunResult> {
  const {data} = await apiClient.post<{
    stdout?: string;
    stderr?: string;
    status?: string;
    exit_code?: number | null;
    time_ms?: number | null;
    memory_kb?: number | null;
    engine?: 'judge0' | 'ai';
  }>('/api/v1/coding/run', {language, code, stdin});
  return {
    stdout: data.stdout ?? '',
    stderr: data.stderr ?? '',
    status: data.status,
    exitCode: data.exit_code ?? null,
    timeMs: data.time_ms ?? null,
    memoryKb: data.memory_kb ?? null,
    engine: data.engine,
  };
}

/**
 * POST /api/v1/coding/run-tests — real execution of the submitted code
 * against each of TEST_CASES, diffing real stdout against the expected
 * output server-side. Backs CodingInterview.tsx's "Run Tests" action.
 */
export async function runTests(
  language: string,
  code: string,
  cases: TestCase[] = TEST_CASES,
): Promise<RunTestsSummary> {
  const {data} = await apiClient.post<{
    passed_count?: number;
    passedCount?: number;
    total_count?: number;
    engine?: 'judge0' | 'ai';
    results?: Array<{
      stdin?: string;
      input?: string;
      expected_output?: string;
      expectedOutput?: string;
      actual_output?: string;
      actualOutput?: string;
      stderr?: string;
      passed?: boolean;
    }>;
  }>('/api/v1/coding/run-tests', {
    language,
    code,
    cases: cases.map(c => ({stdin: c.input, expected_output: c.expectedOutput})),
  });

  const rawResults = data.results ?? [];
  const results: TestRunResult[] = cases.map((testCase, i) => {
    const r = rawResults[i];
    return {
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      passed: r?.passed ?? false,
      actualOutput: r?.actual_output ?? r?.actualOutput,
      stderr: r?.stderr,
    };
  });
  const passedCount = data.passed_count ?? data.passedCount ?? results.filter(r => r.passed).length;
  return {results, passedCount, totalCount: data.total_count ?? results.length, engine: data.engine};
}

/**
 * POST /api/v1/coding/review — a real LLM code review, grounded in the
 * actual submitted code and (unlike the old mock) the problem statement
 * itself, so feedback references what was actually asked. Backs
 * CodingInterview.tsx's "Get AI Code Review" action.
 *
 * NOTE on the `language` field name collision: this endpoint's existing
 * `language` param is the *programming* language (e.g. "python") per its
 * pre-existing contract — it can't double as the UI/response language field
 * the backend's contract calls `language` (docs/BACKEND_SPEC_ADDENDUM_2026-07.md
 * §16). Sent as `responseLanguage` here instead to avoid clobbering it —
 * flagged explicitly for the backend since every other endpoint in this app
 * uses the literal field name `language`; this is the one exception.
 */
export async function getCodeReview(
  code: string,
  language: string,
  problem: string,
): Promise<CodeReviewResult> {
  const {data} = await apiClient.post<{
    complexity_note?: string;
    complexityNote?: string;
    feedback?: string[];
    suggestions?: string[];
  }>('/api/v1/coding/review', {language, code, problem, responseLanguage: currentLanguage()});
  return {
    complexityNote: data.complexity_note ?? data.complexityNote ?? '',
    feedback: data.feedback ?? data.suggestions ?? [],
  };
}

/**
 * POST /api/v1/coding/system-design — AI feedback on a free-text system
 * design writeup. Called from SystemDesignWhiteboard.tsx's "Get AI Review"
 * action: the whiteboard itself is a purely visual freehand-sketch +
 * shape-stamp canvas (react-native-svg strokes/rects/circles/arrows) with
 * nothing exportable as text, so the candidate types a brief explanation of
 * what they sketched (designNotes) and that's what actually gets reviewed
 * here — same as talking a design through out loud in a real interview.
 * (Comment previously said this was unused — that was stale; the calling
 * UI shipped in a later pass.)
 */
export async function getSystemDesignFeedback(notes: string): Promise<SystemDesignFeedbackResult> {
  const {data} = await apiClient.post<{
    summary?: string;
    feedback?: string[];
    suggestions?: string[];
  }>('/api/v1/coding/system-design', {notes, language: currentLanguage()});
  return {
    summary: data.summary ?? '',
    feedback: data.feedback ?? data.suggestions ?? [],
  };
}
