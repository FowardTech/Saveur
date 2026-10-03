import React, { memo } from 'react';
import { Alert, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Spinner,
  Icon,
  Input,
} from '@ui-kitten/components';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as practicalService from 'services/practicalService';
import { PracticalStep } from 'services/practicalService';

// Result of a submitted "task" step -- holds the graded feedback for the
// step just answered AND the already-generated next step (or the terminal
// 'completed' signal), exactly what practicalService.submitTask() resolves
// to. Kept separate from `step` state below because the learner needs to
// actually read this feedback (product requirement: "don't just silently
// advance") before a "Continue" tap swaps `step` over to the next one.
type TaskSubmitResult = Awaited<ReturnType<typeof practicalService.submitTask>>;

// The scenario itself — one decision point at a time. Each choice the
// learner taps genuinely changes what comes next (the backend regenerates
// the next situation live from the whole decision history, see
// services/practicalService.ts's chooseOption), so this screen just needs
// to render the current step and hand the choice off, then swap in
// whatever comes back. Reaching the final step routes to
// PracticalScenarioFeedback, where the AI's judgment scoring across the
// whole path shows up once it's ready.
const TOTAL_STEPS_ESTIMATE = 6; // mirrors Saveur-Backend/app/api/practical.py's MAX_STEPS

