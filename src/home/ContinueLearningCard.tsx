import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, Icon } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';

import Text from 'components/Text';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as learningService from 'services/learningService';
import { ContinueCourseSummary, CourseVideo } from 'services/learningService';
import InAppVideoPlayer from 'components/InAppVideoPlayer';

// Product request item: "In the homescreen I want you to place like a card
// to show the user about where they left over in the lesson. or video
// lesson they were watching so that they can continue from there... A
// button to continue should be there where i can click and it will take me
// to the learning course i was taking or the lesson video i was watching
// before i closed the app. Also for the videos the app should always know
// where i stopped in the video and then i can continue from where i
// stopped in the video."
//
// Two independent resume rows, since the request explicitly names both as
// separate scenarios ("i was in module 3 of a topic OR i was watching a
// recommended video"):
//   - Course/module resume — reuses services/learningService.ts's
//     deriveContinueCourse, the exact same "most recently active,
//     genuinely in-progress course" rule LearningCourses.tsx's own
//     "Continue" banner already applies, just factored out so it isn't
//     reimplemented here.
//   - Video resume — new this feature. The in-app player
//     (components/InAppVideoPlayer.tsx) now reports playback position to
//     the backend every few seconds (see its buildPlayerHtml/reportTime),
//     and GET /videos/continue (video_activity_service.get_continue_video)
//     returns the most recent not-yet-finished one. Tapping it opens the
//     player right here (a local visible/playingVideo pair, same "own its
//     player state" pattern DailyChallengeCard/PersonalizationCard use for
//     their own self-contained state) with `startSeconds` set so playback
//     genuinely resumes instead of restarting at 0:00.
//
// Either, both, or neither row can be showing — renders null entirely if
// there's nothing to resume, same "don't show an empty card" convention
// every other self-contained Home card in this file already follows.
const ContinueLearningCard = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home', 'common']);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { navigate } = navigation;

  const [course, setCourse] = React.useState<ContinueCourseSummary | null>(null);
  const [video, setVideo] = React.useState<CourseVideo | null>(null);
  const [playingVideo, setPlayingVideo] = React.useState<CourseVideo | null>(null);

  const load = React.useCallback(() => {
    learningService.getAllProgress()
      .then(all => setCourse(learningService.deriveContinueCourse(all)))
      .catch(() => {});
    learningService.getContinueVideo().then(setVideo).catch(() => {});
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Refresh on focus — coming back to Home after finishing another module,
  // or after watching more of the same/a different video, should reflect
  // that immediately rather than only on the next full app launch. Same
  // "focus listener" convention LearningCourses.tsx uses for its own
  // continue banner.
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  if (!course && !video) return null;

  const videoProgressPct =
    video?.durationSeconds && video.durationSeconds > 0
      ? Math.min(100, Math.round(((video.lastPositionSeconds ?? 0) / video.durationSeconds) * 100))
      : null;

  return (
    // Product request: "give this continue lesson card a light pink and
    // dark pink gradient color and then all the texts and icon white
    // color." Same safe LinearGradient pattern used elsewhere in this app
    // (see HomeSrc.tsx's homeBannerFallback/streak-ring comments) — the
    // gradient is an absoluteFillObject layer BEHIND the real, normal-flow
    // content rather than the content container itself, since a
    // LinearGradient with no explicit height doesn't reliably grow to wrap
    // its own children's intrinsic size on every layout pass and can clip
    // content. `card`'s shadow is already zeroed out app-wide (see other
    // cards' comments — "remove box shadows from every card in the app"),
    // so adding overflow:'hidden' here to clip the gradient to the card's
    // rounded corners costs nothing.
    <View style={styles.card}>
      <LinearGradient
        colors={['#FF9CD6', '#C2186B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientFill}
      />
      <Flex justify="flex-start" itemsCenter mb={12}>
        <Icon
          pack="eva"
          name="play-circle-outline"
          style={[globalStyle.icon20, { tintColor: '#FFFFFF' }]}
        />
        <Text category="h9" bold ml={8} style={styles.whiteText}>
          {t('home:continue_learning_title', { defaultValue: 'Continue Learning' })}
        </Text>
      </Flex>

      {course && (
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.row, video ? styles.rowDivider : null]}
          onPress={() =>
            navigate('CourseSession', {
              topic: course.topic,
              totalModules: course.totalModules,
              level: course.level,
            })
          }>
          <View style={globalStyle.flexOne}>
            <Text category="h9-s" bold numberOfLines={1} style={styles.whiteText}>
              {course.topic}
            </Text>
            <Text category="h10" mt={2} style={styles.subtitleText}>
              {t('home:continue_course_subtitle', {
                defaultValue: 'Module {{current}} of {{total}}',
                current: Math.min(course.completedModules + 1, course.totalModules),
                total: course.totalModules,
              })}
            </Text>
          </View>
          <View style={styles.continueBtn}>
            <Text category="h10" bold style={styles.whiteText}>
              {t('common:continue', { defaultValue: 'Continue' })}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {video && (
        <TouchableOpacity activeOpacity={0.7} style={styles.row} onPress={() => setPlayingVideo(video)}>
          <View style={globalStyle.flexOne}>
            <Text category="h9-s" bold numberOfLines={1} style={styles.whiteText}>
              {video.title}
            </Text>
            <Text category="h10" mt={2} numberOfLines={1} style={styles.subtitleText}>
              {videoProgressPct != null
                ? t('home:continue_video_subtitle_pct', {
                    defaultValue: '{{pct}}% watched — video lesson',
                    pct: videoProgressPct,
                  })
                : t('home:continue_video_subtitle', { defaultValue: 'Video lesson' })}
            </Text>
          </View>
          <View style={styles.continueBtn}>
            <Text category="h10" bold style={styles.whiteText}>
              {t('common:continue', { defaultValue: 'Continue' })}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <InAppVideoPlayer
        visible={!!playingVideo}
        video={playingVideo}
        onClose={() => {
          setPlayingVideo(null);
          // The just-closed session may have moved the resume position (or
          // finished the video entirely, dropping it off get_continue_video
          // altogether) — refresh so this card's own subtitle/percentage
          // isn't left showing a stale pre-watch snapshot.
          load();
        }}
        context={
          playingVideo
            ? {
                topic: playingVideo.topic ?? undefined,
                moduleTitle: playingVideo.moduleTitle ?? undefined,
                courseId: playingVideo.courseId ?? undefined,
              }
            : undefined
        }
        startSeconds={playingVideo?.lastPositionSeconds}
      />
    </View>
  );
});

export default ContinueLearningCard;

const themedStyles = StyleService.create({
  // Radius inherited from globalStyle.card (14) — no local override, same
  // convention as DailyChallengeCard/PersonalizationCard. `overflow:hidden`
  // clips the gradientFill layer below to these rounded corners — safe to
  // add since this card carries no shadow (shadows are zeroed out
  // app-wide, see other cards' own comments), so there's no shadow for
  // overflow:hidden to clip off.
  card: {
    ...globalStyle.card,
    padding: 16,
    marginTop: 24,
    overflow: 'hidden',
  },
  // Pink gradient background (product request), positioned behind the
  // real content instead of wrapping it directly — see the JSX comment
  // above this component's return for why.
  gradientFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  whiteText: {
    color: '#FFFFFF',
  },
  // Slightly translucent white for subtitle/secondary text — keeps the
  // same "less prominent than the title" hierarchy the placeholder status
  // color gave it before, just recolored for the pink background instead
  // of relying on a theme token that assumed a neutral card fill.
  subtitleText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 4,
  },
  continueBtn: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
});
