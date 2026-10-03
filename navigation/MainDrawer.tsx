import React, {memo} from 'react';
import {AppState, ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Icon, useTheme} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import Text from 'components/Text';
import BrandWordmark from 'components/BrandWordmark';
import useLayout from 'hooks/useLayout';
import UserAvatar from 'components/UserAvatar';
import ModalRequest from 'components/ModalRequest';
import useModal from 'hooks/useModal';
import {Images} from 'assets/images';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as notificationService from 'services/notificationService';
import {getMoreMenuBadges, MoreMenuBadges} from 'services/moreMenuBadgesService';
import {EKeyAsyncStorage, NotificationProps} from 'constants/Types';
import HomeStackNavigator from './HomeStackNavigator';
import FindScreen from 'src/find/FindScreen';
import MessagesNavigator from './MessagesNavigator';
import RequestsBottomNavigator from './RequestsBottomNavigator';
import MoreNavigator from './MoreNavigator';
import VerifyEmailGate from 'src/auth/VerifyEmailGate';
import ProLockGate from 'components/ProLockGate';
import LoadingIndicator from 'components/LoadingIndicator';
import {AuthContext} from '../AuthContext';
import {MainBottomTabStackParamList} from './types';
import {navigationRef} from './navigationRef';
import {DrawerProvider, useAppDrawer} from './DrawerContext';
import AppDrawerOverlay from 'components/AppDrawerOverlay';

// SYMPHONY REDESIGN: replaces the old bottom tab bar (see this file's own
// git history — the previous implementation lived at ./MainBottomTab.tsx,
// kept in the repo for reference but no longer imported anywhere) with a
// left drawer, per explicit product request: "no bottom navigations since
// this is an AI app... the drawable menu just like the one in the symphony
// screenshots... home icon, chat icon, a more icon that leads to the
// settings screen."
//
// NOT built on @react-navigation/drawer — see navigation/DrawerContext.tsx's
// own top comment for the full story: that package's last-ever v6 release
// (6.7.2) has two internal implementations, and BOTH are dead ends against
// this app's installed react-native-reanimated@~4.3.2 ("legacy" explicitly
// throws on any Reanimated 3+ install; "modern" imports
// `useAnimatedGestureHandler`, a hook Reanimated 4 removed entirely — real
// crash confirmed on-device, then confirmed structurally via grepping
// node_modules for both). Instead, this is a plain `createBottomTabNavigator`
// (the exact same, already-proven navigator type the old bottom tab bar
// used) with its own visual tab bar hidden (`tabBar={props => <BottomBar {...props} badges={badges} />}`), wrapped
// in a small custom `<DrawerProvider>` (navigation/DrawerContext.tsx) whose
// open/close state drives `<AppDrawerOverlay>` (components/AppDrawerOverlay.tsx
// — the actual sliding panel, animated with Reanimated's current,
// non-deprecated APIs only).
//
// Screen names/structure inside the tab navigator are UNCHANGED from the old
// bottom-tab version on purpose — Home/Practice/Coach/Interviews/Profile,
// same components, same gating logic. React Navigation resolves a screen
// by name by walking UP the tree the same way regardless of whether the
// containing navigator is a tab bar or a drawer, so every existing
// `navigate('MainBottomTab', {screen: 'X'})` call site (HomeSrc.tsx,
// Subscription.tsx, navigationRef.ts's push-notification cold-start
// targets, etc.) keeps working with zero changes. Only Home/Coach/Profile
// are shown as visible drawer items (relabeled Home/Chat/More per the
// product request); Practice and Interviews are still real, fully
// functional screens in this same navigator, just not in the drawer's own
// list — they're reached via new rows added to src/more/MoreSrc.tsx's
// menu instead (see that file's own comment on why).
const CoachProLockGate = () => {
  const {t} = useTranslation(['common', 'message']);
  return (
    <ProLockGate
      title={t('message:ai_coach_name', {defaultValue: 'AI Career Coach'}).toString()}
      description={t('common:coach_prolock_description', {
        defaultValue:
          'Chat with your AI coach, get personalized suggested topics, and practice salary negotiations — all on the Basic plan.',
      }).toString()}
    />
  );
};

