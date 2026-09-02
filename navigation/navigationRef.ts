import {CommonActions, createNavigationContainerRef} from '@react-navigation/native';
import {Difficulty_Enum, Interview_Type_Enum, JobAlertProps, Practice_Mode_Enum} from 'constants/Types';
import {RootStackParamList} from './types';

// Standard React Navigation "navigate without the navigation prop" escape
// hatch (https://reactnavigation.org/docs/navigating-without-navigation-prop/)
// — needed because services/pushNotificationService.ts's tap handlers fire
// from Firebase listeners set up in App.tsx, outside any screen component,
// so there's no useNavigation() to call.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// A push tap can resolve before the navigator has mounted — specifically
// messaging().getInitialNotification() when the app was launched cold by
// tapping a notification (not just backgrounded). Queue whichever one
// destination was requested and flush it from AppContainer's
// <NavigationContainer onReady> once the navigator is actually ready to
// accept a navigate() call. Generalized from a job-alert-only queue (a
// single `pendingJob`) so a tap on any OTHER notification type (see
// services/pushNotificationService.ts) has somewhere to go too, instead of
// being silently dropped if it happens to launch the app cold.
type PendingNavigation =
  | {name: 'JobAlertDetails'; params: {job: JobAlertProps}}
  | {
      name: 'WebViewScreen';
      params: {url: string; title?: string; job?: {company: string; role: string; applyUrl: string; companyLogoUrl?: string}};
    }
  | {name: 'Notification'}
  | {name: 'WeeklyCareerReport'}
  | {name: 'DailyIndustryNews'}
  // Push-tap destinations added for "push notifications aren't navigating to
  // the actual screens" (product request item — previously only job_alert,
  // weekly_career_report and daily_industry_news pushes went anywhere
  // specific; everything else silently fell back to the generic in-app
  // Notification list). See services/pushNotificationService.ts's
  // handleDataTap for the full data.type -> destination mapping.
  | {
      name: 'MockInterviewSetup';
      params: {
        interviewType?: Interview_Type_Enum;
        mode?: Practice_Mode_Enum;
        difficulty?: Difficulty_Enum;
        role?: string;
        company?: string;
        durationMin?: number;
      };
    }
  | {name: 'InterviewFeedback'; params: {sessionId?: string}}
  | {name: 'PracticalScenarioFeedback'; params: {sessionId: number}}
  | {name: 'CareerRoadmap'}
  | {name: 'Leaderboard'}
  | {name: 'Subscription'}
  | {name: 'PaymentHistory'}
  | {name: 'Home'}
  | {name: 'GoalTipDetail'}
  | {name: 'DailyChallenge'}
  | {name: 'SharedContentDetail'; params: {shareId: string}}
  // connection_request / connection_accepted push taps (product request
  // item: "Before a user can share something with another Saveur user they
  // must send a request first and until the other person accept it...").
  // `initialTab: 1` lands directly on SharedWithMe.tsx's "Pending Requests"
  // tab for an incoming request; connection_accepted has nothing specific
  // to show (the requester already knows who they requested), so it just
  // opens the default "Shared with Me" tab (0).
  | {name: 'SharedWithMe'; params?: {initialTab?: number}}
  // curriculum_week_unlocked / curriculum_complete / roadmap_step_unlocked /
  // roadmap_complete push+in-app-notification taps (product report: "the
  // notifications are not navigating to the individual screens concerned"
  // — these four kinds existed on both the push and in-app notification
  // paths already, sent by Saveur-Backend's app/api/learning.py and
  // app/api/career_roadmap.py, but neither path had ever routed them
  // anywhere; both fell through to the generic notification list).
  // roadmap_step_unlocked/roadmap_complete reuse the existing CareerRoadmap
  // destination above (same screen roadmap_ready already lands on).
  | {name: 'LearningCourses'}
  // post_offer_checkin push tap (product request: "always check up on the
  // user regularly to know how they are doing at the new role until the
  // first 90 days are over") -- nothing to parse out of the payload beyond
  // a week number the screen itself re-fetches anyway, so this just lands
  // on What's Next, which re-checks for a pending check-in on focus (see
  // src/more/WhatsNext.tsx) and pops the sheet itself.
  | {name: 'WhatsNext'}
  // next_step_plan push tap (product request: "after that [graduation]
  // redirect them to the next step and build up a next step career plan
  // recommendation or suggestion for them") -- see
  // src/more/NextStepRecommendation.tsx, which fetches the AI-authored
  // recommendation itself; nothing to parse out of the payload.
  | {name: 'NextStepRecommendation'}
  // stale_applications push tap (Saveur-Backend's job_tracker_service.py) —
  // previously fell through entirely to the generic notification list (see
  // the audit that also caught GoalTipDetail/DailyChallenge's missing
  // runNavigation branches below). Single stale application -> straight to
  // its detail screen; multiple -> the Application Tracker list tab, same
  // "one item goes to its detail, several go to the list" pattern as every
  // other multi-item push in this file.
  | {name: 'ApplicationDetails'; params: {id: string | number}}
  | {name: 'ApplicationsList'}
  // career_event push tap fallback (Saveur-Backend's
  // career_events_service.py — product request: "Users need to get push
  // notifications too the same way they get for job alert") — only used
  // when a career_event payload has no usable url; the normal case reuses
  // the existing WebViewScreen entry above (navigateToCareerEventWebView).
  | {name: 'NetworkingAssistant'}
  // post_offer_step_unlocked / post_offer_plan_complete push taps
  // (Saveur-Backend's roadmap_progress_service.py) — same gap as
  // stale_applications above; both reuse the existing WhatsNext
  // destination post_offer_checkin already lands on.
  // coach_checkin push tap (Saveur-Backend's coach_checkin_service.py —
  // product request: "I want the AI Career coach to always send regular
  // push notifications to the user to ask how things are going and if
  // whenever they are ready to talk"). Lands on the Coach tab's default
  // Chat screen (same MainBottomTab -> Coach route Home's "Today's Career
  // Focus" card uses — see MainBottomTabStackParamList.Coach's own comment)
  // rather than the separate top-level `MessagesStack` in
  // RootStackParamList, so the tab bar highlights Coach and the existing
  // VerifyEmailGate/CoachProLockGate gating still applies. No special params
  // -- this is just "open the coach", not a specific canned message.
  | {name: 'CoachChat'}
  // Used by AuthContext.tsx's LinkedIn cold-start sign-in fallback — see its
  // comment for why: the Stack.Navigator's `initialRouteName` prop only
  // matters on first mount, so simply flipping `isSignedIn` to true after
  // the navigator has already mounted on Login does NOT move the app off
  // that screen (every other sign-in path gets there via each button
  // handler's own explicit nextScreen('MainBottomTab') stack reset — this
  // fallback has no button handler to call that from, since it runs from a
  // plain Firebase listener with no navigation prop in scope).
  | {name: 'ResetToMain'};

