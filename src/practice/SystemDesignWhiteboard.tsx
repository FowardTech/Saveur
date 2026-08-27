import React, { memo } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Input,
  Button,
  Layout,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList, SystemDesignWhiteboardScreenNavigationProp } from 'navigation/types';
import * as interviewService from 'services/interviewService';
import * as codingService from 'services/codingService';

// REWRITTEN (product decision, after FIVE separate rounds of fixes to the
// freehand drawing/drag canvas this screen used to have — a touch-stealing
// empty-state overlay, zero-length-path commits, duplicate React keys,
// locationX/Y drift, an SVG intercepting hit-testing, a full rewrite onto
// react-native-gesture-handler's Gesture.Pan()/GestureDetector, then a
// further rewrite onto React Native's own core Touch Responder System to
// dodge a Reanimated-4-vs-worklets-core conflict — and drawing/dragging
// STILL didn't reliably register for users): the canvas is gone.
//
// It was never load-bearing. The AI review and the interview-completion
// grading below both only ever sent the candidate's TYPED explanation
// (designNotes) to the backend — never the drawing itself (an arbitrary
// freehand SVG path has nothing exportable as text — see
// codingService.getSystemDesignFeedback's own comment). So this screen now
// asks for that explanation directly instead of first asking the user to
// sketch on a canvas that didn't work: describe the design in words (same
// as talking through a whiteboard answer out loud in a real interview),
// get the same AI review as before. Nothing about scoring/feedback
// changed — only the now-removed decorative canvas is gone.
const SystemDesignWhiteboard = memo(() => {
  const { goBack, navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<SystemDesignWhiteboardScreenNavigationProp>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);

  // Optional session context (product report: "the system design should
  // also be added as part of the tools too" + session-length timer + AI
  // review — see navigation/types.tsx's own comment on this route). All
  // undefined when reached the old way (the standalone sandbox icon), which
  // is still fully supported — every session-specific block below is
  // gated on `sessionId` being present.
  //
  // endsAt/designPrompt (product report: "the count down timer... should
  // continue counting down until the user finishes... and then the overall
  // feedback of both the two interview should now be generated") — set
  // instead of durationMin when this screen is reached as a mid-interview
  // handoff from LiveInterviewSession.tsx rather than a fresh start: endsAt
  // is an absolute deadline carried over from however much of the original
  // selected duration was left, so the countdown genuinely continues rather
  // than restarting at a full new duration; designPrompt is the AI
  // interviewer's own handoff instruction, shown as a brief so the
  // candidate knows what to describe instead of landing on a blank input.
  const { sessionId, interviewType, durationMin, endsAt, designPrompt } = route.params ?? {};

  // endsAt is an absolute epoch-ms deadline (not "seconds remaining from
  // mount"), so this recomputes from it on every tick below rather than
  // just decrementing a locally-seeded counter — that keeps the countdown
  // accurate even accounting for however long it took this screen to
  // actually mount after LiveInterviewSession's navigate() call fired.
  const computeSecondsLeft = React.useCallback((): number | null => {
    if (endsAt) return Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    if (durationMin) return durationMin * 60;
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, durationMin]);

  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(computeSecondsLeft);
  const hasAutoFinishedRef = React.useRef(false);
  const [isFinishing, setIsFinishing] = React.useState(false);

  const [designNotes, setDesignNotes] = React.useState('');
  const [isReviewing, setIsReviewing] = React.useState(false);
  const [reviewResult, setReviewResult] = React.useState<{ summary: string; feedback: string[] } | null>(null);

  // Product report: "the system design hands on practice should also have
  // a AI code review too and result." See this file's header comment for
  // why the explanation is what actually gets reviewed, same as talking
  // through a design on a real whiteboard interview.
  const onGetReview = async () => {
    if (isReviewing) return;
    if (!designNotes.trim()) {
      Alert.alert(
        t('find:system_design_notes_required_title', { defaultValue: 'Describe your design first' }),
        t('find:system_design_notes_required_body', {
          defaultValue: 'Briefly explain your system design (components, data flow, tradeoffs) so the AI has something to review.',
        }),
      );
      return;
    }
    setIsReviewing(true);
    try {
      const result = await codingService.getSystemDesignFeedback(designNotes);
      setReviewResult(result);
    } catch (e: any) {
      Alert.alert(
        t('find:review_failed', { defaultValue: 'Review failed' }),
        e?.message ?? t('find:review_failed_body', { defaultValue: 'Could not get an AI code review. Please try again.' }),
      );
    } finally {
      setIsReviewing(false);
    }
  };

  const onFinish = async (opts?: { timedOut?: boolean }) => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      if (sessionId) {
        try {
          // BUG FIX (product report: "make sure the system design practice
          // ... give an interview feedback and it must be correct
          // feedbacks"): the backend has nothing else to grade a system
          // design session on — passing whatever explanation the candidate
          // already typed (designNotes) is the only real signal available,
          // same text the on-demand "Get AI Review" button above already
          // uses. Sent even if empty; the backend leaves feedback blank
          // rather than fabricating an assessment when there's genuinely
          // nothing here.
          await interviewService.completeSession(sessionId, undefined, undefined, { designNotes });
        } catch (e: any) {
          if (!opts?.timedOut) {
            Alert.alert(
              t('find:finish_interview_sync_failed', { defaultValue: 'Could not sync interview' }),
              e?.message ?? t('find:finish_interview_sync_failed_body', { defaultValue: 'Your session ended locally but we could not reach the server to finalize it. Your feedback may be incomplete.' }),
            );
          }
        }
      }
    } finally {
      setIsFinishing(false);
      // See isPracticeSandbox's own comment in navigation/types.tsx — only
      // the pure no-interviewer sandbox (reached with no endsAt, e.g.
      // FindScreen's Tools tile) sets this; a real-interview handoff from
      // LiveInterviewSession always carries an endsAt, so it correctly gets
      // InterviewFeedback's full Q&A layout instead of the simplified one.
      navigate('InterviewFeedback', { sessionId, interviewType, isPracticeSandbox: !endsAt });
    }
  };

  // Countdown tick + time's-up handling — same pattern as
  // CodingInterview.tsx's own timer (see that file's comment); a no-op
  // whenever no durationMin was passed.
  React.useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      if (!hasAutoFinishedRef.current) {
        hasAutoFinishedRef.current = true;
        Alert.alert(
          t('find:coding_time_up_title', { defaultValue: "Time's up" }),
          t('find:coding_time_up_body', {
            defaultValue: 'Your session length has ended. Submitting what you have and moving to feedback.',
          }),
          [{ text: t('common:ok', { defaultValue: 'OK' }), onPress: () => onFinish({ timedOut: true }) }],
        );
      }
      return;
    }
    const id = setTimeout(() => {
      setSecondsLeft(prev => {
        if (prev === null) return null;
        // See computeSecondsLeft's own comment — when we have a real
        // endsAt deadline, recompute from it (self-correcting) rather than
        // just decrementing, so this can never drift from the interview's
        // actual remaining time.
        return endsAt ? computeSecondsLeft() : prev - 1;
      });
    }, 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const timerLabel = React.useMemo(() => {
    if (secondsLeft === null) return null;
    const clamped = Math.max(0, secondsLeft);
    const mm = Math.floor(clamped / 60).toString().padStart(2, '0');
    const ss = (clamped % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  }, [secondsLeft]);

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:system_design_whiteboard', { defaultValue: 'System Design' })}
        accessoryLeft={<NavigationAction onPress={goBack} />}
        accessoryRight={
          timerLabel
            ? () => (
                <View style={[styles.timerPill, secondsLeft !== null && secondsLeft <= 60 ? styles.timerPillUrgent : null]}>
                  <Icon pack="eva" name="clock-outline" style={[globalStyle.icon16, { tintColor: secondsLeft !== null && secondsLeft <= 60 ? '#FF6B6B' : theme['text-basic-color'] }]} />
                  <Text category="h9" bold ml={6} style={secondsLeft !== null && secondsLeft <= 60 ? { color: '#FF6B6B' } : undefined}>
                    {timerLabel}
                  </Text>
                </View>
              )
            : undefined
        }
      />
      <KeyboardAvoidingView style={globalStyle.flexOne} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Design-brief banner (product report: "the AI interviewer can ask
              the user to create some design in the whiteboard as part of the
              interview questions... the app should automatically navigate the
              user to the system design whiteboard") — only present on a
              mid-interview handoff from LiveInterviewSession.tsx (see
              designPrompt's own comment above); the standalone sandbox entry
              points (FindScreen's Tools tile, the old manual jump-to-whiteboard
              icon) never set this, so this banner simply doesn't render there. */}
          {designPrompt ? (
            <View style={styles.designBrief}>
              <Icon pack="eva" name="message-square-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
              <Text category="h9-s" ml={8} style={[globalStyle.flexOne, { color: theme['text-basic-color'] }]}>
                {designPrompt}
              </Text>
            </View>
          ) : null}

          <Layout level="1" style={styles.card}>
            <Text category="h7" bold mb={8}>
              {t('find:system_design_notes_required_title', { defaultValue: 'Describe your design first' })}
            </Text>
            <Text category="h9-s" status="placeholder" mb={12}>
              {t('find:system_design_notes_label', {
                defaultValue: 'Briefly explain your system design — the components, how data flows between them, and any tradeoffs you made. The AI reviews this explanation, the way an interviewer listens to you talk through a design.',
              })}
            </Text>
            <Input
              multiline
              textStyle={{ minHeight: 160, textAlignVertical: 'top' }}
              style={globalStyle.inputField}
              value={designNotes}
              onChangeText={setDesignNotes}
              placeholder={t('find:system_design_notes_placeholder', { defaultValue: 'e.g. A load balancer routes requests to stateless API servers, which read/write to a sharded database with a cache in front for hot reads…' }).toString()}
            />
            <Button
              children={isReviewing ? t('find:reviewing_code', { defaultValue: 'Reviewing…' }) : t('find:get_ai_code_review', { defaultValue: 'Get AI Review' })}
              disabled={isReviewing}
              status="info"
              onPress={onGetReview}
              accessoryLeft={props => <Icon {...props} pack="assets" name="quote" />}
              style={{ marginTop: 14 }}
            />
            {reviewResult ? (
              <Layout level="2" style={styles.reviewBox}>
                <Text category="h9" bold status="link" mb={8}>
                  {reviewResult.summary}
                </Text>
                {reviewResult.feedback.map((line, i) => (
                  <Flex key={i} justify="flex-start" itemsCenter mt={i === 0 ? 0 : 8}>
                    <Icon pack="assets" name="quote" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                    <Text category="h9-s" ml={10} style={globalStyle.flexOne}>{line}</Text>
                  </Flex>
                ))}
              </Layout>
            ) : null}
          </Layout>
        </ScrollView>

        {sessionId ? (
          <View style={styles.footerBar}>
            <Button
              children={isFinishing ? t('find:finishing', { defaultValue: 'Finishing…' }) : t('find:finish_interview', { defaultValue: 'Finish Interview' })}
              disabled={isFinishing}
              status="success"
              size="small"
              onPress={() => onFinish()}
              style={globalStyle.flexOne}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Container>
  );
});

export default SystemDesignWhiteboard;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  // Design-brief banner — see designPrompt's own comment above.
  designBrief: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 99, 248, 0.08)',
  },
  card: {
    ...globalStyle.card,
    padding: 16,
  },
  reviewBox: {
    ...globalStyle.card,
    marginTop: 16,
    padding: 16,
  },
  footerBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: 'background-basic-color-2',
  },
  timerPillUrgent: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
});
