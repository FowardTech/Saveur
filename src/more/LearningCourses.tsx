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
  CourseLevel, COURSE_LEVELS, LEVEL_LABELS, MODULES_PER_LEVEL, CAREER_PATHS,
  TopicCheckResult, CourseProgressSummary, Certificate, AllProgress,
} from 'services/learningService';

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
  const { isPremium } = React.useContext(AuthContext);

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

  const loadProgress = React.useCallback(() => {
    learningService.getAllProgress().then(setAllProgress).catch(() => {});
  }, []);

  React.useEffect(() => {
    learningService.listCertificates().then(setCertificates).catch(() => {});
    loadProgress();
  }, [loadProgress]);

  // Refresh every time this screen regains focus (e.g. backing out of a
  // CourseSession after completing a module) so progress made in the last
  // session is reflected immediately, not just on the next full app launch.
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadProgress);
    return unsubscribe;
  }, [navigation, loadProgress]);

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
        title="Learning Courses"
        description="AI-taught, module-by-module courses on any career topic, with a badge on completion — Learning Courses is a Pro Premium feature."
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
              <View style={[styles.continueIconWrap, { backgroundColor: theme['color-primary-transparent-200'] }]}>
                <Icon pack="eva" name="play-circle-outline" style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text category="h10" status="placeholder">Continue where you left off</Text>
                <Text category="h8" bold mt={2}>{continueTitle}</Text>
                <Text category="h10" status="placeholder" mt={2}>
                  {LEVEL_LABELS[continueLevel]} · {continueEntry?.completedModules ?? 0}/{continueTotal} modules
                </Text>
              </View>
              <Button size="small" onPress={onContinueMostRecent}>
                {t('more:continue', { defaultValue: 'Continue' })}
              </Button>
            </Flex>
          </Layout>
        ) : null}

        {certificates.length ? (
          <Layout level="2" style={[styles.customCard, { marginBottom: 20 }]}>
            <Text category="h7" bold mb={12}>
              Your Badges
            </Text>
            {certificates.map(c => (
              <Flex key={c.code} justify="flex-start" itemsCenter mb={8}>
                <Icon pack="eva" name="award-outline" style={[globalStyle.icon20, { tintColor: theme['color-success-500'] }]} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text category="h9" bold>{c.topic}</Text>
                  <Text category="h10" status="placeholder">Basic · Intermediate · Advanced — {c.code}</Text>
                </View>
              </Flex>
            ))}
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
              {careerPath || t('more:career_path_placeholder', { defaultValue: 'Select a career path' })}
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
                    {path}
                  </Text>
                  {careerPath === path ? (
                    <Icon pack="eva" name="checkmark-outline" style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]} />
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
            <Button
              size="small"
              disabled={!careerPath || isCheckingTopic}
              style={styles.customStartBtn}
              onPress={onCheckTopic}>
              {isCheckingTopic ? '…' : t('more:check_topic', { defaultValue: 'Check' })}
            </Button>
          </Flex>

          {isCheckingTopic ? (
            <Flex center style={{ paddingVertical: 20 }}>
              <Spinner size="small" />
            </Flex>
          ) : topicCheck && !topicCheck.valid ? (
            <View style={styles.rejectedBox}>
              <Text category="h9-s" status="warning">
                {topicCheck.reason || "That doesn't look like a specific professional or career skill yet — try something more concrete."}
              </Text>
            </View>
          ) : topicCheck?.valid ? (
            <View style={{ marginTop: 16 }}>
              <Text category="h8" bold mb={4}>{topicCheck.canonicalTopic}</Text>
              {topicCheck.coreSubtopics.length ? (
                <Text category="h10" status="placeholder" mb={12}>
                  Covers: {topicCheck.coreSubtopics.slice(0, 4).join(', ')}
                  {topicCheck.coreSubtopics.length > 4 ? '…' : ''}
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
                        {LEVEL_LABELS[level]}
                      </Text>
                      <Text category="h10" status="placeholder">
                        {isTierComplete ? 'Completed' : `${completed}/${total} modules`}
                      </Text>
                    </View>
                    <Button
                      size="tiny"
                      appearance={unlocked ? 'filled' : 'outline'}
                      status={isTierComplete ? 'success' : 'primary'}
                      disabled={!unlocked}
                      onPress={() => onStartTier(level)}>
                      {!unlocked ? 'Locked' : isTierComplete ? 'Review' : completed > 0 ? 'Continue' : 'Start'}
                    </Button>
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
                  <Text category="h10" bold status="link">{course.category}</Text>
                </View>
                <Text category="h10" status="placeholder">{course.durationMin} min</Text>
              </Flex>
              <Text category="h7" bold mb={4}>{course.title}</Text>
              <Text category="h9-s" status="placeholder" mb={12}>{course.description}</Text>

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
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
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
  rejectedBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'color-warning-transparent-200',
  },
  tierRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'background-basic-color-3',
  },
  courseCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
