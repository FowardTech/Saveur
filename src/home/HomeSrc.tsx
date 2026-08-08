import React, { memo } from 'react';
import { Alert, AppState, InteractionManager, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleService, useStyleSheet, useTheme, Icon, Button, Spinner } from '@ui-kitten/components';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';

import Content from 'components/Content';
import Container from 'components/Container';
import HeaderHome from './Components/HeaderHome';
import GradientCard from 'components/GradientCard';
import { ArtCareerCoach, ArtPractice, ArtDreamCompany } from './HomeHeroArt';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from 'navigation/types';
import Text from 'components/Text';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { AdvertisementProps, EKeyAsyncStorage } from 'constants/Types';
import * as notificationService from 'services/notificationService';
import * as adsService from 'services/adsService';
import * as jobShareService from 'services/jobShareService';
import { navigateToJobAlertDetails } from 'navigation/navigationRef';
import AdPopupModal from 'components/AdPopupModal';
import AppTour from 'components/AppTour';
import AppRatingModal from 'components/AppRatingModal';
import DailyCheckInSheet, { DailyCheckInMode } from 'components/DailyCheckInSheet';
import * as appRatingService from 'services/appRatingService';
import * as dailyCheckinService from 'services/dailyCheckinService';
import useModal from 'hooks/useModal';
import { AuthContext } from '../../AuthContext';

// Defined at module scope (not inline in JSX) so it's a stable component
// reference across renders — see Subscription.tsx's renderCheckoutSpinner
// for the same reasoning.
const renderCheckInSpinner = () => <Spinner size="tiny" status="control" />;

// BUG FIX (product report: homescreen freezing on scroll, every load, both
// platforms) — root cause: `useTranslation(['home', 'common'])` used to
// pass a brand-new array literal as its namespace argument on every render,
// which this app's react-i18next version doesn't deep-compare, so the
// returned `t` function's own reference could change on every render even
// with no real language change. Hoisting this array to a stable module-level
// constant closes off that root cause. See git history for the fuller
// mechanism (this file used to have several dashboard widgets whose data-
// loading useCallbacks fed straight into mount effects with `t` in their own
// dependency arrays — the exact loop that made this matter).
const HOME_I18N_NAMESPACES = ['home', 'common'] as const;