// BUG FIX (product report: "when the app reloads it shows the subscribe to
// basic plan stuff before it loads the chat app screen even when the user
// have already subscribe to it") — root cause: AuthContext's `subscription`
// (and therefore `isPro`, which is derived from it) starts out `false`-ish
// on every cold start and is only populated by an async
// GET /billing/subscription call kicked off alongside sign-in, while
// `isSignedIn` flips true as soon as just the profile fetch resolves. The
// Coach Tab.Screen below used to switch purely on `!isPro`, which can't
// distinguish "confirmed not subscribed" from "haven't heard back yet" — so
// it rendered CoachProLockGate for the beat between those two, even for an
// already-Pro user, until the subscription fetch landed and flipped `isPro`
// to true. This neutral spinner fills that gap instead — AuthContext now
// exposes `isSubscriptionLoading` (true until the first post-sign-in
// subscription fetch settles) precisely so callers like this one don't have
// to guess from `subscription === null` alone.
const CoachLoadingGate = () => <LoadingIndicator flexOne size="large" />;

const Tab = createBottomTabNavigator<MainBottomTabStackParamList>();

// The 3 visible drawer rows (product request: "home icon, chat icon, a
// more icon"). `route` is the underlying screen name (unchanged from the
// old bottom tab bar — see this file's own top comment); `label`/`icon`
// are the drawer-facing rename. Badge is set on Jobs, Career Events, and
// More (see the `badges` prop threaded into CustomDrawerContent below) —
// same Job Alerts/Career Events/Daily Industry News/Weekly Career Report
// counts the old Menu tab icon showed, now split per-row instead of one
// aggregated number.
// Deliberately narrowed to the 3 literal routes actually offered here
// (rather than `keyof MainBottomTabStackParamList`) so onNavigate below can
// switch on `route` and get real per-screen params-shape checking from
// navigationRef.navigate's own discriminated-union typing, instead of a
// generic keyof losing that narrowing.
// SalaryNegotiation/DreamCompanies added per product request: "Add the
// Salary Negotiation and Dream Job to the drawer menu" — both are real,
// existing root-stack screens (src/practice/SalaryNegotiation.tsx,
// src/more/DreamCompanies.tsx — registered directly on AppContainer.tsx's
// root Stack.Navigator, params: undefined for both) that previously only
// had indirect entry points (WhatsNext.tsx's "Practice this live" button,
// MoreSrc.tsx's "Dream Company Dashboard" row) and no drawer row of their
// own.
// RecentInterviews added per product request: "In the drawer i want a
// link there that says recent interviews. When users click it it takes
// them to the recent interviews they just completed. Let it be under the
// chat item." Not its own screen -- lands on the real, existing "Interviews"
// tab (src/requests/RequestsSrc.tsx, hidden from the drawer's own visible
// list per this file's own top comment) with its Practice History pill
// tab pre-selected instead of the Applications tab it otherwise defaults
// to (see RequestsSrc.tsx's own initialTab param comment).
type DrawerRoute = 'Home' | 'Growth' | 'Practice' | 'Coach' | 'RecentInterviews' | 'SalaryNegotiation' | 'OfferAnalyzer' | 'CareerGrowth' | 'DreamCompanies' | 'Jobs' | 'CareerEvents' | 'Profile';
interface DrawerNavItem {
  route: DrawerRoute;
  label: string;
  icon: string;
  badge?: number;
}

// BUG FIX (product report, with screenshot: "you just gave this the app
// background what about the icons and text they are not showing" -- the
// PREVIOUS fix for "i want the drawer background to be the app background"
// read the live theme token (background-basic-color-1), which resolves
// light on a device/session in light mode -- white text/icons on that near-
// white background is what the screenshot shows, everything but the
// active-row pill invisible. Reading the *live* theme was the mistake: this
// drawer's text/icon colors below are fixed white, not theme-driven, so its
// background can't be theme-driven either without breaking in light mode.
// Fixed here as a fixed hex constant instead -- the exact value
// background-basic-color-1 resolves to in this app's dark theme
// (constants/theme/dark.json), so it's still literally "the app
// background" (same color content uses in dark mode) but no longer flips
// with the live theme setting.

interface CustomDrawerContentProps {
  activeRoute: keyof MainBottomTabStackParamList;
  onNavigate: (route: DrawerRoute) => void;
  // Product request: "I want the Career events and the jobs in the drawer
  // to have notification count badge too" -- per-item counts sourced from
  // the same GET /api/v1/more/badges call the old More screen rows used
  // (see moreMenuBadgesService.ts). Optional/undefined until the first
  // fetch resolves, same as the old menuBadgeCount this replaces.
  badges?: MoreMenuBadges;
}

