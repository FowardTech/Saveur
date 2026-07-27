import {Interview_Type_Enum, Practice_Mode_Enum, Difficulty_Enum, Application_Stage_Enum} from 'constants/Types';

// Interview_Type_Enum's own values (constants/Types.tsx) are literal English
// strings ("Behavioral", "System Design", ...) that double as the identifier
// sent to the backend (interviewType param on startSession/MockInterviewSetup
// etc.) — they can't be translated in place without breaking every API call
// that relies on the exact value. This maps each enum value to a `find:*`
// translation key instead, purely for display; every screen that renders an
// interview type (src/find/FindScreen.tsx, src/home/HomeSrc.tsx,
// src/practice/MockInterviewSetup.tsx, src/practice/ScheduleInterview.tsx,
// src/practice/InterviewFeedback.tsx, src/practice/MyProgress.tsx,
// src/requests/PracticeHistory/PracticeSessionItem.tsx) should go through
// this rather than rendering the raw enum value, so a French/Spanish/etc.
// user sees "Conception système" instead of "System Design" while the value
// actually sent to the backend is untouched.
type TFunc = (key: string, options?: Record<string, unknown>) => string;

export function getInterviewTypeLabel(type: string | undefined, t: TFunc): string {
  if (!type) return '';
  const key = INTERVIEW_TYPE_KEYS[type];
  return key ? t(key, {defaultValue: type}) : type;
}

const INTERVIEW_TYPE_KEYS: Record<string, string> = {
  [Interview_Type_Enum.Behavioral]: 'find:interview_type_behavioral',
  [Interview_Type_Enum.Technical]: 'find:interview_type_technical',
  [Interview_Type_Enum.Coding]: 'find:interview_type_coding',
  [Interview_Type_Enum.SystemDesign]: 'find:interview_type_system_design',
  [Interview_Type_Enum.ProductManagement]: 'find:interview_type_product_management',
  [Interview_Type_Enum.Sales]: 'find:interview_type_sales',
  [Interview_Type_Enum.Marketing]: 'find:interview_type_marketing',
  [Interview_Type_Enum.Finance]: 'find:interview_type_finance',
  [Interview_Type_Enum.Healthcare]: 'find:interview_type_healthcare',
  [Interview_Type_Enum.CustomerService]: 'find:interview_type_customer_service',
  [Interview_Type_Enum.Government]: 'find:interview_type_government',
  [Interview_Type_Enum.Consulting]: 'find:interview_type_consulting',
  [Interview_Type_Enum.Executive]: 'find:interview_type_executive',
  [Interview_Type_Enum.Graduate]: 'find:interview_type_graduate',
  [Interview_Type_Enum.Internship]: 'find:interview_type_internship',
  [Interview_Type_Enum.Sports]: 'find:interview_type_sports',
};

// Same problem, same fix, for Practice_Mode_Enum ("Voice"/"Text"/"Video") and
// Difficulty_Enum ("Beginner"/"Intermediate"/"Advanced") — both also literal
// English enum values doubling as the value sent to the backend.
export function getPracticeModeLabel(mode: string | undefined, t: TFunc): string {
  if (!mode) return '';
  const key = PRACTICE_MODE_KEYS[mode];
  return key ? t(key, {defaultValue: mode}) : mode;
}

// DATA_PRACTICE_MODES (constants/Data.ts) also carries a hardcoded English
// `description` string per mode (e.g. "Speak your answers, get spoken
// feedback") purely for display on MockInterviewSetup's mode cards — not an
// enum value and never sent to the backend, but still needs its own
// translation lookup since it isn't the same key as the mode label itself.
export function getPracticeModeDescription(mode: string | undefined, t: TFunc): string {
  if (!mode) return '';
  const key = PRACTICE_MODE_DESCRIPTION_KEYS[mode];
  return key ? t(key, {defaultValue: PRACTICE_MODE_DESCRIPTION_DEFAULTS[mode]}) : '';
}

export function getDifficultyLabel(difficulty: string | undefined, t: TFunc): string {
  if (!difficulty) return '';
  const key = DIFFICULTY_KEYS[difficulty];
  return key ? t(key, {defaultValue: difficulty}) : difficulty;
}

// Session status ('Completed' | 'Scheduled' — MockInterviewSessionProps in
// constants/Types.tsx) isn't an enum, just a literal string union, but has
// the exact same "also used as a value, not just a label" concern in a
// couple of places (e.g. PracticeSessionItem.tsx's status tag), so gets the
// same treatment.
export function getSessionStatusLabel(status: string | undefined, t: TFunc): string {
  if (!status) return '';
  const key = SESSION_STATUS_KEYS[status];
  return key ? t(key, {defaultValue: status}) : status;
}

const PRACTICE_MODE_KEYS: Record<string, string> = {
  [Practice_Mode_Enum.Voice]: 'find:practice_mode_voice',
  [Practice_Mode_Enum.Text]: 'find:practice_mode_text',
  [Practice_Mode_Enum.Video]: 'find:practice_mode_video',
};

const PRACTICE_MODE_DESCRIPTION_KEYS: Record<string, string> = {
  [Practice_Mode_Enum.Voice]: 'find:practice_mode_voice_description',
  [Practice_Mode_Enum.Text]: 'find:practice_mode_text_description',
  [Practice_Mode_Enum.Video]: 'find:practice_mode_video_description',
};

const PRACTICE_MODE_DESCRIPTION_DEFAULTS: Record<string, string> = {
  [Practice_Mode_Enum.Voice]: 'Speak your answers, get spoken feedback',
  [Practice_Mode_Enum.Text]: 'Type your answers at your own pace',
  [Practice_Mode_Enum.Video]: 'Practice on camera like a real interview',
};

const DIFFICULTY_KEYS: Record<string, string> = {
  [Difficulty_Enum.Beginner]: 'find:difficulty_beginner',
  [Difficulty_Enum.Intermediate]: 'find:difficulty_intermediate',
  [Difficulty_Enum.Advanced]: 'find:difficulty_advanced',
};

const SESSION_STATUS_KEYS: Record<string, string> = {
  Completed: 'find:session_status_completed',
  Scheduled: 'find:session_status_scheduled',
};

// Application_Stage_Enum (constants/Types.tsx) — same "literal English value
// doubles as backend identifier" concern as the interview enums above, used
// by the Application Tracker (ApplicationDetails.tsx, ApplicationItem.tsx,
// ApplicationsTab.tsx).
export function getApplicationStageLabel(stage: string | undefined, t: TFunc): string {
  if (!stage) return '';
  const key = APPLICATION_STAGE_KEYS[stage];
  return key ? t(key, {defaultValue: stage}) : stage;
}

const APPLICATION_STAGE_KEYS: Record<string, string> = {
  [Application_Stage_Enum.Applied]: 'request:application_stage_applied',
  [Application_Stage_Enum.Interviewing]: 'request:application_stage_interviewing',
  [Application_Stage_Enum.Offer]: 'request:application_stage_offer',
  [Application_Stage_Enum.Rejected]: 'request:application_stage_rejected',
};