// Home redesign (product request, reference screenshot: a clean two-big-card
// "what do you want to do" landing screen) — this screen used to be a long,
// ever-growing dashboard: nav pills, a "continue learning" card, a day-of-
// week calendar strip, an admin promo banner, a streak/XP/check-in card with
// its own "upcoming session" sub-block, a surprise daily-challenge card, a
// Career DNA/Dream Company teaser, and a leaderboard preview. All of that
// was real, working content — none of it was deleted, just moved. It now
// lives on src/practice/MyProgress.tsx's "Overview" tab (reachable from the
// More menu's new "My Progress" row, see src/more/MoreSrc.tsx), which was
// already this app's dedicated "your progress toward your goal" screen and
// had no overlapping content of its own to collide with. Home itself is now
// just: the existing header (unchanged), the verify-email banner (kept here
// since it's a critical, time-sensitive account action, not "content"), and
// two large tappable cards into this app's two actual entry points —
// AI Career Coach (navigation/MainBottomTab.tsx's "Coach" tab) and Practice
// (that same file's "Practice" tab, FindScreen.tsx). The four auto-triggered
// overlays (App Tour, daily check-in sheet, rating prompt, ad popup) and
// their shared one-at-a-time arbitration queue are UNCHANGED — they're
// app-wide engagement mechanisms triggered independently of what's on
// screen, not a "content card" a user would look for here.
const HomeSrc = memo(() => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(HOME_I18N_NAMESPACES);
  const { isSignedIn, emailVerified, resendVerificationEmail, refreshEmailVerified, profile } =
    React.useContext(AuthContext);

  // Bell badge — GET /api/v1/notifications (see services/notificationService.ts).
  const [unreadCount, setUnreadCount] = React.useState(0);
  const loadUnreadCount = React.useCallback(async () => {
    try {
      const list = await notificationService.listNotifications();
      setUnreadCount(list.filter(n => !n.read).length);
    } catch {
      // Non-critical — the badge just stays at its last-known count on a
      // failed refresh rather than surfacing an error for a header icon.
    }
  }, []);
  React.useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  // BUG FIX (repeat product report: "the pop up advert is still freezing
  // the app... I thought you have solved this issue already?") — this
  // screen has FOUR separate auto-triggered overlays that each
  // independently decide, on their own effect, to flip their own `visible`
  // state to true on Home mount/focus — the App Tour walkthrough (below),
  // the daily goal check-in sheet, the app-rating prompt, and the ad popup
  // itself — every one of them a real native RN <Modal> (three of the four
  // already `transparent`). None of them has ever known whether one of the
  // OTHERS is already open. A brand new or returning user can easily
  // satisfy two of these conditions at once — when that happens, TWO native
  // Modals end up mounted at the same time, which is a well-documented
  // Android RN failure mode (simultaneous Modals fight over the same native
  // Window for touch dispatch) and matches "loads then freezes, won't
  // scroll, won't dismiss" exactly.
  //
  // This tiny queue makes sure only ONE of the four is ever visible at a
  // time: each overlay "requests" its slot instead of just setting its own
  // visible flag on its own, waits (still queued, not shown) if someone
  // else already holds the slot, and "releases" it on dismiss/submit/close
  // so the next queued one (if any) gets its turn. OVERLAY_PRIORITY governs
  // which queued overlay goes next when a slot frees up with more than one
  // waiting — roughly most-important-first (the one-time tour, then the
  // time-sensitive morning check-in, then the rating ask, then the ad
  // last, since it's the least essential and already the only one of the
  // four with its own deliberate entry delay).
  const OVERLAY_PRIORITY = ['tour', 'checkin', 'rating', 'ad'] as const;
  type AutoOverlayKey = (typeof OVERLAY_PRIORITY)[number];
  const [activeOverlay, setActiveOverlay] = React.useState<AutoOverlayKey | null>(null);
  const activeOverlayRef = React.useRef<AutoOverlayKey | null>(null);
  activeOverlayRef.current = activeOverlay;
  const overlayQueueRef = React.useRef<AutoOverlayKey[]>([]);
  const requestOverlay = React.useCallback((key: AutoOverlayKey) => {
    if (activeOverlayRef.current === null) {
      setActiveOverlay(key);
      return;
    }
    if (activeOverlayRef.current !== key && !overlayQueueRef.current.includes(key)) {
      overlayQueueRef.current.push(key);
    }
  }, []);
  const releaseOverlay = React.useCallback((key: AutoOverlayKey) => {
    overlayQueueRef.current = overlayQueueRef.current.filter(k => k !== key);
    if (activeOverlayRef.current !== key) return;
    overlayQueueRef.current.sort(
      (a, b) => OVERLAY_PRIORITY.indexOf(a) - OVERLAY_PRIORITY.indexOf(b),
    );
    setActiveOverlay(overlayQueueRef.current.shift() ?? null);
  }, []);

  // One-time "how this app works" walkthrough (components/AppTour.tsx) —
  // checked on every Home focus (not just mount) rather than once, so
  // MoreSrc.tsx's "Show app tour" replay entry (which clears this same
  // flag and navigates back to Home) actually reopens it without needing
  // Home to remount.
  const [showTour, setShowTour] = React.useState(false);
  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem(EKeyAsyncStorage.appTourSeen).then(seen => {
        if (!seen) {
          setShowTour(true);
          requestOverlay('tour'); // see OVERLAY_PRIORITY's own comment above
        }
      });
    }, [requestOverlay]),
  );
  const onCloseTour = React.useCallback(() => {
    setShowTour(false);
    releaseOverlay('tour');
    AsyncStorage.setItem(EKeyAsyncStorage.appTourSeen, '1').catch(() => { });
  }, [releaseOverlay]);

  // Regular QA rating prompt (product request item: "a regular if not
  // weekly or monthly app rating that will pop up as modal... for quality
  // assurance purposes", PLUS "the rating should pop up after a user have
  // completed 5 interviews or has applied to at least 1 job or has just
  // finished a conversation with the AI coach") — two independent signals
  // decide whether to show this: the server's own periodic due-check
  // (services/appRatingService.ts's isRatingPromptDue, admin-configurable
  // interval, default 30 days) for the "regular" cadence, OR a local flag
  // (EKeyAsyncStorage.ratingPromptQueued) that utils/appRating.ts's three
  // milestone functions set the instant one of those three conditions
  // fires, for the "right after a real accomplishment" cadence.
  const [showRatingPrompt, setShowRatingPrompt] = React.useState(false);
  // A ref always reads the current value — see the module's own history for
  // why the `[]`-deps useCallback below can't just read `showRatingPrompt`
  // directly.
  const showRatingPromptRef = React.useRef(false);
  React.useEffect(() => {
    showRatingPromptRef.current = showRatingPrompt;
  }, [showRatingPrompt]);
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  useFocusEffect(
    React.useCallback(() => {
      if (showRatingPromptRef.current) return; // already showing -- don't re-check mid-display
      (async () => {
        // Local backstop (see EKeyAsyncStorage.ratingPromptLastShownAt's own
        // comment) — checked BEFORE either trigger path below, so a
        // silently-failed dismiss/submit POST from a previous showing can
        // never cause this to re-fire on the very next focus.
        const lastShownRaw = await AsyncStorage.getItem(EKeyAsyncStorage.ratingPromptLastShownAt);
        if (lastShownRaw && Date.now() - Number(lastShownRaw) < WEEK_MS) return;
        const queued = (await AsyncStorage.getItem(EKeyAsyncStorage.ratingPromptQueued)) === 'true';
        if (queued) {
          setShowRatingPrompt(true);
          requestOverlay('rating'); // see OVERLAY_PRIORITY's own comment above
          AsyncStorage.setItem(EKeyAsyncStorage.ratingPromptLastShownAt, String(Date.now())).catch(() => {});
          return;
        }
        const due = await appRatingService.isRatingPromptDue();
        if (due) {
          setShowRatingPrompt(true);
          requestOverlay('rating');
          AsyncStorage.setItem(EKeyAsyncStorage.ratingPromptLastShownAt, String(Date.now())).catch(() => {});
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestOverlay]),
  );
  const onSubmitRating = React.useCallback(async (score: number, comment?: string) => {
    try {
      await appRatingService.submitRating(score, comment);
      // Only close on success -- a failed submit keeps the modal open
      // (with whatever the user already picked still showing) so they can
      // just retry, rather than silently losing the rating they were
      // trying to send.
      setShowRatingPrompt(false);
      releaseOverlay('rating');
      AsyncStorage.removeItem(EKeyAsyncStorage.ratingPromptQueued).catch(() => {});
    } catch (e: any) {
      Alert.alert(
        t('common:rating_submit_failed_title', { defaultValue: "Couldn't send your rating" }),
        e?.message ?? t('common:try_again_later', { defaultValue: 'Please try again in a moment.' }),
      );
    }
  }, [t, releaseOverlay]);
  const onDismissRating = React.useCallback(() => {
    setShowRatingPrompt(false);
    releaseOverlay('rating');
    appRatingService.dismissRatingPrompt().catch(() => { });
    AsyncStorage.removeItem(EKeyAsyncStorage.ratingPromptQueued).catch(() => {});
  }, [releaseOverlay]);

  // Daily career-goal check-in (product request item): on login, ask
  // "what's your career goal for today?" — explicitly distinct from the
  // one-time signup goal (profile.goals). Checked once on mount (due-ness
  // can't flip back to true within the same session without an explicit
  // submit/dismiss). Skipped entirely if the user already answered today
  // (server-side) OR already dismissed it once today without answering
  // (local-only flag — see dailyCheckinService.wasGoalPromptDismissedToday's
  // own comment). Only auto-shows before noon local time (product report:
  // "should only appear once a day and that should be the starting of the
  // day which is in the morning").
  const [checkinSheet, setCheckinSheet] = React.useState<DailyCheckInMode | null>(null);
  React.useEffect(() => {
    if (!isSignedIn) return;
    if (new Date().getHours() >= 12) return;
    (async () => {
      try {
        const [today, dismissed] = await Promise.all([
          dailyCheckinService.getToday(),
          dailyCheckinService.wasGoalPromptDismissedToday(),
        ]);
        if (!today.goalAnswered && !dismissed) {
          setCheckinSheet('goal');
          requestOverlay('checkin'); // see OVERLAY_PRIORITY's own comment above
        }
      } catch {
        // Non-critical — a failed fetch just means no popup this session,
        // not a broken Home screen.
      }
    })();
  }, [isSignedIn, requestOverlay]);

  // "How did your day go?" push tap (see pushNotificationService.ts) sets a
  // pending flag rather than assuming Home is already mounted/focused —
  // same deferred-until-Home pattern as the shared-job deep link below.
  // Checked on every focus (not just mount, unlike the goal prompt above)
  // since a user could tap the push while already sitting on Home, which
  // wouldn't remount this component at all.
  useFocusEffect(
    React.useCallback(() => {
      dailyCheckinService.consumePendingReflectionPrompt().then(pending => {
        if (pending) {
          setCheckinSheet('reflection');
          requestOverlay('checkin');
        }
      });
    }, [requestOverlay]),
  );

  const onSubmitCheckin = React.useCallback(async (text: string) => {
    if (checkinSheet === 'goal') {
      await dailyCheckinService.submitGoal(text);
    } else if (checkinSheet === 'reflection') {
      await dailyCheckinService.submitReflection(text);
    }
    setCheckinSheet(null);
    releaseOverlay('checkin');
  }, [checkinSheet, releaseOverlay]);

  const onDismissCheckin = React.useCallback(() => {
    // Only the morning goal prompt has a "don't ask again today" local
    // flag — a dismissed reflection prompt should still be reachable by
    // tapping the same push notification again (or just doesn't need
    // re-prompting, since there's no follow-up push for it today).
    if (checkinSheet === 'goal') {
      dailyCheckinService.dismissGoalPromptForToday().catch(() => { });
    }
    setCheckinSheet(null);
    releaseOverlay('checkin');
  }, [checkinSheet, releaseOverlay]);

  // "Share a job" deep-link landing (product request item) — a pending job
  // id captured by App.tsx's AppsFlyer listeners / saveur://job fallback
  // link (see services/jobShareService.ts) sits in AsyncStorage until the
  // user actually reaches Home, which by definition only happens once
  // they're authenticated (Home is behind AuthContext's signed-in gate) —
  // so this is naturally the right moment to resolve it. consumePendingJob()
  // clears the stored id itself (success or failure) so this only ever
  // fires once per shared link, not on every future Home visit.
  React.useEffect(() => {
    jobShareService.consumePendingJob().then(job => {
      if (job) navigateToJobAlertDetails(job);
    });
  }, []);
  // Refresh whenever the app returns to the foreground (e.g. after visiting
  // the Notification screen and marking things read) — same AppState pattern
  // used elsewhere in this file/Subscription.tsx.
  React.useEffect(() => {
    const listener = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') loadUnreadCount();
    });
    return () => listener.remove();
  }, [loadUnreadCount]);

  // Non-blocking "verify your email" banner — see AuthContext.emailVerified's
  // doc comment. Deliberately NOT a hard gate on the rest of the app: an
  // interview-prep tool has no action that strictly requires a verified
  // email today, and a hard gate risks locking someone out entirely if a
  // verification email gets lost/delayed. Only ever true for an
  // email/password account — Google/Apple sign-ins are pre-verified. Kept
  // here (not moved to My Progress with everything else) since it's a
  // time-sensitive account action, not a content card.
  const [resendingVerification, setResendingVerification] = React.useState(false);
  const onResendVerification = React.useCallback(async () => {
    if (resendingVerification) return;
    setResendingVerification(true);
    try {
      await resendVerificationEmail();
      Alert.alert(
        t('home:verification_resent_title', { defaultValue: 'Email sent' }),
        t('home:verification_resent_body', { defaultValue: 'Check your inbox for the verification link.' }),
      );
    } catch (error: any) {
      Alert.alert(
        t('home:verification_resend_failed_title', { defaultValue: "Couldn't send that" }),
        error?.message ?? t('common:try_again_later', { defaultValue: 'Please try again in a moment.' }),
      );
    } finally {
      setResendingVerification(false);
    }
  }, [resendingVerification, resendVerificationEmail, t]);

  // Firebase only learns the user tapped the emailed link after an explicit
  // reload — refresh whenever the app returns to the foreground (matching
  // Subscription.tsx's AppState pattern for Stripe checkout) so the banner
  // clears itself without the user having to do anything extra.
  React.useEffect(() => {
    if (!isSignedIn || emailVerified) return;
    const listener = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        refreshEmailVerified();
      }
    });
    return () => listener.remove();
  }, [isSignedIn, emailVerified, refreshEmailVerified]);

  // Admin-configured ad popup — GET /api/v1/ads/next (see
  // services/adsService.ts). Mirrors the existing "AI Coach feedback ready"
  // popup pattern (navigation/MainBottomTab.tsx): only shown when there's a
  // real, still-eligible ad (the backend already enforces the admin's own
  // "how many times to show" cap per user), fetched once per mount rather
  // than on every focus so revisiting the Home tab within one sitting can't
  // burn through that cap. adRef mirrors the feedbackNotifRef pattern
  // elsewhere in this codebase — lets the dismiss/tap handlers below read
  // the latest fetched ad without needing it in their own dependency arrays.
  const [pendingAd, setPendingAd] = React.useState<AdvertisementProps | null>(null);
  const adRef = React.useRef<AdvertisementProps | null>(null);
  const { visible: adVisible, show: showAd, hide: hideAd } = useModal();
  React.useEffect(() => {
    let cancelled = false;
    let cleanupInteraction: (() => void) | null = null;
    adsService.getNextAd().then(ad => {
      if (cancelled || !ad) return;
      adRef.current = ad;
      setPendingAd(ad);
      setTimeout(() => {
        if (cancelled) return;
        // BUG FIX (product report: "the pop up advert is still freezing the
        // app when it loads the homescreen"): this 1500ms timer fires
        // completely blind to whatever the user is physically doing on
        // screen at that exact moment. Android has a well-documented RN
        // issue where presenting a native `Modal` while the view underneath
        // still has an ACTIVE touch responder (e.g. a ScrollView mid-drag)
        // can leave that responder stuck — the touch stream gets cut off
        // mid-gesture with no proper "cancelled" event, so the ScrollView
        // never releases its own internal "I'm being touched" state and
        // simply stops responding to new touches afterward.
        // InteractionManager.runAfterInteractions defers the callback until
        // the JS thread reports no animations/gestures are currently in
        // flight — the standard, documented React Native pattern for
        // exactly this "don't mount something heavy while the user might be
        // mid-touch" scenario.
        const interactionHandle = InteractionManager.runAfterInteractions(() => {
          if (cancelled) return;
          showAd();
          // See OVERLAY_PRIORITY's own comment above — `requestOverlay` here
          // just reserves this screen's single overlay slot; the Modal
          // itself (see its render below) also checks
          // `activeOverlay === 'ad'` before actually going visible, so if
          // another overlay already holds the slot, the ad silently waits
          // its turn (still fetched and ready) rather than opening on top
          // of it.
          requestOverlay('ad');
        });
        cleanupInteraction = () => interactionHandle.cancel();
      }, 1500);
    }).catch(() => {
      // Offline or the request failed — no ad this session, same
      // fail-quiet behavior as checkFeedbackNotification's catch in
      // MainBottomTab.tsx.
    });
    return () => {
      cancelled = true;
      cleanupInteraction?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestOverlay]);
  // Records the impression only once the popup has ACTUALLY rendered on
  // screen (both showAd() fired AND this screen's shared overlay slot is
  // really held by 'ad', not just requested/queued behind another overlay)
  // — a fetched-but-never-actually-shown ad shouldn't burn one of its
  // limited views.
  const hasRecordedAdImpressionRef = React.useRef(false);
  React.useEffect(() => {
    if (!adVisible || activeOverlay !== 'ad' || !pendingAd) return;
    if (hasRecordedAdImpressionRef.current) return;
    hasRecordedAdImpressionRef.current = true;
    adsService.recordImpression(pendingAd.id).catch(() => { });
  }, [adVisible, activeOverlay, pendingAd]);
  const onDismissAd = React.useCallback(() => {
    hideAd();
    releaseOverlay('ad');
  }, [hideAd, releaseOverlay]);
  const onOpenAd = React.useCallback(() => {
    hideAd();
    releaseOverlay('ad');
    if (adRef.current) {
      navigate('AdDetails', { ad: adRef.current });
    }
  }, [hideAd, releaseOverlay, navigate]);

  return (
    <Container style={styles.container}>
      <HeaderHome
        name={profile?.name || t('home:default_user_name', { defaultValue: 'there' })}
        username={profile?.username}
        avatarUrl={profile?.avatarUrl}
        email={profile?.email ?? ''}
        notification={unreadCount}
      />
      <Content contentContainerStyle={styles.content} padder>
        {isSignedIn && !emailVerified ? (
          <Flex
            style={styles.verifyBanner}
            justify="flex-start"
            itemsCenter
            mb={16}>
            <Icon
              pack="eva"
              name="email-outline"
              style={[globalStyle.icon20, { tintColor: theme['text-basic-color'] }]}
            />
            <View style={[globalStyle.flexOne, styles.verifyBannerText]}>
              <Text category="h9-s" bold>
                {t('home:verify_email_title', { defaultValue: 'Verify your email' })}
              </Text>
              <Text category="h10" status="placeholder" mt={2}>
                {t('home:verify_email_body', { defaultValue: "We sent you a link — tap it, then come back here." })}
              </Text>
            </View>
            <Button
              size="tiny"
              status="warning"
              disabled={resendingVerification}
              accessoryLeft={resendingVerification ? renderCheckInSpinner : undefined}
              onPress={onResendVerification}>
              {t('home:resend', { defaultValue: 'Resend' })}
            </Button>
          </Flex>
        ) : null}

        {/* "Happy to meet you" card landing (see this file's module comment
            above for the full redesign context). Straightforward left-to-
            right linear gradient (product follow-up — was a diagonal
            corner-to-corner gradient, which read as an uneven "inner" patch
            rather than a clean fill) via GradientCard's start/end props, an
            SVG illustration (src/home/HomeHeroArt.tsx) anchored to the
            card's right side, and a real caption line, not just a bare
            title. Career Coach -> navigation/MainBottomTab.tsx's "Coach" tab
            (src/messages/MessagesScreen.tsx, repurposed as the AI Coach
            chat). Explicit {screen: 'Coach'} target (not a bare
            'MainBottomTab') is required, not optional — React Navigation
            doesn't fire a focus change (so nothing re-checks/re-renders)
            when you "navigate" to a tab that's already the active one, same
            reasoning MoreSrc.tsx's onReplayTour comment documents for the
            equivalent Home case. */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigate('MainBottomTab', { screen: 'Coach' })}>
          <GradientCard
            colors={['#0063f8', '#1DA1F2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroCard}
            contentStyle={styles.heroCardContent}>
            <View style={globalStyle.flexOne}>
              <View style={styles.heroIconWrap}>
                <Icon pack="eva" name="message-circle-outline" style={[globalStyle.icon24, styles.heroIcon]} />
              </View>
              <Text category="h6" bold style={styles.heroTitle} mt={14}>
                {t('home:career_coach_card_title', { defaultValue: 'Career Coach' })}
              </Text>
              <Text category="h9-s" style={styles.heroSubtitle} mt={4}>
                {t('home:career_coach_card_subtitle', {
                  defaultValue: 'Ask anything — interview prep, salary talk, next-step advice — get a straight answer, day or night.',
                })}
              </Text>
              <Flex justify="flex-start" itemsCenter mt={14}>
                <Text category="h10" bold style={styles.heroCta}>
                  {t('home:career_coach_card_cta', { defaultValue: 'Start chatting' })}
                </Text>
                <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, styles.heroIcon, { marginLeft: 4 }]} />
              </Flex>
            </View>
            <View style={styles.heroArtWrap}>
              <ArtCareerCoach size={92} />
            </View>
          </GradientCard>
        </TouchableOpacity>

        {/* Practice -> navigation/MainBottomTab.tsx's "Practice" tab
            (src/find/FindScreen.tsx, repurposed as the practice hub — pick
            an interview type/mode/difficulty and start a mock session). */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigate('MainBottomTab', { screen: 'Practice' })}>
          <GradientCard
            colors={['#FF9068', '#FD746C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.heroCard, styles.heroCardSecond]}
            contentStyle={styles.heroCardContent}>
            <View style={globalStyle.flexOne}>
              <View style={styles.heroIconWrap}>
                <Icon pack="eva" name="mic-outline" style={[globalStyle.icon24, styles.heroIcon]} />
              </View>
              <Text category="h6" bold style={styles.heroTitle} mt={14}>
                {t('home:practice_card_title', { defaultValue: 'Practice' })}
              </Text>
              <Text category="h9-s" style={styles.heroSubtitle} mt={4}>
                {t('home:practice_card_subtitle', {
                  defaultValue: 'Run a real mock interview with live AI feedback and sharpen your skills before it counts.',
                })}
              </Text>
              <Flex justify="flex-start" itemsCenter mt={14}>
                <Text category="h10" bold style={styles.heroCta}>
                  {t('home:practice_card_cta', { defaultValue: 'Start a session' })}
                </Text>
                <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, styles.heroIcon, { marginLeft: 4 }]} />
              </Flex>
            </View>
            <View style={styles.heroArtWrap}>
              <ArtPractice size={92} />
            </View>
          </GradientCard>
        </TouchableOpacity>

        {/* Dream Company Dashboard (product follow-up — "under the practice
            card let's have the dream company dashboard card... same size
            with the practice card but let it be a white background").
            src/more/DreamCompanies.tsx already exists and already has its
            own Pro Premium gate (see entitlements_service.require_premium
            on its backend routes) — tapping through to it and letting that
            screen enforce entitlements is the same pattern every other
            More-menu row already uses, not something this card needs to
            duplicate. */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => navigate('DreamCompanies')}>
          <View style={[styles.heroCard, styles.heroCardWhite, styles.heroCardContent]}>
            <View style={globalStyle.flexOne}>
              <View style={styles.heroIconWrapLight}>
                <Icon pack="eva" name="briefcase-outline" style={[globalStyle.icon24, { tintColor: '#0063f8' }]} />
              </View>
              <Text category="h6" bold style={styles.heroTitleDark} mt={14}>
                {t('home:dream_company_card_title', { defaultValue: 'Dream Company Dashboard' })}
              </Text>
              <Text category="h9-s" status="placeholder" mt={4}>
                {t('home:dream_company_card_subtitle', {
                  defaultValue: 'Track the employers you actually want, with AI research and prep built in.',
                })}
              </Text>
              <Flex justify="flex-start" itemsCenter mt={14}>
                <Text category="h10" bold style={styles.heroCtaDark}>
                  {t('home:dream_company_card_cta', { defaultValue: 'View dashboard' })}
                </Text>
                <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, { tintColor: '#0063f8', marginLeft: 4 }]} />
              </Flex>
            </View>
            <View style={styles.heroArtWrap}>
              <ArtDreamCompany size={92} />
            </View>
          </View>
        </TouchableOpacity>
      </Content>
      {/* Admin-configured ad popup — only rendered visible when a real,
          still-eligible ad was found (see the effect above); tapping its
          single action opens AdDetails.tsx with that ad's full write-up.
          title/body intentionally not passed — AdPopupModal no longer
          renders any caption over the ad image (product report: "I said I
          dont want captions on any ads"). */}
      {/* Each of these four `visible` props is ALSO gated on
          `activeOverlay` (see that state's own comment further up this
          file) on top of each one's own "do I want to show" flag — so even
          if two or more of their conditions are true at the same moment,
          only the one that actually holds the shared overlay slot ever
          renders its Modal as visible. */}
      <AdPopupModal
        visible={adVisible && activeOverlay === 'ad'}
        imageUrl={pendingAd?.imageUrl}
        ctaLabel={t('common:view_details', { defaultValue: 'View Details' })}
        onCta={onOpenAd}
        onDismiss={onDismissAd}
      />
      <AppTour visible={showTour && activeOverlay === 'tour'} onClose={onCloseTour} />
      <AppRatingModal
        visible={showRatingPrompt && activeOverlay === 'rating'}
        onSubmit={onSubmitRating}
        onDismiss={onDismissRating}
      />
      <DailyCheckInSheet
        visible={checkinSheet !== null && activeOverlay === 'checkin'}
        mode={checkinSheet ?? 'goal'}
        onSubmit={onSubmitCheckin}
        onDismiss={onDismissCheckin}
      />
    </Container>
  );
});

