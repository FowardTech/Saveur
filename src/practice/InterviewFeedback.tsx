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
import { SkillScoreProps, StarBreakdownItemProps } from 'constants/Types';
import * as feedbackService from 'services/feedbackService';
import {isFeedbackPending} from 'services/feedbackService';
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
  const { navigate, goBack } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<InterviewFeedbackScreenNavigationProp>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);

  const { sessionId, interviewType, videoAnalysis } = route.params ?? {};

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
  const POLL_INTERVAL_MS = 3000;
  const MAX_POLL_ATTEMPTS = 20; // ~60s total before giving up and showing whatever came back

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  const fetchFeedback = React.useCallback(async () => {
    if (!sessionId) return;
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    pollAttemptsRef.current = 0;
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
      setOverallScore(result.overallScore);
      setSkillScores(result.skillScores);
      setStarBreakdown(result.starBreakdown);
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
      // Same as fetchFeedback above — apply whatever came back regardless
      // of status, so a background poll only ever adds/refreshes data, it
      // never blanks out something already showing.
      setOverallScore(result.overallScore);
      setSkillScores(result.skillScores);
      setStarBreakdown(result.starBreakdown);
      if (isFeedbackPending(result.status) && pollAttemptsRef.current < MAX_POLL_ATTEMPTS) {
        pollTimeoutRef.current = setTimeout(pollFeedback, POLL_INTERVAL_MS);
        return;
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
          accessoryLeft={<NavigationAction onPress={goBack} />}
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
          accessoryLeft={<NavigationAction onPress={goBack} />}
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

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:interview_feedback')}
        accessoryLeft={<NavigationAction onPress={goBack} />}
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
});