let pendingNavigation: PendingNavigation | null = null;

function runNavigation(nav: PendingNavigation): void {
  if (nav.name === 'JobAlertDetails') {
    navigationRef.navigate('JobAlertDetails', nav.params);
  } else if (nav.name === 'WebViewScreen') {
    navigationRef.navigate('WebViewScreen', nav.params);
  } else if (nav.name === 'Notification') {
    navigationRef.navigate('Notification');
  } else if (nav.name === 'WeeklyCareerReport') {
    navigationRef.navigate('WeeklyCareerReport');
  } else if (nav.name === 'DailyIndustryNews') {
    navigationRef.navigate('DailyIndustryNews');
  } else if (nav.name === 'MockInterviewSetup') {
    navigationRef.navigate('MockInterviewSetup', nav.params);
  } else if (nav.name === 'InterviewFeedback') {
    navigationRef.navigate('InterviewFeedback', nav.params);
  } else if (nav.name === 'PracticalScenarioFeedback') {
    navigationRef.navigate('PracticalScenarioFeedback', nav.params);
  } else if (nav.name === 'CareerRoadmap') {
    navigationRef.navigate('CareerRoadmap');
  } else if (nav.name === 'Leaderboard') {
    navigationRef.navigate('Leaderboard');
  } else if (nav.name === 'Subscription') {
    navigationRef.navigate('Subscription');
  } else if (nav.name === 'PaymentHistory') {
    navigationRef.navigate('PaymentHistory');
  } else if (nav.name === 'Home') {
    navigationRef.navigate('MainBottomTab', {screen: 'Home'});
  } else if (nav.name === 'SharedContentDetail') {
    navigationRef.navigate('SharedContentDetail', nav.params);
  } else if (nav.name === 'SharedWithMe') {
    navigationRef.navigate('SharedWithMe', nav.params);
  } else if (nav.name === 'LearningCourses') {
    navigationRef.navigate('LearningCourses');
  } else if (nav.name === 'WhatsNext') {
    navigationRef.navigate('WhatsNext');
  } else if (nav.name === 'NextStepRecommendation') {
    navigationRef.navigate('NextStepRecommendation');
  } else if (nav.name === 'GoalTipDetail') {
    // BUG FIX (product report: "I clicked the today's challenge and it's
    // navigating me to the homescreen instead of its screen" — same gap
    // affected GoalTipDetail): both were declared in the PendingNavigation
    // union above but never matched by any branch here, so both silently
    // fell through to the final `else` below — which is meant ONLY for
    // 'ResetToMain' and does a full stack reset to MainBottomTab (Home).
    // A goal-tip/daily-challenge push tap was therefore indistinguishable
    // from a full app reset to Home, even though handleDataTap and the
    // PendingNavigation type both correctly identified the destination.
    navigationRef.navigate('GoalTipDetail');
  } else if (nav.name === 'DailyChallenge') {
    navigationRef.navigate('DailyChallenge');
  } else if (nav.name === 'ApplicationDetails') {
    navigationRef.navigate('RequestStack', {screen: 'ApplicationDetails', params: nav.params});
  } else if (nav.name === 'ApplicationsList') {
    navigationRef.navigate('MainBottomTab', {screen: 'Interviews', params: {screen: 'RequestsSrc'}});
  } else if (nav.name === 'NetworkingAssistant') {
    navigationRef.navigate('NetworkingAssistant');
  } else if (nav.name === 'CoachChat') {
    navigationRef.navigate('MainBottomTab', {screen: 'Coach', params: undefined});
  } else {
    // Mirrors Login.tsx's nextScreen() reset — MainBottomTab becomes the
    // only entry in history, so there's no way to "back" into the Login
    // screen from a session that's now genuinely signed in.
    navigationRef.dispatch(
      CommonActions.reset({index: 0, routes: [{name: 'MainBottomTab'}]}),
    );
  }
}

