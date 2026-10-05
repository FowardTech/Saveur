import i18n from 'i18next';
import apiClient from './apiClient';

// Lifetime career features (Saveur-Backend app/api/lifetime.py).
const B = '/api/v1/lifetime';
const lang = () => ({language: i18n.language || 'en'});

export interface Overview {
  weekly_checkin_done: boolean;
  weekly_next_step: string | null;
  brag_count: number;
  timeline_count: number;
  pay_checked_at: string | null;
  pay_behind: boolean;
  market_checked_at: string | null;
  skill_milestones_open: number;
}
export interface WeeklyCheckin {
  id: number;
  week_start: string;
  next_step_done: boolean;
  summary: string;
  wins: string[];
  learnings: string[];
  focus_next_week: string;
  next_step: {title: string; why: string; action: string};
  encouragement: string;
  entries_used: number;
}
export interface BragItem {
  id: number;
  title: string;
  bullet: string;
  impact?: string;
  skills: string[];
  applied_to_resume: boolean;
}
export interface ReviewPrep {
  kind: string;
  evidence: {claim: string; proof: string}[];
  self_review: string;
  talking_points: string[];
  likely_questions: {question: string; tip: string}[];
  gaps: string[];
  ask: string;
}
export interface LeadershipPrep {
  kind: string;
  title: string;
  goal: string;
  sections: {heading: string; points: string[]}[];
  script: string;
  avoid: string[];
}
export interface RoleplayFeedback {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  better_phrasing: {you_said: string; try: string}[];
}
export interface PayCheck {
  behind: boolean;
  position: string;
  gap_pct: number;
  current_base: number;
  currency: string;
  role?: string;
  location: string;
  market: {p25: number; p50: number; p75: number};
  suggested_ask?: number | null;
  tip?: string;
  caveat?: string;
  created_at?: string;
}
export interface MarketRole {
  id: number;
  title: string;
  company: string;
  location?: string;
  apply_url?: string;
  why: string;
  step_up: string;
}
export interface MarketDigest {
  roles: MarketRole[];
  summary: string;
  empty?: boolean;
  created_at?: string;
}
export interface SkillPlan {
  target_role: string;
  current_role: string;
  weeks: number;
  gap_summary: string;
  skills: {name: string; why: string; level_now: string; level_goal: string}[];
  certifications: {name: string; provider: string; why: string; est_weeks: number}[];
  milestones: {id: string; title: string; type: string; due: string; done: boolean}[];
}
export interface TimelineEvent {
  id: string;
  source: 'timeline' | 'pay' | 'certificate';
  kind: string;
  title: string;
  detail?: string | null;
  date: string;
  deletable: boolean;
}

export const getOverview = async () => (await apiClient.get<Overview>(`${B}/overview`)).data;

export const getWeekly = async () =>
  (await apiClient.get<{current_week_start: string; checkins: WeeklyCheckin[]}>(`${B}/checkin/weekly`)).data;
export const generateWeekly = async (reflection?: string) =>
  (await apiClient.post<WeeklyCheckin>(`${B}/checkin/weekly`, {reflection, ...lang()})).data;
export const setStepDone = async (id: number, done: boolean) =>
  (await apiClient.post<WeeklyCheckin>(`${B}/checkin/weekly/${id}/step-done`, {done})).data;

export const getBrag = async () => (await apiClient.get<{items: BragItem[]}>(`${B}/brag`)).data.items;
export const generateBrag = async () => (await apiClient.post<{items: BragItem[]}>(`${B}/brag/generate`, lang())).data.items;
export const deleteBrag = async (id: number) => apiClient.delete(`${B}/brag/${id}`);
export const applyBragToResume = async () => (await apiClient.post<{applied: number}>(`${B}/brag/apply-to-resume`, {})).data.applied;

export const getReviewPrep = async () => {
  const {data} = await apiClient.get<Partial<ReviewPrep>>(`${B}/review/prep`);
  return data.self_review ? (data as ReviewPrep) : null;
};
export const buildReviewPrep = async (kind: 'performance_review' | 'promotion', role: string, target_role: string) =>
  (await apiClient.post<ReviewPrep>(`${B}/review/prep`, {kind, role, target_role, ...lang()})).data;

export const buildLeadershipPrep = async (kind: string, situation: string, person: string) =>
  (await apiClient.post<LeadershipPrep>(`${B}/leadership/prep`, {kind, situation, person, ...lang()})).data;

export const roleplayReply = async (scenario: string, context: string, messages: {role: 'user' | 'ai'; text: string}[]) =>
  (await apiClient.post<{reply: string}>(`${B}/roleplay`, {scenario, context, messages, ...lang()})).data.reply;
export const roleplayFeedback = async (scenario: string, context: string, messages: {role: 'user' | 'ai'; text: string}[]) =>
  (await apiClient.post<{feedback: RoleplayFeedback}>(`${B}/roleplay`, {scenario, context, messages, finish: true, ...lang()})).data.feedback;

export const getPay = async () => (await apiClient.get<{latest: PayCheck | null; due: boolean}>(`${B}/pay`)).data;
export const runPayCheck = async (location?: string) =>
  (await apiClient.post<{latest: PayCheck}>(`${B}/pay/check`, {location, ...lang()})).data.latest;

export const getMarket = async () => (await apiClient.get<{latest: MarketDigest | null}>(`${B}/market`)).data.latest;
export const refreshMarket = async () => (await apiClient.post<{latest: MarketDigest}>(`${B}/market/refresh`, lang())).data.latest;

export const getSkillPlan = async () => (await apiClient.get<{plan: SkillPlan | null}>(`${B}/skills`)).data.plan;
export const buildSkillPlan = async (target_role: string, current_role: string, weeks: number) =>
  (await apiClient.post<{plan: SkillPlan}>(`${B}/skills/plan`, {target_role, current_role, weeks, ...lang()})).data.plan;
export const setMilestone = async (id: string, done: boolean) =>
  (await apiClient.post<{plan: SkillPlan}>(`${B}/skills/milestone`, {id, done})).data.plan;

export const getTimeline = async () => (await apiClient.get<{events: TimelineEvent[]}>(`${B}/timeline`)).data.events;
export const addTimeline = async (e: {title: string; kind: string; date: string; detail?: string}) =>
  (await apiClient.post<TimelineEvent>(`${B}/timeline`, e)).data;
export const deleteTimeline = async (id: string) => apiClient.delete(`${B}/timeline/${id.replace(/^t/, '')}`);

export const errMsg = (e: any, fallback: string) => e?.response?.data?.message ?? e?.message ?? fallback;
