import React, { memo } from 'react';
import { FlatList, Image, TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Button,
  Input,
  Spinner,
} from '@ui-kitten/components';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as learningService from 'services/learningService';
import { CourseModule, CourseLevel, Certificate, COURSE_LEVELS, CourseVideo } from 'services/learningService';
import * as speechService from 'services/speechService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import { getCourseLevelLabel } from 'utils/learningLabels';
import CtaButton from 'components/CtaButton';
import InAppVideoPlayer from 'components/InAppVideoPlayer';
import CodeBlock from 'components/CodeBlock';
import { ArtTrophy } from 'src/home/HomeHeroArt';

type LessonMode = 'voice' | 'text';

// Product report: "In the lesson course there are code written as
// explanation for software engineer and IT related courses. So I want the
// codes to be written like in real code editor design." CourseModule.body
// (see services/learningService.ts) is a single AI-generated string with
// no structural parsing at all today — a fenced ```language ... ``` block
// (the AI already writes these for code-heavy topics, same markdown
// convention it uses everywhere else in this app's AI output) used to
// render as plain prose, fences and all, in the exact same font/size as
// everything else. Splits the body on fences and renders each code segment
// via CodeBlock (dark editor chrome + monospace) while prose segments keep
// rendering as plain Text, same as before — deliberately NOT a full
// markdown parser (no such library exists in this app yet, and headers/
// lists/bold aren't part of this report), just fenced code-block
// detection.
const CODE_FENCE_RE = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g;

