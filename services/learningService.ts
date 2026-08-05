import i18n from 'i18next';
import apiClient from './apiClient';
import * as coachService from './coachService';

// Same convention as coachService.ts's currentLanguage() — sent on every
// AI-generation call so a non-English learner gets topic-check/syllabus/
// module content genuinely generated in their language, not just an
// English reply they have to translate themselves.
function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// learningService — powers the AI-taught Learning Courses experience
// (src/more/CourseSession.tsx), replacing the old LearningCourses.tsx
// "Start" button, which just showed an Alert("Course content coming soon.")
// placeholder with no real lesson content at all.
//
// Module *content* generation reuses the same real, already-working
// POST /api/v1/coach/advice endpoint the Coach tab chat is built on (via
// coachService.askOneOff — a one-off variant that doesn't touch the coach
// chat's persisted history) rather than waiting on a new backend endpoint —
// there was no reason to invent one when a working general-purpose
// instruction-following LLM call already exists. This means module content
// works today, live, for any topic — "even if it's coding," per the
// product ask — not just the fixed DATA_COURSES catalog.
//
// The one piece that genuinely can't be done this way: real AI-generated
// *images* for visual examples. That needs an actual image-generation API
// key/integration the backend holds (DALL-E, Stable Diffusion, etc.) — see
// generateVisual below and the backend spec addendum §15. Until that
// endpoint exists, generateVisual just returns null and the module viewer
// skips showing an image for that module rather than blocking the lesson.
// ---------------------------------------------------------------------------

export interface CourseModule {
  index: number; // 0-based
  title: string;
  body: string;
  checkQuestion?: string;
}

// ---------------------------------------------------------------------------
// Tiered curriculum (basic → intermediate → advanced) + certificates.
//
// Each level of a topic is tracked as its own course_id
// ("<topic-slug>::<level>") against the existing per-module
// GET/POST /api/v1/learning/progress endpoints (already existed, previously
// unused by this screen — CourseSession.tsx never actually saved progress,
// which is also why "resume where I left off" never worked). A certificate
// is only issued once basic+intermediate+advanced are all genuinely complete
// (POST /api/v1/learning/certificates/issue re-validates that against the
// real recorded progress rows server-side, not just what the client claims).
// ---------------------------------------------------------------------------

export type CourseLevel = 'basic' | 'intermediate' | 'advanced';
export const COURSE_LEVELS: CourseLevel[] = ['basic', 'intermediate', 'advanced'];
export const MODULES_PER_LEVEL: Record<CourseLevel, number> = {
  basic: 4,
  intermediate: 5,
  advanced: 6,
};
export const LEVEL_LABELS: Record<CourseLevel, string> = {
  basic: 'Basic',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

// Curated career-path list for the "start a course" flow (LearningCourses.tsx).
// This is a new concept — nothing like it existed anywhere in the app before
// (every similar field: profile.desiredRoles/industries/goals, interview
// practice's "Target Role", is free text with no fixed value set). A fixed
// list is deliberate here since the picker needs to show a finite dropdown,
// not a type-anything box — the optional topic input right below it is
// still free text, same as every other field in the app.
export const CAREER_PATHS: string[] = [
  'Software Engineering',
  'Product Management',
  'Data Science & Analytics',
  'UX/UI Design',
  'Digital Marketing',
  'Sales & Business Development',
  'Finance & Accounting',
  'Human Resources',
  'Project Management',
  'Customer Success & Support',
  'Operations & Supply Chain',
  'Business Analysis',
  'Cybersecurity',
  'Cloud & DevOps',
  'Legal & Compliance',
  'Healthcare & Life Sciences',
  'Education & Training',
  'Consulting & Strategy',
  'Entrepreneurship & Startups',
  'Other / General Career Skills',
];

export function slugifyTopic(topic: string): string {
  return topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '') || 'topic';
}

export function courseIdFor(topic: string, level: CourseLevel): string {
  return `${slugifyTopic(topic)}::${level}`;
}

export interface TopicCheckResult {
  valid: boolean;
  canonicalTopic: string;
  reason?: string;
  coreSubtopics: string[];
}

