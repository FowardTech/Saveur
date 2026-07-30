import React, { memo } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import {
  TopNavigation,
  TopNavigationAction,
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
import * as interviewService from 'services/interviewService';

// Video Interview Replay — product request item ("the real catch of the
// app... users can replay and see the part where they need to improve
// themselves"). Now a REAL, seekable recorded video (react-native-video)
// when one exists — see services/interviewReplayService.ts's SessionReplay.
// videoUrl for how that gets here, and services/videoAnalysisService.ts's
// startVideoRecording/stopVideoRecording for how it's actually captured
// on-device during the live session. Still assembles the same transcript +
// camera/voice metrics timeline with flagged moments as before — those
// flagged moments are now real seek targets INTO the video (see
// jumpToAnnotation below), not just a transcript-scroll fallback. Falls
// back to the transcript-only view (no player) for Voice/Text-mode
// sessions, or a Video-mode session whose upload hasn't landed yet.
const InterviewReplay = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['practice', 'common']);
  const route = useRoute<RouteProp<RootStackParamList, 'InterviewReplay'>>();
  const sessionId = route.params?.sessionId;

  const [replay, setReplay] = React.useState<SessionReplay | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [videoError, setVideoError] = React.useState(false);
  // `paused` has to be real React state kept in sync with the native
  // player via onPlaybackStateChanged below. It was previously a hardcoded
  // `paused` prop (always true) on <Video>, which is why tapping the
  // native play button did nothing: react-native-video is a controlled
  // component, so any re-render of this screen (e.g. scrolling the
  // transcript, tapping a flagged moment) re-sent paused=true to the
  // native player and immediately paused it back. Video now starts
  // paused (poster/first-frame shown) and only plays once the user
  // presses play, with JS state tracking what the native controls did.
  const [paused, setPaused] = React.useState(true);
  const [isDeletingVideo, setIsDeletingVideo] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);
  const rowOffsets = React.useRef<Record<number, number>>({});
  const videoRef = React.useRef<VideoRef>(null);

  React.useEffect(() => {
    if (!sessionId) { setIsLoading(false); return; }
    interviewReplayService.getSessionReplay(sessionId)
      .then(setReplay)
      .catch(() => setError(t('practice:replay_load_failed', { defaultValue: "Couldn't load this session's replay." })))
      .finally(() => setIsLoading(false));
  }, [sessionId, t]);

  const hasVideo = !!replay?.videoUrl && !videoError;

  // Maps the technical reason (see interviewReplayService.ts's
  // SessionReplay.videoError comment) to one short, human sentence --
  // never shown verbatim, same reasoning as the interview-start
  // llm_unavailable fix (services/apiClient.ts): a raw error code/message
  // is meaningless to a user and just looks broken.
  const noVideoReason = (() => {
    const reason = replay?.videoError;
    if (!reason) return null;
    if (reason.startsWith('insufficient_storage')) {
      return t('practice:replay_no_video_storage', {
        defaultValue: "Your device didn't have enough free storage to save this recording.",
      });
    }
    if (reason.includes('camera-not-ready') || reason.includes('camera_not_ready')) {
      return t('practice:replay_no_video_camera', {
        defaultValue: "The camera wasn't ready in time to record this session.",
      });
    }
    if (reason.startsWith('upload_failed')) {
      return t('practice:replay_no_video_upload', {
        defaultValue: 'The recording could not finish saving to the server.',
      });
    }
    return t('practice:replay_no_video_generic', {
      defaultValue: "This session's video couldn't be saved.",
    });
  })();

  const jumpToAnnotation = (tMs: number) => {
    if (!replay) return;
    // Real seek into the actual recorded video, when there is one — this is
    // the feature: tapping a flagged moment jumps straight to that part of
    // the recording instead of just scrolling text.
    if (hasVideo) {
      videoRef.current?.seek(tMs / 1000);
      // Jumping to a flagged moment should also start playback from
      // there — otherwise the seek visibly moves the scrubber but the
      // frame just sits there paused, which looks just as "broken" as
      // play not working at all.
      setPaused(false);
    }
    // Also scroll the transcript to the matching row either way — useful on
    // its own for Voice/Text-mode sessions (no video at all), and a nice
    // companion to the video seek otherwise (reading along with the
    // moment you just jumped to).
    let closestIndex = 0;
    let closestDiff = Infinity;
    replay.transcript.forEach((entry, i) => {
      const diff = Math.abs(entry.tMs - tMs);
      if (diff < closestDiff) { closestDiff = diff; closestIndex = i; }
    });
    const y = rowOffsets.current[closestIndex];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(y - 40, 0), animated: true });
  };

  // Product request: "There should be a delete button in the video
  // interview so that users can delete it anytime they want" -- privacy/
  // control over their own recording, on demand, not just something an
  // admin can do. Confirms first (destructive, irreversible), then clears
  // local state immediately on success so the screen falls back to the
  // transcript-only view without waiting on a refetch.
  const onDeleteVideo = () => {
    if (!sessionId || !replay?.videoUrl || isDeletingVideo) return;
    Alert.alert(
      t('practice:delete_video_title', { defaultValue: 'Delete this video?' }),
      t('practice:delete_video_message', {
        defaultValue: "This removes the recorded video permanently. Your transcript and scores stay untouched.",
      }),
      [
        { text: t('common:cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common:delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: async () => {
            setIsDeletingVideo(true);
            try {
              await interviewService.deleteSessionVideo(String(sessionId));
              setReplay(prev => (prev ? { ...prev, videoUrl: null, videoError: null } : prev));
            } catch (err) {
              Alert.alert(
                t('practice:delete_video_failed', { defaultValue: 'Could not delete video' }),
                t('common:something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' }),
              );
            } finally {
              setIsDeletingVideo(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('practice:interview_replay', { defaultValue: 'Interview Replay' })}
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          hasVideo
            ? () => (
                <TopNavigationAction
                  icon={props => <Icon {...props} pack="eva" name="trash-2-outline" />}
                  onPress={onDeleteVideo}
                  disabled={isDeletingVideo}
                />
              )
            : undefined
        }
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
          {hasVideo ? (
            <View style={styles.videoWrap}>
              <Video
                ref={videoRef}
                source={{ uri: replay.videoUrl! }}
                style={globalStyle.flexOne}
                resizeMode="cover"
                controls
                paused={paused}
                playInBackground={false}
                // Fixes "video plays but no audio" on iOS. Two separate,
                // stackable causes, both silent by default:
                // (1) ignoreSilentSwitch defaults to 'inherit', which on
                // iOS means playback still respects the hardware mute
                // switch -- perfectly plausible for a tester to have
                // flipped that during/after recording an interview and
                // never noticed, since nothing else in the app makes sound
                // depend on it. 'ignore' makes this player's audio play
                // regardless, same as every other video-playback app.
                // (2) the interview was just recorded moments earlier with
                // the device's audio session in a recording-capable mode
                // (needed to capture mic input alongside video) -- iOS can
                // leave the shared audio route favoring the earpiece
                // rather than the speaker afterward, which sounds
                // identical to "no audio" unless you hold the phone right
                // up to your ear. audioOutput="speaker" forces this
                // player's output through the speaker explicitly rather
                // than inheriting whatever route the prior recording
                // session left active.
                ignoreSilentSwitch="ignore"
                audioOutput="speaker"
                onPlaybackStateChanged={(e) => setPaused(!e.isPlaying)}
                onError={() => setVideoError(true)}
              />
            </View>
          ) : (
            <Text category="h9-s" status="placeholder" mb={16}>
              {noVideoReason ?? t('practice:replay_scope_note', {
                defaultValue: 'A timeline of your transcript and in-session metrics — no video was recorded for this session.',
              })}
            </Text>
          )}

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
                  style={[styles.transcriptRow, globalStyle.divider]}
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
  videoWrap: {
    width: '100%',
    // Matches LiveInterviewSession.tsx's own cameraWrap aspect ratio — the
    // video was recorded through that exact same front-camera view, so
    // played back at the same aspect ratio it was shot in.
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 20,
  },
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
  // borderBottom comes from the shared globalStyle.divider at the usage
  // site instead of a duplicated inline rgba value.
  transcriptRow: {
    paddingVertical: 10,
  },
});
