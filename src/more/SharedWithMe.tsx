import React, {memo} from 'react';
import {Alert, RefreshControl} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Icon,
  Button,
  Input,
} from '@ui-kitten/components';
import {NavigationProp, RouteProp, useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import BasicTabBar from 'components/BasicTabBar';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import * as sharesService from 'services/sharesService';
import {ReceivedShareProps, PendingConnectionRequest} from 'services/sharesService';
import dayjs from 'utils/dayjs';
import CtaButton from 'components/CtaButton';
import { SkeletonList } from 'components/Skeleton';

const ICON_BY_TYPE: Record<string, string> = {
  feedback: 'checkmark-circle-2-outline',
  video: 'video-outline',
  job: 'briefcase-outline',
  project: 'code-outline',
};

function previewLine(share: ReceivedShareProps, t: (key: string, opts?: any) => string): string {
  if (share.contentType === 'project') {
    return share.preview.title || '';
  }
  if (share.contentType === 'job') {
    return [share.preview.title, share.preview.company].filter(Boolean).join(' · ') || '';
  }
  const role = share.preview.role || share.preview.interviewType || '';
  const score = typeof share.preview.overallScore === 'number' ? `${share.preview.overallScore}%` : null;
  return [role, score ? t('more:shared_score', {defaultValue: 'Score: {{score}}', score}) : null]
    .filter(Boolean)
    .join(' · ');
}

// "Shared with Me" inbox (product request item: users can share AI
// feedback/video replay/jobs with each other by username) — reached from
// MoreSrc.tsx. See services/sharesService.ts and Saveur-Backend's
// app/api/shares.py. Tapping a row opens SharedContentDetail.tsx, which
// assembles the same view the owner sees for that content, fetched fresh
// each time rather than a cached snapshot.
//
// Also hosts the "Pending Requests" tab (product request item: "Before a
// user can share something with another Saveur user they must send a
// request first and until the other person accept it then they can now be
// able to send or share with that user... If the other user did not accept
// it should go to pending requests until the user accept or declines") —
// incoming connection requests the current user hasn't responded to yet,
// with Accept/Decline actions right on the row.
const SharedWithMe = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'common']);
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SharedWithMe'>>();

  const [activeIndex, setActiveIndex] = React.useState(route.params?.initialTab ?? 0);

  const [shares, setShares] = React.useState<ReceivedShareProps[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [requests, setRequests] = React.useState<PendingConnectionRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = React.useState(true);
  const [requestsError, setRequestsError] = React.useState<string | null>(null);
  const [respondingId, setRespondingId] = React.useState<string | null>(null);

  const [connections, setConnections] = React.useState<string[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = React.useState(true);
  const loadConnections = React.useCallback(async () => {
    setConnections(await sharesService.listConnections());
    setIsLoadingConnections(false);
  }, []);

  const load = React.useCallback(async () => {
    try {
      const data = await sharesService.listReceivedShares();
      setShares(data);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [t]);

  const loadRequests = React.useCallback(async () => {
    try {
      const data = await sharesService.listPendingConnectionRequests();
      setRequests(data);
      setRequestsError(null);
    } catch (e: any) {
      setRequestsError(e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}));
    } finally {
      setIsLoadingRequests(false);
      setIsRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    React.useCallback(() => {
      load();
      loadRequests();
      loadConnections();
    }, [load, loadRequests, loadConnections]),
  );

  const onRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    load();
    loadRequests();
    loadConnections();
  }, [load, loadRequests, loadConnections]);

  const onRespond = React.useCallback(
    async (requestId: string, accept: boolean) => {
      if (respondingId) return;
      setRespondingId(requestId);
      try {
        await sharesService.respondToConnectionRequest(requestId, accept);
        setRequests(prev => prev.filter(r => r.id !== requestId));
        if (accept) loadConnections();
      } catch {
        // Advisory only — a refresh will resync if this failed silently.
        loadRequests();
      } finally {
        setRespondingId(null);
      }
    },
    [respondingId, loadRequests, loadConnections],
  );

  const renderShares = () =>
    isLoading ? (
      <SkeletonList count={3} style={{ paddingHorizontal: 16 }} />
    ) : loadError ? (
      <EmptyState variant="error" body={loadError} actionLabel={t('common:try_again', {defaultValue: 'Try again'})} onAction={load} />
    ) : shares.length === 0 ? (
      <EmptyState
        icon="people-outline"
        title={t('more:shared_with_me_empty_title', {defaultValue: 'Nothing shared yet'})}
        body={t('more:shared_with_me_empty_body', {
          defaultValue: 'When another Saveur user shares feedback, a video replay, or a job with you, it shows up here.',
        })}
      />
    ) : (
      shares.map(share => (
        <Flex
          key={share.id}
          justify="flex-start"
          itemsCenter
          style={styles.row}
          onPress={() => navigate('SharedContentDetail', {shareId: share.id})}>
          {/* "Colored glass" icon treatment (app-wide consistency pass) —
              was a plain gray circle (Layout level="2") behind an
              already-blue icon; now the circle itself is tinted to match. */}
          <Layout
            level="2"
            style={[
              styles.iconCircle,
              {backgroundColor: theme['color-primary-transparent-200']},
              !share.read && {borderColor: theme['color-primary-500'], borderWidth: 1},
            ]}>
            <Icon
              pack="eva"
              name={ICON_BY_TYPE[share.contentType] ?? 'share-outline'}
              style={[globalStyle.icon20, {tintColor: theme['color-primary-500']}]}
            />
          </Layout>
          <Flex vertical style={{flex: 1, marginLeft: 12}}>
            <Text category="h9" bold={!share.read} numberOfLines={1}>
              {t('more:shared_by', {defaultValue: '@{{username}} shared with you', username: share.senderUsername})}
            </Text>
            <Text category="h10" status="placeholder" numberOfLines={1} mt={2}>
              {previewLine(share, t)}
            </Text>
            <Text category="h10" status="placeholder" mt={4}>
              {dayjs(share.createdAt).fromNow()}
            </Text>
          </Flex>
        </Flex>
      ))
    );

  // "Send request" -- Shared With Me needs a way to ask another Saveur user
  // to connect, not only to answer incoming requests.
  const [reqUsername, setReqUsername] = React.useState('');
  const [sendingReq, setSendingReq] = React.useState(false);
  const onSendRequest = async () => {
    const name = reqUsername.trim().replace(/^@/, '');
    if (!name || sendingReq) return;
    setSendingReq(true);
    try {
      const r = await sharesService.sendConnectionRequest(name);
      Alert.alert(
        r.autoAccepted
          ? t('more:share_connected_title', {defaultValue: 'Connected!'})
          : t('more:share_request_sent_title', {defaultValue: 'Request sent'}),
        r.autoAccepted
          ? t('more:share_connected_body', {defaultValue: 'You and @{{username}} can now share with each other.', username: name})
          : t('more:share_request_sent_body', {defaultValue: '@{{username}} needs to accept before you can share with them.', username: name}),
      );
      setReqUsername('');
    } catch (e: any) {
      const code = e?.response?.data?.error ?? e?.error;
      const msg =
        code === 'recipient_not_found'
          ? t('more:share_user_not_found', {defaultValue: 'No Saveur user found with that username.'})
          : code === 'already_connected'
          ? t('more:share_already_connected', {defaultValue: "You're already connected with this user."})
          : code === 'request_already_sent'
          ? t('more:share_request_already_sent', {defaultValue: "You've already sent a request to this user."})
          : code === 'cannot_share_with_self'
          ? t('more:share_cannot_share_self', {defaultValue: "You can't share with yourself."})
          : t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'});
      Alert.alert(t('more:share_failed_title', {defaultValue: "Couldn't share"}), msg);
    } finally {
      setSendingReq(false);
    }
  };

  const renderSendRequest = () => (
    <Layout level="2" style={{borderRadius: 14, padding: 12, marginBottom: 12}}>
      <Text category="h9" bold mb={8}>
        {t('more:connect_with_user', {defaultValue: 'Connect with another Saveur user'})}
      </Text>
      <Input
        placeholder={t('more:share_username_placeholder', {defaultValue: 'their username'}).toString()}
        value={reqUsername}
        onChangeText={setReqUsername}
        autoCapitalize="none"
        autoCorrect={false}
        style={{marginBottom: 8}}
      />
      <CtaButton disabled={!reqUsername.trim() || sendingReq} onPress={onSendRequest}>
        {t('more:send_request', {defaultValue: 'Send request'})}
      </CtaButton>
    </Layout>
  );

  const renderRequests = () =>
    isLoadingRequests ? (
      <SkeletonList count={3} style={{ paddingHorizontal: 16 }} />
    ) : requestsError ? (
      <EmptyState variant="error" body={requestsError} actionLabel={t('common:try_again', {defaultValue: 'Try again'})} onAction={loadRequests} />
    ) : requests.length === 0 ? (
      <EmptyState
        icon="people-outline"
        title={t('more:pending_requests_empty_title', {defaultValue: 'No pending requests'})}
        body={t('more:pending_requests_empty_body', {
          defaultValue: "When another Saveur user asks to connect with you, it shows up here — accept to start sharing with each other.",
        })}
      />
    ) : (
      requests.map(req => (
        <Flex key={req.id} justify="flex-start" itemsCenter style={styles.row}>
          <Layout level="2" style={[styles.iconCircle, {backgroundColor: theme['color-primary-transparent-200']}]}>
            <Icon pack="eva" name="people-outline" style={[globalStyle.icon20, {tintColor: theme['color-primary-500']}]} />
          </Layout>
          <Flex vertical style={{flex: 1, marginLeft: 12}}>
            <Text category="h9" bold numberOfLines={1}>
              {t('more:connection_request_from', {defaultValue: '@{{username}} wants to connect', username: req.requesterUsername})}
            </Text>
            <Text category="h10" status="placeholder" mt={4}>
              {dayjs(req.createdAt).fromNow()}
            </Text>
            <Flex mt={8}>
              <CtaButton
                size="small"
                onPress={() => onRespond(req.id, true)}
                disabled={respondingId === req.id}
                style={{marginRight: 8}}>
                {t('common:accept', {defaultValue: 'Accept'})}
              </CtaButton>
              <Button
                size="small"
                appearance="outline"
                status="basic"
                onPress={() => onRespond(req.id, false)}
                disabled={respondingId === req.id}>
                {t('common:decline', {defaultValue: 'Decline'})}
              </Button>
            </Flex>
          </Flex>
        </Flex>
      ))
    );

  const renderConnections = () =>
    isLoadingConnections ? (
      <SkeletonList count={3} style={{ paddingHorizontal: 16 }} />
    ) : connections.length === 0 ? (
      <EmptyState
        icon="people-outline"
        title={t('more:connections_empty_title', {defaultValue: 'No connections yet'})}
        body={t('more:connections_empty_body', {
          defaultValue: 'Send a request above. Once someone accepts, they appear here and you can share with them.',
        })}
      />
    ) : (
      connections.map(username => (
        <Flex key={username} justify="flex-start" itemsCenter style={styles.row}>
          <Layout level="2" style={[styles.iconCircle, {backgroundColor: theme['color-primary-transparent-200']}]}>
            <Icon pack="eva" name="people-outline" style={[globalStyle.icon20, {tintColor: theme['color-primary-500']}]} />
          </Layout>
          <Text category="h9" bold numberOfLines={1} style={{flex: 1, marginLeft: 12}}>
            @{username}
          </Text>
        </Flex>
      ))
    );

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:shared_with_me', {defaultValue: 'Shared with Me'})}
        accessoryLeft={<NavigationAction />}
      />
      <Layout style={styles.tabBarWrap}>
        <BasicTabBar
          activeIndex={activeIndex}
          onChange={setActiveIndex}
          tabs={[
            t('more:shared_with_me_tab', {defaultValue: 'Shared with Me'}),
            requests.length > 0
              ? t('more:pending_requests_tab_count', {defaultValue: 'Pending Requests ({{count}})', count: requests.length})
              : t('more:pending_requests_tab', {defaultValue: 'Pending Requests'}),
            t('more:connections_tab', {defaultValue: 'Connections'}),
          ]}
        />
      </Layout>
      <Content
        padder
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}>
        {renderSendRequest()}
        {activeIndex === 0 ? renderShares() : activeIndex === 1 ? renderRequests() : renderConnections()}
      </Content>
    </Container>
  );
});

export default SharedWithMe;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  // No explicit `level` on the wrapping <Layout> below defaulted it to
  // level="1" (near-white, #FAFAFA in light mode) sitting on top of
  // Container's own level="3" page background (#F0F0F0, grayer) — the
  // color difference between the two showed up as a faint pale band/line
  // right under the header, exactly where this tab bar sits (bug report:
  // "dividing white line... below the header text"). Transparent instead,
  // so the tab bar sits directly on the page with no seam.
  tabBarWrap: {
    paddingHorizontal: 12,
    paddingTop: 4,
    backgroundColor: 'transparent',
  },
  content: {
    paddingBottom: 40,
  },
  row: {
    ...globalStyle.card,
    padding: 12,
    marginBottom: 12,
    // `card` carries a real shadow, which needs an opaque fill to render
    // correctly on Android — this renders on a plain <Flex> with no
    // `level` prop (its own default fill is 'transparent'), so the fill
    // has to live here.
    backgroundColor: 'background-basic-color-2',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
