import React, { memo } from 'react';
import { ScrollView, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as interviewReplayService from 'services/interviewReplayService';
import { SessionReplay } from 'services/interviewReplayService';
import { formatMs } from 'services/interviewReplayService';

// Video Interview Replay — product request item. Real transcript + camera/
// voice metrics timeline with flagged moments (confidence dips, strong
// moments) — see services/interviewReplayService.ts for why this isn't
// literal video playback.
const InterviewReplay = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['practice', 'common']);
  const route = useRoute<RouteProp<RootStackParamList, 'InterviewReplay'>>();
  const sessionId = route.params?.sessionId;

  const [replay, setReplay] = React.useState<SessionReplay | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<ScrollView>(null);
  const rowOffsets = React.useRef<Record<number, number>>({});

  React.useEffect(() => {
    if (!sessionId) { setIsLoading(false); return; }
    interviewReplayService.getSessionReplay(sessionId)
      .then(setReplay)
      .catch(() => setError(t('practice:replay_load_failed', { defaultValue: "Couldn't load this session's replay." })))
      .finally(() => setIsLoading(false));
  }, [sessionId, t]);

  const jumpToAnnotation = (tMs: number) => {
    if (!replay) return;
    // Find the closest transcript entry at or before this timestamp and
    // scroll to it — the closest thing to "seeking" available without an
    // actual video to scrub (see module header).
    let closestIndex = 0;
    let closestDiff = Infinity;
    replay.transcript.forEach((entry, i) => {
      const diff = Math.abs(entry.tMs - tMs);
      if (diff < closestDiff) { closestDiff = diff; closestIndex = i; }
    });
    const y = rowOffsets.current[closestIndex];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(y - 40, 0), animated: true });
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('practice:interview_replay', { defaultValue: 'Interview Replay' })}
        accessoryLeft={<NavigationAction />}
      />
      {isLoading ? (
        <Flex center style={globalStyle.flexOne}><Spinner size="large" /></Flex>
      ) : error || !replay ? (
        <Flex vertical center style={globalStyle.flexOne}>
          <Text category="h9-s" status="danger" center>
            {error || t('practice:replay_unavailable', { defaultValue: 'Replay data is unavailable for this session.' })}
          </Text>
        </Flex>
      ) : (
        <Content padder contentContainerStyle={styles.content}>
          <Text category="h9-s" status="placeholder" mb={16}>
            {t('practice:replay_scope_note', {
              defaultValue: 'A timeline of your transcript and in-session metrics — not a video recording.',
            })}
          </Text>

          {replay.voiceMetrics ? (
            <View style={styles.statsRow}>
              <Layout level="2" style={styles.statCard}>
                <Text category="h5" bold center>{replay.voiceMetrics.wordsPerMinute ?? '—'}</Text>
                <Text category="h10" status="placeholder" center mt={4}>{t('practice:wpm', { defaultValue: 'WPM' })}</Text>
              </Layout>
              <Layout level="2" style={styles.statCard}>
                <Text category="h5" bold center>{replay.voiceMetrics.fillerCount ?? '—'}</Text>
                <Text category="h10" status="placeholder" center mt={4}>{t('practice:filler_words', { defaultValue: 'Filler words' })}</Text>
              </Layout>
              <Layout level="2" style={styles.statCard}>
                <Text category="h5" bold center>{replay.voiceMetrics.longPauses ?? '—'}</Text>
                <Text category="h10" status="placeholder" center mt={4}>{t('practice:long_pauses', { defaultValue: 'Long pauses' })}</Text>
              </Layout>
            </View>
          ) : null}

          {replay.annotations.length ? (
            <View style={{ marginTop: 20 }}>
              <Text category="h7" bold mb={12}>{t('practice:flagged_moments', { defaultValue: 'Flagged Moments' })}</Text>
              {replay.annotations.map((a, i) => (
                <Flex
                  key={i}
                  justify="flex-start"
                  itemsCenter
                  style={styles.annotationRow}
                  onPress={() => jumpToAnnotation(a.tMs)}
                >
                  <Icon
                    pack="eva"
                    name={a.type === 'strong_moment' ? 'checkmark-circle-2-outline' : 'alert-circle-outline'}
                    style={[globalStyle.icon20, { tintColor: a.type === 'strong_moment' ? theme['color-success-500'] : theme['color-warning-500'] }]}
                  />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text category="h9-s">{a.label}</Text>
                    <Text category="h10" status="placeholder">{formatMs(a.tMs)}</Text>
                  </View>
                </Flex>
              ))}
            </View>
          ) : null}

          <View style={{ marginTop: 24 }}>
            <Text category="h7" bold mb={12}>{t('practice:transcript', { defaultValue: 'Transcript' })}</Text>
            <ScrollView ref={scrollRef} style={{ maxHeight: 400 }} nestedScrollEnabled>
              {replay.transcript.map((entry, i) => (
                <View
                  key={i}
                  onLayout={e => { rowOffsets.current[i] = e.nativeEvent.layout.y; }}
                  style={styles.transcriptRow}
                >
                  <Text category="h10" status="placeholder" mb={2}>
                    {formatMs(entry.tMs)} · {entry.role === 'interviewer'
                      ? t('practice:interviewer', { defaultValue: 'Interviewer' })
                      : t('practice:you', { defaultValue: 'You' })}
                  </Text>
                  <Text category="h9-s">{entry.text}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </Content>
      )}
    </Container>
  );
});

export default InterviewReplay;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    marginHorizontal: 4,
  },
  annotationRow: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  transcriptRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
});
