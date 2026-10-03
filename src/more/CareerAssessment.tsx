import React, {memo} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Spinner, Icon} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NavigationProp, RouteProp, useNavigation, useRoute, CommonActions} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import {EKeyAsyncStorage, accountScopedKey} from 'constants/Types';
import {AuthContext} from '../../AuthContext';
import * as onboardingAssessmentService from 'services/onboardingAssessmentService';
import {
  PersonalityQuestion,
  SkillsQuizQuestion,
  SkillsQuizResultDetail,
} from 'services/onboardingAssessmentService';

// Product request: "I want us to add prep test and many other personality
// test during onboarding and also when user enters the dashboard for the
// first time." Two independent, back-to-back quizzes in one screen:
// 1. Career Personality Assessment (12 fixed questions, one per trait
//    dimension — see the backend's onboarding_assessment_service.py for
//    the actual question bank; this screen renders whatever it returns
//    rather than holding its own copy).
// 2. Skills Prep Quiz (5 questions, dynamically generated for the user's
//    own target role — same "JD-aware, dynamic" approach as this app's
//    mock interview questions).
// Reachable two ways (see navigation/types.tsx's CareerAssessment entry):
// a new button on the post-signup SuccessScr (`fromOnboarding: true`), and
// a one-time automatic nudge on Home's first-ever dashboard visit if the
// user skipped it during signup (see HomeSrc.tsx). Both entry points are
// the exact same screen/component — nothing here branches on how it was
// reached except where to navigate on completion.
type Stage =
  | 'intro'
  | 'personality_loading'
  | 'personality'
  | 'personality_result'
  | 'skills_intro'
  | 'skills_loading'
  | 'skills_quiz'
  | 'skills_result';