function queueOrNavigate(nav: PendingNavigation): void {
  if (!navigationRef.isReady()) {
    pendingNavigation = nav;
    return;
  }
  runNavigation(nav);
}

// Every job-alert tap path (JobAlerts list, notification bell, push tap,
// shared-job deep link landing) lands here first — the in-app job details
// screen (src/more/JobAlertDetails.tsx), whose own "Apply on {source}"
// button is what actually opens the real posting via
// navigateToJobAlertWebView below. There was a brief period where every
// call site skipped straight to the WebView instead (to cut the extra tap)
// — reverted per explicit follow-up request, back to this details-first
// flow everywhere.
export function navigateToJobAlertDetails(job: JobAlertProps): void {
  queueOrNavigate({name: 'JobAlertDetails', params: {job}});
}

// Reached from JobAlertDetails.tsx's "Apply on {source}" button (the one
// action that actually leaves the details screen) — not navigated to
// directly by any push/notification/list tap path itself; those all go
// through navigateToJobAlertDetails above.
export function navigateToJobAlertWebView(job: JobAlertProps): void {
  queueOrNavigate({
    name: 'WebViewScreen',
    params: {
      url: job.applyUrl,
      title: job.title,
      job: {
        company: job.company,
        role: job.title,
        applyUrl: job.applyUrl,
        companyLogoUrl: job.companyLogoUrl,
      },
    },
  });
}

/** Career event push tap (Saveur-Backend's career_events_service sends
 * type: "career_event" — product request: "Users need to get push
 * notifications too the same way they get for job alert"). Same "land
 * directly on the real content, not just the list" treatment
 * navigateToJobAlertWebView above gets — a career event has no separate
 * in-app details screen of its own (see src/more/NetworkingAssistant.tsx),
 * so this opens the real Eventbrite page in-app via WebViewScreen
 * directly, skipping an extra tap through the events list. */