/**
 * POST /api/v1/learning/topic-check — a real AI judgment call on whether a
 * typed "Learn Anything" topic is a coherent professional/career skill area
 * worth building a certificate-bearing course around, and (if so) what its
 * recognized professional subtopics are. Directly addresses "the AI should
 * be able to filter the topics... a user cannot just be getting certificate
 * on just anyhow topics." Fails open (treats the topic as valid, with no
 * subtopic guidance) on any network/provider error, so a transient hiccup
 * never blocks a genuinely legitimate topic.
 */
export async function checkTopic(topic: string): Promise<TopicCheckResult> {
  try {
    const {data} = await apiClient.post<{
      valid?: boolean; canonical_topic?: string; reason?: string; core_subtopics?: string[];
    }>('/api/v1/learning/topic-check', {topic, language: currentLanguage()});
    return {
      valid: data.valid ?? true,
      canonicalTopic: data.canonical_topic ?? topic,
      reason: data.reason,
      coreSubtopics: data.core_subtopics ?? [],
    };
  } catch {
    return {valid: true, canonicalTopic: topic, coreSubtopics: []};
  }
}

export interface CourseProgressSummary {
  completedModules: number;
  lastModuleIndex: number;
}

/**
 * GET /api/v1/learning/progress?course_id=... — used on entering a course
 * session to resume from where the learner left off, instead of always
 * restarting at module 0 (a real, previously-unfixed gap: this screen never
 * read or wrote progress at all before now).
 */
export async function getCourseProgress(courseId: string): Promise<CourseProgressSummary> {
  try {
    const {data} = await apiClient.get<{
      by_course?: Record<string, {completed_modules?: number; last_module_index?: number}>;
    }>('/api/v1/learning/progress', {params: {course_id: courseId}});
    const entry = data.by_course?.[courseId];
    return {
      completedModules: entry?.completed_modules ?? 0,
      lastModuleIndex: entry?.last_module_index ?? 0,
    };
  } catch {
    return {completedModules: 0, lastModuleIndex: 0};
  }
}

export interface AllProgress {
  /** Real per-course completion, keyed by course_id (`<slug>::<level>`). */
  byCourse: Record<string, CourseProgressSummary>;
  /** The course_id with the most recently-updated (but not yet fully
   * complete) progress row, if any — used to power a "Continue where you
   * left off" surface. Null if the learner has no in-progress course. */
  mostRecentCourseId: string | null;
}

/**
 * GET /api/v1/learning/progress with no `course_id` filter — returns every
 * course the learner has ever touched in one call. Used by
 * LearningCourses.tsx to (a) show each catalog course's REAL completion
 * instead of the static DATA_COURSES mock numbers, which never changed no
 * matter how much of a course the learner actually finished, and (b)
 * determine which course to resume in a "Continue where you left off"
 * banner, using each row's `updated_at` (already returned by the backend,
 * just never used client-side before) to find the most recently active one.
 */
export async function getAllProgress(): Promise<AllProgress> {
  try {
    const {data} = await apiClient.get<{
      progress?: Array<{course_id: string; updated_at?: string}>;
      by_course?: Record<string, {completed_modules?: number; last_module_index?: number}>;
    }>('/api/v1/learning/progress');
    const byCourse: Record<string, CourseProgressSummary> = {};
    Object.entries(data.by_course ?? {}).forEach(([courseId, entry]) => {
      byCourse[courseId] = {
        completedModules: entry.completed_modules ?? 0,
        lastModuleIndex: entry.last_module_index ?? 0,
      };
    });

    let mostRecentCourseId: string | null = null;
    let mostRecentAt = -Infinity;
    (data.progress ?? []).forEach(row => {
      const t = row.updated_at ? new Date(row.updated_at).getTime() : NaN;
      if (Number.isNaN(t)) return;
      if (t > mostRecentAt) {
        mostRecentAt = t;
        mostRecentCourseId = row.course_id;
      }
    });

    return {byCourse, mostRecentCourseId};
  } catch {
    return {byCourse: {}, mostRecentCourseId: null};
  }
}

/**
 * POST /api/v1/learning/progress — marks a module completed as the learner
 * finishes it. Best-effort: a save hiccup shouldn't block moving on to the
 * next module, but it does mean that module won't count toward "resume" or
 * toward certificate eligibility until it's successfully recorded.
 */