const CustomDrawerContent = memo(({activeRoute, onNavigate, badges}: CustomDrawerContentProps) => {
  const {t} = useTranslation(['common']);
  const {top, bottom} = useLayout();
  const {profile, isPro, isSubscriptionLoading} = React.useContext(AuthContext);
  const theme = useTheme();
  const DRAWER_BG = theme['background-basic-color-1'];
  const DRAWER_TEXT = theme['text-basic-color'];
  const DRAWER_TEXT_MUTED = theme['text-hint-color'];
  const DRAWER_DIVIDER = theme['border-card-default'];
  const DRAWER_ACTIVE_BG = theme['background-basic-color-3'];
  const DRAWER_ACCENT = theme['text-basic-color'];

  const tabItems: DrawerNavItem[] = [
    {route: 'Home', label: t('common:tab_home', {defaultValue: 'Home'}).toString(), icon: 'home-outline'},
    {route: 'Coach', label: t('common:tab_coach', {defaultValue: 'Coach'}).toString(), icon: 'message-circle-outline'},
    {route: 'Practice', label: t('common:tab_practice', {defaultValue: 'Practice'}).toString(), icon: 'search-outline'},
    {
      route: 'Jobs',
      label: t('common:tab_jobs', {defaultValue: 'Jobs'}).toString(),
      icon: 'briefcase-outline',
      badge: badges?.jobAlertsUnreadCount || undefined,
    },
    {
      route: 'Profile',
      label: t('common:tab_more', {defaultValue: 'More'}).toString(),
      icon: 'grid-outline',
      badge:
        (badges?.dailyIndustryNewsUnread ? 1 : 0) + (badges?.weeklyCareerReportUnread ? 1 : 0) || undefined,
    },
  ];
  const shortcutItems: DrawerNavItem[] = [
    {
      route: 'RecentInterviews',
      label: t('common:drawer_recent_interviews', {defaultValue: 'Recent Interviews'}).toString(),
      icon: 'clock-outline',
    },
    {
      route: 'SalaryNegotiation',
      label: t('common:drawer_salary_negotiation', {defaultValue: 'Salary Negotiation'}).toString(),
      icon: 'swap-outline',
    },
    {
      route: 'OfferAnalyzer',
      label: t('common:drawer_offer_analyzer', {defaultValue: 'Offer Analyzer'}).toString(),
      icon: 'pie-chart-outline',
    },
    {
      route: 'CareerGrowth',
      label: t('common:drawer_career_growth', {defaultValue: 'Career Growth'}).toString(),
      icon: 'trending-up-outline',
    },
    {
      route: 'DreamCompanies',
      label: t('common:drawer_dream_company', {defaultValue: 'Dream Company'}).toString(),
      icon: 'building-outline',
    },
    {
      route: 'CareerEvents',
      label: t('common:drawer_career_events', {defaultValue: 'Career Events'}).toString(),
      icon: 'calendar-outline',
      badge: badges?.careerEventsUnreadCount || undefined,
    },
  ];
  const renderItem = (item: DrawerNavItem, isTab: boolean) => {
    const focused = isTab && activeRoute === item.route;
    return (
      <TouchableOpacity
        key={item.route + item.label}
        activeOpacity={0.7}
        onPress={() => onNavigate(item.route)}
        style={[styles.navRow, focused && {backgroundColor: DRAWER_ACTIVE_BG}]}>
        <Icon pack="eva" name={item.icon} style={[styles.navIcon, {tintColor: DRAWER_ACCENT}]} />
        <Text category="h8" bold={focused} style={[styles.navLabel, {color: DRAWER_TEXT}]}>
          {item.label}
        </Text>
        {item.badge ? (
          <View style={[styles.navBadge, {backgroundColor: DRAWER_TEXT}]}>
            <Text category="h10" bold style={{color: DRAWER_BG}}>
              {item.badge > 9 ? '9+' : item.badge}
            </Text>
          </View>
        ) : null}
        {!isSubscriptionLoading && !isPro && item.route === 'Coach' ? (
          <Icon pack="eva" name="lock-outline" style={[styles.navLockIcon, {tintColor: DRAWER_TEXT_MUTED}]} />
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.drawer, {backgroundColor: DRAWER_BG, paddingTop: top + 16, paddingBottom: bottom + 16}]}>
      {/* BUG FIX (product request: "the saveur logo should have the
          default blue background") -- was passing markColor={DRAWER_TEXT},
          which swaps in the transparent-background mark art
          (Images.logoMark) tinted solid white, i.e. no badge/background
          behind the mark at all. Dropping markColor falls back to
          BrandWordmark's real default (Images.logoBadge): the same mark
          art on its own baked-in solid blue square, matching the app icon
          everywhere else it appears (Login.tsx/VerifyEmailGate.tsx). */}
      <View style={styles.brandRow}>
        <BrandWordmark size={32} color={DRAWER_TEXT} />
      </View>

      <ScrollView style={styles.flexOne} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 12}}>
      <Text category="h10" bold style={[styles.sectionLabel, {color: DRAWER_TEXT_MUTED}]}>
        {t('common:drawer_tabs', {defaultValue: 'Tabs'}).toString()}
      </Text>
      <View style={styles.navList}>{tabItems.map(i => renderItem(i, true))}</View>
      <Text category="h10" bold style={[styles.sectionLabel, {color: DRAWER_TEXT_MUTED}]}>
        {t('common:drawer_shortcuts', {defaultValue: 'Shortcuts'}).toString()}
      </Text>
      <View style={styles.navList}>{shortcutItems.map(i => renderItem(i, false))}</View>

      </ScrollView>

      <View style={[styles.footerDivider, {borderTopColor: DRAWER_DIVIDER}]} />

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onNavigate('Profile')}
        style={styles.footerRow}>
        <UserAvatar uri={profile?.avatarUrl} name={profile?.name || 'A'} style={styles.footerAvatar} />
        <View style={styles.flexOne}>
          <Text category="h9" bold numberOfLines={1} style={{color: DRAWER_TEXT}}>
            {profile?.name || t('common:default_user_name', {defaultValue: 'My Account'})}
          </Text>
          <Text category="h10" numberOfLines={1} style={{color: DRAWER_TEXT_MUTED}}>
            {profile?.email ?? ''}
          </Text>
        </View>
        <Icon pack="eva" name="settings-2-outline" style={[styles.navIcon, {tintColor: DRAWER_TEXT_MUTED}]} />
      </TouchableOpacity>
    </View>
  );
});

