import i18n from 'i18next';
import {NavigationProp} from '@react-navigation/native';
import {SuggestedActionId} from 'constants/Types';
import {NEW_JOB_COURSE_TITLE, NEW_JOB_COURSE_MODULES} from 'constants/Data';
import {RootStackParamList} from 'navigation/types';
import * as learningService from './learningService';

// ---------------------------------------------------------------------------
// Single source of truth for what the AI Coach's SUGGESTED_ACTION marker can
// actually DO in the app — see constants/Types.tsx's SuggestedActionId for
// the full background on why this replaces 4+ previously-duplicated
// switch/ternary chains (src/messages/Chat.tsx's onRunSuggestedAction +
// renderCustomView, src/messages/VoiceCoachView.tsx's offer-text ternary).
//
// Every entry needs a short `title` (a plain-English name for the
// destination, e.g. "Mock Interview", "Career Roadmap") and an eva icon
// name — both are reused for two different pieces of UI text via generic
// templates (Chat.tsx's tappable chip, VoiceCoachView's spoken "want me to
// take you there?" offer), rather than each action carrying its own
// hand-written sentence x2 as before. That's a real behavior change for the
// original 4 actions (their offer text used to be a custom full sentence
// per action, e.g. "Want me to start a mock interview for you now?") in
// exchange for this being maintainable at 40+ entries — losing a little
// per-action color for consistency and so a NEW action never needs new
// prose written in 3 different places again.
// ---------------------------------------------------------------------------

interface ActionMeta {
  title: string;
  titleKey: string;
  icon: string;
}

export const ACTION_META: Record<SuggestedActionId, ActionMeta> = {
  mock_interview: {title: 'a Mock Interview', titleKey: 'message:suggested_action_title_mock_interview', icon: 'mic-outline'},
  daily_challenge: {title: "today's Daily Challenge", titleKey: 'message:suggested_action_title_daily_challenge', icon: 'flash-outline'},
  new_job_course: {title: 'the Starting Your New Job course', titleKey: 'message:suggested_action_title_new_job_course', icon: 'briefcase-outline'},
  networking_assistant: {title: 'the Networking Assistant', titleKey: 'message:suggested_action_title_networking_assistant', icon: 'people-outline'},
  continue_learning: {title: 'where you left off learning', titleKey: 'message:suggested_action_title_continue_learning', icon: 'play-circle-outline'},
  application_tracker: {title: 'your Application Tracker', titleKey: 'message:suggested_action_title_application_tracker', icon: 'briefcase-outline'},
  career_goal: {title: 'your Career Goal', titleKey: 'message:suggested_action_title_career_goal', icon: 'flag-outline'},
  job_preferences: {title: 'your Job Preferences', titleKey: 'message:suggested_action_title_job_preferences', icon: 'options-2-outline'},
  my_progress: {title: 'your Progress', titleKey: 'message:suggested_action_title_my_progress', icon: 'trending-up-outline'},
  goals_hub: {title: 'your Goals', titleKey: 'message:suggested_action_title_goals_hub', icon: 'flag-outline'},
  leaderboard: {title: 'the Leaderboard', titleKey: 'message:suggested_action_title_leaderboard', icon: 'award-outline'},
  faq: {title: 'the FAQ', titleKey: 'message:suggested_action_title_faq', icon: 'question-mark-circle-outline'},
  policy: {title: 'the Privacy Policy & Terms', titleKey: 'message:suggested_action_title_policy', icon: 'file-text-outline'},
  about: {title: 'the About screen', titleKey: 'message:suggested_action_title_about', icon: 'info-outline'},
  resume_builder: {title: 'the Resume Builder', titleKey: 'message:suggested_action_title_resume_builder', icon: 'file-text-outline'},
  my_documents: {title: 'My Documents', titleKey: 'message:suggested_action_title_my_documents', icon: 'folder-outline'},
  jd_analyzer: {title: 'the JD Analyzer', titleKey: 'message:suggested_action_title_jd_analyzer', icon: 'search-outline'},
  saved_videos: {title: 'your Saved Videos', titleKey: 'message:suggested_action_title_saved_videos', icon: 'bookmark-outline'},
  weekly_career_report: {title: 'your Weekly Career Report', titleKey: 'message:suggested_action_title_weekly_career_report', icon: 'bar-chart-outline'},
  daily_industry_news: {title: "Today's Industry News", titleKey: 'message:suggested_action_title_daily_industry_news', icon: 'globe-2-outline'},
  resume_variants: {title: 'your Resume Evolution', titleKey: 'message:suggested_action_title_resume_variants', icon: 'file-text-outline'},
  generated_documents: {title: 'your Generated Documents', titleKey: 'message:suggested_action_title_generated_documents', icon: 'download-outline'},
  linkedin_optimizer: {title: 'the LinkedIn Optimizer', titleKey: 'message:suggested_action_title_linkedin_optimizer', icon: 'linkedin-outline'},
  emotional_coach: {title: 'the Emotional Coach', titleKey: 'message:suggested_action_title_emotional_coach', icon: 'heart-outline'},
  company_intelligence: {title: 'Company Intelligence', titleKey: 'message:suggested_action_title_company_intelligence', icon: 'briefcase-outline'},
  student_verification: {title: 'Student Verification', titleKey: 'message:suggested_action_title_student_verification', icon: 'checkmark-circle-2-outline'},
  salary_negotiation: {title: 'Salary Negotiation practice', titleKey: 'message:suggested_action_title_salary_negotiation', icon: 'trending-up-outline'},
  system_design_whiteboard: {title: 'the System Design Whiteboard', titleKey: 'message:suggested_action_title_system_design_whiteboard', icon: 'grid-outline'},
  learning_courses: {title: 'Learning Courses', titleKey: 'message:suggested_action_title_learning_courses', icon: 'book-open-outline'},
  career_diary: {title: 'your Career Diary', titleKey: 'message:suggested_action_title_career_diary', icon: 'edit-2-outline'},
  my_ratings: {title: 'My Ratings', titleKey: 'message:suggested_action_title_my_ratings', icon: 'star-outline'},
  career_roadmap: {title: 'your Career Roadmap', titleKey: 'message:suggested_action_title_career_roadmap', icon: 'map-outline'},
  career_dna: {title: 'your Career DNA', titleKey: 'message:suggested_action_title_career_dna', icon: 'activity-outline'},
  dream_companies: {title: 'your Dream Companies', titleKey: 'message:suggested_action_title_dream_companies', icon: 'star-outline'},
  practical_scenarios: {title: 'a Practical Scenario', titleKey: 'message:suggested_action_title_practical_scenarios', icon: 'layers-outline'},
  referral_program: {title: 'the Referral Program', titleKey: 'message:suggested_action_title_referral_program', icon: 'gift-outline'},
  security_settings: {title: 'Security Settings', titleKey: 'message:suggested_action_title_security_settings', icon: 'shield-outline'},
  job_alerts: {title: 'your Job Alerts', titleKey: 'message:suggested_action_title_job_alerts', icon: 'bell-outline'},
  subscription: {title: 'your Subscription', titleKey: 'message:suggested_action_title_subscription', icon: 'credit-card-outline'},
  payment_history: {title: 'your Payment History', titleKey: 'message:suggested_action_title_payment_history', icon: 'credit-card-outline'},
  shared_with_me: {title: 'Shared With Me', titleKey: 'message:suggested_action_title_shared_with_me', icon: 'share-outline'},
  schedule_interview: {title: 'Schedule an Interview', titleKey: 'message:suggested_action_title_schedule_interview', icon: 'calendar-outline'},
  cover_letter_generator: {title: 'the Cover Letter Generator', titleKey: 'message:suggested_action_title_cover_letter_generator', icon: 'file-text-outline'},
};