export function navigateToCareerEventWebView(url: string, title?: string): void {
  queueOrNavigate({name: 'WebViewScreen', params: {url, title}});
}

/** Fallback for a career_event push/notification tap with no usable url
 * (shouldn't normally happen — see jobFromPushData's own equivalent
 * "not enough to act on" fallback) — lands on the Career Events section
 * itself rather than doing nothing. */
export function navigateToNetworkingAssistant(): void {
  queueOrNavigate({name: 'NetworkingAssistant'});
}

/** Generic fallback destination for any non-job-alert push tap — see
 * services/pushNotificationService.ts's handleNotificationTap. */
export function navigateToNotifications(): void {
  queueOrNavigate({name: 'Notification'});
}

/** Weekly Career Report push tap (Saveur-Backend's
 * career_report_service.send_weekly_report_broadcast sends
 * data.type = "weekly_career_report") — takes the user straight to the
 * report screen (src/more/WeeklyCareerReport.tsx) instead of the generic
 * in-app notification list. */
export function navigateToWeeklyCareerReport(): void {
  queueOrNavigate({name: 'WeeklyCareerReport'});
}

/** Daily Industry News push tap (Saveur-Backend's
 * news_service.send_daily_news_broadcast sends
 * data.type = "daily_industry_news") — takes the user straight to the news
 * screen (src/more/DailyIndustryNews.tsx) instead of the generic in-app
 * notification list. */
export function navigateToDailyIndustryNews(): void {
  queueOrNavigate({name: 'DailyIndustryNews'});
}

/** Scheduled interview reminder push tap (Saveur-Backend's
 * scheduled_interview_service.send_due_reminders sends
 * data.type = "scheduled_interview_reminder") — takes the user straight into
 * MockInterviewSetup pre-filled with that session's details, matching
 * HomeSrc.tsx's own "Upcoming Session" card tap behavior, instead of the
 * generic in-app notification list. */
export function navigateToMockInterviewSetup(params: {
  interviewType?: Interview_Type_Enum;
  mode?: Practice_Mode_Enum;
  difficulty?: Difficulty_Enum;
  role?: string;
  company?: string;
  durationMin?: number;
}): void {
  queueOrNavigate({name: 'MockInterviewSetup', params});
}

/** AI interview feedback ready push tap (Saveur-Backend's
 * app/tasks/feedback_job.py sends data.type = "feedback_ready") — takes the
 * user straight to that session's feedback screen instead of the generic
 * in-app notification list. */
export function navigateToInterviewFeedback(sessionId?: string): void {
  queueOrNavigate({name: 'InterviewFeedback', params: {sessionId}});
}

/** Practical Scenario feedback ready push tap (Saveur-Backend's
 * app/tasks/practical_feedback_job.py sends
 * data.type = "practical_feedback_ready") — takes the user straight to that
 * session's feedback screen. */
export function navigateToPracticalScenarioFeedback(sessionId: number): void {
  queueOrNavigate({name: 'PracticalScenarioFeedback', params: {sessionId}});
}

/** AI Career Roadmap ready push tap (Saveur-Backend's
 * career_roadmap_service sends data.type = "roadmap_ready"). */
export function navigateToCareerRoadmap(): void {
  queueOrNavigate({name: 'CareerRoadmap'});
}

/** post_offer_checkin push tap -- see the PendingNavigation union's own
 * comment above. */
export function navigateToWhatsNext(): void {
  queueOrNavigate({name: 'WhatsNext'});
}

/** next_step_plan push tap -- see the PendingNavigation union's own
 * comment above. */
export function navigateToNextStepRecommendation(): void {
  queueOrNavigate({name: 'NextStepRecommendation'});
}

/** coach_checkin push tap -- see the PendingNavigation union's own
 * comment above. */
export function navigateToCoachChat(): void {
  queueOrNavigate({name: 'CoachChat'});
}

/** Daily leaderboard + tip push tap (Saveur-Backend's
 * daily_broadcast_service sends data.type = "daily_leaderboard_tip") — takes
 * the user to the full leaderboard instead of the generic in-app
 * notification list. */