export async function markModuleProgress(
  courseId: string,
  moduleIndex: number,
  completed = true,
): Promise<void> {
  try {
    await apiClient.post('/api/v1/learning/progress', {
      course_id: courseId, module_index: moduleIndex, completed,
    });
  } catch {
    // best-effort
  }
}

export interface Certificate {
  topic: string;
  code: string;
  levelsCompleted: CourseLevel[];
  issuedAt: number | null;
}

/**
 * GET /api/v1/learning/certificates — the user's already-earned
 * certificates (topic + all three tiers completed).
 */
export async function listCertificates(): Promise<Certificate[]> {
  try {
    const {data} = await apiClient.get<{items?: Array<{
      topic: string; code: string; levels_completed?: string[]; issued_at?: string | null;
    }>}>('/api/v1/learning/certificates');
    return (data.items ?? []).map(c => ({
      topic: c.topic,
      code: c.code,
      levelsCompleted: (c.levels_completed ?? []) as CourseLevel[],
      issuedAt: c.issued_at ? new Date(c.issued_at).getTime() : null,
    }));
  } catch {
    return [];
  }
}

/**
 * POST /api/v1/learning/certificates/issue — call once the learner finishes
 * the final module of the Advanced tier. The backend independently
 * re-verifies each tier's completion against real CourseProgress rows
 * before issuing anything, so this can't be spoofed by calling it early;
 * returns null if a tier genuinely isn't complete yet (shouldn't normally
 * happen if this is only called after finishing Advanced, but the caller
 * should not assume success).
 */
export async function issueCertificateIfEligible(topic: string): Promise<Certificate | null> {
  try {
    const tiers = COURSE_LEVELS.map(level => ({
      level,
      course_id: courseIdFor(topic, level),
      total_modules: MODULES_PER_LEVEL[level],
    }));
    const {data} = await apiClient.post<{
      topic?: string; code?: string; levels_completed?: string[]; issued_at?: string | null; error?: string;
    }>('/api/v1/learning/certificates/issue', {topic, tiers});
    if (!data.code) return null;
    return {
      topic: data.topic ?? topic,
      code: data.code,
      levelsCompleted: (data.levels_completed ?? []) as CourseLevel[],
      issuedAt: data.issued_at ? new Date(data.issued_at).getTime() : null,
    };
  } catch {
    return null;
  }
}

/**
 * Asks the coach endpoint for a short numbered syllabus so module titles
 * feel like a real course outline rather than "Module 1/2/3...". `level`
 * calibrates depth (basic/intermediate/advanced) and `coreSubtopics` (from
 * checkTopic above) keeps the syllabus grounded in the topic's real
 * professional subject matter rather than the AI free-associating under
 * that name. Falls back to generic titles if the call fails or returns
 * fewer lines than expected — never blocks starting the course over a
 * syllabus-naming hiccup.
 */
export async function generateSyllabus(
  topic: string,
  totalModules: number,
  level: CourseLevel = 'basic',
  coreSubtopics: string[] = [],
): Promise<string[]> {
  const fallback = Array.from({length: totalModules}, (_, i) => `${topic} — Part ${i + 1}`);
  const levelDescription =
    level === 'basic' ? 'foundational, beginner-level'
    : level === 'intermediate' ? 'practical, intermediate-level'
    : 'in-depth, advanced/expert-level';
  const subtopicsHint = coreSubtopics.length
    ? ` Ground the modules specifically in these real professional subtopics of "${topic}": ${coreSubtopics.join(', ')}.`
    : '';
  try {
    const prompt =
      `Create a numbered list of exactly ${totalModules} short module titles (3-6 words each) ` +
      `for a ${levelDescription} course teaching "${topic}" as a real professional/career skill.` +
      subtopicsHint +
      ` Reply with ONLY the numbered list, one title per line, no other commentary.`;
    const reply = await coachService.askOneOff(prompt);
    const lines = reply
      .split('\n')
      .map(line => line.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean);
    if (lines.length >= totalModules) return lines.slice(0, totalModules);
    return lines.length ? [...lines, ...fallback.slice(lines.length)] : fallback;
  } catch {
    return fallback;
  }
}