const BAR_TABS: {route: keyof MainBottomTabStackParamList; key: string; label: string; icon: string}[] = [
  {route: 'Coach', key: 'tab_coach', label: 'Coach', icon: 'message-circle-outline'},
  {route: 'Practice', key: 'tab_practice', label: 'Practice', icon: 'search-outline'},
  {route: 'Interviews', key: 'tab_jobs', label: 'Jobs', icon: 'briefcase-outline'},
  {route: 'Home', key: 'tab_growth', label: 'Growth', icon: 'trending-up-outline'},
  {route: 'Profile', key: 'tab_more', label: 'More', icon: 'grid-outline'},
];

const BottomBar = memo(({state, navigation, badges}: any) => {
  const theme = useTheme();
  const {t} = useTranslation(['common']);
  const {bottom} = useLayout();
  const activeName = state.routes[state.index]?.name;
  return (
    <View pointerEvents="box-none" style={{paddingHorizontal: 20, paddingBottom: Math.max(bottom, 12), backgroundColor: 'transparent'}}>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: theme['background-basic-color-2'],
          borderRadius: 32,
          padding: 6,
          borderWidth: 1,
          borderColor: theme['border-card-default'],
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 4},
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 4,
        }}>
        {BAR_TABS.map(tab => {
          const focused = activeName === tab.route;
          const badge =
            tab.route === 'Interviews'
              ? badges?.jobAlertsUnreadCount
              : tab.route === 'Profile'
              ? (badges?.dailyIndustryNewsUnread ? 1 : 0) + (badges?.weeklyCareerReportUnread ? 1 : 0)
              : 0;
          return (
            <TouchableOpacity
              key={tab.route}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t(`common:${tab.key}`, {defaultValue: tab.label}).toString()}
              style={{
                flex: 1,
                height: 52,
                borderRadius: 26,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? theme['background-basic-color-3'] : 'transparent',
              }}
              onPress={() => navigation.navigate(tab.route)}>
              <View>
                <Icon
                  pack="eva"
                  name={tab.icon}
                  style={{width: 24, height: 24, tintColor: theme['text-basic-color']}}
                />
                {badge ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -4,
                      width: 9,
                      height: 9,
                      borderRadius: 5,
                      backgroundColor: theme['text-basic-color'],
                    }}
                  />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const MainDrawerContent = memo(() => {
  const {isSignedIn, emailVerified, isPro, isSubscriptionLoading} = React.useContext(AuthContext);
  const {visible, show, hide} = useModal();
  const {t} = useTranslation(['common']);
  const {isOpen, close} = useAppDrawer();
  // Same "an unverified user can't use practice/coach/interview tools, but
  // Profile/More always stays reachable" gate the old bottom tab bar
  // enforced — see VerifyEmailGate.tsx.
  const isGated = isSignedIn && !emailVerified;

  // Same first-run-Home-then-always-Coach resolution the old bottom tab
  // bar used (product request: "the AI career coach should be the
  // entering point anytime users open the app... except the very first
  // time"). Unchanged logic, just relocated from MainBottomTab.tsx.
  const [initialTab, setInitialTab] = React.useState<'Home' | 'Coach' | null>(null);
  React.useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const openedBefore = await AsyncStorage.getItem(EKeyAsyncStorage.hasOpenedAppOnce);
        if (!openedBefore) {
          AsyncStorage.setItem(EKeyAsyncStorage.hasOpenedAppOnce, '1').catch(() => {});
          if (!cancelled) setInitialTab('Home');
          return;
        }
        if (!cancelled) setInitialTab('Coach');
      } catch {
        if (!cancelled) setInitialTab('Home');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  // Tracks which top-level screen is currently focused, for the custom
  // drawer's own active-row highlight. Previously read straight off
  // react-navigation's own DrawerContentComponentProps.state (the drawer
  // content was a child of the Drawer.Navigator, with that state handed to
  // it automatically) — now that the drawer content renders as a sibling
  // overlay instead of a nested drawer screen (see this file's top
  // comment), there's no such props object to read, so each Tab.Screen's
  // own `focus` listener below updates this directly. Safe to seed from
  // `initialTab` since this component doesn't mount until initialTab has
  // resolved for a signed-in user (see the `if (isSignedIn && !initialTab)`
  // guard below) — for a signed-out user it's simply unused (no drawer to
  // show).
  const [activeTab, setActiveTab] = React.useState<keyof MainBottomTabStackParamList>(initialTab ?? 'Home');

  const onNavigate = React.useCallback(
    (route: DrawerRoute) => {
      if (route === 'Practice') {
        navigationRef.navigate('MainBottomTab', {screen: 'Practice'});
      } else if (route === 'Home' || route === 'Growth') {
        navigationRef.navigate('MainBottomTab', {screen: 'Home'});
      } else if (route === 'Coach') {
        navigationRef.navigate('MainBottomTab', {screen: 'Coach', params: undefined});
      } else if (route === 'RecentInterviews') {
        navigationRef.navigate('MainBottomTab', {
          screen: 'Interviews',
          params: {screen: 'RequestsSrc', params: {initialTab: 1}},
        });
      } else if (route === 'SalaryNegotiation') {
        navigationRef.navigate('SalaryNegotiation');
      } else if (route === 'OfferAnalyzer') {
        navigationRef.navigate('OfferAnalyzer');
      } else if (route === 'CareerGrowth') {
        navigationRef.navigate('CareerGrowth');
      } else if (route === 'DreamCompanies') {
        navigationRef.navigate('DreamCompanies');
      } else if (route === 'Jobs') {
        navigationRef.navigate('JobAlerts');
      } else if (route === 'CareerEvents') {
        navigationRef.navigate('NetworkingAssistant');
      } else {
        navigationRef.navigate('MainBottomTab', {screen: 'Profile', params: {screen: 'MoreSrc'}});
      }
      // The library-based drawer used to auto-close itself as part of its
      // own internal navigate() handling — our overlay has no such built-in
      // behavior, so closing after navigating has to be explicit here.
      close();
    },
    [close],
  );

  // Feedback-ready popup — used to trigger off the "Interviews" bottom-tab
  // icon becoming focused (see the old MainBottomTab.tsx's ButtonTab). Now
  // that Interviews is a hidden (non-drawer-listed) screen reached from
  // More's menu instead of a visible tab icon, the trigger stays on that
  // screen's own `listeners.focus` below — screen focus events fire the
  // same way regardless of whether a screen has a visible nav icon, so
  // this is unchanged behavior.
  const [feedbackNotif, setFeedbackNotif] = React.useState<NotificationProps | null>(null);
  const checkFeedbackNotification = React.useCallback(async () => {
    try {
      const notifications = await notificationService.listNotifications();
      const unread = notifications.find(n => n.type === 'feedback_ready' && !n.read) ?? null;
      setFeedbackNotif(unread);
      if (unread) {
        setTimeout(() => show(), 1200);
      }
    } catch {
      setFeedbackNotif(null);
    }
  }, [show]);

  const onDismissFeedbackNotif = React.useCallback(() => {
    hide();
    if (feedbackNotif) {
      notificationService.markNotificationsRead([feedbackNotif.id]).catch(() => {});
      setFeedbackNotif(null);
    }
  }, [hide, feedbackNotif]);

  // BUG FIX: this used to collapse Job Alerts/Career Events/Daily Industry
  // News/Weekly Career Report into one aggregated number (menuBadgeCount)
  // that was never actually attached to any drawer row -- a leftover from
  // before the drawer redesign that computed a badge count with nowhere to
  // render it. Product request ("I want the Career events and the jobs in
  // the drawer to have notification count badge too") now needs the
  // individual counts, not just a total, so this keeps the full
  // MoreMenuBadges object and hands it to CustomDrawerContent, which reads
  // each field it needs per-row (see the `items` array above).
  const [badges, setBadges] = React.useState<MoreMenuBadges | undefined>(undefined);
  const refreshMenuBadges = React.useCallback(async () => {
    setBadges(await getMoreMenuBadges());
  }, []);
  React.useEffect(() => {
    refreshMenuBadges();
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') refreshMenuBadges();
    });
    return () => subscription.remove();
  }, [refreshMenuBadges]);

  if (isSignedIn && !initialTab) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Tab.Navigator
        initialRouteName={initialTab ?? 'Home'}
        // No built-in tab bar at all — each of the 3 visible root screens
        // (HomeSrc, Chat, MoreSrc) renders its own header with its own
        // DrawerMenuButton (see that component's own comment) to open the
        // custom overlay drawer rendered below instead.
        tabBar={props => <BottomBar {...props} badges={badges} />}
        screenOptions={{headerShown: false}}>
        <Tab.Screen
          name="Home"
          component={isGated ? VerifyEmailGate : HomeStackNavigator}
          listeners={{focus: () => setActiveTab('Home')}}
        />
        <Tab.Screen
          name="Coach"
          component={
            isGated
              ? VerifyEmailGate
              : isSubscriptionLoading
              ? CoachLoadingGate
              : !isPro
              ? CoachProLockGate
              : MessagesNavigator
          }
          listeners={{focus: () => setActiveTab('Coach')}}
        />
        {/* Hidden from the drawer's own visible list (see
            CustomDrawerContent above, which only ever renders Home/Coach/
            Profile) but still fully real, functional screens — reached via
            src/more/MoreSrc.tsx's "Practice Interviews"/"Applications"
            rows now that there's no bottom tab bar to put them on. */}
        <Tab.Screen
          name="Practice"
          component={isGated ? VerifyEmailGate : FindScreen}
          listeners={{focus: () => setActiveTab('Practice')}}
        />
        <Tab.Screen
          name="Interviews"
          component={isGated ? VerifyEmailGate : RequestsBottomNavigator}
          listeners={{
            focus: () => {
              setActiveTab('Interviews');
              checkFeedbackNotification();
            },
          }}
        />
        <Tab.Screen
          name="Profile"
          component={MoreNavigator}
          listeners={{
            focus: () => setActiveTab('Profile'),
            blur: () => refreshMenuBadges(),
          }}
        />
      </Tab.Navigator>
      <AppDrawerOverlay visible={isOpen} onRequestClose={close}>
        <CustomDrawerContent activeRoute={activeTab} onNavigate={onNavigate} badges={badges} />
      </AppDrawerOverlay>
      <ModalRequest
        visible={visible}
        show={show}
        name={feedbackNotif?.title ?? t('common:default_coach_name', {defaultValue: 'Your AI Coach'})}
        avatar={Images.logoBadge}
        isOnl={true}
        onDetails={onDismissFeedbackNotif}
        hide={onDismissFeedbackNotif}
        message={feedbackNotif?.message}
      />
    </View>
  );
});

const MainDrawer = memo(() => (
  <DrawerProvider>
    <MainDrawerContent />
  </DrawerProvider>
));

export default MainDrawer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  drawer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  brandRow: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  navList: {
    marginTop: 4,
    marginBottom: 12,
  },
  sectionLabel: {
    marginTop: 8,
    paddingHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  navIcon: {
    width: 22,
    height: 22,
    marginRight: 14,
  },
  navLabel: {
    flex: 1,
  },
  navBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLockIcon: {
    width: 16,
    height: 16,
    marginLeft: 8,
  },
  footerDivider: {
    borderTopWidth: 1,
    marginTop: 8,
    marginBottom: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  footerAvatar: {
    marginRight: 12,
  },
  flexOne: {
    flex: 1,
  },
});
