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

// Two Sum's test cases — kept only as the last-resort fallback if
// GET /coding/problem fails outright (see getProblem() below), so the
// screen still renders something familiar/working rather than an empty
// problem panel. The real, varied problem bank now lives entirely on the
// backend (Saveur-Backend's app/services/coding_problems.py) — see
// CodingProblem/getProblem() below for the fix to the product report
// "the coding practice problems are not diverse... always the same Two
// Sum problem with the same test cases regardless of the session."
export const TEST_CASES: TestCase[] = [
  {input: 'nums = [2,7,11,15], target = 9', expectedOutput: '[0,1]'},
  {input: 'nums = [3,2,4], target = 6', expectedOutput: '[1,2]'},
  {input: 'nums = [3,3], target = 6', expectedOutput: '[0,1]'},
];

// Local fallback so the language picker still renders something useful if
// GET /coding/languages fails (first launch offline, backend hiccup,
// etc). `starterCode` here is now only a last-resort per-language default
// (a generic Two Sum stub) — the real, problem-specific starter code comes
// from getProblem()'s own `starterCode` map once it loads (see
// CodingInterview.tsx's onSelectLanguage/loadProblem).
export const DEFAULT_LANGUAGES: CodingLanguage[] = [
  {id: 'javascript', name: 'JavaScript', starterCode: `function twoSum(nums, target) {\n  // your code here\n}`},
  {id: 'python', name: 'Python', starterCode: `def two_sum(nums, target):\n    # your code here\n    pass`},
  {id: 'java', name: 'Java', starterCode: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // your code here\n    }\n}`},
  {id: 'cpp', name: 'C++', starterCode: `vector<int> twoSum(vector<int>& nums, int target) {\n    // your code here\n}`},
  {id: 'go', name: 'Go', starterCode: `func twoSum(nums []int, target int) []int {\n\t// your code here\n}`},
];

/**
 * One problem's worth of submitted work inside a timed session that may
 * have cycled through several problems via "Next Problem" (product report:
 * "the AI interviewer is not supposed to give just one problem it's
 * supposed to be random problems until the time elapses" — this is the
 * follow-up: "build [scoring across multiple problems] out too", so a
 * session's feedback covers everything attempted, not just whichever
 * problem happened to be on screen when Finish was pressed).
 */
export interface CodingAttempt {
  problemSlug?: string;
  problemTitle?: string;
  problemStatement: string;
  language: string;
  code: string;
  testsPassed?: number;
  testsTotal?: number;
}

export interface CodingProblem {
  slug: string;
  title: string;
  difficulty?: string;
  /** Filter-chip category on the free-practice hub (e.g. "arrays",
   * "dynamic_programming") — see Saveur-Backend's coding_problems.py. */
  category?: string;
  description: string;
  testCases: TestCase[];
  /** Per-language starter code, keyed by the same `language.id` values
   * getLanguages()/DEFAULT_LANGUAGES use (e.g. "javascript", "python"). */
  starterCode: Record<string, string>;
}

/** One row on the free-practice hub's browse list — lightweight, no
 * description/test_cases/starter_code (see GET /coding/problems). */
export interface CodingProblemSummary {
  slug: string;
  title: string;
  difficulty: string;
  category: string;
  /** null = never attempted, "attempted" = ran tests but not all passing
   * yet, "solved" = a full-pass run was recorded at least once. */
  status: 'attempted' | 'solved' | null;
  bookmarked: boolean;
}

export interface CodingStats {
  solvedTotal: number;
  attemptedTotal: number;
  totalProblems: number;
  solvedByDifficulty: Record<string, number>;
  solvedByCategory: Record<string, number>;
}

// Two Sum, in the CodingProblem shape — used only if GET /coding/problem
// fails outright (network error, backend down), so the screen degrades to
// exactly its old pre-problem-bank behavior instead of showing nothing.
const FALLBACK_PROBLEM: CodingProblem = {
  slug: 'two_sum',
  title: 'Two Sum',
  difficulty: 'easy',
  description:
    'Given an array of integers nums and an integer target, return the indices of the two numbers that add up to target. Each input has exactly one solution, and you may not use the same element twice.',
  testCases: TEST_CASES,
  starterCode: DEFAULT_LANGUAGES.reduce((acc, l) => {
    if (l.starterCode) acc[l.id] = l.starterCode;
    return acc;
  }, {} as Record<string, string>),
};

interface ProblemWire {
  slug?: string;
  title?: string;
  difficulty?: string;
  category?: string;
  description?: string;
  test_cases?: Array<{stdin?: string; expected_output?: string}>;
  starter_code?: Record<string, string>;
}

/**
 * GET /api/v1/coding/problem — fixes the product report: "the coding
 * practice problems are not diverse... always the same Two Sum problem
 * with the same test cases regardless of the session." Backed by a real
 * ~24-problem bank on the backend (see Saveur-Backend's
 * app/services/coding_problems.py), selected deterministically per
 * `sessionId` — the same session always sees the same problem (so
 * backgrounding the app or revisiting InterviewFeedback.tsx afterward
 * never shows a different one), but different sessions land on different
 * problems across the bank. Falls back to the old hardcoded Two Sum
 * problem (FALLBACK_PROBLEM above) if the request fails, so a backend
 * hiccup degrades to the previous behavior rather than an empty screen.
 *
 * `slug`, when given, takes priority over `sessionId` — backs the
 * free-practice hub (CodingPracticeHub.tsx) opening one SPECIFIC problem
 * a user picked off the browse list, rather than a session-hash pick.
 */
export async function getProblem(
  sessionId?: string | null,
  slug?: string | null,
): Promise<CodingProblem> {
  try {
    // Product decision: coding problem statements SHOULD be translated too
    // (confirmed explicitly, since "language" already means *programming*
    // language on this endpoint's sibling /coding/review call, see that
    // note below). Sent as `responseLanguage`, same field name/convention
    // reviewCode() already uses to avoid that exact collision. Backend
    // doesn't implement this yet (see docs/BACKEND_SPEC_ADDENDUM_2026-07.md's
    // new §16d) -- same "client sends it now, harmless no-op until backend
    // catches up" pattern this app already used for TTS's `language` field
    // (§16 in that same doc) before ElevenLabs voice mapping existed.
    const {data} = await apiClient.get<ProblemWire>('/api/v1/coding/problem', {
      params: {
        ...(slug ? {slug} : sessionId ? {session_id: sessionId} : undefined),
        responseLanguage: currentLanguage(),
      },
    });
    const testCases = (data.test_cases ?? []).map(c => ({
      input: c.stdin ?? '',
      expectedOutput: c.expected_output ?? '',
    }));
    if (!data.title || !testCases.length) throw new Error('Incomplete problem response');
    return {
      slug: data.slug ?? 'problem',
      title: data.title,
      difficulty: data.difficulty,
      category: data.category,
      description: data.description ?? '',
      testCases,
      starterCode: data.starter_code ?? {},
    };
  } catch {
    return FALLBACK_PROBLEM;
  }
}

/**
 * GET /api/v1/coding/problem?next=1 — the other half of the fix for
 * "the AI interviewer is not supposed to give just one problem it's
 * supposed to be random problems until the time elapses". Called by
 * CodingInterview.tsx's "Next Problem" button once the candidate is ready
 * to move on and there's still time left on the session clock —
 * `excludeSlugs` (every slug already seen this session, tracked client-
 * side) is sent back so a single timed session cycles through DIFFERENT
 * problems instead of repeating. Falls back to plain getProblem(undefined)
 * (a fresh session-less random pick) if this specific call fails, so a
 * transient network hiccup degrades to "still get a new problem" rather
 * than leaving the button stuck.
 */
export async function getNextProblem(excludeSlugs: string[]): Promise<CodingProblem> {
  try {
    const {data} = await apiClient.get<ProblemWire>('/api/v1/coding/problem', {
      params: {next: 1, exclude: excludeSlugs.join(','), responseLanguage: currentLanguage()},
    });
    const testCases = (data.test_cases ?? []).map(c => ({
      input: c.stdin ?? '',
      expectedOutput: c.expected_output ?? '',
    }));
    if (!data.title || !testCases.length) throw new Error('Incomplete problem response');
    return {
      slug: data.slug ?? 'problem',
      title: data.title,
      difficulty: data.difficulty,
      category: data.category,
      description: data.description ?? '',
      testCases,
      starterCode: data.starter_code ?? {},
    };
  } catch {
    return getProblem(undefined, undefined);
  }
}

interface ProblemSummaryWire {
  slug: string;
  title: string;
  difficulty: string;
  category: string;
  status: 'attempted' | 'solved' | null;
  bookmarked: boolean;
}

/**
 * GET /api/v1/coding/problems — the free-practice hub's browse list
 * (product follow-up: "add more features to the coding tool so that its
 * worth the amount its paid for" — there was previously no way to see
 * the whole problem bank or pick a specific problem at all, only whatever
 * a timed mock-interview session happened to assign). Optional filters
 * mirror the backend's query params 1:1.
 */
export async function listProblems(filters?: {
  difficulty?: string;
  category?: string;
  bookmarkedOnly?: boolean;
}): Promise<CodingProblemSummary[]> {
  // BUG FIX -- was missing responseLanguage, unlike its siblings
  // getProblem()/getNextProblem() above (same field-name-collision reason:
  // this domain's `language` already means the *programming* language).
  const {data} = await apiClient.get<ProblemSummaryWire[]>('/api/v1/coding/problems', {
    params: {
      difficulty: filters?.difficulty,
      category: filters?.category,
      bookmarked_only: filters?.bookmarkedOnly ? 1 : undefined,
      responseLanguage: currentLanguage(),
    },
  });
  return (data ?? []).map(p => ({
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    category: p.category,
    status: p.status,
    bookmarked: !!p.bookmarked,
  }));
}

/** POST/DELETE /api/v1/coding/problems/<slug>/bookmark — toggles a
 * problem's "revisit later" bookmark on the hub. */
export async function setBookmark(slug: string, bookmarked: boolean): Promise<boolean> {
  const {data} = bookmarked
    ? await apiClient.post<{bookmarked?: boolean}>(`/api/v1/coding/problems/${slug}/bookmark`)
    : await apiClient.delete<{bookmarked?: boolean}>(`/api/v1/coding/problems/${slug}/bookmark`);
  return !!data.bookmarked;
}

/**
 * POST /api/v1/coding/problems/<slug>/attempt — records a Run Tests
 * result against a specific problem so solved/attempted status persists
 * on the hub (CodingProgress on the backend). Called right after Run
 * Tests resolves on CodingProblemSolve.tsx — unlike the old
 * CodingInterview.tsx flow, there's no "Finish" step required for this to
 * be recorded.
 */
export async function recordAttempt(
  slug: string,
  language: string,
  passed: number,
  total: number,
): Promise<{status: 'attempted' | 'solved'}> {
  const {data} = await apiClient.post<{status?: 'attempted' | 'solved'}>(
    `/api/v1/coding/problems/${slug}/attempt`,
    {language, passed, total},
  );
  return {status: data.status ?? 'attempted'};
}

interface StatsWire {
  solved_total?: number;
  attempted_total?: number;
  total_problems?: number;
  solved_by_difficulty?: Record<string, number>;
  solved_by_category?: Record<string, number>;
}

/** GET /api/v1/coding/stats — the hub's header summary (solved/attempted
 * counts, broken down by difficulty and category). */
export async function getStats(): Promise<CodingStats> {
  const {data} = await apiClient.get<StatsWire>('/api/v1/coding/stats');
  return {
    solvedTotal: data.solved_total ?? 0,
    attemptedTotal: data.attempted_total ?? 0,
    totalProblems: data.total_problems ?? 0,
    solvedByDifficulty: data.solved_by_difficulty ?? {},
    solvedByCategory: data.solved_by_category ?? {},
  };
}

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
