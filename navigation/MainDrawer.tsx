import React, {memo} from 'react';
import {AppState, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Icon} from '@ui-kitten/components';
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
import {getMoreMenuBadges} from 'services/moreMenuBadgesService';
import {EKeyAsyncStorage, NotificationProps} from 'constants/Types';
import HomeStackNavigator from './HomeStackNavigator';
import FindScreen from 'src/find/FindScreen';
import MessagesNavigator from './MessagesNavigator';
import RequestsBottomNavigator from './RequestsBottomNavigator';
import MoreNavigator from './MoreNavigator';
import VerifyEmailGate from 'src/auth/VerifyEmailGate';
import ProLockGate from 'components/ProLockGate';
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
// used) with its own visual tab bar hidden (`tabBar={() => null}`), wrapped
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

const Tab = createBottomTabNavigator<MainBottomTabStackParamList>();

// The 3 visible drawer rows (product request: "home icon, chat icon, a
// more icon"). `route` is the underlying screen name (unchanged from the
// old bottom tab bar — see this file's own top comment); `label`/`icon`
// are the drawer-facing rename. Badge is only ever set on "More" (see
// menuBadgeCount below), same aggregated Job Alerts/Career Events/Daily
// Industry News/Weekly Career Report count the old Menu tab icon showed.
// Deliberately narrowed to the 3 literal routes actually offered here
// (rather than `keyof MainBottomTabStackParamList`) so onNavigate below can
// switch on `route` and get real per-screen params-shape checking from
// navigationRef.navigate's own discriminated-union typing, instead of a
// generic keyof losing that narrowing.
type DrawerRoute = 'Home' | 'Coach' | 'Profile';
interface DrawerNavItem {
  route: DrawerRoute;
  label: string;
  icon: string;
  badge?: number;
}

// Always-dark drawer regardless of the app's own light/dark theme setting
// — matches the Symphony reference exactly (its drawer is a fixed dark
// sidebar even though its own Settings/Home screens are light). Kept as
// plain hex literals (not theme tokens) since this is a deliberate,
// theme-independent surface, the same reasoning globalStyle.ts's
// `backdropStyle` already uses for its own fixed-dark overlay.
const DRAWER_BG = '#0B0B10';
const DRAWER_TEXT = '#FFFFFF';
const DRAWER_TEXT_MUTED = 'rgba(255,255,255,0.6)';
const DRAWER_DIVIDER = 'rgba(255,255,255,0.08)';
const DRAWER_ACTIVE_BG = 'rgba(0,99,248,0.22)';
const DRAWER_ACCENT = '#3D8BFF';

interface CustomDrawerContentProps {
  activeRoute: keyof MainBottomTabStackParamList;
  onNavigate: (route: DrawerRoute) => void;
}

const CustomDrawerContent = memo(({activeRoute, onNavigate}: CustomDrawerContentProps) => {
  const {t} = useTranslation(['common']);
  const {top, bottom} = useLayout();
  const {profile, isPro} = React.useContext(AuthContext);

  const items: DrawerNavItem[] = [
    {route: 'Home', label: t('common:tab_home', {defaultValue: 'Home'}).toString(), icon: 'home-outline'},
    {route: 'Coach', label: t('common:drawer_chat', {defaultValue: 'Chat'}).toString(), icon: 'message-circle-outline'},
    {
      route: 'Profile',
      label: t('common:drawer_more', {defaultValue: 'More'}).toString(),
      icon: 'settings-2-outline',
    },
  ];

  return (
    <View style={[styles.drawer, {backgroundColor: DRAWER_BG, paddingTop: top + 16, paddingBottom: bottom + 16}]}>
      {/* BUG FIX (product report: "you just wrote the name of the app what
          about the logo. You just wrote saveur but you did not place the
          logo beside it") -- was bare "Saveur" text, no mark at all.
          BrandWordmark already renders the real logo + wordmark together
          (used the same way on Login.tsx/VerifyEmailGate.tsx) -- `markColor`
          swaps in the transparent-background mark art (Images.logoMark)
          tinted solid white instead of its default baked-in light-gray
          badge, same "line logo on a colored surface" treatment
          AppRatingModal.tsx already uses for its own dark background. */}
      <View style={styles.brandRow}>
        <BrandWordmark size={32} color={DRAWER_TEXT} markColor={DRAWER_TEXT} />
      </View>

      <View style={styles.navList}>
        {items.map(item => {
          const focused = activeRoute === item.route;
          return (
            <TouchableOpacity
              key={item.route}
              activeOpacity={0.7}
              onPress={() => onNavigate(item.route)}
              style={[styles.navRow, focused && {backgroundColor: DRAWER_ACTIVE_BG}]}>
              <Icon
                pack="eva"
                name={item.icon}
                style={[
                  styles.navIcon,
                  {tintColor: focused ? DRAWER_ACCENT : DRAWER_TEXT_MUTED},
                ]}
              />
              <Text
                category="h8"
                bold={focused}
                style={[styles.navLabel, {color: focused ? DRAWER_TEXT : DRAWER_TEXT_MUTED}]}>
                {item.label}
              </Text>
              {item.badge ? (
                <View style={styles.navBadge}>
                  <Text category="h10" bold style={{color: DRAWER_TEXT}}>
                    {item.badge > 9 ? '9+' : item.badge}
                  </Text>
                </View>
              ) : null}
              {!isPro && item.route === 'Coach' ? (
                <Icon pack="eva" name="lock-outline" style={[styles.navLockIcon, {tintColor: DRAWER_TEXT_MUTED}]} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

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

const MainDrawerContent = memo(() => {
  const {isSignedIn, emailVerified, isPro} = React.useContext(AuthContext);
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
      if (route === 'Home') {
        navigationRef.navigate('MainBottomTab', {screen: 'Home'});
      } else if (route === 'Coach') {
        navigationRef.navigate('MainBottomTab', {screen: 'Coach', params: undefined});
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

  // Menu ("More") badge — same aggregated Job Alerts/Career Events/Daily
  // Industry News/Weekly Career Report count as before, just displayed on
  // the drawer row instead of a tab icon.
  const [menuBadgeCount, setMenuBadgeCount] = React.useState<number | undefined>(undefined);
  const refreshMenuBadges = React.useCallback(async () => {
    const badges = await getMoreMenuBadges();
    const total =
      badges.jobAlertsUnreadCount +
      badges.careerEventsUnreadCount +
      (badges.dailyIndustryNewsUnread ? 1 : 0) +
      (badges.weeklyCareerReportUnread ? 1 : 0);
    setMenuBadgeCount(total > 0 ? total : undefined);
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
        tabBar={() => null}
        screenOptions={{headerShown: false}}>
        <Tab.Screen
          name="Home"
          component={isGated ? VerifyEmailGate : HomeStackNavigator}
          listeners={{focus: () => setActiveTab('Home')}}
        />
        <Tab.Screen
          name="Coach"
          component={isGated ? VerifyEmailGate : !isPro ? CoachProLockGate : MessagesNavigator}
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
        <CustomDrawerContent activeRoute={activeTab} onNavigate={onNavigate} />
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
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  navList: {
    marginTop: 8,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 4,
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
    backgroundColor: '#3D8BFF',
  },
  navLockIcon: {
    width: 16,
    height: 16,
    marginLeft: 8,
  },
  footerDivider: {
    borderTopWidth: 1,
    marginTop: 'auto',
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
