import React, { memo } from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Icon, useTheme } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from './Text';
import { globalStyle } from 'styles/globalStyle';
import { CourseVideo, CourseVideoContext } from 'services/learningService';
import * as learningService from 'services/learningService';
import { API_BASE_URL } from 'constants/env';

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
// BUG FIX (product report: "why am i seeing this youtube error?
// [screenshot of YouTube's own 'Error 153: Video player configuration
// error']"). The player used to point a plain WebView straight at the
// embed URL string (`{uri: embedSrc}`) with no `origin` parameter at all.
// YouTube's embedded player validates the requesting page's origin against
// its own embeddability rules for that video/channel; with no origin sent,
// some videos fail that check and YouTube renders ITS OWN error screen
// (branding, logo, "Error 153" text) inside the WebView — exactly what the
// user saw and explicitly said they don't want visible.
//
// Fix: load a small local HTML page (via WebView's `source={{html,
// baseUrl}}`, not a remote URL) that uses YouTube's real IFrame Player API
// with an explicit `origin` matching `baseUrl` (this app's own real
// backend domain — a legitimate origin, not a placeholder). The player API
// also fires a genuine `onError` event for embeddability failures (rather
// than just rendering broken chrome), which this page forwards to React
// Native via `window.ReactNativeWebView.postMessage`, letting THIS
// component render its own clean, on-brand "video unavailable" state
// instead of ever showing YouTube's native error screen.
function buildPlayerHtml(videoId: string, origin: string): string {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden;}#player{position:absolute;top:0;left:0;width:100%;height:100%;}</style>
</head><body>
<div id="player"></div>
<script>
  var tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  document.body.appendChild(tag);
  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }
  var player;
  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('player', {
      videoId: ${JSON.stringify(videoId)},
      playerVars: {
        playsinline: 1, autoplay: 1, modestbranding: 1, rel: 0,
        origin: ${JSON.stringify(origin)},
      },
      events: {
        onReady: function (e) { post({ type: 'ready' }); e.target.playVideo(); },
        // Error codes per YouTube's IFrame API docs: 2 invalid param,
        // 5 HTML5 player error, 100 video not found/removed/private,
        // 101/150 embedding disallowed by the video owner (the family
        // Error 153 belongs to) — every one of these means "can't play
        // this here", so all are treated the same on the RN side.
        onError: function (e) { post({ type: 'error', code: e.data }); },
      },
    });
  };
  // If the IFrame API script itself fails to load (offline, blocked, etc.)
  // there's no player at all — surface that as an error too instead of an
  // indefinitely-blank black box.
  setTimeout(function () {
    if (!window.YT || !player) { post({ type: 'error', code: 'api_load_failed' }); }
  }, 8000);
</script>
</body></html>`;
}

const InAppVideoPlayer = memo(({ visible, video, onClose, context }: Props) => {
  const theme = useTheme();
  const { t } = useTranslation(['more', 'common']);
  const [isSaved, setIsSaved] = React.useState(!!video?.isSaved);
  const [isSaving, setIsSaving] = React.useState(false);
  const [playbackError, setPlaybackError] = React.useState(false);

  // Product request item: "the AI career coach [should] know the content
  // of every video the user watches" — logged the moment the player is
  // actually shown for a given video (not just when it's rendered as a
  // recommendation card), and again if the user reopens a different video
  // without this component unmounting (videoId dependency, not just
  // `visible`). Fire-and-forget — see logVideoWatch's own comment.
  React.useEffect(() => {
    setIsSaved(!!video?.isSaved);
    setPlaybackError(false);
    if (visible && video) {
      learningService.logVideoWatch(video, context);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, video?.videoId]);

  if (!video) return null;

  const playerHtml = buildPlayerHtml(video.videoId, API_BASE_URL);

  const onWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg?.type === 'error') setPlaybackError(true);
    } catch {
      // Ignore malformed/unexpected messages rather than crashing the player.
    }
  };

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
          {playbackError ? (
            // Clean in-app fallback — no YouTube branding, logo, or native
            // error chrome, per the product request. Just an explanation
            // and the same citation line the player always shows below it.
            <View style={styles.errorFallback}>
              <Icon
                pack="eva"
                name="video-off-outline"
                style={[globalStyle.icon28, { tintColor: '#8A8A8E' }]}
              />
              <Text
                category="para-s"
                status="control"
                style={{ marginTop: 12, textAlign: 'center' }}
              >
                {t('more:video_unavailable', {
                  defaultValue: "This video can't be played right now.",
                })}
              </Text>
            </View>
          ) : (
            <WebView
              key={video.videoId}
              source={{ html: playerHtml, baseUrl: API_BASE_URL }}
              style={styles.webview}
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              onMessage={onWebViewMessage}
              onError={() => setPlaybackError(true)}
            />
          )}
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
  errorFallback: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
  },
  citation: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
};
