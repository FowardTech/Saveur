import {CourseLevel} from 'services/learningService';

// Same "literal English value doubles as an identifier" concern as
// utils/interviewTypeLabels.ts — CourseLevel ('basic'|'intermediate'|
// 'advanced') and learningService.LEVEL_LABELS ('Basic'/'Intermediate'/
// 'Advanced') are used both as the course_id suffix sent to the backend
// (courseIdFor) and as the display text on LearningCourses.tsx/
// CourseSession.tsx. Translate only the display side through this lookup;
// the raw CourseLevel value keeps flowing to courseIdFor/getCourseProgress
// untouched.
type TFunc = (key: string, options?: Record<string, unknown>) => string;

const LEVEL_KEYS: Record<CourseLevel, string> = {
  basic: 'more:course_level_basic',
  intermediate: 'more:course_level_intermediate',
  advanced: 'more:course_level_advanced',
};

const LEVEL_DEFAULTS: Record<CourseLevel, string> = {
  basic: 'Basic',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export function getCourseLevelLabel(level: CourseLevel | undefined, t: TFunc): string {
  if (!level) return '';
  return t(LEVEL_KEYS[level], {defaultValue: LEVEL_DEFAULTS[level]});
}

// CAREER_PATHS (services/learningService.ts) — fixed 20-item list used both
// as the picker's display text and as the value threaded into
// checkTopic/effectiveTopic (e.g. "Roadmapping (Product Management)"). Only
// the picker's on-screen label goes through this lookup; the value stored
// in state/sent to the AI stays the canonical English path string, since
// that's what grounds the AI's topic-check/course-generation prompts today.
const CAREER_PATH_KEYS: Record<string, string> = {
  'Software Engineering': 'more:career_path_software_engineering',
  'Product Management': 'more:career_path_product_management',
  'Data Science & Analytics': 'more:career_path_data_science_analytics',
  'UX/UI Design': 'more:career_path_ux_ui_design',
  'Digital Marketing': 'more:career_path_digital_marketing',
  'Sales & Business Development': 'more:career_path_sales_business_development',
  'Finance & Accounting': 'more:career_path_finance_accounting',
  'Human Resources': 'more:career_path_human_resources',
  'Project Management': 'more:career_path_project_management',
  'Customer Success & Support': 'more:career_path_customer_success_support',
  'Operations & Supply Chain': 'more:career_path_operations_supply_chain',
  'Business Analysis': 'more:career_path_business_analysis',
  Cybersecurity: 'more:career_path_cybersecurity',
  'Cloud & DevOps': 'more:career_path_cloud_devops',
  'Legal & Compliance': 'more:career_path_legal_compliance',
  'Healthcare & Life Sciences': 'more:career_path_healthcare_life_sciences',
  'Education & Training': 'more:career_path_education_training',
  'Consulting & Strategy': 'more:career_path_consulting_strategy',
  'Entrepreneurship & Startups': 'more:career_path_entrepreneurship_startups',
  'Other / General Career Skills': 'more:career_path_other_general',
};

export function getCareerPathLabel(path: string | undefined, t: TFunc): string {
  if (!path) return '';
  const key = CAREER_PATH_KEYS[path];
  return key ? t(key, {defaultValue: path}) : path;
}

// DATA_COURSES (constants/Data.ts) — catalog `category` field, a closed set
// (CourseProps['category']), used purely as a display pill; not sent
// anywhere.
const COURSE_CATEGORY_KEYS: Record<string, string> = {
  Behavioral: 'more:course_category_behavioral',
  Technical: 'more:course_category_technical',
  'Salary Negotiation': 'more:course_category_salary_negotiation',
  Resume: 'more:course_category_resume',
  'System Design': 'more:course_category_system_design',
  Networking: 'more:course_category_networking',
  Onboarding: 'more:course_category_onboarding',
};

export function getCourseCategoryLabel(category: string | undefined, t: TFunc): string {
  if (!category) return '';
  const key = COURSE_CATEGORY_KEYS[category];
  return key ? t(key, {defaultValue: category}) : category;
}

// DATA_COURSES catalog title/description — static mock course content
// (constants/Data.ts). Keyed by course id so the same lookup pattern applies
// without changing the catalog's shape.
const COURSE_TITLE_KEYS: Record<string, string> = {
  course_star: 'more:course_star_title',
  course_system_design: 'more:course_system_design_title',
  course_salary_negotiation: 'more:course_salary_negotiation_title',
  course_resume: 'more:course_resume_title',
  course_algo_patterns: 'more:course_algo_patterns_title',
  course_networking: 'more:course_networking_title',
  course_executive_presence: 'more:course_executive_presence_title',
  course_new_job_onboarding: 'more:course_new_job_onboarding_title',
};

const COURSE_DESCRIPTION_KEYS: Record<string, string> = {
  course_star: 'more:course_star_description',
  course_system_design: 'more:course_system_design_description',
  course_salary_negotiation: 'more:course_salary_negotiation_description',
  course_resume: 'more:course_resume_description',
  course_algo_patterns: 'more:course_algo_patterns_description',
  course_networking: 'more:course_networking_description',
  course_executive_presence: 'more:course_executive_presence_description',
  course_new_job_onboarding: 'more:course_new_job_onboarding_description',
};

export function getCourseTitleLabel(id: string, fallback: string, t: TFunc): string {
  const key = COURSE_TITLE_KEYS[id];
  return key ? t(key, {defaultValue: fallback}) : fallback;
}

export function getCourseDescriptionLabel(id: string, fallback: string, t: TFunc): string {
  const key = COURSE_DESCRIPTION_KEYS[id];
  return key ? t(key, {defaultValue: fallback}) : fallback;
}
