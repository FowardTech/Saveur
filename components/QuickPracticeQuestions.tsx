import React, {memo} from 'react';
import {KeyboardAvoidingView, Modal, Platform, TouchableOpacity, View} from 'react-native';
import {Button, Icon, Input, Layout, useTheme} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from './Text';
import Flex from './Flex';
import CtaButton from './CtaButton';
import StarRating, {percentToStars} from './StarRating';
import {SkeletonList} from './Skeleton';
import {globalStyle} from 'styles/globalStyle';
import * as questionLibraryService from 'services/questionLibraryService';
import {LibraryQuestion} from 'services/questionLibraryService';
import * as coachService from 'services/coachService';
import {StarBreakdownResult} from 'services/coachService';

// Mobile port of Saveur-Web's components/practice/QuickPracticeQuestions.tsx
// (task #44, porting task #23 "Interview Prep pre-made question library"
// which only ever shipped on web -- resume.io's own Interview Prep page has
// a row of ready-made "5 min" question cards sitting above the full
// role-specific mock-interview setup; this is that lighter,
// browse-first-then-practice-one-question tier). Same real backend as web
// (see questionLibraryService.ts's own header comment), and reuses
// coachService.getStarBreakdown() -- a STAR-grading helper that already
// existed on mobile but had no caller yet (POST /api/v1/coach/star, free,
// no session created).
export const QuickPracticeQuestions = memo(({interviewType, role}: {interviewType: string; role: string}) => {
  const {t} = useTranslation(['find', 'common']);
  const [questions, setQuestions] = React.useState<LibraryQuestion[] | null>(null);
  const [active, setActive] = React.useState<LibraryQuestion | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setQuestions(null);
    questionLibraryService.getQuestionLibrary(interviewType, role).then(list => {
      if (!cancelled) setQuestions(list);
    });
    return () => {
      cancelled = true;
    };
  }, [interviewType, role]);

  if (questions !== null && questions.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text category="h9-s" bold status="placeholder">
        {t('find:quick_questions_title', {defaultValue: 'Quick practice questions'})}
      </Text>
      <Text category="h10" status="placeholder" mt={2} mb={12}>
        {t('find:quick_questions_subtitle', {defaultValue: 'Answer one question and get instant feedback — no full session needed.'})}
      </Text>

      {questions === null ? (
        <SkeletonList count={3} />
      ) : (
        questions.map(q => (
          <TouchableOpacity key={q.id} style={[globalStyle.card, styles.questionCard]} onPress={() => setActive(q)}>
            <View style={styles.timeChip}>
              <Icon pack="eva" name="clock-outline" style={[globalStyle.icon16, styles.timeChipIcon]} />
              <Text category="h10-s" bold style={styles.timeChipText}>
                {t('find:five_min', {defaultValue: '5 min'})}
              </Text>
            </View>
            <Text category="h9-s" mt={10}>
              {q.text}
            </Text>
          </TouchableOpacity>
        ))
      )}

      {active ? <AnswerQuestionModal question={active} onClose={() => setActive(null)} /> : null}
    </View>
  );
});

const AnswerQuestionModal = memo(({question, onClose}: {question: LibraryQuestion; onClose: () => void}) => {
  const theme = useTheme();
  const {t} = useTranslation(['find', 'common']);
  const [answer, setAnswer] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<StarBreakdownResult | null>(null);

  async function handleGetFeedback() {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await coachService.getStarBreakdown(answer.trim(), {question: question.text});
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? t('find:star_feedback_failed', {defaultValue: "Couldn't grade your answer. Please try again."}));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.modalCard, {backgroundColor: theme['background-basic-color-1']}]}>
          <Flex justify="space-between" itemsCenter mb={12}>
            <Text category="h8-s" bold style={globalStyle.flexOne}>
              {question.text}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, {tintColor: theme['text-hint-color']}]} />
            </TouchableOpacity>
          </Flex>

          {!result ? (
            <>
              <Input
                multiline
                placeholder={t('find:answer_placeholder', {defaultValue: 'Type your answer…'}).toString()}
                value={answer}
                onChangeText={setAnswer}
                style={styles.textInput}
                textStyle={styles.textInputInner}
              />
              {error ? (
                <Text category="h10" status="danger" mt={8}>
                  {error}
                </Text>
              ) : null}
              <CtaButton style={{marginTop: 16}} disabled={!answer.trim() || submitting} loading={submitting} onPress={handleGetFeedback}>
                {submitting
                  ? t('find:grading_label', {defaultValue: 'Grading…'})
                  : t('find:get_feedback', {defaultValue: 'Get feedback'})}
              </CtaButton>
            </>
          ) : (
            <>
              {result.breakdown.map((item, i) => (
                <Layout key={i} level="2" style={styles.starRow}>
                  <Flex justify="flex-start" itemsCenter mb={8}>
                    <View style={[styles.starBadge, {backgroundColor: theme['color-primary-500']}]}>
                      <Text category="h9-s" status="control" bold>
                        {item.letter}
                      </Text>
                    </View>
                    <Text category="h9-s" ml={10} bold>
                      {item.label}
                    </Text>
                    <Text category="h9-s" ml={8} status="link" bold>
                      {item.score}%
                    </Text>
                  </Flex>
                  <StarRating value={percentToStars(item.score)} size={12} style={{marginBottom: 6}} />
                  {item.note ? (
                    <Text category="h10" status="placeholder">
                      {item.note}
                    </Text>
                  ) : null}
                </Layout>
              ))}
              {result.overallNote ? (
                <Text category="h10" mt={4} mb={12}>
                  {result.overallNote}
                </Text>
              ) : null}
              <Button
                appearance="outline"
                onPress={() => {
                  setResult(null);
                  setAnswer('');
                }}>
                {t('find:try_another_answer', {defaultValue: 'Try another answer'})}
              </Button>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

export default QuickPracticeQuestions;

const styles = {
  section: {
    marginTop: 20,
    marginBottom: 4,
  },
  questionCard: {
    padding: 14,
    marginBottom: 10,
  },
  timeChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    backgroundColor: 'rgba(139, 92, 246, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
  },
  timeChipIcon: {
    tintColor: '#52525b',
  },
  timeChipText: {
    color: '#52525b',
    marginLeft: 4,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%' as const,
    maxHeight: '85%' as const,
    borderRadius: 16,
    padding: 20,
  },
  textInput: {
    borderRadius: 12,
    minHeight: 110,
  },
  textInputInner: {
    minHeight: 90,
    textAlignVertical: 'top' as const,
  },
  starRow: {
    ...globalStyle.card,
    padding: 14,
    marginBottom: 12,
  },
  starBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};
