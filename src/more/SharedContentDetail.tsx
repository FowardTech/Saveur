import React, {memo} from 'react';
import {ActivityIndicator, Linking} from 'react-native';
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
                <Flex justify="space-between" itemsCenter mt={12}>
                  <Text category="h2" bold status="primary">
                    {content.overall_score ?? 0}%
                  </Text>
                  <Text category="h9" status="placeholder">
                    {t('find:overall_score', {defaultValue: 'Overall Score'})}
                  </Text>
                </Flex>
              </Layout>

              {hasVideo ? (
                <Layout level="2" style={[styles.card, {padding: 0, overflow: 'hidden'}]}>
                  <Video
                    source={{uri: content.video_url}}
                    style={styles.video}
                    controls
                    resizeMode="cover"
                    paused
                  />
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

              <Layout level="2" style={styles.card}>
                <Text category="h8" bold mb={12}>
                  {t('find:skill_breakdown', {defaultValue: 'Skill Breakdown'})}
                </Text>
                {SCORE_KEYS.map(key => (
                  <Flex key={key} justify="space-between" itemsCenter style={styles.scoreRow}>
                    <Text category="h9-s" style={{textTransform: 'capitalize'}}>
                      {key.replace('_', ' ')}
                    </Text>
                    <Text category="h9" bold>
                      {content.scores?.[key] ?? 0}%
                    </Text>
                  </Flex>
                ))}
              </Layout>

              {content.summary ? (
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
    // No fill — border-only (app-wide "cards are transparent" pass).
    // Explicit 'transparent' since every usage is <Layout level="2" .../>,
    // whose own level mapping would otherwise still fill it.
    backgroundColor: 'transparent',
  },
  messageCard: {
    ...globalStyle.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    backgroundColor: 'transparent',
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