interface BodySegment {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

function parseModuleBody(body: string): BodySegment[] {
  if (!body) return [];
  const segments: BodySegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  CODE_FENCE_RE.lastIndex = 0;
  while ((match = CODE_FENCE_RE.exec(body))) {
    if (match.index > lastIndex) {
      const prose = body.slice(lastIndex, match.index).trim();
      if (prose) segments.push({type: 'text', content: prose});
    }
    const code = match[2].replace(/\n$/, '');
    if (code.trim()) segments.push({type: 'code', content: code, language: match[1] || undefined});
    lastIndex = CODE_FENCE_RE.lastIndex;
  }
  const rest = body.slice(lastIndex).trim();
  if (rest) segments.push({type: 'text', content: rest});
  // No fences at all — the overwhelmingly common case for non-technical
  // courses — returns the original single text segment, so behavior is
  // byte-for-byte unchanged for every lesson that isn't showing code.
  return segments.length ? segments : [{type: 'text', content: body}];
}

// AI-taught course session — replaces the old LearningCourses.tsx "Start"
// button, which just showed Alert("Course content coming soon.") with no
// real content behind it. The AI genuinely teaches here: module content is
// generated live per module (services/learningService.ts, built on the same
// real POST /api/v1/coach/advice endpoint the Coach tab uses — works for
// ANY topic, not a fixed catalog, including technical/coding topics), read
// aloud via the existing interview TTS pipeline (services/speechService.ts)
// when Voice mode is picked, and the check-for-understanding question at
// the end of each module is real — typed answers get real AI feedback
// (learningService.getAnswerFeedback), not just decoration.
//
// Visuals: per the product decision, these should be real AI-generated
// images, which needs a backend image-generation integration that doesn't
// exist yet (see learningService.generateVisual + backend spec addendum
// §15) — this screen calls that endpoint per module and simply doesn't
// render an image if it comes back null, so the lesson is never blocked on
// it.
const CourseSession = memo(() => {
  const theme = useTheme();
  const { t } = useTranslation(['more', 'common']);
  const styles = useStyleSheet(themedStyles);
  const { goBack } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CourseSession'>>();
  const { profile, isPremium } = React.useContext(AuthContext);
  const { topic, totalModules, level = 'basic' as CourseLevel, coreSubtopics } = route.params;
  const courseId = React.useMemo(() => learningService.courseIdFor(topic, level), [topic, level]);

  const [mode, setMode] = React.useState<LessonMode>('text');
  const [syllabus, setSyllabus] = React.useState<string[] | null>(null);
  const [moduleIndex, setModuleIndex] = React.useState(0);
  const [hasResumed, setHasResumed] = React.useState(false);
  const [moduleCache, setModuleCache] = React.useState<Record<number, CourseModule>>({});
  const [imageCache, setImageCache] = React.useState<Record<number, string | null>>({});
  const [isLoadingModule, setIsLoadingModule] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [isComplete, setIsComplete] = React.useState(false);
  const [earnedCertificate, setEarnedCertificate] = React.useState<Certificate | null>(null);

  // Product request (item #63 of the redesign batch): "Learning Course: add
  // a 'Get Started' intro screen" — this screen used to drop a learner
  // straight into Module 1's content (or a loading spinner for it) the
  // instant they tapped Start, with zero framing of what the course
  // actually covers first. Defaults true; the resume-progress effect below
  // flips it false immediately for anyone who already has completed
  // modules on this course, so returners go straight back into their
  // in-progress lesson exactly like before — only a genuinely fresh course
  // start shows this.
  const [showIntro, setShowIntro] = React.useState(true);

  const [answer, setAnswer] = React.useState('');
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [isCheckingAnswer, setIsCheckingAnswer] = React.useState(false);

  const context = {
    goals: profile?.goals,
    industries: profile?.industries,
    desiredRoles: profile?.desiredRoles,
  };

  // Resume where the learner left off — previously this screen always
  // restarted at module 0 with no memory of prior progress at all. Runs
  // once, before the syllabus/module load effects below, so moduleIndex is
  // already correct by the time the first module is fetched.
  React.useEffect(() => {
    let cancelled = false;
    learningService.getCourseProgress(courseId).then(progress => {
      if (cancelled) return;
      const resumeIndex = Math.min(progress.lastModuleIndex, Math.max(totalModules - 1, 0));
      if (progress.completedModules > 0 && resumeIndex > 0) {
        setModuleIndex(resumeIndex);
      }
      if (progress.completedModules > 0) {
        setShowIntro(false);
      }
      setHasResumed(true);
    }).catch(() => setHasResumed(true));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Syllabus — first check for one already saved for this (user, course)
  // pair (see learningService.getSavedSyllabus) so re-opening or reviewing a
  // course always shows the same module list it started with, instead of
  // regenerating fresh titles via AI on every mount. Only generates (and
  // then saves) a new one the first time this course is ever opened.
  React.useEffect(() => {
    if (!hasResumed) return;
    let cancelled = false;
    (async () => {
      const saved = await learningService.getSavedSyllabus(courseId);
      if (saved) {
        if (!cancelled) setSyllabus(saved);
        return;
      }
      const titles = await learningService.generateSyllabus(topic, totalModules, level, coreSubtopics ?? []);
      if (cancelled) return;
      setSyllabus(titles);
      learningService.saveSyllabus(courseId, titles);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasResumed, courseId]);

  const loadModule = React.useCallback(
    async (index: number, titles: string[]) => {
      if (moduleCache[index]) {
        setIsLoadingModule(false);
        return;
      }
      setIsLoadingModule(true);
      setLoadError(null);
      try {
        // Same reuse-before-regenerate pattern as the syllabus above: a
        // module already taught to this learner must always show the exact
        // content (and check-question) they originally saw and answered
        // against — never a freshly regenerated variant, even via Previous
        // or re-opening a completed course.
        const saved = await learningService.getSavedModuleContent(courseId, index);
        if (saved) {
          setModuleCache(prev => ({ ...prev, [index]: saved.module }));
          if (saved.imageUrl) setImageCache(prev => ({ ...prev, [index]: saved.imageUrl }));
          return;
        }
        const mod = await learningService.generateModule(topic, index, totalModules, titles[index], context, level);
        setModuleCache(prev => ({ ...prev, [index]: mod }));
        // Best-effort, non-blocking — don't wait on the image to show text.
        learningService.generateVisual(`${topic}: ${titles[index]}`).then(url => {
          setImageCache(prev => ({ ...prev, [index]: url }));
          learningService.saveModuleContent(courseId, index, mod, url);
        });
      } catch (e: any) {
        setLoadError(e?.message ?? t('more:course_load_error', { defaultValue: 'Could not load this module.' }));
      } finally {
        setIsLoadingModule(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topic, totalModules, moduleCache, courseId],
  );

  React.useEffect(() => {
    if (syllabus) loadModule(moduleIndex, syllabus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syllabus, moduleIndex]);

  const currentModule = moduleCache[moduleIndex];
  const currentImage = imageCache[moduleIndex];

  // Recommended videos (product request item: "after each lesson/module,
  // auto-suggest real matching videos... play inside a custom in-app
  // player") — get-or-fetch per module, same cache-by-index shape as
  // moduleCache/imageCache above. Guarded by the `!== undefined` check
  // (rather than listing videosByModule itself as a dependency) so
  // revisiting an already-fetched module via Previous/Next never re-runs
  // the search, without needing a ref.
  const [videosByModule, setVideosByModule] = React.useState<Record<number, CourseVideo[]>>({});
  const [playerVideo, setPlayerVideo] = React.useState<CourseVideo | null>(null);
  React.useEffect(() => {
    if (!currentModule || videosByModule[moduleIndex] !== undefined) return;
    learningService.getModuleVideos(courseId, moduleIndex, topic, currentModule.title).then(videos => {
      setVideosByModule(prev => ({ ...prev, [moduleIndex]: videos }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModule, moduleIndex, courseId, topic]);
  const currentVideos = videosByModule[moduleIndex];

  // Voice mode — auto-narrate as soon as a module's content is ready.
  React.useEffect(() => {
    if (mode !== 'voice' || !currentModule) return;
    let cancelled = false;
    (async () => {
      setIsSpeaking(true);
      try {
        await speechService.speak(currentModule.body);
        if (!cancelled && currentModule.checkQuestion) {
          await speechService.speak(currentModule.checkQuestion);
        }
      } catch {
        // Best-effort — speechService already falls back to on-device TTS
        // internally, so a failure here means both paths failed; just leave
        // the text visible.
      } finally {
        if (!cancelled) setIsSpeaking(false);
      }
    })();
    return () => {
      cancelled = true;
      speechService.stopSpeaking();
    };
  }, [mode, currentModule]);

  React.useEffect(() => {
    return () => speechService.stopSpeaking();
  }, []);

  // Explicit stop-then-navigate for every "back" exit — the mount-cleanup
  // above only fires once this screen actually unmounts, which React
  // Navigation doesn't do until its transition finishes, and even then
  // stopSpeaking() alone used to only stop audio that had ALREADY started
  // playing. Between those two gaps, a still-in-flight speak() call (mid
  // ElevenLabs fetch or mid on-device engine init right as "back" was
  // tapped) could finish a moment later and start talking well after the
  // user was already back on the previous screen (product report: "the AI
  // keeps talking even after going back"). Calling stopSpeaking() here,
  // synchronously and immediately on tap, closes both gaps — combined with
  // speechService.ts's own cancellation-token fix for the "starts late"
  // half of that race.
  const onBack = () => {
    speechService.stopSpeaking();
    goBack();
  };

  const onToggleMode = (next: LessonMode) => {
    if (next === mode) return;
    speechService.stopSpeaking();
    setIsSpeaking(false);
    setMode(next);
  };

  const onCheckAnswer = async () => {
    if (!answer.trim() || !currentModule?.checkQuestion || isCheckingAnswer) return;
    setIsCheckingAnswer(true);
    try {
      const result = await learningService.getAnswerFeedback(topic, currentModule.checkQuestion, answer);
      setFeedback(result);
    } finally {
      setIsCheckingAnswer(false);
    }
  };

  const onNext = () => {
    speechService.stopSpeaking();
    setAnswer('');
    setFeedback(null);
    // Persist completion for this module — the source of truth "resume"
    // (above) and certificate issuance (below) both rely on, rather than
    // this screen ever recording anything before now.
    learningService.markModuleProgress(courseId, moduleIndex, true).catch(() => {});
    if (moduleIndex + 1 >= totalModules) {
      setIsComplete(true);
      // Product decision: course completion is no longer one of the App
      // Store review prompt's trigger conditions (see utils/appRating.ts's
      // header comment) — the prompt now only fires off 5 completed
      // interviews, 1 tracked job application, or 1 finished AI coach
      // conversation.
      if (level === 'advanced') {
        learningService.issueCertificateIfEligible(topic).then(cert => {
          if (cert) setEarnedCertificate(cert);
        }).catch(() => {});
      }
    } else {
      setModuleIndex(i => i + 1);
    }
  };

  const onPrevious = () => {
    if (moduleIndex === 0) return;
    speechService.stopSpeaking();
    setAnswer('');
    setFeedback(null);
    setModuleIndex(i => i - 1);
  };

  // Defense-in-depth — LearningCourses.tsx (the only normal entry point to
  // this screen) is already Pro-Premium-gated, but gate here too in case
  // anything else ever navigates straight to CourseSession.
  if (!isPremium) {
    return (
      <ProLockGate
        variant="premium"
        title={t('more:learning_courses', { defaultValue: 'Learning Courses' })}
        description={t('more:learning_courses_premium_gate_description', {
          defaultValue:
            'Structured courses with badges to sharpen your interview skills — Learning Courses is a Pro Premium feature.',
        })}
      />
    );
  }

  if (isComplete) {
    const nextLevelIdx = COURSE_LEVELS.indexOf(level) + 1;
    const nextLevel = COURSE_LEVELS[nextLevelIdx];
    return (
      <Container style={styles.container}>
        <TopNavigation
          // `topic` is free-text the user typed (see this file's top
          // comment — "works for ANY topic, not a fixed catalog"), so it
          // can easily run longer than a canned screen title.
          // numberOfLines={1} keeps it from wrapping into/behind the back
          // button (components/NavigationAction.tsx).
          title={<Text category="h6" bold numberOfLines={1} ellipsizeMode="tail">{topic}</Text>}
          accessoryLeft={<NavigationAction onPress={onBack} />}
        />
        <Content padder contentContainerStyle={styles.content}>
          <Flex vertical itemsCenter justify="center" style={{ flex: 1, paddingTop: 60 }}>
            {/* Product request: "add illustrations like the gift box
                wherever needed" — was a bare "award-outline" Eva icon on
                what's actually a real celebration moment. A trophy with a
                couple of sparkle accents reads as an achievement, not just
                a generic badge glyph. See src/home/HomeHeroArt.tsx's own
                comment for the full sweep. */}
            <ArtTrophy size={104} />
            <Text category="h3" bold center mt={20}>
              {t('more:course_tier_complete', {
                defaultValue: '{{level}} Tier Complete!',
                level: getCourseLevelLabel(level, t),
              })}
            </Text>
            <Text category="h9-s" status="placeholder" center mt={12} maxWidth={280}>
              {t('more:course_tier_complete_description', {
                defaultValue: "You've finished all {{count}} {{level}} modules of {{topic}}.",
                count: totalModules,
                level: getCourseLevelLabel(level, t).toLowerCase(),
                topic,
              })}
            </Text>
            {earnedCertificate ? (
              // Plain success-tinted card (gradient fill removed — reserved
              // for the homescreen XP card only). Reverted to the
              // pre-reskin semantic: status="success" title on a
              // color-success-transparent-200 fill.
              <View style={[styles.certCard, styles.certCardInner]}>
                <Text category="h8" bold status="success" center>
                  {t('more:course_certificate_earned', { defaultValue: 'Badge Earned' })}
                </Text>
                <Text category="h9-s" status="placeholder" center mt={4}>
                  {t('more:course_certificate_subtitle', {
                    defaultValue: '{{topic}} — Basic, Intermediate & Advanced',
                    topic,
                  })}
                </Text>
                <Text category="h10" status="placeholder" center mt={6}>
                  {earnedCertificate.code}
                </Text>
              </View>
            ) : nextLevel ? (
              <Text category="h9-s" status="link" center mt={16}>
                {t('more:course_next_level_unlocked', {
                  defaultValue: '{{level}} unlocked — head back to Learning Courses to continue.',
                  level: getCourseLevelLabel(nextLevel, t),
                })}
              </Text>
            ) : null}
            <CtaButton style={{ marginTop: 32, width: '100%' }} onPress={onBack}>
              {t('more:course_back_to_courses', { defaultValue: 'Back to Courses' })}
            </CtaButton>
          </Flex>
        </Content>
      </Container>
    );
  }

  if (hasResumed && showIntro) {
    return (
      <Container style={styles.container}>
        <TopNavigation
          title={<Text category="h6" bold numberOfLines={1} ellipsizeMode="tail">{topic}</Text>}
          accessoryLeft={<NavigationAction onPress={onBack} />}
        />
        <Content padder contentContainerStyle={styles.content}>
          <Flex vertical itemsCenter style={{ paddingTop: 24 }}>
            <View style={[styles.introIconWrap, { backgroundColor: theme['color-primary-transparent-200'] }]}>
              <Icon pack="eva" name="book-open-outline" style={[globalStyle.icon40, { tintColor: theme['color-primary-500'] }]} />
            </View>
            <Text category="h4" bold center mt={20}>{topic}</Text>
            <Text category="h9-s" status="placeholder" center mt={8}>
              {t('more:course_intro_subtitle', {
                defaultValue: '{{level}} · {{count}} modules',
                level: getCourseLevelLabel(level, t),
                count: totalModules,
              })}
            </Text>

            {/* Product feedback: "You did not design this page well... the
                page that displays the curriculum of the lesson or module.
                Its not looking good and professional." This list used to be
                bare text rows floating directly on the page background,
                separated only by a top hairline (which also drew a stray
                line under the subtitle above row 1), with a plain gray
                number circle and no other visual hierarchy. Now it's a real
                card (globalStyle.card, same treatment every other list card
                in the app uses) with a primary-tinted number badge, a
                secondary "Module N" caption under each title, a trailing
                chevron for scannability, and bottom (not top) dividers so
                the last row sits flush with the card's own edge instead of
                floating past it. */}
            {syllabus ? (
              <View
                style={[
                  globalStyle.card,
                  styles.introSyllabus,
                  { backgroundColor: theme['background-basic-color-2'] },
                ]}>
                {syllabus.map((title, i) => (
                  <Flex
                    key={i}
                    justify="flex-start"
                    itemsCenter
                    style={[
                      styles.introSyllabusRow,
                      i === syllabus.length - 1 && styles.introSyllabusRowLast,
                    ]}>
                    <View
                      style={[
                        styles.introSyllabusIndex,
                        { backgroundColor: theme['color-primary-transparent-200'] },
                      ]}>
                      <Text category="h10" bold style={{ color: theme['color-primary-500'] }}>
                        {i + 1}
                      </Text>
                    </View>
                    <View style={styles.introSyllabusTextWrap}>
                      <Text category="h9" bold numberOfLines={2}>
                        {title}
                      </Text>
                      <Text category="h10-s" status="placeholder" mt={2}>
                        {t('more:course_module_label', { defaultValue: 'Module {{n}}', n: i + 1 })}
                      </Text>
                    </View>
                    {/* BUG FIX (crash: "Icon: 'chevron-right-outline' icon is
                        not registered in pack 'eva'" — that name was never
                        added to assets/LucideEvaIconsPack.tsx, only to
                        AssetIconsPack.tsx under a different name; same class
                        of bug this codebase already hit once before in
                        PersonalizationCard.tsx, see LucideEvaIconsPack.tsx's
                        own comment on that). Correct existing chevron is
                        pack="assets" name="chevronRight", already used the
                        same way in src/more/components/ButtonOptional.tsx. */}
                    <Icon
                      pack="assets"
                      name="chevronRight"
                      style={[globalStyle.icon20, { tintColor: theme['text-hint-color'] }]}
                    />
                  </Flex>
                ))}
              </View>
            ) : (
              <Flex center style={{ paddingVertical: 32 }}>
                <Spinner size="small" />
              </Flex>
            )}

            <CtaButton
              style={{ marginTop: 8, width: '100%' }}
              disabled={!syllabus}
              onPress={() => setShowIntro(false)}>
              {t('more:course_get_started', { defaultValue: 'Get Started' })}
            </CtaButton>
          </Flex>
        </Content>
      </Container>
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={<Text category="h6" bold numberOfLines={1} ellipsizeMode="tail">{topic}</Text>}
        accessoryLeft={<NavigationAction onPress={goBack} />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Flex justify="space-between" itemsCenter mb={16}>
          <Text category="h9" bold status="placeholder">
            {t('more:course_module_progress', {
              defaultValue: '{{level}} · Module {{current}} of {{total}}',
              level: getCourseLevelLabel(level, t),
              current: moduleIndex + 1,
              total: totalModules,
            })}
          </Text>
          <Flex justify="flex-start">
            <TouchableOpacity
              onPress={() => onToggleMode('text')}
              style={[styles.modePill, { backgroundColor: mode === 'text' ? theme['color-primary-500'] : theme['background-basic-color-2'] }]}>
              <Text category="h10" bold status={mode === 'text' ? 'control' : 'basic'}>
                {t('more:course_mode_text', { defaultValue: 'Text' })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onToggleMode('voice')}
              style={[styles.modePill, { backgroundColor: mode === 'voice' ? theme['color-primary-500'] : theme['background-basic-color-2'], marginLeft: 8 }]}>
              <Text category="h10" bold status={mode === 'voice' ? 'control' : 'basic'}>
                {t('more:course_mode_voice', { defaultValue: 'Voice' })}
              </Text>
            </TouchableOpacity>
          </Flex>
        </Flex>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(((moduleIndex + 1) / totalModules) * 100)}%`, backgroundColor: theme['color-primary-500'] },
            ]}
          />
        </View>

        {isLoadingModule ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 60 }}>
            <Spinner size="large" />
            <Text category="h9-s" status="placeholder" mt={12} center>
              {mode === 'voice'
                ? t('more:course_preparing_lesson', { defaultValue: 'Preparing your lesson…' })
                : t('more:course_writing_module', { defaultValue: 'Writing this module…' })}
            </Text>
          </Flex>
        ) : loadError ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 40 }}>
            <Text category="h9-s" status="danger" center mb={16}>
              {loadError}
            </Text>
            <Text category="h9" status="link" bold onPress={() => syllabus && loadModule(moduleIndex, syllabus)}>
              {t('common:try_again', { defaultValue: 'Try again' })}
            </Text>
          </Flex>
        ) : currentModule ? (
          <>
            <Text category="h6" bold mt={20} mb={12}>
              {currentModule.title}
            </Text>

            {currentImage ? (
              <Image source={{ uri: currentImage }} style={styles.visual} resizeMode="cover" />
            ) : null}

            {mode === 'voice' && isSpeaking ? (
              <Flex justify="flex-start" itemsCenter mb={12}>
                <Icon pack="eva" name="volume-up-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                <Text category="h9" status="link" ml={8}>
                  {t('more:course_speaking', { defaultValue: 'Speaking…' })}
                </Text>
                <Text
                  category="h9"
                  status="danger"
                  bold
                  ml={16}
                  onPress={() => {
                    speechService.stopSpeaking();
                    setIsSpeaking(false);
                  }}>
                  {t('more:course_stop', { defaultValue: 'Stop' })}
                </Text>
              </Flex>
            ) : null}

            {parseModuleBody(currentModule.body).map((segment, i) =>
              segment.type === 'code' ? (
                <CodeBlock
                  key={i}
                  code={segment.content}
                  language={segment.language}
                  style={{marginBottom: 20}}
                />
              ) : (
                <Text key={i} category="h9-s" mb={20}>
                  {segment.content}
                </Text>
              ),
            )}

            {currentModule.checkQuestion ? (
              <View style={styles.checkCard}>
                <Text category="h8" bold mb={8}>
                  {t('more:course_check_understanding', { defaultValue: 'Check your understanding' })}
                </Text>
                <Text category="h9-s" status="placeholder" mb={12}>
                  {currentModule.checkQuestion}
                </Text>
                <Input
                  placeholder={t('more:course_answer_placeholder', { defaultValue: 'Type your answer…' }).toString()}
                  value={answer}
                  onChangeText={setAnswer}
                  multiline
                  style={styles.answerInput}
                  textStyle={globalStyle.inputText}
                />
                <Button
                  size="small"
                  appearance="outline"
                  disabled={!answer.trim() || isCheckingAnswer}
                  onPress={onCheckAnswer}
                  style={{ marginTop: 10 }}>
                  {isCheckingAnswer
                    ? t('more:course_checking', { defaultValue: 'Checking…' })
                    : t('more:course_check_my_answer', { defaultValue: 'Check my answer' })}
                </Button>
                {feedback ? (
                  <Text category="h9-s" status="success" mt={12}>
                    {feedback}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {currentVideos && currentVideos.length > 0 ? (
              <View style={{ marginTop: 24 }}>
                <Text category="h8" bold mb={12}>
                  {t('more:course_recommended_videos', { defaultValue: 'Recommended Videos' })}
                </Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={currentVideos}
                  keyExtractor={v => v.videoId}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.videoCard}
                      activeOpacity={0.8}
                      onPress={() => setPlayerVideo(item)}>
                      <Image source={{ uri: item.thumbnailUrl }} style={styles.videoThumb} resizeMode="cover" />
                      <View style={styles.videoPlayBadge}>
                        <Icon pack="eva" name="play-circle-outline" style={[globalStyle.icon24, { tintColor: '#fff' }]} />
                      </View>
                      <Text category="h10" bold numberOfLines={2} mt={6}>
                        {item.title}
                      </Text>
                      {item.channel ? (
                        <Text category="h10" status="placeholder" numberOfLines={1}>
                          {item.channel}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  )}
                />
              </View>
            ) : null}

            <Flex justify="space-between" itemsCenter mt={32}>
              <Button appearance="ghost" disabled={moduleIndex === 0} onPress={onPrevious}>
                {t('more:course_previous', { defaultValue: 'Previous' })}
              </Button>
              <CtaButton onPress={onNext}>
                {moduleIndex + 1 >= totalModules
                  ? t('more:course_finish', { defaultValue: 'Finish' })
                  : t('more:course_next_module', { defaultValue: 'Next Module' })}
              </CtaButton>
            </Flex>
          </>
        ) : null}
      </Content>
      <InAppVideoPlayer
        visible={playerVideo !== null}
        video={playerVideo}
        onClose={() => setPlayerVideo(null)}
        context={{ topic, moduleTitle: currentModule?.title, courseId }}
      />
    </Container>
  );
});

export default CourseSession;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  // "Get Started" intro screen (see the JSX above).
  introIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introSyllabus: {
    width: '100%',
    marginTop: 28,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  introSyllabusRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'background-basic-color-3',
  },
  introSyllabusRowLast: {
    borderBottomWidth: 0,
  },
  introSyllabusTextWrap: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  introSyllabusIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 99,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'background-basic-color-3',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  visual: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginBottom: 16,
  },
  checkCard: {
    ...globalStyle.card,
    padding: 16,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill to render correctly on Android (was
    // 'transparent') — this renders on a plain View (no `level` prop), so
    // the fill has to live here.
    backgroundColor: 'background-basic-color-2',
    marginTop: 8,
  },
  videoCard: {
    width: 160,
    marginRight: 12,
  },
  videoThumb: {
    width: 160,
    height: 90,
    borderRadius: 10,
    backgroundColor: 'background-basic-color-3',
  },
  videoPlayBadge: {
    position: 'absolute',
    top: 33,
    left: 68,
  },
  answerInput: {
    ...globalStyle.inputField,
    minHeight: 60,
  },
  // Plain success-tinted card (gradient fill removed).
  certCard: {
    marginTop: 24,
    width: '100%',
    borderRadius: 14,
    backgroundColor: 'color-success-transparent-200',
  },
  certCardInner: {
    padding: 16,
    width: '100%',
  },
});
