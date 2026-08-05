import React, { memo } from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Icon, useTheme } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from './Text';
import { globalStyle } from 'styles/globalStyle';
import { CourseVideo, CourseVideoContext } from 'services/learningService';
import * as learningService from 'services/learningService';

interface Props {
  visible: boolean;
  video: CourseVideo | null;
  onClose: () => void;
  // Which course/module this video was recommended under — forwarded to
  // logVideoWatch/setVideoSaved so the AI coach can later reference "the
  // video you watched on X" (see Saveur-Backend's coach.py
  // _activity_snippet). Optional — omitted entirely for any future caller
  // that plays a video with no course context.
  context?: CourseVideoContext;
}

// Product request item: "Videos must play inside a custom in-app player (no
// YouTube branding/redirect to external site)." See Saveur-Backend's
// learning_video_service.py for the full explanation of why "no YouTube
// branding" specifically isn't achievable while staying compliant with
// YouTube's Terms of Service — the short version: YouTube requires embedded
// playback to go through its own official player, which always carries a
// small amount of unremovable attribution (video title bar, a YouTube logo,
// a "watch on YouTube" affordance baked into the player chrome itself).
//
// What THIS component does deliver, in full: the video plays entirely
// inside this WebView, inside this app — tapping it never opens the
// YouTube app or an external browser, and there's no "open externally"
// button anywhere in this screen. `modestbranding=1&rel=0` are real
// embed-URL parameters that minimize (but per YouTube's own docs, cannot
// fully remove) the surrounding chrome, and the citation line below the
// player is the explicit "cite source only" the product request asked for.
const InAppVideoPlayer = memo(({ visible, video, onClose, context }: Props) => {
  const theme = useTheme();
  const { t } = useTranslation(['more', 'common']);
  const [isSaved, setIsSaved] = React.useState(!!video?.isSaved);
  const [isSaving, setIsSaving] = React.useState(false);

  // Product request item: "the AI career coach [should] know the content
  // of every video the user watches" — logged the moment the player is
  // actually shown for a given video (not just when it's rendered as a
  // recommendation card), and again if the user reopens a different video
  // without this component unmounting (videoId dependency, not just
  // `visible`). Fire-and-forget — see logVideoWatch's own comment.
  React.useEffect(() => {
    setIsSaved(!!video?.isSaved);
    if (visible && video) {
      learningService.logVideoWatch(video, context);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, video?.videoId]);

  if (!video) return null;

  const embedSrc = `${video.embedUrl}?playsinline=1&autoplay=1&modestbranding=1&rel=0`;

  const onToggleSave = async () => {
    if (isSaving) return;
    const next = !isSaved;
    setIsSaved(next); // optimistic
    setIsSaving(true);
    const ok = await learningService.setVideoSaved(video, next, context);
    if (!ok) setIsSaved(!next); // revert on failure
    setIsSaving(false);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme['background-basic-color-1'] }]}>
        <View style={styles.header}>
          <Text category="h8" bold numberOfLines={1} style={{ flex: 1, marginRight: 12 }}>
            {video.title}
          </Text>
          {/* Product request item: "implement the ability for users to
              save a video too" — a bookmark toggle right in the player,
              same place the close button already lives. */}
          <TouchableOpacity
            onPress={onToggleSave}
            disabled={isSaving}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginRight: 16 }}
            accessibilityLabel={t('more:save_video', { defaultValue: 'Save video' }).toString()}
          >
            <Icon
              pack="eva"
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              style={[globalStyle.icon24, { tintColor: isSaved ? theme['color-primary-500'] : theme['text-basic-color'] }]}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon
              pack="eva"
              name="close-outline"
              style={[globalStyle.icon24, { tintColor: theme['text-basic-color'] }]}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.playerWrap}>
          <WebView
            source={{ uri: embedSrc }}
            style={styles.webview}
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
          />
        </View>

        {/* Explicit citation, per the product request's own "cite source
            only, never open externally" — no tap target here on purpose,
            this is attribution text, not a link out. */}
        <View style={styles.citation}>
          <Text category="h10" status="placeholder">
            {t('more:video_source_citation', {
              defaultValue: 'Source: YouTube{{channel}}',
              channel: video.channel ? ` — ${video.channel}` : '',
            })}
          </Text>
        </View>
      </View>
    </Modal>
  );
});

export default InAppVideoPlayer;

const styles = {
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
  },
  playerWrap: {
    width: '100%' as const,
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  citation: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
};
