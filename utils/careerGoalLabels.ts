// BUG FIX (product report, with screenshot: the Goals screen showed the
// literal English word "Promotion" even though the app's language was set
// to Chinese) — root cause: src/more/ChangeCareType/index.tsx (and
// src/auth/Signup/SignupFirstStep.tsx, the same picker at signup) were
// persisting `updateProfile({ goals: [items[active].title] })` — the
// ALREADY-TRANSLATED display string for whatever locale was active at save
// time, not a stable identifier. Switching languages later can never
// re-translate a value that was permanently baked into one language when it
// was written. Same class of bug already solved for
// Application_Stage_Enum via getApplicationStageLabel
// (utils/interviewTypeLabels.ts) and for Interview_Type_Enum in that same
// file — this is the identical fix for the 10-item career-goal picker: a
// single canonical list (stable English `defaultValue` doubles as the
// identifier that gets persisted/sent to the backend, same convention the
// enums above use), a reverse lookup for display, and both write sites
// (ChangeCareType/index.tsx, SignupFirstStep.tsx) switched to persist the
// stable `defaultValue` instead of the resolved `title`.
type TFunc = (key: string, options?: Record<string, unknown>) => string;

export interface CareerGoalOption {
  titleKey: string;
  defaultValue: string;
  icon: string;
}

export const CAREER_GOALS: CareerGoalOption[] = [
  { titleKey: 'auth:goal_new_job', defaultValue: 'Land a New Job', icon: 'briefcase-outline' },
  { titleKey: 'auth:goal_career_change', defaultValue: 'Career Change', icon: 'swap-outline' },
  { titleKey: 'auth:goal_promotion', defaultValue: 'Promotion', icon: 'trending-up-outline' },
  { titleKey: 'auth:goal_return_to_work', defaultValue: 'Return to Work', icon: 'log-in-outline' },
  { titleKey: 'auth:goal_internship', defaultValue: 'Internship / Grad Job', icon: 'book-open-outline' },
  { titleKey: 'auth:goal_executive', defaultValue: 'Executive Move', icon: 'star-outline' },
  { titleKey: 'auth:goal_start_business', defaultValue: 'Start a Business', icon: 'bulb-outline' },
  { titleKey: 'auth:goal_relocate', defaultValue: 'Relocate / Work Abroad', icon: 'globe-outline' },
  { titleKey: 'auth:goal_grow_network', defaultValue: 'Grow My Network', icon: 'people-outline' },
  { titleKey: 'auth:goal_explore_options', defaultValue: 'Explore My Options', icon: 'compass-outline' },
];

const CAREER_GOAL_KEYS: Record<string, string> = Object.fromEntries(
  CAREER_GOALS.map(g => [g.defaultValue, g.titleKey]),
);

// Falls back to the raw stored string if it doesn't match any known goal --
// covers legacy data that was already saved as a non-English translated
// string before this fix (nothing we can recover that back to a key from,
// same defensive fallback getApplicationStageLabel/getInterviewTypeLabel
// already use).
export function getCareerGoalLabel(goal: string | undefined, t: TFunc): string {
  if (!goal) return '';
  const key = CAREER_GOAL_KEYS[goal];
  return key ? t(key, { defaultValue: goal }) : goal;
}
