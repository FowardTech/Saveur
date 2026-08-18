import React, { memo } from 'react';
import { FlatList, Image, TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
} from '@ui-kitten/components';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import InAppVideoPlayer from 'components/InAppVideoPlayer';
import ProLockGate from 'components/ProLockGate';
import { SkeletonList } from 'components/Skeleton';
import { globalStyle } from 'styles/globalStyle';
import * as learningService from 'services/learningService';
import { CourseVideo } from 'services/learningService';
import { AuthContext } from '../../AuthContext';

// Product request item: "implement the ability for users to save a video
// too" — a bookmark toggle lives in InAppVideoPlayer.tsx itself; this
// screen is where those saved videos actually show up afterward (a save
// button with nowhere to review what was saved isn't a real feature).
// Reachable from the More menu, same Pro Premium gate as Learning Courses
// itself (require_premium on the backend's /learning/videos/saved).
const SavedVideos = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const { t } = useTranslation(['more', 'common']);
  const { isPremium } = React.useContext(AuthContext);

  const [videos, setVideos] = React.useState<CourseVideo[] | null>(null);
  const [playerVideo, setPlayerVideo] = React.useState<CourseVideo | null>(null);

  const load = React.useCallback(() => {
    learningService.getSavedVideos().then(setVideos);
  }, []);

  // Refetch on every focus, not just mount — unsaving a video from inside
  // the player (tap the filled bookmark again) should make it disappear
  // from this list the next time the user comes back to it.
  useFocusEffect(load);

  if (!isPremium) {
    return (
      <ProLockGate
        variant="premium"
        title={t('more:saved_videos', { defaultValue: 'Saved Videos' })}
        description={t('more:saved_videos_pro_gate_description', {
          defaultValue: 'Bookmark Learning Course videos to come back to later — Saved Videos is a Premium feature.',
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:saved_videos', { defaultValue: 'Saved Videos' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        {videos === null ? (
          <SkeletonList count={3} style={{ paddingHorizontal: 16 }} />
        ) : videos.length === 0 ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 60 }}>
            <Icon pack="eva" name="bookmark-outline" style={[{ width: 32, height: 32 }, { tintColor: theme['text-hint-color'] }]} />
            <Text category="h9-s" status="placeholder" mt={12} center>
              {t('more:saved_videos_empty', { defaultValue: "Videos you save from a Learning Course lesson will show up here." })}
            </Text>
          </Flex>
        ) : (
          <FlatList
            data={videos}
            keyExtractor={v => v.videoId}
            ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: theme['background-basic-color-2'] }]}
                activeOpacity={0.8}
                onPress={() => setPlayerVideo(item)}
              >
                <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} resizeMode="cover" />
                <View style={styles.playBadge}>
                  <Icon pack="eva" name="play-circle-outline" style={[globalStyle.icon24, { tintColor: '#fff' }]} />
                </View>
                <View style={styles.info}>
                  <Text category="h9" bold numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.channel ? (
                    <Text category="h10" status="placeholder" numberOfLines={1} mt={2}>
                      {item.channel}
                    </Text>
                  ) : null}
                  {item.moduleTitle ? (
                    <Text category="h10" status="placeholder" numberOfLines={1} mt={2}>
                      {t('more:saved_video_from_lesson', { defaultValue: 'From: {{lesson}}', lesson: item.moduleTitle })}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </Content>
      <InAppVideoPlayer
        visible={playerVideo !== null}
        video={playerVideo}
        onClose={() => {
          setPlayerVideo(null);
          load(); // pick up an unsave that happened inside the player
        }}
        context={{ topic: playerVideo?.topic ?? undefined, moduleTitle: playerVideo?.moduleTitle ?? undefined }}
      />
    </Container>
  );
});

export default SavedVideos;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    // Google-style furnishing pass (see styles/globalStyle.ts's `card`) --
    // 14 -> 20.
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
  },
  thumb: {
    width: 90,
    height: 60,
    borderRadius: 10,
  },
  playBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    width: 90,
    height: 60,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
});