const CareerAssessment = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'common']);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'CareerAssessment'>>();
  const {profile} = React.useContext(AuthContext);
  const fromOnboarding = !!route.params?.fromOnboarding;

  const [stage, setStage] = React.useState<Stage>('intro');
  const [error, setError] = React.useState<string | null>(null);

  // --- Personality quiz state ---
  const [personalityQuestions, setPersonalityQuestions] = React.useState<PersonalityQuestion[]>([]);
  const [personalityIndex, setPersonalityIndex] = React.useState(0);
  const [personalityAnswers, setPersonalityAnswers] = React.useState<onboardingAssessmentService.PersonalityAnswer[]>([]);
  const [narrative, setNarrative] = React.useState('');
  const [isSubmittingPersonality, setIsSubmittingPersonality] = React.useState(false);

  // --- Skills quiz state ---
  const [quizId, setQuizId] = React.useState<string | null>(null);
  const [skillsQuestions, setSkillsQuestions] = React.useState<SkillsQuizQuestion[]>([]);
  const [skillsIndex, setSkillsIndex] = React.useState(0);
  const [skillsAnswers, setSkillsAnswers] = React.useState<onboardingAssessmentService.SkillsQuizAnswer[]>([]);
  const [skillsScore, setSkillsScore] = React.useState({score: 0, total: 0});
  const [skillsDetail, setSkillsDetail] = React.useState<SkillsQuizResultDetail[]>([]);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = React.useState(false);

  const targetRole = profile?.desiredRoles?.[0] || '';
  const targetIndustry = profile?.industries?.[0] || '';

  const markSeen = React.useCallback(() => {
    AsyncStorage.setItem(accountScopedKey(EKeyAsyncStorage.careerAssessmentPromptSeen, profile?.uid), '1').catch(() => {});
  }, [profile?.uid]);

  const finish = React.useCallback(() => {
    markSeen();
    if (fromOnboarding) {
      // Reset, not push — mirrors SignupThirdStep's goToSuccess "See your
      // dashboard" button, which also lands on MainBottomTab as the new
      // root rather than leaving the whole signup stack behind it.
      navigation.dispatch(CommonActions.reset({index: 0, routes: [{name: 'MainBottomTab'}]}));
    } else {
      navigation.goBack();
    }
  }, [fromOnboarding, markSeen, navigation]);

  const onSkipAll = React.useCallback(() => {
    finish();
  }, [finish]);

  const startPersonality = React.useCallback(async () => {
    setStage('personality_loading');
    setError(null);
    try {
      const questions = await onboardingAssessmentService.getPersonalityQuestions();
      setPersonalityQuestions(questions);
      setPersonalityIndex(0);
      setPersonalityAnswers([]);
      setStage('personality');
    } catch (e: any) {
      setError(e?.message ?? t('more:career_assessment_load_failed', {defaultValue: "Couldn't load the assessment right now."}));
      setStage('intro');
    }
  }, [t]);

  const onSelectPersonalityOption = React.useCallback(async (optionIndex: number) => {
    const question = personalityQuestions[personalityIndex];
    if (!question) return;
    const nextAnswers = [...personalityAnswers, {questionId: question.id, optionIndex}];
    setPersonalityAnswers(nextAnswers);
    if (personalityIndex + 1 < personalityQuestions.length) {
      setPersonalityIndex(personalityIndex + 1);
      return;
    }
    setIsSubmittingPersonality(true);
    try {
      const result = await onboardingAssessmentService.submitPersonality(nextAnswers);
      setNarrative(result.narrative);
      setStage('personality_result');
    } catch (e: any) {
      setError(e?.message ?? t('more:career_assessment_submit_failed', {defaultValue: "Couldn't save your answers right now."}));
      setStage('personality_result');
    } finally {
      setIsSubmittingPersonality(false);
    }
  }, [personalityAnswers, personalityIndex, personalityQuestions, t]);

  const startSkillsQuiz = React.useCallback(async () => {
    setStage('skills_loading');
    setError(null);
    setIsGeneratingQuiz(true);
    try {
      const result = await onboardingAssessmentService.generateSkillsQuiz(targetRole, targetIndustry);
      setQuizId(result.quizId);
      setSkillsQuestions(result.questions);
      setSkillsIndex(0);
      setSkillsAnswers([]);
      setStage('skills_quiz');
    } catch (e: any) {
      setError(e?.message ?? t('more:career_assessment_quiz_generate_failed', {defaultValue: "Couldn't put together your quiz right now."}));
      setStage('skills_intro');
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [t, targetIndustry, targetRole]);

  const onSelectSkillsOption = React.useCallback(async (selectedIndex: number) => {
    const question = skillsQuestions[skillsIndex];
    if (!question || !quizId) return;
    const nextAnswers = [...skillsAnswers, {questionId: question.id, selectedIndex}];
    setSkillsAnswers(nextAnswers);
    if (skillsIndex + 1 < skillsQuestions.length) {
      setSkillsIndex(skillsIndex + 1);
      return;
    }
    try {
      const result = await onboardingAssessmentService.submitSkillsQuiz(quizId, nextAnswers, targetRole);
      setSkillsScore({score: result.score, total: result.total});
      setSkillsDetail(result.detail);
    } catch {
      // best-effort — still show a results screen even if the graded
      // detail failed to come back, rather than stranding the user
      setSkillsScore({score: 0, total: skillsQuestions.length});
    } finally {
      setStage('skills_result');
    }
  }, [quizId, skillsAnswers, skillsIndex, skillsQuestions, targetRole]);

  const renderProgress = (current: number, total: number) => (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, {width: `${((current + 1) / total) * 100}%`, backgroundColor: theme['color-primary-100']}]} />
    </View>
  );

  const renderOptionRow = (labelText: string, onPress: () => void, key: string) => (
    <TouchableOpacity
      key={key}
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.optionRow, {borderColor: theme['background-basic-color-4'], backgroundColor: theme['background-basic-color-2']}]}>
      <Text category="h8" style={styles.optionText}>{labelText}</Text>
      <Icon pack="eva" name="chevron-right-outline" style={[globalStyle.icon20, {tintColor: theme['text-placeholder-color']}]} />
    </TouchableOpacity>
  );

  let body: React.ReactNode;

  if (stage === 'intro') {
    body = (
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h2" bold mb={12} fontSize={28} lineHeight={34}>
          {t('more:career_assessment_intro_title', {defaultValue: "Let's get to know how you work"})}
        </Text>
        <Text category="h9-s" status="placeholder" mb={24}>
          {t('more:career_assessment_intro_subtitle', {
            defaultValue: 'A quick 2-minute career personality assessment, plus an optional skills-readiness quiz for your target role — both help your AI Coach personalize its advice from day one.',
          })}
        </Text>
        {!!error && <Text status="danger" mb={16}>{error}</Text>}
        <CtaButton size="large" onPress={startPersonality}>
          {t('more:career_assessment_start_button', {defaultValue: 'Start (2 min)'})}
        </CtaButton>
        <TouchableOpacity style={styles.skipLink} onPress={onSkipAll}>
          <Text category="h9" status="placeholder" center>
            {t('more:career_assessment_skip_for_now', {defaultValue: 'Skip for now'})}
          </Text>
        </TouchableOpacity>
      </Content>
    );
  } else if (stage === 'personality_loading' || stage === 'skills_loading') {
    body = (
      <Flex center justify="center" style={styles.loadingFill}>
        <Spinner size="large" />
      </Flex>
    );
  } else if (stage === 'personality') {
    const question = personalityQuestions[personalityIndex];
    body = (
      <Content padder contentContainerStyle={styles.content}>
        {renderProgress(personalityIndex, personalityQuestions.length)}
        <Text category="h9" status="placeholder" mt={16} mb={8}>
          {t('more:career_assessment_question_of', {
            current: personalityIndex + 1, total: personalityQuestions.length,
            defaultValue: `Question ${personalityIndex + 1} of ${personalityQuestions.length}`,
          })}
        </Text>
        <Text category="h4" bold mb={20}>{question?.text}</Text>
        {isSubmittingPersonality ? (
          <Flex center mt={24}><Spinner size="large" /></Flex>
        ) : (
          question?.options.map((opt, i) => renderOptionRow(opt, () => onSelectPersonalityOption(i), `${question.id}_${i}`))
        )}
      </Content>
    );
  } else if (stage === 'personality_result') {
    body = (
      <Content padder contentContainerStyle={styles.content}>
        <View style={[styles.badgeCircle, {backgroundColor: theme['color-primary-transparent-200'] ?? 'rgba(0,99,248,0.1)'}]}>
          <Icon pack="eva" name="checkmark-circle-2" style={[globalStyle.icon40, {tintColor: theme['color-primary-100']}]} />
        </View>
        <Text category="h3" bold center mt={16} mb={8}>
          {t('more:career_assessment_personality_done_title', {defaultValue: 'Your working style'})}
        </Text>
        {!!error && <Text status="danger" center mb={12}>{error}</Text>}
        {!!narrative && <Text category="h8" center mb={24}>{narrative}</Text>}
        <CtaButton size="large" onPress={() => setStage('skills_intro')}>
          {t('more:career_assessment_continue_button', {defaultValue: 'Continue'})}
        </CtaButton>
      </Content>
    );
  } else if (stage === 'skills_intro') {
    body = (
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h2" bold mb={12} fontSize={28} lineHeight={34}>
          {t('more:career_assessment_skills_intro_title', {defaultValue: 'Want a quick skills check?'})}
        </Text>
        <Text category="h9-s" status="placeholder" mb={24}>
          {targetRole
            ? t('more:career_assessment_skills_intro_subtitle_role', {
                role: targetRole,
                defaultValue: `5 quick multiple-choice questions on ${targetRole} fundamentals — see where you stand before your first mock interview.`,
              })
            : t('more:career_assessment_skills_intro_subtitle_generic', {
                defaultValue: '5 quick multiple-choice questions to gauge your readiness before your first mock interview.',
              })}
        </Text>
        {!!error && <Text status="danger" mb={16}>{error}</Text>}
        <CtaButton size="large" onPress={startSkillsQuiz} disabled={isGeneratingQuiz}>
          {t('more:career_assessment_take_quiz_button', {defaultValue: 'Take the quiz'})}
        </CtaButton>
        <TouchableOpacity style={styles.skipLink} onPress={finish}>
          <Text category="h9" status="placeholder" center>
            {t('more:career_assessment_skip_quiz', {defaultValue: 'Skip and go to my dashboard'})}
          </Text>
        </TouchableOpacity>
      </Content>
    );
  } else if (stage === 'skills_quiz') {
    const question = skillsQuestions[skillsIndex];
    body = (
      <Content padder contentContainerStyle={styles.content}>
        {renderProgress(skillsIndex, skillsQuestions.length)}
        <Text category="h9" status="placeholder" mt={16} mb={8}>
          {t('more:career_assessment_question_of', {
            current: skillsIndex + 1, total: skillsQuestions.length,
            defaultValue: `Question ${skillsIndex + 1} of ${skillsQuestions.length}`,
          })}
        </Text>
        <Text category="h4" bold mb={20}>{question?.text}</Text>
        {question?.options.map((opt, i) => renderOptionRow(opt, () => onSelectSkillsOption(i), `${question.id}_${i}`))}
      </Content>
    );
  } else if (stage === 'skills_result') {
    body = (
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h1" bold center mb={4}>
          {skillsScore.score}/{skillsScore.total}
        </Text>
        <Text category="h9-s" status="placeholder" center mb={24}>
          {t('more:career_assessment_skills_result_subtitle', {defaultValue: "Here's a quick recap:"})}
        </Text>
        {skillsDetail.map((d, i) => (
          <View key={d.questionId} style={[styles.recapRow, {borderColor: theme['background-basic-color-4']}]}>
            <Icon
              pack="eva"
              name={d.correct ? 'checkmark-circle-2' : 'close-circle'}
              style={[globalStyle.icon20, {tintColor: d.correct ? theme['color-success-500'] : theme['color-danger-500'], marginTop: 2}]}
            />
            <View style={styles.recapTextWrap}>
              <Text category="h9" bold mb={2}>{i + 1}. {d.text}</Text>
              {!!d.explanation && <Text category="h10-s" status="placeholder">{d.explanation}</Text>}
            </View>
          </View>
        ))}
        <CtaButton size="large" style={{marginTop: 24}} onPress={finish}>
          {t('more:career_assessment_finish_button', {defaultValue: 'Go to my dashboard'})}
        </CtaButton>
      </Content>
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={fromOnboarding ? '' : t('more:career_assessment_screen_title', {defaultValue: 'Career Assessment'}).toString()}
        accessoryLeft={fromOnboarding ? undefined : () => <NavigationAction />}
      />
      {body}
    </Container>
  );
});

export default CareerAssessment;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
    flexGrow: 1,
  },
  loadingFill: {
    flex: 1,
  },
  skipLink: {
    marginTop: 16,
    paddingVertical: 8,
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  optionText: {
    flex: 1,
    marginRight: 8,
  },
  badgeCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  recapRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  recapTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
});