export function navigateToLeaderboard(): void {
  queueOrNavigate({name: 'Leaderboard'});
}

/** Payment-failed / graduation (billing reverted to full price) push taps
 * (Saveur-Backend's billing.py and student_service.py send
 * data.type = "payment_failed" / "graduation") — takes the user to the
 * Subscription screen so they can see/fix their plan. */
export function navigateToSubscription(): void {
  queueOrNavigate({name: 'Subscription'});
}

/** Payment receipt push tap (Saveur-Backend's receipt_service sends
 * data.type = "payment") — takes the user to their payment history instead
 * of the generic in-app notification list. */
export function navigateToPaymentHistory(): void {
  queueOrNavigate({name: 'PaymentHistory'});
}

export function navigateToHome(): void {
  queueOrNavigate({name: 'Home'});
}

/** Goal-tip push tap (Saveur-Backend's goal_tip_service sends
 * data.type = "goal_tip") — the "Today's Goal Tips" dashboard card was
 * removed (product request item: rely on the push notification itself
 * instead of a persistent home card) in favor of a dedicated detail screen
 * (src/home/GoalTipDetail.tsx) that fetches the same
 * GET /api/v1/goals/tips/today the old card used, so a tap always lands on
 * the full, current content regardless of which specific tip triggered the
 * push. */
export function navigateToGoalTipDetail(): void {
  queueOrNavigate({name: 'GoalTipDetail'});
}

/** Daily Challenge push tap (Saveur-Backend's daily_challenge_service sends
 * data.type = "daily_challenge") — takes the user straight to today's
 * Surprise Challenge (src/home/DailyChallengeScreen.tsx), which fetches
 * GET /api/v1/daily-challenge/today itself, same "always shows today's
 * current content regardless of which push triggered it" pattern as
 * navigateToGoalTipDetail above. */
export function navigateToDailyChallenge(): void {
  queueOrNavigate({name: 'DailyChallenge'});
}

/** stale_applications push tap (Saveur-Backend's job_tracker_service.py
 * sends data.type = "stale_applications" + data.application_ids, a
 * comma-separated list). One stale application -> its detail screen
 * directly; more than one -> the Application Tracker list tab, since
 * there's no single detail screen to land on. */
export function navigateToApplicationDetails(id: string | number): void {
  queueOrNavigate({name: 'ApplicationDetails', params: {id}});
}

export function navigateToApplicationsList(): void {
  queueOrNavigate({name: 'ApplicationsList'});
}

/** Content-shared push tap (Saveur-Backend's shares_service sends
 * data.type = "content_shared") — takes the user straight to the shared
 * item instead of the generic in-app notification list. */
export function navigateToSharedContentDetail(shareId: string): void {
  queueOrNavigate({name: 'SharedContentDetail', params: {shareId}});
}

/** connection_request / connection_accepted push tap (Saveur-Backend's
 * shares_service sends data.type = "connection_request" or
 * "connection_accepted") — opens SharedWithMe.tsx, optionally landing
 * directly on the "Pending Requests" tab. */
export function navigateToSharedWithMe(initialTab?: number): void {
  queueOrNavigate({name: 'SharedWithMe', params: initialTab !== undefined ? {initialTab} : undefined});
}

/** curriculum_week_unlocked / curriculum_complete push+in-app-notification
 * tap (Saveur-Backend's app/api/learning.py sends data.type = one of those)
 * — takes the user to the Learning Courses list (src/more/LearningCourses.tsx)
 * instead of the generic in-app notification list. */
export function navigateToLearningCourses(): void {
  queueOrNavigate({name: 'LearningCourses'});
}

/** See the ResetToMain case in PendingNavigation above — call once a cold-
 * start LinkedIn sign-in (or any other listener-driven sign-in with no
 * button handler in scope) has actually completed. */
export function resetToMainAfterExternalSignIn(): void {
  queueOrNavigate({name: 'ResetToMain'});
}

export function flushPendingNavigation(): void {
  if (!pendingNavigation || !navigationRef.isReady()) return;
  const nav = pendingNavigation;
  pendingNavigation = null;
  runNavigation(nav);
}