/**
 * GET /api/v1/learning/syllabus?course_id=... — the syllabus already saved
 * for this course, if any. See saveSyllabus below: once a syllabus has been
 * generated and saved for a (user, course) pair, it must always come back
 * from here afterward instead of being regenerated fresh via AI, so module
 * titles stay the same course every time the learner opens or reviews it.
 */
export async function getSavedSyllabus(courseId: string): Promise<string[] | null> {
  try {
    const {data} = await apiClient.get<{titles?: string[] | null}>('/api/v1/learning/syllabus', {
      params: {course_id: courseId},
    });
    return data.titles && data.titles.length ? data.titles : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/v1/learning/syllabus — saves a freshly AI-generated syllabus the
 * first time one is built for a (user, course) pair. The backend is
 * first-write-wins (see app/api/learning.py's save_syllabus), so calling
 * this redundantly is always safe — it just hands back whatever was already
 * saved instead of overwriting it.
 */
export async function saveSyllabus(courseId: string, titles: string[]): Promise<void> {
  try {
    await apiClient.post('/api/v1/learning/syllabus', {course_id: courseId, titles});
  } catch {
    // best-effort — worst case the syllabus regenerates next visit
  }
}

/**
 * GET /api/v1/learning/module-content?course_id=...&module_index=... — the
 * already-generated content for this module, if any. This is the fix for
 * "when a user finishes a course and wants to review, the AI generates
 * different new content": CourseSession.tsx now checks here before calling
 * generateModule below, so a module already taught once is never
 * regenerated — including via the Previous button or re-opening a
 * completed course from LearningCourses.tsx.
 */
export async function getSavedModuleContent(
  courseId: string,
  moduleIndex: number,
): Promise<{module: CourseModule; imageUrl: string | null} | null> {
  try {
    const {data} = await apiClient.get<{content?: {
      title: string; body: string; check_question?: string | null; image_url?: string | null;
    } | null}>('/api/v1/learning/module-content', {
      params: {course_id: courseId, module_index: moduleIndex},
    });
    if (!data.content) return null;
    return {
      module: {
        index: moduleIndex,
        title: data.content.title,
        body: data.content.body,
        checkQuestion: data.content.check_question ?? undefined,
      },
      imageUrl: data.content.image_url ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * POST /api/v1/learning/module-content — saves a freshly generated module
 * the first time it's taught. First-write-wins server-side, same as
 * saveSyllabus above.
 */
export async function saveModuleContent(
  courseId: string,
  moduleIndex: number,
  mod: CourseModule,
  imageUrl?: string | null,
): Promise<void> {
  try {
    await apiClient.post('/api/v1/learning/module-content', {
      course_id: courseId,
      module_index: moduleIndex,
      title: mod.title,
      body: mod.body,
      check_question: mod.checkQuestion ?? null,
      image_url: imageUrl ?? null,
    });
  } catch {
    // best-effort — worst case this module regenerates next visit
  }
}

/**
 * Generates one module's actual teaching content — the AI acting as
 * instructor, not just answering a question. `context` (profile
 * goals/industries/desiredRoles) lets the same personalization the Coach
 * tab uses flavor examples toward the learner's own career direction.
 * `level` calibrates depth so the Advanced tier is genuinely more advanced,
 * not just more of the same beginner content repeated.
 */
export async function generateModule(
  topic: string,
  moduleIndex: number,
  totalModules: number,
  moduleTitle: string,
  context?: coachService.CoachUserContext,
  level: CourseLevel = 'basic',
): Promise<CourseModule> {
  const depthHint =
    level === 'basic' ? 'Assume no prior background — build fundamentals clearly.'
    : level === 'intermediate' ? 'Assume the learner already knows the basics — go beyond definitions into real practical application.'
    : 'Assume solid working knowledge already — go deep into expert-level nuance, trade-offs, and real-world edge cases professionals actually deal with.';
  const prompt =
    `You are an expert instructor teaching a structured ${level}-level course on "${topic}". This ` +
    `is module ${moduleIndex + 1} of ${totalModules}, titled "${moduleTitle}". ${depthHint} Teach ` +
    `this module clearly and step by step, assuming the student already completed the earlier ` +
    `modules but nothing after this one. Include one concrete, worked example (real code if the ` +
    `topic is technical/coding). End with exactly one short check-for-understanding question on ` +
    `its own final line. Keep the whole response focused and roughly 150-250 words, formatted as ` +
    `plain paragraphs (no numbered module headers, since the app already shows those separately).`;

  const reply = await coachService.askOneOff(prompt, context);
  const lines = reply
    .trim()
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  let checkQuestion: string | undefined;
  let bodyLines = lines;
  if (lines.length > 1 && lines[lines.length - 1].endsWith('?')) {
    checkQuestion = lines[lines.length - 1];
    bodyLines = lines.slice(0, -1);
  }

  return {
    index: moduleIndex,
    title: moduleTitle,
    body: bodyLines.join('\n\n') || reply || i18n.t('more:course_module_unavailable', { defaultValue: 'Content unavailable for this module — try regenerating.' }),
    checkQuestion,
  };
}

/**
 * Real interactivity for the module's check-for-understanding question —
 * the learner types an answer, this asks the same coach endpoint for brief
 * feedback on it (correct/what to adjust), rather than the question just
 * being decorative. Falls back to a plain acknowledgment if the call fails,
 * since a feedback hiccup shouldn't block moving to the next module.
 */
export async function getAnswerFeedback(
  topic: string,
  checkQuestion: string,
  answer: string,
): Promise<string> {
  try {
    const prompt =
      `You're teaching a course on "${topic}". You asked the student: "${checkQuestion}". ` +
      `Their answer: "${answer}". In 2-3 sentences, tell them whether they've got it, and gently ` +
      `correct anything they got wrong or incomplete. Be encouraging but specific.`;
    const reply = await coachService.askOneOff(prompt);
    return reply.trim() || i18n.t('more:course_answer_ack', { defaultValue: "Thanks for answering — let's keep going." });
  } catch {
    return i18n.t('more:course_answer_ack', { defaultValue: "Thanks for answering — let's keep going." });
  }
}

// ---------------------------------------------------------------------------
// AI Curriculum Builder — "the AI can build a curriculum (e.g. Week 1
// Python, Week 2 SQL, Week 3 React, Week 4 System Design)" per product
// request. A curriculum is just an AI-planned ORDER of topics; each week
// reuses the exact same single-topic course flow (courseIdFor(topic,
// 'basic')) that "Learn anything" already teaches through — see
// app/api/learning.py's /curriculum endpoints.
// ---------------------------------------------------------------------------

export interface CurriculumWeek {
  week: number;
  topic: string;
  level: CourseLevel;
  courseId: string;
  description: string;
  // Task #67 auto-continuation: week 1 always starts unlocked; week N+1
  // flips to unlocked server-side the instant week N's course is fully
  // completed (see app/api/learning.py's _advance_curriculum_if_complete),
  // alongside a push + in-app notification. Older curricula generated
  // before this shipped won't have these fields on their saved rows — see
  // the `?? i === 0` / `?? false` fallbacks below, which treat that as
  // "only week 1 unlocked, nothing completed yet" rather than crashing or
  // locking every week.
  unlocked: boolean;
  completed: boolean;
}

export interface CurriculumPlan {
  goal: string;
  weeks: CurriculumWeek[];
}

function mapCurriculum(raw: {
  goal?: string;
  weeks?: Array<{
    week?: number; topic?: string; level?: string; course_id?: string;
    description?: string; unlocked?: boolean; completed?: boolean;
  }>;
}): CurriculumPlan {
  return {
    goal: raw.goal ?? '',
    weeks: (raw.weeks ?? []).map((w, i) => ({
      week: w.week ?? i + 1,
      topic: w.topic ?? '',
      level: (w.level as CourseLevel) || 'basic',
      courseId: w.course_id ?? courseIdFor(w.topic ?? '', 'basic'),
      description: w.description ?? '',
      unlocked: w.unlocked ?? i === 0,
      completed: w.completed ?? false,
    })),
  };
}

/** GET /api/v1/learning/curriculum — the learner's already-saved plan, if any. */
export async function getSavedCurriculum(): Promise<CurriculumPlan | null> {
  try {
    const { data } = await apiClient.get<{ curriculum: { goal?: string; weeks?: any[] } | null }>(
      '/api/v1/learning/curriculum',
    );
    return data.curriculum ? mapCurriculum(data.curriculum) : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/v1/learning/curriculum — generates (or, if one already exists,
 * simply returns) a week-by-week plan toward `goal`. First-write-wins
 * server-side, matching generateSyllabus's stability guarantee — a
 * curriculum doesn't reshuffle on repeat visits.
 */
export async function generateCurriculum(goal: string, weeksCount = 4): Promise<CurriculumPlan | null> {
  try {
    const { data } = await apiClient.post<{ goal?: string; weeks?: any[] }>('/api/v1/learning/curriculum', {
      goal,
      weeks_count: weeksCount,
      language: currentLanguage(),
    });
    return mapCurriculum(data);
  } catch {
    return null;
  }
}

/** DELETE /api/v1/learning/curriculum — clears the saved plan so a learner can build a new one. */
export async function resetCurriculum(): Promise<void> {
  try {
    await apiClient.delete('/api/v1/learning/curriculum');
  } catch {
    // best-effort
  }
}

/**
 * POST /api/v1/learning/visual — proposed endpoint, not yet implemented
 * server-side (see backend spec addendum §15). Returns null on any failure
 * (including a 404 from an endpoint that doesn't exist yet) rather than
 * throwing, so a missing image never blocks a lesson from being usable —
 * text/voice content is the core of the feature; the image is a bonus.
 */
export async function generateVisual(prompt: string): Promise<string | null> {
  try {
    const {data} = await apiClient.post<{image_url?: string; url?: string}>('/api/v1/learning/visual', {
      prompt,
    });
    return data.image_url ?? data.url ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Learning course video recommendations (product request item): "after each
// lesson/module, auto-suggest real matching videos... play inside a custom
// in-app player." See Saveur-Backend's app/services/learning_video_service.py
// for the real-web-search-backed discovery + anti-hallucination gate, and
// that same file's docstring for why this is YouTube-only (a real ToS
// constraint, not a scoping choice) and why the embed always carries a
// small amount of required YouTube branding — components/
// InAppVideoPlayer.tsx is what actually renders it, entirely inside the
// app, never opening the YouTube app or an external browser.
// ---------------------------------------------------------------------------

export interface CourseVideo {
  videoId: string;
  title: string;
  channel: string | null;
  url: string;
  embedUrl: string;
  thumbnailUrl: string;
  source: 'youtube';
}

interface CourseVideoWire {
  video_id: string;
  title: string;
  channel: string | null;
  url: string;
  embed_url: string;
  thumbnail_url: string;
  source: string;
}

function fromVideoWire(w: CourseVideoWire): CourseVideo {
  return {
    videoId: w.video_id,
    title: w.title,
    channel: w.channel,
    url: w.url,
    embedUrl: w.embed_url,
    thumbnailUrl: w.thumbnail_url,
    source: 'youtube',
  };
}

/**
 * Get-or-fetch — the first call for a given (course, module) runs a real
 * search server-side and caches it; every later call (reopening the
 * module, reviewing a finished course) just returns the same cached list
 * instantly. Returns [] on any failure rather than throwing, same
 * "never block the lesson" tolerance generateVisual above has — a missing
 * videos section is a much smaller loss than breaking the module itself.
 */
export async function getModuleVideos(
  courseId: string,
  moduleIndex: number,
  topic: string,
  moduleTitle: string,
): Promise<CourseVideo[]> {
  try {
    // Product follow-up ("the video suggestions should be in the language
    // the user has already set, not English, just because that's what a
    // native Spanish speaker would actually want") — same currentLanguage()
    // sent on every other AI-facing call in this file; the backend uses it
    // to search for videos actually in that language rather than defaulting
    // to English results regardless of locale.
    const {data} = await apiClient.post<{videos?: CourseVideoWire[]}>('/api/v1/learning/videos', {
      course_id: courseId,
      module_index: moduleIndex,
      topic,
      module_title: moduleTitle,
      language: currentLanguage(),
    });
    return (data.videos ?? []).map(fromVideoWire);
  } catch {
    return [];
  }
}
