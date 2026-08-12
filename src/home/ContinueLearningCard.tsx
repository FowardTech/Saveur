import React, { memo } from 'react';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import Text from 'components/Text';
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
// REDESIGN (product follow-up: "remove the continue learning card in the
// My Progress screen and then place it at the top in the homescreen but
// let the background be white and the height be very small like an info
// card") — this used to live on src/practice/MyProgress.tsx as a padded,
// pink-gradient card that could show up to two full rows (course AND
// video). Moved to the top of src/home/HomeSrc.tsx (see that file, right
// under the header) and shrunk to a single compact white row: whichever ONE
// resume target is more specific wins (a video mid-playback is a more
// precise "pick up exactly here" moment than a course module, so video
// takes priority when both exist) rather than stacking both — a true
// "very small info card" doesn't have room for two rows. `style` is
// accepted so HomeSrc can lay this out side-by-side with the "already
// scheduled" upcoming-session card (see UpcomingSessionHomeCard.tsx) in a
// flex row — when only one of the two has content the other renders `null`
// and contributes no layout space, so this naturally expands to full width
// on its own.
//
// Renders null entirely if there's nothing to resume, same "don't show an
// empty card" convention every other self-contained Home card follows.
const ContinueLearningCard = memo(({ style }: { style?: StyleProp<ViewStyle> }) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
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

  // A truly "very small info card" only has room for one resumable item —
  // video wins when both exist (see the module comment above for why).
  const primary: { title: string; subtitle: string; onPress: () => void } | null = video
    ? {
        title: video.title,
        subtitle:
          videoProgressPct != null
            ? t('home:continue_video_subtitle_pct', { defaultValue: '{{pct}}% watched', pct: videoProgressPct })
            : t('home:continue_video_subtitle', { defaultValue: 'Video lesson' }),
        onPress: () => setPlayingVideo(video),
      }
    : course
    ? {
        title: course.topic,
        subtitle: t('home:continue_course_subtitle', {
          defaultValue: 'Module {{current}} of {{total}}',
          current: Math.min(course.completedModules + 1, course.totalModules),
          total: course.totalModules,
        }),
        onPress: () =>
          navigate('CourseSession', {
            topic: course.topic,
            totalModules: course.totalModules,
            level: course.level,
          }),
      }
    : null;

  if (!primary) return null;

  return (
    <>
      <TouchableOpacity activeOpacity={0.8} style={[styles.card, style]} onPress={primary.onPress}>
        <View style={styles.iconWrap}>
          <Icon pack="eva" name="play-circle-outline" style={[globalStyle.icon16, { tintColor: '#0063f8' }]} />
        </View>
        <View style={globalStyle.flexOne}>
          <Text category="h10" bold numberOfLines={1}>
            {primary.title}
          </Text>
          <Text category="h10" status="placeholder" numberOfLines={1} mt={1}>
            {primary.subtitle}
          </Text>
        </View>
        <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
      </TouchableOpacity>

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
    </>
  );
});

export default ContinueLearningCard;

const themedStyles = StyleService.create({
  // "Very small like an info card" (product request) — a single compact
  // white row (icon + one-line title/subtitle + chevron), nothing like the
  // old padded, two-row, pink-gradient card this replaced. `backgroundColor`
  // here (not `level`) since this renders inside a plain TouchableOpacity,
  // same "card needs its own opaque fill for Android shadow" pattern this
  // app's other plain-View cards already follow.
  //
  // BUG FIX (product report, with screenshot: "these cards should be
  // white") — see DailyTipsBanner.tsx's own comment on this exact same
  // fix: `background-basic-color-1` (`#F6FAF8`) was nearly invisible
  // against Container's page background (light blue at the time this fix
  // shipped; since reverted to gray -- see Container.tsx's own comment
  // history); `background-basic-color-2` (real `#FFFFFF`) is the token
  // this app's other "actually white" cards already use, and reads even
  // more clearly against the current gray page than it did against blue.
  // Radius bumped 14 -> 20 (Google-style furnishing pass -- see
  // src/home/QuickActionGrid.tsx's own comment) to match this screen's
  // larger, softer corner language.
  card: {
    ...globalStyle.card,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'background-basic-color-2',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'color-primary-transparent-100',
  },
});