// Localized title — falls back to the plain-English `title` above (used as
// the i18n defaultValue) exactly like every other t(key, {defaultValue})
// call elsewhere in this app.
export function actionTitle(id: SuggestedActionId): string {
  const meta = ACTION_META[id];
  return i18n.t(meta.titleKey, {defaultValue: meta.title});
}

type Nav = NavigationProp<RootStackParamList>;

// Plain single-screen destinations that take no required params — the vast
// majority of the list. Each maps straight to a RootStackParamList screen
// name; `params` is included only for the handful whose param type doesn't
// accept a bare `undefined` (React Navigation still requires an explicit,
// even if empty, object in that case).
const SCREEN_MAP: Partial<Record<SuggestedActionId, {screen: string; params?: object}>> = {
  mock_interview: {screen: 'MockInterviewSetup', params: {}},
  daily_challenge: {screen: 'DailyChallenge'},
  networking_assistant: {screen: 'NetworkingAssistant'},
  career_goal: {screen: 'ChangeCareType'},
  job_preferences: {screen: 'JobPreferences'},
  my_progress: {screen: 'MyProgress'},
  goals_hub: {screen: 'GoalsScreen'},
  leaderboard: {screen: 'Leaderboard'},
  faq: {screen: 'FaqScreen'},
  policy: {screen: 'PolicyScreen'},
  about: {screen: 'AboutScreen'},
  resume_builder: {screen: 'ResumeBuilder'},
  my_documents: {screen: 'MyDocuments'},
  jd_analyzer: {screen: 'JDAnalyzer'},
  saved_videos: {screen: 'SavedVideos'},
  weekly_career_report: {screen: 'WeeklyCareerReport'},
  daily_industry_news: {screen: 'DailyIndustryNews'},
  resume_variants: {screen: 'ResumeVariants'},
  generated_documents: {screen: 'GeneratedDocuments'},
  linkedin_optimizer: {screen: 'LinkedInOptimizer'},
  emotional_coach: {screen: 'EmotionalCoach'},
  company_intelligence: {screen: 'CompanyIntelligence', params: {}},
  student_verification: {screen: 'StudentVerification'},
  salary_negotiation: {screen: 'SalaryNegotiation'},
  system_design_whiteboard: {screen: 'SystemDesignWhiteboard'},
  learning_courses: {screen: 'LearningCourses'},
  career_diary: {screen: 'CareerDiary'},
  my_ratings: {screen: 'MyRatings'},
  career_roadmap: {screen: 'CareerRoadmap'},
  career_dna: {screen: 'CareerDna'},
  dream_companies: {screen: 'DreamCompanies'},
  practical_scenarios: {screen: 'PracticalScenarioSetup'},
  referral_program: {screen: 'ReferralProgram'},
  security_settings: {screen: 'SecuritySettings'},
  job_alerts: {screen: 'JobAlerts'},
  subscription: {screen: 'Subscription'},
  payment_history: {screen: 'PaymentHistory'},
  shared_with_me: {screen: 'SharedWithMe'},
  schedule_interview: {screen: 'ScheduleInterview'},
  cover_letter_generator: {screen: 'CoverLetterGenerator', params: {}},
  // new_job_course, continue_learning, application_tracker are NOT here —
  // each needs real logic (a fixed course payload, an async lookup, or a
  // 2-level nested tab navigation) rather than a flat screen+params pair.
  // Handled explicitly in runSuggestedAction below.
};

