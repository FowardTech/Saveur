import React, { memo } from 'react';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import Text from 'components/Text';
import GradientIconBadge from 'components/GradientIconBadge';
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
// video). Shrunk to a single compact white row: whichever ONE resume
// target is more specific wins (a video mid-playback is a more precise
// "pick up exactly here" moment than a course module, so video takes
// priority when both exist) rather than stacking both — a true "very small
// info card" doesn't have room for two rows. `style` is accepted so a
// caller can lay this out side-by-side with another card in a flex row (it
// no longer is — see below — but the prop is harmless to keep) — when this
// card has nothing to show it renders `null` and contributes no layout
// space either way.
//
// POSITION HISTORY: despite the "place it at the top in the homescreen"
// wording above, this actually ended up living at the very BOTTOM of Home,
// inside the "Next Steps" stack alongside UpcomingSessionHomeCard (see
// HomeSrc.tsx's own git history) — this comment just never got updated to
// match. Product follow-up caught the drift ("the continue learning card
// should be at the top of the homescreen... since it does not appear all
// the time" — a card that only sometimes has content is easy to miss
// buried under 4+ other sections at the bottom): actually moved to the top
// now, right after the verify-email banner and before the admin banner —
// see HomeSrc.tsx's own JSX comment at that call site. Its old bottom slot
// is now a permanent "What's Next" link card instead (HomeSrc.tsx again).
//
// Renders null entirely if there's nothing to resume, same "don't show an
// empty card" convention every other self-contained Home card follows.
const ContinueLearningCard = memo(({ style, onVisibilityChange }: {
  style?: StyleProp<ViewStyle>;
  // BUG FIX (product report: "the Today's Plan section in the homescreen,
  // nothing is there its empty") — this card (and UpcomingSessionHomeCard,
  // its row partner) always rendered null on its own when it had nothing
  // to show, which is correct, but HomeSrc.tsx's "Today's plan" section
  // label above the row had no way to know that and rendered
  // unconditionally — a heading sitting over an empty row on any account
  // with no in-progress lesson AND no scheduled session. Reports whether
  // this card actually has something to show so HomeSrc can hide the whole
  // section (label included) when both cards in the row are empty.
  onVisibilityChange?: (visible: boolean) => void;
}) => {
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

  const hasContent = !!course || !!video;
  // Hooks must run unconditionally (before the early `return null` below),
  // so this reports visibility every render rather than only when there's
  // something to show.
  React.useEffect(() => {
    onVisibilityChange?.(hasContent);
  }, [hasContent, onVisibilityChange]);

  if (!hasContent) return null;

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
        {/* REDESIGN (product ask: "use that same icon style in some other
            key notable screens in the app") -- was a flat
            color-primary-transparent-100 tint circle; now the same
            GradientIconBadge every other icon badge in the app uses. */}
        <GradientIconBadge color="#0063f8" size={30} radius={10} style={styles.iconWrap}>
          <Icon pack="eva" name="play-circle-outline" style={[globalStyle.icon16, { tintColor: '#fff' }]} />
        </GradientIconBadge>
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
  //
  // Product follow-up ("remove the box shadow and give it a border"), now
  // that this card sits right at the top of Home under the header rather
  // than buried at the bottom: shadowOpacity/elevation explicitly zeroed
  // to cancel out globalStyle.card's own shadow (spread above) -- setting
  // both unconditionally is safe cross-platform, RN just ignores whichever
  // one doesn't apply on the current OS -- and a real hairline border
  // takes its place, same neutral tone as globalStyle.divider.
  card: {
    ...globalStyle.card,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'background-basic-color-2',
    shadowOpacity: 0,
    elevation: 0,
    // RESTORED (product follow-up: "Change the app background back to
    // white and then give the white cards their borders back. Make the
    // border width to be 1.5") — matches globalStyle.card's own border
    // restoration, see that style's comment for the full reasoning.
    borderWidth: 1.5,
    borderColor: 'rgba(128,128,128,0.3)',
  },
  // Just the spacing now -- GradientIconBadge owns its own size/shape via
  // its `size`/`radius` props at the call site.
  iconWrap: {
    marginRight: 10,
  },
});
