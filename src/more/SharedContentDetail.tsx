import React, {memo} from 'react';
import {ActivityIndicator, Linking, View} from 'react-native';
import Video from 'react-native-video';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import {RouteProp, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import CompanyLogoAvatar from 'components/CompanyLogoAvatar';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import * as sharesService from 'services/sharesService';
import {SharedContentDetailProps} from 'services/sharesService';
import {getInterviewTypeLabel} from 'utils/interviewTypeLabels';
import {formatMs} from 'services/interviewReplayService';
import CtaButton from 'components/CtaButton';
import StarRating, {percentToStars} from 'components/StarRating';

const SCORE_KEYS = [
  'confidence', 'communication', 'technical', 'leadership',
  'problem_solving', 'creativity', 'critical_thinking',
];

// Viewer for one piece of content another Saveur user shared (product
// request item — see services/sharesService.ts's module docstring).
// Reached from src/more/SharedWithMe.tsx's inbox list, or directly from a
// "content_shared" push tap (see navigation/navigationRef.ts). Renders a
// read-only view of whatever `content_type` the share is — the exact same
// underlying data the sender's own InterviewFeedback/InterviewReplay/
// JobAlertDetails screens show, just without any of the owner-only actions
// (regenerate, delete, apply-tracking) those screens have.
const SharedContentDetail = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'find', 'common']);
  const route = useRoute<RouteProp<RootStackParamList, 'SharedContentDetail'>>();
  const shareId = route.params?.shareId;

  const [share, setShare] = React.useState<SharedContentDetailProps | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!shareId) {
      setIsLoading(false);
      return;
    }
    sharesService
      .getShareDetail(shareId)
      .then(setShare)
      .catch((e: any) =>
        setError(e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'})),
      )
      .finally(() => setIsLoading(false));
  }, [shareId, t]);

  const content = share?.content ?? {};
  const hasVideo = share?.contentType === 'video' && !!content.video_url;
  // BUG FIX ("Overall Score doesn't display in the Shared with You screen"):
  // feedback.py's _feedback_payload can legitimately still be mid-generation
  // when this is opened (interview feedback generation is slow — see
  // feedback_job.py) — it reports `status: "pending"` and `overall_score: 0`
  // in that case, same wire shape InterviewFeedback.tsx already knows to
  // treat as "not ready yet" and keep polling for. This read-only recipient
  // view had no equivalent check at all, so a share opened while generation
  // was still running just silently rendered 0%/empty stars forever with no
  // indication anything was wrong — it looked like a permanently broken
  // score rather than a still-in-progress one. Treat a missing `status`
  // field (older shares, predating this field) as ready so nothing existing
  // regresses.
  const isFeedbackPending =
    (share?.contentType === 'feedback' || share?.contentType === 'video') && content.status === 'pending';

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:shared_content', {defaultValue: 'Shared with You'})}
        accessoryLeft={<NavigationAction />}
      />
      {isLoading ? (
        <Flex center style={globalStyle.flexOne}>
          <Spinner size="large" />
        </Flex>
      ) : error || !share ? (
        <EmptyState
          variant="error"
          body={error ?? t('more:shared_content_unavailable', {defaultValue: 'This shared item is no longer available.'})}
        />
      ) : (
        <Content padder contentContainerStyle={styles.content}>
          <Flex justify="space-between" itemsCenter mb={16}>
            <Text category="h9" status="placeholder">
              {t('more:shared_by', {defaultValue: '@{{username}} shared with you', username: share.senderUsername})}
            </Text>
          </Flex>
          {share.message ? (
            <Layout level="2" style={styles.messageCard}>
              <Text category="h9-s" style={{fontStyle: 'italic'}}>
                "{share.message}"
              </Text>
            </Layout>
          ) : null}

          {share.contentType === 'job' ? (
            <Layout level="2" style={styles.card}>
              <Flex justify="flex-start" mb={12}>
                <CompanyLogoAvatar logoUrl={content.company_logo_url} companyName={content.company} />
                <Flex vertical style={{marginLeft: 12, flex: 1}}>
                  <Text category="h7" bold>{content.title}</Text>
                  <Text category="h9-s" status="placeholder" mt={2}>
                    {[content.company, content.location].filter(Boolean).join(' · ')}
                  </Text>
                </Flex>
              </Flex>
              {content.apply_url ? (
                <CtaButton onPress={() => Linking.openURL(content.apply_url)}>
                  {t('more:open_posting', {defaultValue: 'Open posting'})}
                </CtaButton>
              ) : null}
            </Layout>
          ) : (
            <>
              <Layout level="2" style={styles.card}>
                <Text category="h9-s" status="placeholder">
                  {[content.role, content.company].filter(Boolean).join(' · ') ||
                    getInterviewTypeLabel(content.interview_type, t)}
                </Text>
                {isFeedbackPending ? (
                  <Flex itemsCenter mt={12}>
                    <Spinner size="small" style={{marginRight: 8}} />
                    <Text category="h9-s" status="placeholder" style={{flex: 1}}>
                      {t('more:shared_feedback_pending', {
                        defaultValue: 'This feedback is still being generated — check back in a moment.',
                      })}
                    </Text>
                  </Flex>
                ) : (
                  <>
                    <Flex justify="space-between" itemsCenter mt={12}>
                      <Text category="h2" bold status="primary">
                        {content.overall_score ?? 0}%
                      </Text>
                      <Text category="h9" status="placeholder">
                        {t('find:overall_score', {defaultValue: 'Overall Score'})}
                      </Text>
                    </Flex>
                    {/* Redesign v2 (full reskin, components/StarRating.tsx) —
                        quick-glance read on this read-only viewer, same content
                        the owner sees on InterviewFeedback.tsx as a progress
                        ring instead. Additive next to the exact percentage
                        above, not a replacement. */}
                    <StarRating value={percentToStars(content.overall_score ?? 0)} size={16} style={{marginTop: 10}} />
                  </>
                )}
              </Layout>

              {hasVideo ? (
                // Two-layer split (see styles.videoCardInner's comment) —
                // a single view can't both cast `card`'s shadow and clip
                // the Video to the rounded corners via overflow:'hidden'.
                <Layout level="2" style={[styles.card, {padding: 0}]}>
                  <View style={styles.videoCardInner}>
                    <Video
                      source={{uri: content.video_url}}
                      style={styles.video}
                      controls
                      resizeMode="cover"
                      paused
                    />
                  </View>
                </Layout>
              ) : null}

              {hasVideo && content.annotations?.length ? (
                <Layout level="2" style={styles.card}>
                  <Text category="h8" bold mb={12}>
                    {t('more:flagged_moments', {defaultValue: 'Flagged Moments'})}
                  </Text>
                  {content.annotations.map((a: any, i: number) => (
                    <Flex key={i} justify="space-between" itemsCenter style={styles.annotationRow}>
                      <Text category="h9-s" style={{flex: 1}}>{a.label}</Text>
                      <Text category="h10" status="primary" bold>
                        {formatMs ? formatMs(a.t_ms) : `${Math.round(a.t_ms / 1000)}s`}
                      </Text>
                    </Flex>
                  ))}
                </Layout>
              ) : null}

              {isFeedbackPending ? null : (
              <Layout level="2" style={styles.card}>
                <Text category="h8" bold mb={12}>
                  {t('find:skill_breakdown', {defaultValue: 'Skill Breakdown'})}
                </Text>
                {SCORE_KEYS.map(key => (
                  <Flex key={key} justify="space-between" itemsCenter style={styles.scoreRow}>
                    <Text category="h9-s" style={{textTransform: 'capitalize'}}>
                      {key.replace('_', ' ')}
                    </Text>
                    <Flex itemsCenter>
                      {/* Redesign v2 (full reskin, components/StarRating.tsx)
                          — per-category quality score in a detailed
                          breakdown table; added as a quick-glance summary
                          next to the exact percentage rather than replacing
                          it, same treatment as InterviewFeedback.tsx's own
                          STAR Breakdown. */}
                      <StarRating value={percentToStars(content.scores?.[key] ?? 0)} size={12} style={{marginRight: 8}} />
                      <Text category="h9" bold>
                        {content.scores?.[key] ?? 0}%
                      </Text>
                    </Flex>
                  </Flex>
                ))}
              </Layout>
              )}

              {!isFeedbackPending && content.summary ? (
                <Layout level="2" style={styles.card}>
                  <Text category="h8" bold mb={8}>
                    {t('more:summary', {defaultValue: 'Summary'})}
                  </Text>
                  <Text category="h9-s">{content.summary}</Text>
                </Layout>
              ) : null}
            </>
          )}
        </Content>
      )}
    </Container>
  );
});

export default SharedContentDetail;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 48,
  },
  card: {
    ...globalStyle.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
  },
  messageCard: {
    ...globalStyle.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    // Same as `card` above — renders via <Layout level="2" .../>.
  },
  // Two layers, not one: overflow:'hidden' (needed to clip the Video to
  // the card's rounded corners) would also clip `card`'s own shadow if
  // applied to the same view — see HomeSrc.tsx's homeBannerCard/
  // homeBannerCardInner for the same split. Outer is `styles.card` +
  // padding:0 (see JSX); this inner carries the actual clip + Video.
  videoCardInner: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: 220,
  },
  annotationRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'border-basic-color-3',
  },
  scoreRow: {
    paddingVertical: 6,
  },
});
