import React, { memo } from 'react';
import { Alert, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Icon,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import ProgressCard from 'src/find/Component/ProgressCard';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList, InterviewFeedbackScreenNavigationProp } from 'navigation/types';
import { Interview_Type_Enum, SkillScoreProps, StarBreakdownItemProps } from 'constants/Types';
import * as feedbackService from 'services/feedbackService';
import {isFeedbackPending, FeedbackReport} from 'services/feedbackService';
import * as codingService from 'services/codingService';
import {getInterviewTypeLabel} from 'utils/interviewTypeLabels';
import ShareToUserModal from 'components/ShareToUserModal';
import CtaButton from 'components/CtaButton';
import StarRating, { percentToStars } from 'components/StarRating';
import { lightenColor } from 'utils/color';

// Redesign v2 (full reskin) — this screen has 5 separate ProgressCard
// rings, 3 of which use the same score>=80/60 success/warning/danger
// threshold ladder repeated inline. Centralized here so the gradient
// "from"/"to" pair (see utils/color.ts's lightenColor) and the plain
// progressStokeColor fallback always agree with each other instead of each
// call site re-deriving the threshold color separately and risking drift.
const scoreRingColors = (score: number, theme: Record<string, string>) => {
  const base =
    score >= 80 ? theme['color-success-500'] : score >= 60 ? theme['color-warning-500'] : theme['color-danger-500'];
  return { progressStokeColor: base, progressGradientFrom: lightenColor(base), progressGradientTo: base };
};
// Brand-blue gradient for the rings that don't carry threshold semantics
// (Overall Score, Smiling) — same two stops GradientCard.tsx defaults to.
const PRIMARY_RING_GRADIENT = { progressGradientFrom: '#1DA1F2', progressGradientTo: '#0063f8' };

