import React, { memo } from 'react';
import { Alert, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
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
      setError(e?.message ?? 'Could not load your feedback. Please try again.');
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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
        'Regenerate failed',
        e?.message ?? 'Something went wrong regenerating your feedback. Please try again.',
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
              No interview session to show feedback for.
            </Text>
          </Flex>
          <Button children={t('find:practice_again')} onPress={onPracticeAgain} style={[globalStyle.shadowBtn, { marginTop: 32 }]} />
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
              Could not load your feedback
            </Text>
            <Text category="h9-s" status="placeholder" center mt={8} maxWidth={280}>
              {error}
            </Text>
            <Button
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
      />
      <Content padder contentContainerStyle={styles.content}>
        <Flex center itemsCenter justify="center" vertical mb={24}>
          <ProgressCard
            title={t('find:overall_score')}
            progress={overallScore}
            d={140}
            strokeWidth={10}
            stokeColor={theme['background-basic-color-3']}
            progressStokeColor={theme['color-primary-500']}
          />
          {interviewType ? (
            <Text category="h8" status="placeholder" mt={12} center>
              {interviewType}
            </Text>
          ) : null}
          {isLoading || (isScoringPending && !hasAnyRealScore) ? (
            <Text category="h9-s" status="placeholder" mt={8} center maxWidth={240}>
              {isScoringPending
                ? "Your AI coach is still scoring this interview — this can take a moment."
                : 'Scoring your interview…'}
            </Text>
          ) : (
            <Button
              children={isRegenerating ? 'Regenerating…' : 'Regenerate Feedback'}
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
              progressStokeColor={
                item.score >= 80
                  ? theme['color-success-500']
                  : item.score >= 60
                  ? theme['color-warning-500']
                  : theme['color-danger-500']
              }
              style={styles.skillCard}
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
            <Text category="h9-s" status="placeholder">
              {item.note}
            </Text>
          </Layout>
        ))}

        {videoAnalysis ? (
          <>
            <Text category="h6" bold mt={16} mb={16}>
              Video Analysis
            </Text>
            <View style={styles.skillsGrid}>
              <ProgressCard
                title="Eye Contact"
                progress={videoAnalysis.eyeContactPct}
                d={84}
                strokeWidth={6}
                stokeColor={theme['background-basic-color-3']}
                progressStokeColor={
                  videoAnalysis.eyeContactPct >= 80
                    ? theme['color-success-500']
                    : videoAnalysis.eyeContactPct >= 60
                    ? theme['color-warning-500']
                    : theme['color-danger-500']
                }
                style={styles.skillCard}
              />
              <ProgressCard
                title="Smiling"
                progress={videoAnalysis.smilePct}
                d={84}
                strokeWidth={6}
                stokeColor={theme['background-basic-color-3']}
                progressStokeColor={theme['color-primary-500']}
                style={styles.skillCard}
              />
              <ProgressCard
                title="Confidence"
                progress={videoAnalysis.confidenceScore}
                d={84}
                strokeWidth={6}
                stokeColor={theme['background-basic-color-3']}
                progressStokeColor={
                  videoAnalysis.confidenceScore >= 80
                    ? theme['color-success-500']
                    : videoAnalysis.confidenceScore >= 60
                    ? theme['color-warning-500']
                    : theme['color-danger-500']
                }
                style={styles.skillCard}
              />
            </View>

            <Layout level="2" style={styles.starRow}>
              <Flex justify="space-between" itemsCenter mb={12}>
                <Text category="h7" bold>
                  Speaking Pace
                </Text>
                <Text category="h7" status="link" bold>
                  {videoAnalysis.speakingRateWpm} wpm
                </Text>
              </Flex>
              <Flex justify="space-between" itemsCenter mb={videoAnalysis.fillerWordCount > 0 ? 8 : 12}>
                <Text category="h7" bold>
                  Filler Words
                </Text>
                <Text category="h7" status="link" bold>
                  {videoAnalysis.fillerWordCount}
                </Text>
              </Flex>
              {Object.keys(videoAnalysis.fillerWordBreakdown).length > 0 ? (
                <Flex wrap justify="flex-start" mb={12}>
                  {Object.entries(videoAnalysis.fillerWordBreakdown).map(([word, count]) => (
                    <View key={word} style={[styles.fillerChip, { backgroundColor: theme['background-basic-color-3'] }]}>
                      <Text category="h10" status="placeholder">
                        “{word}” × {count}
                      </Text>
                    </View>
                  ))}
                </Flex>
              ) : null}
              <Flex justify="space-between" itemsCenter>
                <Text category="h7" bold>
                  Awkward Pauses
                </Text>
                <Text category="h7" status="link" bold>
                  {videoAnalysis.silenceGapCount}
                </Text>
              </Flex>
            </Layout>
          </>
        ) : null}

        <Button children={t('find:practice_again')} onPress={onPracticeAgain} style={[globalStyle.shadowBtn, { marginTop: 32 }]} />
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