/**
 * Actually performs the navigation for a SUGGESTED_ACTION id — the ONLY
 * place this app calls navigate() for a coach-suggested action (both
 * src/messages/Chat.tsx's text mode and VoiceCoachView.tsx's voice mode
 * call through here now, instead of each keeping its own copy of this
 * logic).
 *
 * `navigate` is typed loosely (`Nav['navigate']` cast through `any` at each
 * call site below) rather than fully generically — RootStackParamList's
 * screen union makes a single fully-typed dispatcher over 40+ heterogeneous
 * param shapes impractical, and every target here is already a real,
 * statically-known screen name checked against navigation/types.tsx by hand
 * when this table was built (see this file's own SCREEN_MAP above).
 */
export async function runSuggestedAction(id: SuggestedActionId, navigate: Nav['navigate']): Promise<void> {
  const nav = navigate as (screen: string, params?: object) => void;

  if (id === 'new_job_course') {
    nav('CourseSession', {
      topic: NEW_JOB_COURSE_TITLE,
      totalModules: NEW_JOB_COURSE_MODULES,
      level: 'basic',
    });
    return;
  }

  if (id === 'application_tracker') {
    // Interviews tab wraps its own nested stack (RequestsBottomNavigator,
    // see navigation/RequestsBottomNavigator.tsx) with RequestsSrc as its
    // initial screen (the ViewPager holding "Practice History" and
    // "Application Tracker") — a 2-level `screen`/`params.screen` hop, same
    // pattern React Navigation uses for any nested-stack-inside-a-tab jump.
    nav('MainBottomTab', {screen: 'Interviews', params: {screen: 'RequestsSrc'}});
    return;
  }

  if (id === 'continue_learning') {
    // Product report: "I asked it to open the learning course screen so I
    // can continue from the lesson and the video lesson but it did not
    // open the screen" — reuses the exact same "what's actually in
    // progress right now" logic as the Home screen's Continue Learning
    // card (services/learningService.ts's deriveContinueCourse /
    // getContinueVideo), so the coach lands the user in the same place
    // that card would.
    try {
      const all = await learningService.getAllProgress();
      const course = learningService.deriveContinueCourse(all);
      if (course) {
        nav('CourseSession', {
          topic: course.topic,
          totalModules: course.totalModules,
          level: course.level,
        });
        return;
      }
    } catch {
      // fall through to the video check / catalog fallback below
    }
    try {
      const video = await learningService.getContinueVideo();
      if (video) {
        // There's no standalone "play this video" route — playback is
        // rendered inline by src/home/ContinueLearningCard.tsx on the Home
        // tab (components/InAppVideoPlayer.tsx opened from local state, not
        // a navigable screen). Jumping to Home puts the user right on that
        // card so they can tap "Continue" themselves.
        nav('MainBottomTab', {screen: 'Home'});
        return;
      }
    } catch {
      // fall through to the catalog fallback below
    }
    // Nothing genuinely in progress to resume — the course catalog itself
    // is still a reasonable landing spot rather than doing nothing.
    nav('LearningCourses');
    return;
  }

  const entry = SCREEN_MAP[id];
  if (!entry) return;
  nav(entry.screen, entry.params);
}