// Post-interview feedback. The session has already been finalized by the
// time this screen mounts (LiveInterviewSession/CodingInterview both call
// interviewService.completeSession — POST .../end — before navigating here),
// so this screen's only job is to fetch the real scored report via
// GET /api/v1/feedback/session/{id} (see services/feedbackService.ts) and
// render loading/error/retry states around that real network call, which the
// old mock-backed version never needed since a mock couldn't fail.
const InterviewFeedback = memo(() => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<InterviewFeedbackScreenNavigationProp>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);

  const { sessionId, interviewType, videoAnalysis, codingResult, isPracticeSandbox } = route.params ?? {};

  // Product report: "the feedback interview for coding session should be
  // totally different from the normal interview feedback of the other type
  // of interview... Things like Star breakdown, video replay should not be
  // there because its coding session." Extended to System Design too, same
  // reasoning — neither is a spoken/typed Q&A session, so the conversational
  // scoring this screen otherwise shows (Skill Breakdown, STAR Breakdown,
  // Video Analysis, View Replay) doesn't apply and would just read as a
  // wall of meaningless near-0 scores.
  //
  // System Design is now split (see isPracticeSandbox's own comment in
  // navigation/types.tsx): the pure no-interviewer sandbox still has
  // nothing to show here but a design review, so it keeps this simplified
  // layout — but a REAL System Design interview now has an actual Q&A
  // transcript (feedback_job.generate_system_design_combined scores it
  // alongside any whiteboard portion), so it gets the full layout below
  // just like every other real interview type.
  const isNonQaType =
    interviewType === Interview_Type_Enum.Coding ||
    (interviewType === Interview_Type_Enum.SystemDesign && !!isPracticeSandbox);

  // Product report: "The AI code review button should not be in the coding
  // session. It should be in the feedback screen because thats where the
  // user will see the AI feedback." CodingInterview.tsx threads the final
  // code/language/problem through `codingResult` (see navigation/types.tsx)
  // so this exact same codingService.getCodeReview call — previously fired
  // from that screen — can live here instead.
  const [isReviewingCode, setIsReviewingCode] = React.useState(false);
  const [codeReview, setCodeReview] = React.useState<{ complexityNote: string; feedback: string[] } | null>(null);
  const onGetCodeReview = async () => {
    if (!codingResult || isReviewingCode) return;
    setIsReviewingCode(true);
    try {
      const result = await codingService.getCodeReview(codingResult.code, codingResult.language, codingResult.problemStatement);
      setCodeReview(result);
    } catch (e: any) {
      Alert.alert(
        t('find:review_failed', { defaultValue: 'Review failed' }),
        e?.message ?? t('find:review_failed_body', { defaultValue: 'Could not get an AI code review. Please try again.' }),
      );
    } finally {
      setIsReviewingCode(false);
    }
  };

  // See the "Other Things We Noticed" block below for what these four
  // signals are — computed once here (rather than duplicated inline for
  // the length check and the render map) so both agree on exactly which
  // lines are showing.
  const focusSignalLines = React.useMemo(() => {
    if (!videoAnalysis) return [];
    const FOCUS_SIGNAL_NOISE_FLOOR_PCT = 5;
    const lines: string[] = [];
    if (videoAnalysis.faceNotVisiblePct >= FOCUS_SIGNAL_NOISE_FLOOR_PCT) {
      lines.push(
        t('find:focus_signal_face_not_visible', {
          defaultValue: 'You were out of frame for about {{pct}}% of the interview — try to stay centered in the camera.',
          pct: videoAnalysis.faceNotVisiblePct,
        }),
      );
    }
    if (videoAnalysis.multipleFacesPct >= FOCUS_SIGNAL_NOISE_FLOOR_PCT) {
      lines.push(
        t('find:focus_signal_multiple_faces', {
          defaultValue: 'Someone else appeared in frame for about {{pct}}% of the interview.',
          pct: videoAnalysis.multipleFacesPct,
        }),
      );
    }
    if (videoAnalysis.eyesClosedPct >= FOCUS_SIGNAL_NOISE_FLOOR_PCT) {
      lines.push(
        t('find:focus_signal_eyes_closed', {
          defaultValue: "Your eyes looked closed for about {{pct}}% of the interview — try to keep engaging visually with the camera.",
          pct: videoAnalysis.eyesClosedPct,
        }),
      );
    }
    if (videoAnalysis.excessiveMovementPct >= FOCUS_SIGNAL_NOISE_FLOOR_PCT) {
      lines.push(
        t('find:focus_signal_excessive_movement', {
          defaultValue: 'You moved around a fair amount — sudden head movement showed up in about {{pct}}% of frames. A calmer posture can read as more composed.',
          pct: videoAnalysis.excessiveMovementPct,
        }),
      );
    }
    return lines;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoAnalysis]);

  const [isLoading, setIsLoading] = React.useState(!!sessionId);
  const [error, setError] = React.useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [overallScore, setOverallScore] = React.useState(0);
  const [skillScores, setSkillScores] = React.useState<SkillScoreProps[]>([]);
  const [starBreakdown, setStarBreakdown] = React.useState<StarBreakdownItemProps[]>([]);
  // The backend scores a session asynchronously (an LLM pass over the whole
  // transcript) — reading the feedback endpoint immediately after
  // completeSession() can land before that job finishes, returning a
  // `status: "pending"`-style response with every score still at 0. That
  // was previously shown as-is (a permanent "Skill Breakdown: 0% across the
  // board" — reported as scores "not showing"), since nothing here ever
  // re-checked. Now polls every few seconds while the backend reports the
  // job as still in progress, instead of treating the first 0-score
  // response as final.
  const [isScoringPending, setIsScoringPending] = React.useState(false);
  // "Share to a Saveur user" (product request item) — additive to whatever
  // external sharing this screen may gain later, not a replacement.
  const [isShareUserModalVisible, setIsShareUserModalVisible] = React.useState(false);
  const isMountedRef = React.useRef(true);
  const pollAttemptsRef = React.useRef(0);
  const pollTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // BUG FIX (product report: "the progress bar moved but its showing 0% ...
  // this is how it has been behaving and the value of this particular
  // feedback is not 0%"): the previous applyFeedbackResult guard (below)
  // only protects against an in-flight PENDING poll's zeroed payload
  // stomping an already-loaded real score -- it can't do anything about a
  // session that's genuinely stuck pending forever. Root cause: automatic
  // scoring runs on a bare daemon thread (see feedback_job.generate_
  // background) started right when the interview ends; if that thread gets
  // orphaned (WSGI worker recycle/restart between the request that started
  // it and the thread actually finishing -- a known risk of plain
  // threading instead of a real task queue, called out in that file's own
  // docstring) the InterviewFeedback row's `overall` column is left NULL
  // forever, which the backend correctly keeps reporting as status
  // "pending" (see feedback.py's _feedback_payload) -- so this screen would
  // otherwise poll for ~60s, give up, and permanently show 0% until the
  // user notices and manually taps "Regenerate Feedback". Regenerate runs
  // feedback_job.generate() SYNCHRONOUSLY in the request instead (see
  // feedback.py's regenerate() comment: "why this isn't queued through
  // Redis/RQ anymore"), so it reliably completes where the orphaned
  // background thread didn't. Auto-triggering that same synchronous call
  // once, right when polling would otherwise give up, self-heals this
  // exact case invisibly instead of leaving the user staring at a
  // permanent, wrong 0%.
  const hasAutoRegeneratedRef = React.useRef(false);
  const POLL_INTERVAL_MS = 3000;
  const MAX_POLL_ATTEMPTS = 20; // ~60s total before giving up and showing whatever came back

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  // BUG FIX (product report: "the AI feedback progress bar is flickering,
  // it just changes to 0% sometimes and then changes back") — fetchFeedback
  // and pollFeedback used to call setOverallScore/setSkillScores/
  // setStarBreakdown with whatever that tick's response contained, no
  // matter what. While the backend is still scoring, a poll tick can land
  // between the job clearing old fields and writing new ones and come back
  // with a partial/zeroed payload even though `status` still says pending —
  // that momentarily stomped an already-loaded real score with 0, and
  // CircleSlider (the ring drawing the percentage) restarts its 3s fill
  // animation on every value change, so each poll's real->0->real bounce
  // was visibly a sawtooth flicker, not a one-off glitch. A genuinely final
  // (non-pending) response is always authoritative and applied as-is, even
  // if a session truly scored 0 — only in-flight polls are guarded against
  // regressing to a worse value than what's already on screen.
  const applyFeedbackResult = React.useCallback((result: FeedbackReport) => {
    const pending = isFeedbackPending(result.status);
    setOverallScore(prev => (!pending || result.overallScore > 0 ? result.overallScore : prev));
    setSkillScores(prev =>
      !pending || result.skillScores.some(s => s.score > 0) ? result.skillScores : prev,
    );
    setStarBreakdown(prev =>
      !pending || result.starBreakdown.some(s => s.score > 0) ? result.starBreakdown : prev,
    );
  }, []);

  const fetchFeedback = React.useCallback(async () => {
    if (!sessionId) return;
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    pollAttemptsRef.current = 0;
    hasAutoRegeneratedRef.current = false;
    setIsLoading(true);
    setIsScoringPending(false);
    setError(null);
    try {
      const result = await feedbackService.getSessionFeedback(sessionId);
      if (!isMountedRef.current) return;
      // Always show whatever the response actually contains — a previous
      // version of this returned early here without ever calling
      // setOverallScore/setSkillScores/setStarBreakdown when `status` looked
      // pending, which left the whole screen blank (no cards at all under
      // Skill Breakdown/STAR Breakdown, not even 0%) — reported as
      // "everything was empty." `status` isn't a confirmed backend contract
      // (no real response has been seen), so treating it as a reason to
      // withhold data that IS present was too aggressive; it's now only
      // used to decide whether to keep polling in the background for a
      // possibly-fresher result, never to hide what's already there.
      // (applyFeedbackResult still guards against a pending tick's partial/
      // zeroed payload regressing an already-shown real score — see its own
      // comment above.)
      applyFeedbackResult(result);
      if (isFeedbackPending(result.status)) {
        setIsScoringPending(true);
        pollTimeoutRef.current = setTimeout(pollFeedback, POLL_INTERVAL_MS);
      }
    } catch (e: any) {
      if (!isMountedRef.current) return;
      setError(e?.message ?? t('find:could_not_load_feedback_retry', { defaultValue: 'Could not load your feedback. Please try again.' }));
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, t]);

  const pollFeedback = React.useCallback(async () => {
    if (!sessionId || !isMountedRef.current) return;
    pollAttemptsRef.current += 1;
    try {
      const result = await feedbackService.getSessionFeedback(sessionId);
      if (!isMountedRef.current) return;
      // Same as fetchFeedback above — apply whatever came back, guarded by
      // applyFeedbackResult so a background poll only ever adds/refreshes
      // data, it never blanks out (or flickers) something already showing.
      applyFeedbackResult(result);
      if (isFeedbackPending(result.status) && pollAttemptsRef.current < MAX_POLL_ATTEMPTS) {
        pollTimeoutRef.current = setTimeout(pollFeedback, POLL_INTERVAL_MS);
        return;
      }
      // See hasAutoRegeneratedRef's comment above onFetchFeedback — still
      // pending after giving up almost always means the background
      // generation thread got orphaned, not that scoring is genuinely slow.
      // One synchronous regenerate call self-heals that silently instead of
      // leaving the screen stuck on a permanent, wrong 0%.
      if (isFeedbackPending(result.status) && !hasAutoRegeneratedRef.current) {
        hasAutoRegeneratedRef.current = true;
        try {
          const regenerated = await feedbackService.regenerateFeedback(sessionId);
          if (isMountedRef.current) applyFeedbackResult(regenerated);
        } catch {
          // Falls through to the manual "Regenerate Feedback" button below.
        }
      }
      setIsScoringPending(false);
    } catch {
      // A transient failure mid-poll shouldn't kill the whole screen — just
      // stop polling silently; the user still has the manual "Regenerate
      // Feedback" button as a fallback.
      if (isMountedRef.current) setIsScoringPending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  React.useEffect(() => {
    fetchFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const onRegenerate = async () => {
    if (!sessionId || isRegenerating) return;
    setIsRegenerating(true);
    try {
      const result = await feedbackService.regenerateFeedback(sessionId);
      setOverallScore(result.overallScore);
      setSkillScores(result.skillScores);
      setStarBreakdown(result.starBreakdown);
    } catch (e: any) {
      Alert.alert(
        t('find:regenerate_failed_title', { defaultValue: 'Regenerate failed' }),
        e?.message ?? t('find:regenerate_failed_body', { defaultValue: 'Something went wrong regenerating your feedback. Please try again.' }),
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  const onPracticeAgain = () => navigate('MockInterviewSetup', {});
  const onDone = () => navigate('MainBottomTab');
  // REVERTED (product report: "I think you need to remove it and let the
  // back button [be] the normal back button function... anytime I finish
  // an interview and then tries to go back from the feedback screen it
  // goes back to the interview screen and then the end interview just
  // keep saying ending interview and it refuses to let me close") — this
  // used to force-navigate to MockInterviewSetup instead of a plain
  // goBack(), per an earlier report. That masked rather than fixed the
  // real problem: the just-finished interview screen underneath (Live
  // InterviewSession/CodingInterview/SystemDesignWhiteboard) was itself
  // getting stuck on its own "Ending interview..." exit flow — see that
  // screen's own bug-fix comment for the actual fix. With that screen now
  // able to close properly, going back to it is no longer a dead end, so
  // NavigationAction's own default behavior (goBack when no onPress is
  // given — see components/NavigationAction.tsx) is correct again.

  // `status` isn't a confirmed field (see fetchFeedback's comment) — if a
  // response happens to match one of the PENDING_STATUSES strings for some
  // unrelated reason while real, non-zero scores are already present, don't
  // let the "still scoring" banner cover up data that's actually there.
  const hasAnyRealScore = overallScore > 0 || skillScores.some(s => s.score > 0);

  // No sessionId at all (screen opened without a real interview behind it) —
  // there's nothing to fetch from GET /feedback/session/:id, so show a plain
  // empty state instead of fabricating scores the way the old mock did.
  if (!sessionId) {
    return (
      <Container style={styles.container}>
        <TopNavigation
          title={t('find:interview_feedback')}
          accessoryLeft={<NavigationAction />}
        />
        <Content padder contentContainerStyle={styles.content}>
          <Flex center vertical mt={60}>
            <Text category="h7" bold center>
              {t('find:no_interview_session', { defaultValue: 'No interview session to show feedback for.' })}
            </Text>
          </Flex>
          <CtaButton children={t('find:practice_again')} onPress={onPracticeAgain} style={[globalStyle.shadowBtn, { marginTop: 32 }]} />
        </Content>
      </Container>
    );
  }

  // Fetch failed and nothing has ever loaded — real loading/error/retry
  // state, since a real network call (unlike the old mock) can genuinely
  // fail.
  if (error && skillScores.length === 0 && !isLoading) {
    return (
      <Container style={styles.container}>
        <TopNavigation
          title={t('find:interview_feedback')}
          accessoryLeft={<NavigationAction />}
        />
        <Content padder contentContainerStyle={styles.content}>
          <Flex center vertical mt={60}>
            <Text category="h7" bold status="danger" center>
              {t('find:could_not_load_feedback', { defaultValue: 'Could not load your feedback' })}
            </Text>
            <Text category="h9-s" status="placeholder" center mt={8} maxWidth={280}>
              {error}
            </Text>
            <CtaButton
              children={t('common:retry', { defaultValue: 'Retry' })}
              onPress={fetchFeedback}
              style={{ marginTop: 24 }}
            />
          </Flex>
        </Content>
      </Container>
    );
  }

  // Product report: "the feedback interview for coding session should be
  // totally different from the normal interview feedback" — see
  // isNonQaType's own comment above. Entirely separate return, rather than
  // threading conditionals through the full Q&A layout below, so neither
  // layout risks accidentally leaking the other's sections.
  if (isNonQaType) {
    return (
      <Container style={styles.container}>
        <TopNavigation
          title={t('find:interview_feedback')}
          accessoryLeft={<NavigationAction />}
          accessoryRight={
            sessionId
              ? () => (
                  <Icon
                    pack="eva"
                    name="people-outline"
                    style={[globalStyle.icon24, {tintColor: theme['text-basic-color']}]}
                    onPress={() => setIsShareUserModalVisible(true)}
                  />
                )
              : undefined
          }
        />
        {sessionId ? (
          <ShareToUserModal
            visible={isShareUserModalVisible}
            onClose={() => setIsShareUserModalVisible(false)}
            contentType="feedback"
            contentId={sessionId}
          />
        ) : null}
        <Content padder contentContainerStyle={styles.content}>
          <Flex center itemsCenter justify="center" vertical mb={24}>
            <View style={[styles.doneBadge, { backgroundColor: theme['color-success-transparent-200'] }]}>
              <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon28, { tintColor: theme['color-success-500'] }]} />
            </View>
            <Text category="h6" bold mt={16} center>
              {t('find:coding_session_complete_title', { defaultValue: 'Session complete' })}
            </Text>
            {interviewType ? (
              <Text category="h9" status="placeholder" mt={4} center>
                {getInterviewTypeLabel(interviewType, t)}
              </Text>
            ) : null}
          </Flex>

          {codingResult && (codingResult.testsTotal ?? 0) > 0 ? (
            <Layout level="2" style={styles.codingSummaryCard}>
              <Text category="h8" bold mb={4}>
                {t('find:test_cases', { defaultValue: 'Test Cases' })}
              </Text>
              <Text category="h9-s" status={codingResult.testsPassed === codingResult.testsTotal ? 'success' : 'warning'}>
                {t('find:test_cases_passed', {
                  defaultValue: `${codingResult.testsPassed ?? 0} / ${codingResult.testsTotal} test cases passed`,
                  passed: codingResult.testsPassed ?? 0,
                  total: codingResult.testsTotal,
                })}
              </Text>
            </Layout>
          ) : null}

          {/* Coding-only — System Design's own AI review already lives on
              the whiteboard practice screen itself (product report: "The AI
              code review button should not be in the coding session. It
              should be in the feedback screen" was specifically about
              Coding; system design's equivalent stays where the user is
              actually mid-sketch — see SystemDesignWhiteboard.tsx). */}
          {codingResult ? (
            <>
              <Button
                children={isReviewingCode ? t('find:reviewing_code', { defaultValue: 'Reviewing…' }) : t('find:get_ai_code_review', { defaultValue: 'Get AI Code Review' })}
                disabled={isReviewingCode}
                status="info"
                onPress={onGetCodeReview}
                accessoryLeft={props => <Icon {...props} pack="assets" name="quote" />}
                style={{ marginTop: 16 }}
              />
              {codeReview ? (
                <Layout level="2" style={styles.codingSummaryCard}>
                  <Text category="h9" bold status="link" mb={8}>
                    {codeReview.complexityNote}
                  </Text>
                  {codeReview.feedback.map((line, i) => (
                    <Flex key={i} justify="flex-start" itemsCenter mt={i === 0 ? 0 : 8}>
                      <Icon pack="assets" name="quote" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                      <Text category="h9-s" ml={10} style={globalStyle.flexOne}>{line}</Text>
                    </Flex>
                  ))}
                </Layout>
              ) : null}
            </>
          ) : null}

          <CtaButton children={t('find:practice_again')} onPress={onPracticeAgain} style={[globalStyle.shadowBtn, { marginTop: 32 }]} />
          <Button children={t('common:done')} status="outline" onPress={onDone} style={{ marginTop: 16 }} />
        </Content>
      </Container>
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:interview_feedback')}
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          sessionId
            ? () => (
                <Icon
                  pack="eva"
                  name="people-outline"
                  style={[globalStyle.icon24, {tintColor: theme['text-basic-color']}]}
                  onPress={() => setIsShareUserModalVisible(true)}
                />
              )
            : undefined
        }
      />
      {sessionId ? (
        <ShareToUserModal
          visible={isShareUserModalVisible}
          onClose={() => setIsShareUserModalVisible(false)}
          contentType="feedback"
          contentId={sessionId}
        />
      ) : null}
      <Content padder contentContainerStyle={styles.content}>
        <Flex center itemsCenter justify="center" vertical mb={24}>
          <ProgressCard
            title={t('find:overall_score')}
            progress={overallScore}
            d={140}
            strokeWidth={10}
            stokeColor={theme['background-basic-color-3']}
            progressStokeColor={theme['color-primary-500']}
            {...PRIMARY_RING_GRADIENT}
          />
          {interviewType ? (
            <Text category="h8" status="placeholder" mt={12} center>
              {getInterviewTypeLabel(interviewType, t)}
            </Text>
          ) : null}
          {isLoading || (isScoringPending && !hasAnyRealScore) ? (
            <Text category="h9-s" status="placeholder" mt={8} center maxWidth={240}>
              {isScoringPending
                ? t('find:still_scoring', {
                    defaultValue: 'Your AI coach is still scoring this interview — this can take a moment.',
                  })
                : t('find:scoring_interview', { defaultValue: 'Scoring your interview…' })}
            </Text>
          ) : (
            <Button
              children={
                isRegenerating
                  ? t('find:regenerating', { defaultValue: 'Regenerating…' })
                  : t('find:regenerate_feedback', { defaultValue: 'Regenerate Feedback' })
              }
              disabled={isRegenerating}
              status="basic"
              size="small"
              onPress={onRegenerate}
              style={{ marginTop: 12 }}
            />
          )}
        </Flex>

        <Text category="h6" bold mt={16} mb={16}>
          {t('find:skill_breakdown')}
        </Text>
        <View style={styles.skillsGrid}>
          {skillScores.map((item, i) => (
            <ProgressCard
              key={i}
              title={item.label}
              progress={item.score}
              d={84}
              strokeWidth={6}
              stokeColor={theme['background-basic-color-3']}
              style={styles.skillCard}
              {...scoreRingColors(item.score, theme)}
            />
          ))}
        </View>

        <Text category="h6" bold mt={16} mb={16}>
          {t('find:star_breakdown')}
        </Text>
        {starBreakdown.map((item, i) => (
          <Layout key={i} level="2" style={styles.starRow}>
            <Flex justify="flex-start" itemsCenter mb={8}>
              <View style={[styles.starBadge, { backgroundColor: theme['color-primary-500'] }]}>
                <Text category="h7" status="control" bold>
                  {item.letter}
                </Text>
              </View>
              <Text category="h7" ml={12} bold>
                {item.label}
              </Text>
              <Text category="h7" ml={8} status="link" bold>
                {item.score}%
              </Text>
            </Flex>
            {/* Redesign v2 (full reskin, components/StarRating.tsx) — this
                section is literally titled "STAR Breakdown" (the interview
                method: Situation/Task/Action/Result), which previously had
                nothing to do with actual stars despite the name. Added as a
                quick-glance read alongside the existing S/T/A/R letter badge
                + exact percentage, not a replacement — the percentage stays
                for anyone who wants the precise number. */}
            <StarRating value={percentToStars(item.score)} size={14} style={{ marginBottom: 8 }} />
            <Text category="h9-s" status="placeholder">
              {item.note}
            </Text>
          </Layout>
        ))}

        {videoAnalysis ? (
          <>
            <Text category="h6" bold mt={16} mb={16}>
              {t('find:video_analysis', { defaultValue: 'Video Analysis' })}
            </Text>
            <View style={styles.skillsGrid}>
              <ProgressCard
                title={t('find:eye_contact', { defaultValue: 'Eye Contact' })}
                progress={videoAnalysis.eyeContactPct}
                d={84}
                strokeWidth={6}
                stokeColor={theme['background-basic-color-3']}
                style={styles.skillCard}
                {...scoreRingColors(videoAnalysis.eyeContactPct, theme)}
              />
              <ProgressCard
                title={t('find:smiling', { defaultValue: 'Smiling' })}
                progress={videoAnalysis.smilePct}
                d={84}
                strokeWidth={6}
                stokeColor={theme['background-basic-color-3']}
                progressStokeColor={theme['color-primary-500']}
                style={styles.skillCard}
                {...PRIMARY_RING_GRADIENT}
              />
              <ProgressCard
                title={t('find:confidence', { defaultValue: 'Confidence' })}
                progress={videoAnalysis.confidenceScore}
                d={84}
                strokeWidth={6}
                stokeColor={theme['background-basic-color-3']}
                style={styles.skillCard}
                {...scoreRingColors(videoAnalysis.confidenceScore, theme)}
              />
            </View>

            {/* Was a Speaking Pace / Filler Words / Awkward Pauses card
               here, driven by videoAnalysisService's on-device speech
               recognizer. That recognizer has been removed entirely (see
               services/videoAnalysisService.ts's header comment) because it
               was confirmed fighting VisionCamera's own recording for the
               microphone for the whole interview — the actual root cause of
               recorded interviews coming back with no audio track. Those
               three fields are always 0 now (see stopAnalysis's comment),
               which would have rendered here as "0 wpm / 0 Filler Words /
               0 Awkward Pauses" — indistinguishable from a genuinely
               flawless answer rather than "not measured", so the card is
               removed rather than shown with fake data. Eye Contact /
               Smiling / Confidence above are unaffected — pure ML Kit face
               detection, no microphone involved. */}

            {/* BUG FIX (product report: "it's only flagging the eye
               contact — it should flag any other things that it thinks
               could make the user lose focus") — four more real,
               ML-Kit-derived signals (see videoAnalysisService.ts's
               onFacesDetected for exactly how each is computed; no
               fabricated data). Unlike the rings above (where high is
               good), a high percentage here is the thing worth knowing
               about, so these render as plain constructive callouts
               instead — and only the ones that actually happened, past a
               small noise floor (a single blink or camera glitch
               shouldn't read as a real pattern worth mentioning). */}
            {focusSignalLines.length > 0 ? (
              <>
                <Text category="h6" bold mt={24} mb={12}>
                  {t('find:focus_signals_title', { defaultValue: 'Other Things We Noticed' })}
                </Text>
                <View style={styles.focusSignalsCard}>
                  {focusSignalLines.map((line, i) => (
                    <Text category="h9" key={i} mb={i < focusSignalLines.length - 1 ? 8 : 0}>
                      {line}
                    </Text>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}

        {sessionId ? (
          // Deliberately NOT gated on `videoAnalysis` (only present when
          // arriving fresh from LiveInterviewSession right after ending a
          // session) — reopening a past Video-mode session from Practice
          // History/My Progress lands here with just {sessionId,
          // interviewType}, and that path needs this button too (this was
          // the actual "I finished a video interview and couldn't find the
          // replay" gap: there was previously no link to InterviewReplay
          // anywhere on this screen at all, in either navigation path).
          // Works for every completed session, not just Video mode —
          // InterviewReplay itself already renders a real player when a
          // video exists and falls back to the transcript+metrics timeline
          // when it doesn't, so this is never a dead end either way.
          <Button
            children={t('find:view_replay', { defaultValue: 'View Replay' })}
            status="basic"
            accessoryLeft={props => <Icon {...props} pack="eva" name="play-circle-outline" />}
            onPress={() => navigate('InterviewReplay', { sessionId: String(sessionId) })}
            style={{ marginTop: 32 }}
          />
        ) : null}
        <CtaButton children={t('find:practice_again')} onPress={onPracticeAgain} style={[globalStyle.shadowBtn, { marginTop: sessionId ? 16 : 32 }]} />
        <Button children={t('common:done')} status="outline" onPress={onDone} style={{ marginTop: 16 }} />
      </Content>
    </Container>
  );
});

export default InterviewFeedback;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  skillCard: {
    width: '31%',
    marginBottom: 24,
  },
  focusSignalsCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 8,
    backgroundColor: 'background-basic-color-2',
  },
  starRow: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 16,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
  },
  starBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillerChip: {
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  // Coding/System Design's simplified feedback layout — see isNonQaType's
  // own comment above.
  doneBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codingSummaryCard: {
    ...globalStyle.card,
    marginTop: 16,
    padding: 16,
  },
});