const PracticalScenarioSession = memo(() => {
  const { navigate, goBack } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PracticalScenarioSession'>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);

  const { sessionId, initialStep } = route.params;
  const [step, setStep] = React.useState<PracticalStep>(initialStep);
  const [isChoosing, setIsChoosing] = React.useState(false);

  // Hands-on "task" step state (backend follow-up: steps 3 and 5 of the
  // 6-step session are always step_type: 'task' -- a free-text deliverable
  // instead of tappable choices). `taskResponse` is intentionally NOT
  // cleared on a failed submit, so a 502 grading_failed / 503
  // llm_unavailable just leaves the learner's typed answer sitting in the
  // input ready to retry, per product ask.
  const [taskResponse, setTaskResponse] = React.useState('');
  const [isSubmittingTask, setIsSubmittingTask] = React.useState(false);
  const [taskSubmitError, setTaskSubmitError] = React.useState<string | null>(null);
  const [taskResult, setTaskResult] = React.useState<TaskSubmitResult | null>(null);

  const onChoose = async (choiceId: string) => {
    if (isChoosing) return;
    setIsChoosing(true);
    try {
      const result = await practicalService.chooseOption(sessionId, choiceId);
      if (result.status === 'completed') {
        navigate('PracticalScenarioFeedback', { sessionId });
      } else {
        setStep(result.step);
      }
    } catch (e: any) {
      Alert.alert(
        t('find:practical_choice_failed_title', { defaultValue: "Couldn't continue the scenario" }),
        e?.message ?? t('common:something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' }),
      );
    } finally {
      setIsChoosing(false);
    }
  };

  const onSubmitTask = async () => {
    if (isSubmittingTask || !taskResponse.trim()) return;
    setIsSubmittingTask(true);
    setTaskSubmitError(null);
    try {
      const result = await practicalService.submitTask(sessionId, taskResponse.trim());
      // Don't auto-advance -- the whole point of a hands-on task is getting
      // real feedback on it. `result` (feedback + the already-generated
      // next step) sits here until the learner taps Continue below.
      setTaskResult(result);
    } catch (e: any) {
      // apiClient's response interceptor already normalizes 502
      // grading_failed's `detail` and 503 llm_unavailable's `message` into
      // a clean `.message` -- no extra handling needed for those here.
      setTaskSubmitError(
        e?.message ?? t('common:something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' }),
      );
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const onContinueAfterTask = () => {
    if (!taskResult) return;
    if (taskResult.status === 'completed') {
      navigate('PracticalScenarioFeedback', { sessionId });
    } else {
      setStep(taskResult.step);
    }
    setTaskResult(null);
    setTaskResponse('');
    setTaskSubmitError(null);
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:practical_scenarios', { defaultValue: 'Practical Scenarios' })}
        accessoryLeft={<NavigationAction onPress={() => goBack()} />}
      />
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h10" status="placeholder" mb={16}>
          {t('find:practical_step_progress', {
            defaultValue: 'Step {{step}} of ~{{total}}',
            step: step.order,
            total: TOTAL_STEPS_ESTIMATE,
          })}
        </Text>

        <Layout level="2" style={styles.situationCard}>
          <Text category="h9-s" style={{ lineHeight: 22 }}>{step.situation}</Text>
        </Layout>

        {step.stepType === 'task' ? (
          <>
            <Layout level="2" style={styles.taskPromptCard}>
              <Flex justify="flex-start" itemsCenter mb={8}>
                <Icon pack="eva" name="edit-2-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
                <Text category="h8" bold ml={8}>
                  {t('find:practical_your_task', { defaultValue: 'Your task' })}
                </Text>
              </Flex>
              <Text category="h9-s" style={{ lineHeight: 22 }}>{step.taskPrompt}</Text>
            </Layout>

            {taskResult ? (
              // Answered -- show what they wrote plus the grading, and
              // gate moving on behind an explicit Continue tap.
              <>
                <Text category="h8" bold mt={24} mb={12}>
                  {t('find:practical_your_response', { defaultValue: 'Your response' })}
                </Text>
                <Layout level="2" style={styles.responseReadCard}>
                  <Text category="h9-s" style={{ lineHeight: 22 }}>{taskResponse}</Text>
                </Layout>

                {taskResult.taskFeedback ? (
                  <View style={styles.taskFeedbackBox}>
                    <Flex justify="flex-start" itemsCenter mb={12}>
                      <Icon pack="eva" name="message-square-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
                      <Text category="h8" bold ml={8}>
                        {t('find:practical_task_feedback_title', { defaultValue: 'Feedback on your task' })}
                      </Text>
                    </Flex>
                    <Text category="h9-s" style={{ lineHeight: 22 }} mb={taskResult.taskFeedback.strengths.length || taskResult.taskFeedback.improvements.length ? 16 : 0}>
                      {taskResult.taskFeedback.feedback}
                    </Text>

                    {taskResult.taskFeedback.strengths.length ? (
                      <View style={{ marginBottom: taskResult.taskFeedback.improvements.length ? 16 : 0 }}>
                        <Text category="h9" bold mb={8}>{t('find:practical_strengths', { defaultValue: 'What went well' })}</Text>
                        {taskResult.taskFeedback.strengths.map((s, i) => (
                          <Flex key={i} justify="flex-start" itemsCenter mb={6}>
                            <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                            <Text category="h9-s" ml={8} style={globalStyle.flexOne}>{s}</Text>
                          </Flex>
                        ))}
                      </View>
                    ) : null}

                    {taskResult.taskFeedback.improvements.length ? (
                      <View>
                        <Text category="h9" bold mb={8}>{t('find:practical_improvements', { defaultValue: 'Where to grow' })}</Text>
                        {taskResult.taskFeedback.improvements.map((s, i) => (
                          <Flex key={i} justify="flex-start" itemsCenter mb={6}>
                            <Icon pack="eva" name="alert-circle-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                            <Text category="h9-s" ml={8} style={globalStyle.flexOne}>{s}</Text>
                          </Flex>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <CtaButton style={[globalStyle.shadowBtn, { marginTop: 20 }]} onPress={onContinueAfterTask}>
                  {t('find:practical_continue', { defaultValue: 'Continue' })}
                </CtaButton>
              </>
            ) : isSubmittingTask ? (
              // Grading is an AI call like every other in this app -- same
              // full-width Spinner treatment as the choice-step's isChoosing
              // state above, since this can take a few seconds too.
              <Flex center style={{ paddingVertical: 32 }}>
                <Spinner size="large" />
                <Text category="h9-s" status="placeholder" center mt={16}>
                  {t('find:practical_grading_task', { defaultValue: 'Reviewing your response…' })}
                </Text>
              </Flex>
            ) : (
              <>
                <Text category="h8" bold mt={24} mb={12}>
                  {t('find:practical_your_response_prompt', { defaultValue: 'Write your response' })}
                </Text>
                <Input
                  multiline
                  placeholder={t('find:practical_task_response_placeholder', { defaultValue: 'Type your response…' }).toString()}
                  value={taskResponse}
                  onChangeText={setTaskResponse}
                  style={styles.taskResponseInput}
                  textStyle={globalStyle.inputText}
                />

                {taskSubmitError ? (
                  <Flex justify="flex-start" style={{ alignItems: 'flex-start' }} mt={10}>
                    <Icon pack="eva" name="alert-circle-outline" style={[globalStyle.icon16, { marginTop: 2, tintColor: theme['color-danger-500'] }]} />
                    <Text category="h10" status="danger" ml={6} style={globalStyle.flexOne}>{taskSubmitError}</Text>
                  </Flex>
                ) : null}

                <CtaButton
                  style={[globalStyle.shadowBtn, { marginTop: 16 }]}
                  disabled={!taskResponse.trim()}
                  onPress={onSubmitTask}
                >
                  {taskSubmitError
                    ? t('find:practical_submit_retry', { defaultValue: 'Try again' })
                    : t('find:practical_submit_task', { defaultValue: 'Submit' })}
                </CtaButton>
              </>
            )}
          </>
        ) : (
          <>
            <Text category="h8" bold mt={24} mb={12}>
              {t('find:practical_what_do_you_do', { defaultValue: 'What do you do?' })}
            </Text>

            {isChoosing ? (
              <Flex center style={{ paddingVertical: 32 }}>
                <Spinner size="large" />
              </Flex>
            ) : (
              step.choices.map(choice => (
                <Flex
                  key={choice.id}
                  level="2"
                  style={styles.choiceCard}
                  justify="flex-start"
                  itemsCenter
                  onPress={() => onChoose(choice.id)}
                >
                  <View style={[styles.choiceBadge, { backgroundColor: theme['color-primary-transparent-200'] }]}>
                    {/* Was status="primary" -- near-white text-primary-color on
                        a pale transparent badge, invisible in light mode. See
                        the same fix in JobAlerts.tsx/HomeSrc.tsx. */}
                    <Text category="h9" bold style={{color: theme['color-primary-500']}}>{choice.id.toUpperCase()}</Text>
                  </View>
                  <Text category="h9-s" style={globalStyle.flexOne}>{choice.text}</Text>
                </Flex>
              ))
            )}
          </>
        )}
      </Content>
    </Container>
  );
});

export default PracticalScenarioSession;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  // Redesign v2 (full reskin): `card` carries a real shadow again, which
  // needs an opaque fill on Android — dropped the 'transparent' overrides
  // below so each Layout/Flex's own `level="2"` background shows through
  // instead.
  situationCard: {
    ...globalStyle.card,
    padding: 20,
    marginBottom: 16,
  },
  choiceCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 12,
  },
  choiceBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  // Hands-on task step (backend follow-up: step_type 'task') -- same card
  // treatment as situationCard above so it reads as part of the same flow
  // rather than a visually distinct feature bolted on.
  taskPromptCard: {
    ...globalStyle.card,
    padding: 20,
    marginBottom: 16,
  },
  taskResponseInput: {
    ...globalStyle.inputField,
    minHeight: 140,
  },
  responseReadCard: {
    ...globalStyle.card,
    padding: 16,
    backgroundColor: 'background-basic-color-2',
  },
  taskFeedbackBox: {
    ...globalStyle.card,
    padding: 16,
    marginTop: 16,
  },
});
