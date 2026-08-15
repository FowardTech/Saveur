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
import CodeBlock from 'components/CodeBlock';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as interviewReplayService from 'services/interviewReplayService';
import { SessionReplay } from 'services/interviewReplayService';
import { formatMs } from 'services/interviewReplayService';
import * as interviewService from 'services/interviewService';
import ShareToUserModal from 'components/ShareToUserModal';

// Video Interview Replay — product request item ("the real catch of the
// app... users can replay and see the part where they need to improve
// themselves").
//
// AUDIO TROUBLESHOOTING HISTORY (read before touching audio-related props
// again): three SEPARATE causes have been found and fixed for "recorded
// video plays with no audio", in order of discovery: (1) speechService.ts's
// ElevenLabs/nitro-sound TTS playback fighting VisionCamera's recording
// session mid-interview (preserveRecordingSession), (2)
// videoAnalysisService.ts running an on-device Voice/STT recognizer
// concurrently with the recording for the entire interview (removed
// entirely), (3) react-native-video itself managing/activating the shared
// iOS AVAudioSession, starving VisionCamera's session on the NEXT
// recording (disableAudioSessionManagement below). All three are iOS
// AVAudioSession-specific; if a future report is Android-only, the cause
// is NOT this class of bug (Android has no shared AVAudioSession-style
// conflict) and needs its own fresh diagnosis from real device logs.
//
// Now a REAL, seekable recorded video (react-native-video)
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
  const [isShareUserModalVisible, setIsShareUserModalVisible] = React.useState(false);
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
        accessoryRight={() => (
          <Flex justify="flex-start" itemsCenter>
            {hasVideo ? (
              // "Share to a Saveur user" (product request item: "share...
              // the recorded video interview alongside the flagged
              // moments") — additive to the delete-video action below, not
              // a replacement.
              <TopNavigationAction
                icon={props => <Icon {...props} pack="eva" name="people-outline" />}
                onPress={() => setIsShareUserModalVisible(true)}
              />
            ) : null}
            {hasVideo ? (
              <TopNavigationAction
                icon={props => <Icon {...props} pack="eva" name="trash-2-outline" />}
                onPress={onDeleteVideo}
                disabled={isDeletingVideo}
              />
            ) : null}
          </Flex>
        )}
      />
      {hasVideo && sessionId ? (
        <ShareToUserModal
          visible={isShareUserModalVisible}
          onClose={() => setIsShareUserModalVisible(false)}
          contentType="video"
          contentId={sessionId}
        />
      ) : null}
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
                // REVERTED -- disableAudioSessionManagement was tried here
                // to protect a FUTURE VisionCamera recording from react-
                // native-video's own AVAudioSession management, on the
                // theory that RNV's session claim during THIS replay could
                // linger and starve the next interview's recording. Reading
                // RNV's own iOS source (AudioSessionManager.swift) proved
                // that theory wrong in a much more damaging way: whenever
                // ANY mounted <Video> has this prop set,
                // configureAudioSession() returns immediately at its very
                // first line and NEVER runs again for that view --
                // meaning the AVAudioSession is never activated or put into
                // a playback-appropriate category AT ALL for this player.
                // The video's audio track was never the problem; nothing
                // was ever telling iOS to actually play it audibly. That's
                // the real cause of "the audio in iOS is always muted" --
                // a regression this same fix introduced. Android (which now
                // has real audio, see videoAnalysisService.ts's format fix)
                // never used this prop in the first place (it's iOS-only in
                // RNV's own types), so removing it here doesn't touch
                // Android at all. If a future recording ever does come back
                // silent again because of a genuine RNV-vs-VisionCamera
                // conflict, that needs solving a different way (e.g. a
                // native-level fix, not blanket-disabling this player's own
                // session management) -- not by re-adding this prop.
                onPlaybackStateChanged={(e) => setPaused(!e.isPlaying)}
                onError={() => setVideoError(true)}
              />
            </View>
          ) : replay.sessionType === 'coding' ? null : (
            // BUG FIX: this generic "no video was recorded" note doesn't
            // make sense on a coding session (no video is ever expected
            // there, not a limitation worth noting) — the Problem/Your
            // Code section below already says everything there is to say.
            <Text category="h9-s" status="placeholder" mb={16}>
              {noVideoReason ?? t('practice:replay_scope_note', {
                defaultValue: 'A timeline of your transcript and in-session metrics — no video was recorded for this session.',
              })}
            </Text>
          )}

          {replay.voiceMetrics ? (
            <View style={styles.statsRow}>
              <Layout level="2" style={styles.statCard}>
                <Text category="h3" bold center>{replay.voiceMetrics.wordsPerMinute ?? '—'}</Text>
                <Text category="h10" status="placeholder" center mt={4}>{t('practice:wpm', { defaultValue: 'WPM' })}</Text>
              </Layout>
              <Layout level="2" style={styles.statCard}>
                <Text category="h3" bold center>{replay.voiceMetrics.fillerCount ?? '—'}</Text>
                <Text category="h10" status="placeholder" center mt={4}>{t('practice:filler_words', { defaultValue: 'Filler words' })}</Text>
              </Layout>
              <Layout level="2" style={styles.statCard}>
                <Text category="h3" bold center>{replay.voiceMetrics.longPauses ?? '—'}</Text>
                <Text category="h10" status="placeholder" center mt={4}>{t('practice:long_pauses', { defaultValue: 'Long pauses' })}</Text>
              </Layout>
            </View>
          ) : null}

          {/* Was `replay.annotations.length ? (...) : null` -- a session
             with a real video but zero flagged moments (perfectly normal:
             confidence_dip needs 3 straight low-eye-contact frames,
             strong_moment needs 5 straight high-eye-contact+smiling frames
             -- see Saveur-Backend's feedback.py replay(), plenty of
             sessions legitimately cross neither threshold) rendered
             NOTHING here at all, not even the section header. That's
             indistinguishable from "this is broken" -- which is almost
             certainly what was behind "flagged moments aren't showing on
             Android": the annotation logic itself is 100% platform-
             agnostic (same backend endpoint, same client code, no
             Android/iOS branching anywhere in this feature), so the far
             more likely explanation was always an empty array read as a
             missing feature rather than a real per-platform bug. Now
             always shows the section (once a video exists at all) with an
             explicit empty-state line instead of silently disappearing. */}
          {hasVideo ? (
            <View style={{ marginTop: 20 }}>
              <Text category="h7" bold mb={12}>{t('practice:flagged_moments', { defaultValue: 'Flagged Moments' })}</Text>
              {replay.annotations.length ? (
                replay.annotations.map((a, i) => (
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
                ))
              ) : (
                <Text category="h9-s" status="placeholder">
                  {t('practice:no_flagged_moments', {
                    defaultValue: 'No flagged moments in this session — nothing stood out as a notable dip or a standout stretch.',
                  })}
                </Text>
              )}
            </View>
          ) : null}

          {/* BUG FIX (mobile bug report: "when users view the interview
              replay of coding interview instead of them seeing the
              practice problem they are seeing the transcript of the AI
              interview as if they did voice interview... the user's
              answer and code they wrote to solve the problem should also
              be in the replay") — a coding session never has a real Q&A
              transcript (see interviewReplayService.ts's ReplayCodingResult
              comment for the backend-side reasoning), so this renders the
              actual problem + submitted code instead of the generic
              Interviewer/You transcript rows below, which would otherwise
              either show a leftover unrelated AI question or nothing at
              all. */}
          {replay.sessionType === 'coding' ? (
            <View style={{ marginTop: 24 }}>
              {!replay.codingResult?.problemStatement && !replay.codingResult?.attempts?.length ? (
                <Text category="h9-s" status="placeholder">
                  {t('practice:coding_replay_no_submission', {
                    defaultValue: 'No code was submitted before this session ended.',
                  })}
                </Text>
              ) : replay.codingResult?.attempts?.length ? (
                // Product follow-up ("build [scoring across multiple
                // problems] out too") — a session that cycled through
                // several problems via "Next Problem" gets one Problem +
                // Your Code section per problem attempted, in order,
                // instead of only ever showing the last one.
                replay.codingResult.attempts.map((a, i) => (
                  <View key={i} style={i > 0 ? { marginTop: 28 } : undefined}>
                    <Text category="h7" bold mb={12}>
                      {t('practice:coding_replay_problem_numbered', {
                        defaultValue: 'Problem {{n}}{{title}}',
                        n: i + 1,
                        title: a.problemTitle ? ` — ${a.problemTitle}` : '',
                      })}
                    </Text>
                    {a.problemStatement ? (
                      <View style={styles.problemCard}>
                        <Text category="h9-s">{a.problemStatement}</Text>
                      </View>
                    ) : null}
                    {a.code ? (
                      <>
                        <Flex justify="space-between" itemsCenter mt={16} mb={12}>
                          <Text category="h8" bold>{t('practice:coding_replay_your_code', { defaultValue: 'Your Code' })}</Text>
                          {typeof a.testsTotal === 'number' && a.testsTotal > 0 ? (
                            <Text category="h10" bold status={a.testsPassed === a.testsTotal ? 'success' : 'warning'}>
                              {t('practice:coding_replay_tests_passed', {
                                defaultValue: `${a.testsPassed ?? 0} / ${a.testsTotal} tests passed`,
                                passed: a.testsPassed ?? 0,
                                total: a.testsTotal,
                              })}
                            </Text>
                          ) : null}
                        </Flex>
                        <CodeBlock code={a.code} language={a.language ?? undefined} />
                      </>
                    ) : null}
                  </View>
                ))
              ) : (
                <>
                  <Text category="h7" bold mb={12}>{t('practice:coding_replay_problem', { defaultValue: 'Problem' })}</Text>
                  {replay.codingResult?.problemStatement ? (
                    <View style={styles.problemCard}>
                      <Text category="h9-s">{replay.codingResult.problemStatement}</Text>
                    </View>
                  ) : null}
                  {replay.codingResult?.code ? (
                    <>
                      <Flex justify="space-between" itemsCenter mt={20} mb={12}>
                        <Text category="h7" bold>{t('practice:coding_replay_your_code', { defaultValue: 'Your Code' })}</Text>
                        {typeof replay.codingResult.testsTotal === 'number' && replay.codingResult.testsTotal > 0 ? (
                          <Text category="h10" bold status={replay.codingResult.testsPassed === replay.codingResult.testsTotal ? 'success' : 'warning'}>
                            {t('practice:coding_replay_tests_passed', {
                              defaultValue: `${replay.codingResult.testsPassed ?? 0} / ${replay.codingResult.testsTotal} tests passed`,
                              passed: replay.codingResult.testsPassed ?? 0,
                              total: replay.codingResult.testsTotal,
                            })}
                          </Text>
                        ) : null}
                      </Flex>
                      <CodeBlock code={replay.codingResult.code} language={replay.codingResult.language ?? undefined} />
                    </>
                  ) : null}
                </>
              )}
            </View>
          ) : (
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
          )}
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
    ...globalStyle.card,
    flex: 1,
    paddingVertical: 14,
    marginHorizontal: 4,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
  },
  annotationRow: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  // Same plain-readable-card treatment CodingInterview.tsx's own
  // problemCard uses — distinct from CodeBlock's dark editor-style chrome
  // below it, same "what to read" vs "what was written" visual split.
  problemCard: {
    ...globalStyle.card,
    padding: 16,
    backgroundColor: 'background-basic-color-2',
  },
  // borderBottom comes from the shared globalStyle.divider at the usage
  // site instead of a duplicated inline rgba value.
  transcriptRow: {
    paddingVertical: 10,
  },
});
