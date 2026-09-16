import i18n from 'i18next';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// onboardingAssessmentService — Career Personality Assessment + Skills Prep
// Quiz (product request: "I want us to add prep test and many other
// personality test during onboarding and also when user enters the
// dashboard for the first time"). Deliberately separate from
// careerDnaService.ts's Career DNA (an ongoing, usage-derived, Pro
// Premium-gated profile) -- this is a free, one-time (retakeable), explicit
// quiz. Entirely server-driven: this file holds no question bank or
// scoring logic of its own, just wire-shape mapping -- see
// Saveur-Backend's app/services/onboarding_assessment_service.py for the
// actual question content and scoring, shared identically with the web app.
// ---------------------------------------------------------------------------

function currentLanguage(): string {
  return i18n.language || 'en';
}

export interface OnboardingStatus {
  personalityCompleted: boolean;
  skillsPrepCompleted: boolean;
}

interface WireStatus {
  personality_completed?: boolean;
  skills_prep_completed?: boolean;
}

/** GET /api/v1/onboarding/status */
export async function getStatus(): Promise<OnboardingStatus> {
  const {data} = await apiClient.get<WireStatus>('/api/v1/onboarding/status');
  return {
    personalityCompleted: !!data.personality_completed,
    skillsPrepCompleted: !!data.skills_prep_completed,
  };
}

export interface PersonalityQuestion {
  id: string;
  text: string;
  options: string[];
}

interface WirePersonalityQuestions {
  questions?: PersonalityQuestion[];
}

/** GET /api/v1/onboarding/personality/questions — the fixed 12-question
 * bank, already translated server-side for the current app language. */
export async function getPersonalityQuestions(): Promise<PersonalityQuestion[]> {
  const {data} = await apiClient.get<WirePersonalityQuestions>(
    '/api/v1/onboarding/personality/questions',
    {params: {language: currentLanguage()}},
  );
  return data.questions ?? [];
}

export interface PersonalityAnswer {
  questionId: string;
  optionIndex: number;
}

export interface PersonalityResult {
  traits: Record<string, string>;
  narrative: string;
}

interface WirePersonalityResult {
  traits?: Record<string, string>;
  narrative?: string;
}

/** POST /api/v1/onboarding/personality/submit */
export async function submitPersonality(answers: PersonalityAnswer[]): Promise<PersonalityResult> {
  const {data} = await apiClient.post<WirePersonalityResult>('/api/v1/onboarding/personality/submit', {
    answers: answers.map(a => ({question_id: a.questionId, option_index: a.optionIndex})),
    language: currentLanguage(),
  });
  return {traits: data.traits ?? {}, narrative: data.narrative ?? ''};
}

export interface SkillsQuizQuestion {
  id: string;
  text: string;
  options: string[];
}

interface WireSkillsQuizGenerate {
  quiz_id: string;
  questions: SkillsQuizQuestion[];
}

export interface SkillsQuizGenerateResult {
  quizId: string;
  questions: SkillsQuizQuestion[];
}

/** POST /api/v1/onboarding/skills-quiz/generate — role/industry should be
 * whatever the user already picked during signup (desiredRoles/industries),
 * falling back to a generic quiz server-side if neither is on file yet. */
export async function generateSkillsQuiz(role?: string, industry?: string): Promise<SkillsQuizGenerateResult> {
  const {data} = await apiClient.post<WireSkillsQuizGenerate>('/api/v1/onboarding/skills-quiz/generate', {
    role: role || '',
    industry: industry || '',
    language: currentLanguage(),
  });
  return {quizId: data.quiz_id, questions: data.questions ?? []};
}

export interface SkillsQuizAnswer {
  questionId: string;
  selectedIndex: number;
}

export interface SkillsQuizResultDetail {
  questionId: string;
  text: string;
  options: string[];
  selectedIndex: number | null;
  correctIndex: number;
  correct: boolean;
  explanation: string;
}

export interface SkillsQuizResult {
  score: number;
  total: number;
  detail: SkillsQuizResultDetail[];
}

interface WireSkillsQuizDetail {
  question_id: string;
  text: string;
  options: string[];
  selected_index: number | null;
  correct_index: number;
  correct: boolean;
  explanation: string;
}

interface WireSkillsQuizResult {
  score?: number;
  total?: number;
  detail?: WireSkillsQuizDetail[];
}

/** POST /api/v1/onboarding/skills-quiz/:quizId/submit */
export async function submitSkillsQuiz(
  quizId: string,
  answers: SkillsQuizAnswer[],
  role?: string,
): Promise<SkillsQuizResult> {
  const {data} = await apiClient.post<WireSkillsQuizResult>(
    `/api/v1/onboarding/skills-quiz/${quizId}/submit`,
    {
      answers: answers.map(a => ({question_id: a.questionId, selected_index: a.selectedIndex})),
      role: role || '',
    },
  );
  return {
    score: data.score ?? 0,
    total: data.total ?? 0,
    detail: (data.detail ?? []).map(d => ({
      questionId: d.question_id,
      text: d.text,
      options: d.options,
      selectedIndex: d.selected_index,
      correctIndex: d.correct_index,
      correct: d.correct,
      explanation: d.explanation,
    })),
  };
}