export default HomeSrc;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  verifyBanner: {
    ...globalStyle.card,
    padding: 16,
    marginTop: 16,
    // `card` carries a real soft shadow, which needs an opaque fill to
    // render correctly (especially on Android). The warning-colored border
    // stays as the "needs attention" accent on top of that opaque fill.
    backgroundColor: 'background-basic-color-2',
    borderWidth: 1,
    borderColor: 'color-warning-500',
  },
  verifyBannerText: {
    marginHorizontal: 10,
  },
  // Card landing (see this file's module comment). GradientCard already
  // supplies the shadow/rounded-corner/gradient-fill mechanics (see
  // components/GradientCard.tsx) — these just size/space the cards and lay
  // out what's inside each one. Row layout (icon/title/subtitle/CTA on the
  // left, flexOne so it never runs under the illustration; the SVG
  // illustration fixed-width on the right) rather than the original stacked
  // column — product follow-up: "place some svg illustration on the right
  // side of the cards".
  heroCard: {
    marginTop: 16,
  },
  heroCardSecond: {
    marginTop: 16,
  },
  heroCardContent: {
    padding: 20,
    minHeight: 176,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Third card (Dream Company Dashboard) — same size/shape as the two
  // gradient cards above it, opaque white/theme-adaptive fill instead of a
  // gradient (product follow-up: "let it be a white background").
  heroCardWhite: {
    ...globalStyle.card,
    backgroundColor: 'background-basic-color-2',
  },
  heroArtWrap: {
    width: 92,
    height: 92,
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same circle treatment as heroIconWrap, tinted for a white card instead
  // of a translucent-white one for a gradient card.
  heroIconWrapLight: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'color-primary-transparent-100',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: {
    tintColor: '#fff',
  },
  heroTitle: {
    color: '#fff',
  },
  heroTitleDark: {
    color: 'text-basic-color',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.85)',
  },
  heroCta: {
    color: '#fff',
    textDecorationLine: 'underline',
  },
  heroCtaDark: {
    color: '#0063f8',
  },
});
