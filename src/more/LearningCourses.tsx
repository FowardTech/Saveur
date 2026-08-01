import React, { memo } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Input,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import { DATA_COURSES } from 'constants/Data';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import * as learningService from 'services/learningService';
import {
  CourseLevel, COURSE_LEVELS, MODULES_PER_LEVEL, CAREER_PATHS,
  TopicCheckResult, CourseProgressSummary, Certificate, AllProgress,
  CurriculumPlan,
} from 'services/learningService';
import {
  getCourseLevelLabel, getCareerPathLabel, getCourseCategoryLabel,
  getCourseTitleLabel, getCourseDescriptionLabel,
} from 'utils/learningLabels';
import CtaButton from 'components/CtaButton';

const CUSTOM_TOPIC_MODULES = 5;

// Course catalog + a "teach me anything" custom-topic box. The catalog
// cards below are still the static mock DATA_COURSES numbers (real per-user
// progress tracking for the fixed catalog is a separate, smaller lift than
// what this pass focuses on); the "Learn Anything" flow is the real,
// AI-driven experience: every custom topic is first vetted by the AI (see
// learningService.checkTopic — "a user cannot just be getting certificate
// on just anyhow topics" per product direction), then taught across three
// real tiers — Basic → Intermediate → Advanced, each unlocking after the
// previous one's modules are genuinely completed (tracked via
// GET/POST /api/v1/learning/progress) — with a certificate issued once all
// three are done (src/more/CourseSession.tsx, services/learningService.ts).
const LearningCourses = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { navigate } = navigation;
  const { isPremium, profile } = React.useContext(AuthContext);

  // "Start a course" now asks for a career path first (required — a fixed
  // list, see learningService.CAREER_PATHS) and a specific topic under it
  // second (optional free text, e.g. "Roadmapping" under Product
  // Management). If no specific topic is given, the career path itself
  // becomes the course topic, so a learner can just pick a path and go
  // without having to think of something narrower to type.
  const [careerPath, setCareerPath] = React.useState<string | null>(null);
  const [showCareerPathPicker, setShowCareerPathPicker] = React.useState(false);
  const [customTopic, setCustomTopic] = React.useState('');
  const [isCheckingTopic, setIsCheckingTopic] = React.useState(false);
  const [topicCheck, setTopicCheck] = React.useState<TopicCheckResult | null>(null);
  const [tierProgress, setTierProgress] = React.useState<Record<CourseLevel, CourseProgressSummary> | null>(null);
  const [certificates, setCertificates] = React.useState<Certificate[]>([]);
  // Real per-course progress (see services/learningService.ts's
  // getAllProgress) — the catalog cards below used to always show
  // DATA_COURSES' static mock numbers no matter how far the learner
  // actually got, which is why finishing modules and coming back later
  // never looked like it "saved": the list was never reading real progress
  // at all. This also powers the "Continue where you left off" banner.
  const [allProgress, setAllProgress] = React.useState<AllProgress>({byCourse: {}, mostRecentCourseId: null});

  // AI Curriculum Builder — "Week 1 Python, Week 2 SQL, Week 3 React,
  // Week 4 System Design" per product request. See
  // services/learningService.ts's generateCurriculum/getSavedCurriculum.
  const [curriculum, setCurriculum] = React.useState<CurriculumPlan | null>(null);
  const [curriculumGoal, setCurriculumGoal] = React.useState('');
  const [isGeneratingCurriculum, setIsGeneratingCurriculum] = React.useState(false);
  const [curriculumLoaded, setCurriculumLoaded] = React.useState(false);

  const loadProgress = React.useCallback(() => {
    learningService.getAllProgress().then(setAllProgress).catch(() => {});
  }, []);

  // Separated from the mount-only effect below so the focus listener further
  // down can also re-fetch it — task #67: finishing a week's last module
  // unlocks the next week server-side (app/api/learning.py's
  // _advance_curriculum_if_complete), so backing out of CourseSession into
  // this screen needs a fresh curriculum, not just fresh per-course progress,
  // for the newly-unlocked week's card to stop showing "Locked" immediately.
  const loadCurriculum = React.useCallback(() => {
    learningService.getSavedCurriculum()
      .then(setCurriculum)
      .finally(() => setCurriculumLoaded(true));
  }, []);

  React.useEffect(() => {
    learningService.listCertificates().then(setCertificates).catch(() => {});
    loadCurriculum();
    loadProgress();
  }, [loadProgress, loadCurriculum]);

  // Auto-generate the curriculum from whatever goal/role the user already
  // gave at signup (AuthContext's profile.desiredRoles / profile.goals —
  // see authService.ts) instead of always making them retype it here.
  // Product direction: "the app and the AI already knows everything about
  // the user... it should be able to create the curriculum for the user" —
  // the manual goal box below is now specifically the FALLBACK for users
  // who genuinely entered nothing at signup, not the default path for
  // everyone. generateCurriculum() is idempotent server-side (first-write-
  // wins, per its own doc comment), so firing this automatically the
  // moment we know there's no saved curriculum yet is safe even if the
  // user also lands on this screen more than once before it resolves —
  // it can never overwrite a curriculum that already exists. Guarded by a
  // ref (not just curriculum/curriculumGoal state) so a re-render or the
  // focus-listener's loadCurriculum() re-run below never fires a second
  // background attempt while the first is still in flight or already
  // happened once this mount.
  const hasAutoGeneratedRef = React.useRef(false);
  const [isAutoGeneratingCurriculum, setIsAutoGeneratingCurriculum] = React.useState(false);
  React.useEffect(() => {
    if (!curriculumLoaded || curriculum || hasAutoGeneratedRef.current) return;
    const signupGoal = profile?.desiredRoles?.[0]?.trim() || profile?.goals?.[0]?.trim();
    if (!signupGoal) return; // Nothing to auto-build from — manual box stays the way in.
    hasAutoGeneratedRef.current = true;
    setCurriculumGoal(signupGoal);
    setIsGeneratingCurriculum(true);
    setIsAutoGeneratingCurriculum(true);
    learningService.generateCurriculum(signupGoal)
      .then(plan => { if (plan) setCurriculum(plan); })
      .finally(() => {
        setIsGeneratingCurriculum(false);
        setIsAutoGeneratingCurriculum(false);
      });
  }, [curriculumLoaded, curriculum, profile?.desiredRoles, profile?.goals]);

  const onGenerateCurriculum = async () => {
    const goal = curriculumGoal.trim();
    if (!goal || isGeneratingCurriculum) return;
    setIsGeneratingCurriculum(true);
    try {
      const plan = await learningService.generateCurriculum(goal);
      setCurriculum(plan);
    } finally {
      setIsGeneratingCurriculum(false);
    }
  };

  const onResetCurriculum = async () => {
    await learningService.resetCurriculum();
    setCurriculum(null);
    setCurriculumGoal('');
  };

  const onStartCurriculumWeek = (week: CurriculumPlan['weeks'][number]) => {
    if (!week.unlocked) return;
    navigate('CourseSession', {
      topic: week.topic,
      totalModules: MODULES_PER_LEVEL.basic,
      level: 'basic',
    });
  };

  // Refresh every time this screen regains focus (e.g. backing out of a
  // CourseSession after completing a module) so progress made in the last
  // session is reflected immediately, not just on the next full app launch.
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadProgress();
      loadCurriculum();
    });
    return unsubscribe;
  }, [navigation, loadProgress, loadCurriculum]);

  const catalogProgress = (courseTitle: string, fallbackTotal: number) => {
    const courseId = learningService.courseIdFor(courseTitle, 'basic');
    const real = allProgress.byCourse[courseId];
    return {
      courseId,
      completedModules: real?.completedModules ?? 0,
      totalModules: fallbackTotal,
    };
  };

  // Best-effort friendly label for the "Continue" banner when the most
  // recently active course is a catalog title we already know by name.
  const catalogMatchFor = (courseId: string) =>
    DATA_COURSES.find(c => learningService.courseIdFor(c.title, 'basic') === courseId);

  const continueCourseId = allProgress.mostRecentCourseId;
  const continueCatalogMatch = continueCourseId ? catalogMatchFor(continueCourseId) : undefined;
  const continueEntry = continueCourseId ? allProgress.byCourse[continueCourseId] : undefined;
  // Only surface the banner for a course that's genuinely in progress
  // (something completed, but not the whole thing) — a brand-new or
  // fully-finished course isn't something to "continue".
  const continueTotal = continueCatalogMatch?.totalModules
    ?? (continueCourseId ? MODULES_PER_LEVEL[(continueCourseId.split('::')[1] as CourseLevel) || 'basic'] : 0);
  const showContinueBanner =
    !!continueCourseId &&
    !!continueEntry &&
    continueEntry.completedModules > 0 &&
    continueEntry.completedModules < continueTotal;
  const continueTitle = continueCatalogMatch
    ? continueCatalogMatch.title
    : (continueCourseId?.split('::')[0] ?? '')
        .split('-')
        .filter(Boolean)
        .map(w => w[0].toUpperCase() + w.slice(1))
        .join(' ');
  const continueLevel = (continueCourseId?.split('::')[1] as CourseLevel) || 'basic';

  const onContinueMostRecent = () => {
    if (!continueCourseId) return;
    navigate('CourseSession', {
      topic: continueTitle,
      totalModules: continueTotal,
      level: continueLevel,
    });
  };

  // The topic actually sent to checkTopic/generateSyllabus/generateModule —
  // combines the required career path with the optional specific topic so
  // the AI grounds the course in the chosen path even when a specific topic
  // is given (e.g. "Roadmapping (Product Management)" rather than just
  // "Roadmapping" on its own, which the topic-check AI has no way to know
  // is meant in a product-management context). Falls back to the bare
  // career path when no specific topic is entered.
  const effectiveTopic = careerPath
    ? (customTopic.trim() ? `${customTopic.trim()} (${careerPath})` : careerPath)
    : '';

  const onCheckTopic = async () => {
    const topic = effectiveTopic.trim();
    if (!topic || !careerPath || isCheckingTopic) return;
    setIsCheckingTopic(true);
    setTopicCheck(null);
    setTierProgress(null);
    try {
      const result = await learningService.checkTopic(topic);
      setTopicCheck(result);
      if (result.valid) {
        const entries = await Promise.all(
          COURSE_LEVELS.map(level =>
            learningService.getCourseProgress(learningService.courseIdFor(result.canonicalTopic, level)),
          ),
        );
        const progress = {} as Record<CourseLevel, CourseProgressSummary>;
        COURSE_LEVELS.forEach((level, i) => { progress[level] = entries[i]; });
        setTierProgress(progress);
      }
    } finally {
      setIsCheckingTopic(false);
    }
  };

  const isTierUnlocked = (level: CourseLevel): boolean => {
    const idx = COURSE_LEVELS.indexOf(level);
    if (idx === 0) return true;
    const prevLevel = COURSE_LEVELS[idx - 1];
    const prevCompleted = tierProgress?.[prevLevel]?.completedModules ?? 0;
    return prevCompleted >= MODULES_PER_LEVEL[prevLevel];
  };

  const onStartTier = (level: CourseLevel) => {
    if (!topicCheck?.valid) return;
    navigate('CourseSession', {
      topic: topicCheck.canonicalTopic,
      totalModules: MODULES_PER_LEVEL[level],
      level,
      coreSubtopics: topicCheck.coreSubtopics,
    });
  };

  const onStart = (title: string, totalModules: number) => {
    navigate('CourseSession', { topic: title, totalModules: totalModules || CUSTOM_TOPIC_MODULES, level: 'basic' });
  };

  // Was fully free with no gate at all — per explicit request, Learning
  // Courses (catalog + "teach me anything") is now a Pro Premium feature
  // specifically (Pro Premium or Pro Yearly, not plain monthly Pro), same
  // pattern as JobAlerts.tsx. See entitlements_service.py's module
  // docstring on the backend for the full tier breakdown this mirrors.
  if (!isPremium) {
    return (
      <ProLockGate
        variant="premium"
        title={t('more:learning_courses', { defaultValue: 'Learning Courses' })}
        description={t('more:learning_courses_pro_gate_description', {
          defaultValue: 'AI-taught, module-by-module courses on any career topic, with a badge on completion — Learning Courses is a Pro Premium feature.',
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:learning_courses', { defaultValue: 'Learning Courses' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('more:learning_courses_description', {
            defaultValue: 'Short courses to sharpen specific interview and career skills.',
          })}
        </Text>

        {showContinueBanner ? (
          <Layout level="2" style={[styles.customCard, styles.continueCard]}>
            <Flex justify="flex-start" itemsCenter>
              {/* "Colored glass" icon treatment (app-wide consistency pass)
                  — was a flat gray circle + monochrome icon. */}
              <View style={[styles.continueIconWrap, { backgroundColor: theme['color-primary-transparent-200'] }]}>
                <Icon pack="eva" name="play-circle-outline" style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text category="h10" status="placeholder">{t('more:continue_where_left_off', { defaultValue: 'Continue where you left off' })}</Text>
                <Text category="h8" bold mt={2}>{continueTitle}</Text>
                <Text category="h10" status="placeholder" mt={2}>
                  {t('more:course_progress_line', {
                    defaultValue: '{{level}} · {{completed}}/{{total}} modules',
                    level: getCourseLevelLabel(continueLevel, t),
                    completed: continueEntry?.completedModules ?? 0,
                    total: continueTotal,
                  })}
                </Text>
              </View>
              <CtaButton size="small" onPress={onContinueMostRecent}>
                {t('more:continue', { defaultValue: 'Continue' })}
              </CtaButton>
            </Flex>
          </Layout>
        ) : null}

        {certificates.length ? (
          <Layout level="2" style={[styles.customCard, { marginBottom: 20 }]}>
            <Text category="h7" bold mb={12}>
              {t('more:your_badges', { defaultValue: 'Your Badges' })}
            </Text>
            {certificates.map(c => (
              <Flex key={c.code} justify="flex-start" itemsCenter mb={8}>
                <Icon pack="eva" name="award-outline" style={[globalStyle.icon20, { tintColor: theme['text-basic-color'] }]} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text category="h9" bold>{c.topic}</Text>
                  <Text category="h10" status="placeholder">
                    {t('more:badge_tiers_code', {
                      defaultValue: 'Basic · Intermediate · Advanced — {{code}}',
                      code: c.code,
                    })}
                  </Text>
                </View>
              </Flex>
            ))}
          </Layout>
        ) : null}

        {curriculumLoaded ? (
          <Layout level="2" style={styles.customCard}>
            <Flex justify="space-between" itemsCenter mb={4}>
              <Text category="h7" bold>
                {t('more:curriculum_builder_title', { defaultValue: 'AI Curriculum Builder' })}
              </Text>
              {curriculum ? (
                <TouchableOpacity onPress={onResetCurriculum}>
                  <Text category="h10" status="danger">
                    {t('more:curriculum_start_over', { defaultValue: 'Start over' })}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </Flex>
            <Text category="h9-s" status="placeholder" mb={12}>
              {t('more:curriculum_builder_description', {
                defaultValue: 'Tell the AI your goal and it plans a week-by-week course path to get you there — e.g. "Week 1 Python, Week 2 SQL, Week 3 React, Week 4 System Design".',
              })}
            </Text>

            {curriculum ? (
              <View>
                <Text category="h9" bold mb={12}>{curriculum.goal}</Text>
                {curriculum.weeks.every(w => w.completed) ? (
                  <View style={styles.curriculumDoneBoxOuter}>
                    <View style={styles.curriculumDoneBox}>
                      <Icon pack="eva" name="award-outline" style={[globalStyle.icon20, { tintColor: theme['text-basic-color'] }]} />
                      <Text category="h9" bold status="success" style={{ marginLeft: 8, flex: 1 }}>
                        {t('more:curriculum_all_weeks_done', { defaultValue: "You've completed every week of this curriculum!" })}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {curriculum.weeks.map(week => {
                  const entry = allProgress.byCourse[week.courseId];
                  const completed = entry?.completedModules ?? 0;
                  const total = MODULES_PER_LEVEL.basic;
                  // Server-recorded `week.completed` (set the instant every
                  // module's counted server-side — see
                  // _advance_curriculum_if_complete) is the source of truth;
                  // the live per-course completedModules count is just a
                  // same-session fallback for the instant a learner finishes
                  // the very last module, before this screen's next
                  // getSavedCurriculum() refetch has landed.
                  const isWeekComplete = week.completed || completed >= total;
                  const locked = !week.unlocked;
                  return (
                    <Flex key={week.week} justify="space-between" itemsCenter style={styles.tierRow}>
                      <View style={{ flex: 1 }}>
                        <Text category="h9" bold status={locked ? 'placeholder' : 'basic'}>
                          {t('more:curriculum_week_label', { defaultValue: 'Week {{n}}', n: week.week })} · {week.topic}
                        </Text>
                        <Text category="h10" status="placeholder" mt={2}>
                          {locked
                            ? t('more:curriculum_week_locked_hint', { defaultValue: 'Finish the previous week to unlock' })
                            : week.description}
                        </Text>
                      </View>
                      {/* Was a plain UI Kitten <Button> — per explicit
                          follow-up ("remove the box shadow you gave to
                          this buttons its making them look awful"), this is
                          now a plain flat pill with an explicit style array
                          (no globalStyle.shadowBtn/shadow spread at all, so
                          there's no theme-level shadow source left to trip
                          over) instead of relying on UI Kitten's own
                          filled/outline Button appearances, which is also
                          what let the two "off" states (locked, complete)
                          fall back to a slightly-inconsistent gray/green
                          outline before. One consistent shape, three clear
                          colors: solid brand blue for the actionable
                          state, a soft green tint for a completed week you
                          can revisit, a muted gray tint (lower opacity) for
                          a week that isn't reachable yet. */}
                      <TouchableOpacity
                        activeOpacity={locked ? 1 : 0.7}
                        disabled={locked}
                        onPress={() => onStartCurriculumWeek(week)}
                        style={[
                          styles.weekActionPill,
                          isWeekComplete
                            ? {backgroundColor: theme['color-success-transparent-200']}
                            : locked
                            ? {backgroundColor: theme['background-basic-color-3'], opacity: 0.7}
                            : {backgroundColor: theme['color-primary-100']},
                        ]}>
                        {locked ? (
                          <Icon pack="eva" name="lock-outline" style={[globalStyle.icon16, {tintColor: theme['text-placeholder-color'], marginRight: 4}]} />
                        ) : null}
                        <Text
                          category="h10"
                          bold
                          style={{
                            color: isWeekComplete
                              ? theme['color-success-500']
                              : locked
                              ? theme['text-placeholder-color']
                              : theme['text-primary-color'],
                          }}>
                          {locked
                            ? t('more:locked', { defaultValue: 'Locked' })
                            : isWeekComplete
                            ? t('more:review', { defaultValue: 'Review' })
                            : completed > 0
                            ? t('more:continue', { defaultValue: 'Continue' })
                            : t('more:start', { defaultValue: 'Start' })}
                        </Text>
                      </TouchableOpacity>
                    </Flex>
                  );
                })}
              </View>
            ) : isAutoGeneratingCurriculum ? (
              // Building automatically from the goal/role the user already
              // gave at signup — no need to show the "type your goal" box
              // for something the app already knows, per the "AI should
              // already know everything about the user" product direction.
              <Flex vertical center style={{ paddingVertical: 24 }}>
                <Spinner size="small" />
                <Text category="h9-s" status="placeholder" center mt={12}>
                  {t('more:curriculum_auto_building', {
                    defaultValue: 'Building your curriculum from your goal — {{goal}}…',
                    goal: curriculumGoal,
                  })}
                </Text>
              </Flex>
            ) : (
              <Flex justify="flex-start">
                <Input
                  placeholder={t('more:curriculum_goal_placeholder', { defaultValue: 'e.g. Become a backend engineer' })}
                  value={curriculumGoal}
                  onChangeText={setCurriculumGoal}
                  style={[styles.customInput, globalStyle.flexOne]}
                />
                <CtaButton
                  size="small"
                  disabled={!curriculumGoal.trim() || isGeneratingCurriculum}
                  style={styles.customStartBtn}
                  onPress={onGenerateCurriculum}>
                  {isGeneratingCurriculum
                    ? <Spinner size="tiny" status="control" />
                    : t('more:curriculum_build_cta', { defaultValue: 'Build' })}
                </CtaButton>
              </Flex>
            )}
          </Layout>
        ) : null}

        <Layout level="2" style={styles.customCard}>
          <Text category="h7" bold mb={4}>
            {t('more:teach_me_anything', { defaultValue: 'Learn anything' })}
          </Text>
          <Text category="h9-s" status="placeholder" mb={12}>
            {t('more:teach_me_anything_description', {
              defaultValue: 'Pick a career path, and optionally a specific topic under it — the AI checks it, then builds a real Basic → Intermediate → Advanced course, with a badge when you finish all three.',
            })}
          </Text>

          <Text category="h10" status="placeholder" mb={6}>
            {t('more:career_path_label', { defaultValue: 'Career path' })}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowCareerPathPicker(v => !v)}
            style={[styles.careerPathField, { borderColor: theme['color-basic-400'] }]}
          >
            <Text category="h9" status={careerPath ? 'basic' : 'placeholder'} style={globalStyle.flexOne}>
              {careerPath ? getCareerPathLabel(careerPath, t) : t('more:career_path_placeholder', { defaultValue: 'Select a career path' })}
            </Text>
            <Icon
              pack="eva"
              name={showCareerPathPicker ? 'chevron-up-outline' : 'chevron-down-outline'}
              style={[globalStyle.icon20, { tintColor: theme['text-hint-color'] }]}
            />
          </TouchableOpacity>

          {showCareerPathPicker ? (
            <ScrollView
              style={[styles.careerPathList, { borderColor: theme['color-basic-400'] }]}
              nestedScrollEnabled
            >
              {CAREER_PATHS.map(path => (
                <TouchableOpacity
                  key={path}
                  activeOpacity={0.7}
                  style={styles.careerPathRow}
                  onPress={() => {
                    setCareerPath(path);
                    setShowCareerPathPicker(false);
                    setTopicCheck(null);
                  }}
                >
                  <Text category="h9" status={careerPath === path ? 'link' : 'basic'}>
                    {getCareerPathLabel(path, t)}
                  </Text>
                  {careerPath === path ? (
                    <Icon pack="eva" name="checkmark-outline" style={[globalStyle.icon20, { tintColor: theme['text-basic-color'] }]} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          <Text category="h10" status="placeholder" mt={16} mb={6}>
            {t('more:specific_topic_label', { defaultValue: 'Specific topic (optional)' })}
          </Text>
          <Flex justify="flex-start">
            <Input
              placeholder={t('more:custom_topic_placeholder', { defaultValue: 'e.g. Roadmapping, Salary Negotiation' })}
              value={customTopic}
              onChangeText={text => { setCustomTopic(text); setTopicCheck(null); }}
              style={[styles.customInput, globalStyle.flexOne]}
            />
            <CtaButton
              size="small"
              disabled={!careerPath || isCheckingTopic}
              style={styles.customStartBtn}
              onPress={onCheckTopic}>
              {isCheckingTopic ? t('more:ellipsis', { defaultValue: '…' }) : t('more:check_topic', { defaultValue: 'Check' })}
            </CtaButton>
          </Flex>

          {isCheckingTopic ? (
            <Flex center style={{ paddingVertical: 20 }}>
              <Spinner size="small" />
            </Flex>
          ) : topicCheck && !topicCheck.valid ? (
            <View style={styles.rejectedBoxOuter}>
              <View style={styles.rejectedBox}>
                <Text category="h9-s" status="warning">
                  {topicCheck.reason || t('more:topic_rejected_generic', {
                    defaultValue: "That doesn't look like a specific professional or career skill yet — try something more concrete.",
                  })}
                </Text>
              </View>
            </View>
          ) : topicCheck?.valid ? (
            <View style={{ marginTop: 16 }}>
              <Text category="h8" bold mb={4}>{topicCheck.canonicalTopic}</Text>
              {topicCheck.coreSubtopics.length ? (
                <Text category="h10" status="placeholder" mb={12}>
                  {t('more:covers_subtopics', {
                    defaultValue: 'Covers: {{subtopics}}',
                    subtopics: topicCheck.coreSubtopics.slice(0, 4).join(', '),
                  })}
                  {topicCheck.coreSubtopics.length > 4 ? t('more:ellipsis', { defaultValue: '…' }) : ''}
                </Text>
              ) : null}
              {COURSE_LEVELS.map(level => {
                const unlocked = isTierUnlocked(level);
                const total = MODULES_PER_LEVEL[level];
                const completed = tierProgress?.[level]?.completedModules ?? 0;
                const isTierComplete = completed >= total;
                return (
                  <Flex key={level} justify="space-between" itemsCenter style={styles.tierRow}>
                    <View style={{ flex: 1 }}>
                      <Text category="h9" bold status={unlocked ? 'basic' : 'placeholder'}>
                        {getCourseLevelLabel(level, t)}
                      </Text>
                      <Text category="h10" status="placeholder">
                        {isTierComplete
                          ? t('more:completed', { defaultValue: 'Completed' })
                          : t('more:modules_progress', { defaultValue: `${completed}/${total} modules`, completed, total })}
                      </Text>
                    </View>
                    {/* Same flat pill treatment as the AI Curriculum
                        Builder's week rows above — see weekActionPill's
                        own comment. */}
                    <TouchableOpacity
                      activeOpacity={!unlocked ? 1 : 0.7}
                      disabled={!unlocked}
                      onPress={() => onStartTier(level)}
                      style={[
                        styles.weekActionPill,
                        isTierComplete
                          ? {backgroundColor: theme['color-success-transparent-200']}
                          : !unlocked
                          ? {backgroundColor: theme['background-basic-color-3'], opacity: 0.7}
                          : {backgroundColor: theme['color-primary-100']},
                      ]}>
                      {!unlocked ? (
                        <Icon pack="eva" name="lock-outline" style={[globalStyle.icon16, {tintColor: theme['text-placeholder-color'], marginRight: 4}]} />
                      ) : null}
                      <Text
                        category="h10"
                        bold
                        style={{
                          color: isTierComplete
                            ? theme['color-success-500']
                            : !unlocked
                            ? theme['text-placeholder-color']
                            : theme['text-primary-color'],
                        }}>
                        {!unlocked
                          ? t('more:locked', { defaultValue: 'Locked' })
                          : isTierComplete
                          ? t('more:review', { defaultValue: 'Review' })
                          : completed > 0
                          ? t('more:continue', { defaultValue: 'Continue' })
                          : t('more:start', { defaultValue: 'Start' })}
                      </Text>
                    </TouchableOpacity>
                  </Flex>
                );
              })}
            </View>
          ) : null}
        </Layout>

        {DATA_COURSES.map(course => {
          // Real completion for this course (services/learningService.ts's
          // getAllProgress), not the static DATA_COURSES mock number — that
          // mock never changed no matter how much of the course a given
          // learner actually finished, which is why progress looked like it
          // never saved between visits.
          const { completedModules, totalModules } = catalogProgress(course.title, course.totalModules);
          const progressPct = totalModules > 0 ? completedModules / totalModules : 0;
          const isComplete = completedModules >= totalModules;
          return (
            <Layout key={course.id} level="2" style={styles.courseCard}>
              <Flex justify="space-between" itemsCenter mb={6}>
                <View style={styles.categoryPill}>
                  <Text category="h10" bold status="link">{getCourseCategoryLabel(course.category, t)}</Text>
                </View>
                <Text category="h10" status="placeholder">
                  {t('more:duration_min', { defaultValue: `${course.durationMin} min`, min: course.durationMin })}
                </Text>
              </Flex>
              <Text category="h7" bold mb={4}>{getCourseTitleLabel(course.id, course.title, t)}</Text>
              <Text category="h9-s" status="placeholder" mb={12}>{getCourseDescriptionLabel(course.id, course.description, t)}</Text>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(progressPct * 100)}%`,
                      backgroundColor: isComplete ? theme['color-success-500'] : theme['color-primary-500'],
                    },
                  ]}
                />
              </View>
              <Flex justify="space-between" itemsCenter mt={8} mb={16}>
                <Text category="h10" status="placeholder">
                  {completedModules}/{totalModules} {t('more:modules', { defaultValue: 'modules' })}
                </Text>
                <Text category="h10" status={isComplete ? 'success' : 'placeholder'} bold>
                  {isComplete ? t('more:completed', { defaultValue: 'Completed' }) : `${Math.round(progressPct * 100)}%`}
                </Text>
              </Flex>

              <Button
                size="small"
                status={isComplete ? 'success' : 'primary'}
                onPress={() => onStart(course.title, course.totalModules)}
              >
                {isComplete
                  ? t('more:review', { defaultValue: 'Review' })
                  : completedModules > 0
                  ? t('more:continue', { defaultValue: 'Continue' })
                  : t('more:start', { defaultValue: 'Start' })}
              </Button>
            </Layout>
          );
        })}
      </Content>
    </Container>
  );
});

export default LearningCourses;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  customCard: {
    ...globalStyle.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    // No fill — border-only (app-wide "cards are transparent" pass).
    // Explicit 'transparent' since every usage is <Layout level="2" .../>,
    // whose own level mapping would otherwise still fill it.
    backgroundColor: 'transparent',
  },
  continueCard: {
    padding: 16,
  },
  continueIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customInput: {
    borderRadius: 12,
    marginRight: 8,
  },
  customStartBtn: {
    borderRadius: 12,
  },
  careerPathField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  careerPathList: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    maxHeight: 260,
    overflow: 'hidden',
  },
  careerPathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'background-basic-color-3',
  },
  // Split each into an opaque shadow-casting outer + a translucent-tint
  // inner (product bug: "extra white card behind" on Android, fine on
  // iOS) -- Android's elevation shadow needs an OPAQUE background to
  // compute a rounded shadow silhouette from; with the tint directly on
  // the same elevated view, Android falls back to a plain rectangular
  // surface behind the rounded card. See HomeSrc.tsx's checkInCardOuter/
  // checkInCardInner for the first fix of this same pattern.
  rejectedBoxOuter: {
    ...globalStyle.card,
    marginTop: 16,
    // Was opaque (needed back when `card` still carried Android elevation
    // — see HomeSrc.tsx's checkInCardOuter for the full explanation).
    // `card` is border-only now, so transparent is safe and matches the
    // app-wide "cards are transparent" pass.
    backgroundColor: 'transparent',
  },
  rejectedBox: {
    padding: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'color-warning-transparent-200',
  },
  tierRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'background-basic-color-3',
  },
  // Flat pill for each curriculum week's action button (Start/Continue/
  // Review/Locked) — deliberately no elevation/shadow property anywhere in
  // this object, see the JSX comment at its usage site.
  weekActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginLeft: 12,
  },
  curriculumDoneBoxOuter: {
    ...globalStyle.card,
    marginBottom: 8,
    // Same as rejectedBoxOuter above.
    backgroundColor: 'transparent',
  },
  curriculumDoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'color-success-transparent-200',
  },
  courseCard: {
    ...globalStyle.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  categoryPill: {
    backgroundColor: 'background-basic-color-3',
    borderRadius: 99,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'background-basic-color-3',
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
});
