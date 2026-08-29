import React, {memo} from 'react';
import {AppState, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Icon} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';
import {
  createDrawerNavigator,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import {CommonActions} from '@react-navigation/native';

import Text from 'components/Text';
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

// SYMPHONY REDESIGN: replaces the old bottom tab bar (see this file's own
// git history — the previous implementation lived at ./MainBottomTab.tsx,
// kept in the repo for reference but no longer imported anywhere) with a
// left drawer, per explicit product request: "no bottom navigations since
// this is an AI app... the drawable menu just like the one in the symphony
// screenshots... home icon, chat icon, a more icon that leads to the
// settings screen."
//
// Screen names/structure inside this navigator are UNCHANGED from the old
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

const Drawer = createDrawerNavigator<MainBottomTabStackParamList>();

// The 3 visible drawer rows (product request: "home icon, chat icon, a
// more icon"). `route` is the underlying screen name (unchanged from the
// old bottom tab bar — see this file's own top comment); `label`/`icon`
// are the drawer-facing rename. Badge is only ever set on "More" (see
// menuBadgeCount below), same aggregated Job Alerts/Career Events/Daily
// Industry News/Weekly Career Report count the old Menu tab icon showed.
interface DrawerNavItem {
  route: keyof MainBottomTabStackParamList;
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

const CustomDrawerContent = memo((props: DrawerContentComponentProps) => {
  const {t} = useTranslation(['common']);
  const {top, bottom} = useLayout();
  const {profile, isPro} = React.useContext(AuthContext);
  const activeRouteName = props.state.routes[props.state.index]?.name;

  const items: DrawerNavItem[] = [
    {route: 'Home', label: t('common:tab_home', {defaultValue: 'Home'}).toString(), icon: 'home-outline'},
    {route: 'Coach', label: t('common:drawer_chat', {defaultValue: 'Chat'}).toString(), icon: 'message-circle-outline'},
    {
      route: 'Profile',
      label: t('common:drawer_more', {defaultValue: 'More'}).toString(),
      icon: 'settings-2-outline',
    },
  ];

  const onNavigate = (route: keyof MainBottomTabStackParamList) => {
    props.navigation.dispatch(CommonActions.navigate({name: route}));
  };

  return (
    <View style={[styles.drawer, {backgroundColor: DRAWER_BG, paddingTop: top + 16, paddingBottom: bottom + 16}]}>
      <View style={styles.brandRow}>
        <Text category="h5" bold style={{color: DRAWER_TEXT}}>
          Saveur
        </Text>
      </View>

      <View style={styles.navList}>
        {items.map(item => {
          const focused = activeRouteName === item.route;
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

const MainDrawer = memo(() => {
  const {isSignedIn, emailVerified, isPro} = React.useContext(AuthContext);
  const {visible, show, hide} = useModal();
  const {t} = useTranslation(['common']);
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

  // Feedback-ready popup — used to trigger off the "Interviews" bottom-tab
  // icon becoming focused (see the old MainBottomTab.tsx's ButtonTab). Now
  // that Interviews is a hidden (non-drawer-listed) screen reached from
  // More's menu instead of a visible tab icon, the trigger moves to a
  // `listeners.focus` callback on that Drawer.Screen definition below —
  // screen focus events fire the same way regardless of whether a screen
  // has a visible nav icon, so this is a relocation, not a behavior
  // change.
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
      <Drawer.Navigator
        initialRouteName={initialTab ?? 'Home'}
        // Drop the built-in header entirely — each of the 3 visible root
        // screens (HomeSrc, Chat, MoreSrc) renders its own header with its
        // own DrawerMenuButton to open this drawer (see that component's
        // own comment on why `navigation.dispatch(DrawerActions.
        // openDrawer())` is used there instead of relying on a
        // react-navigation-provided header button).
        screenOptions={{
          headerShown: false,
          drawerType: 'front',
          overlayColor: 'rgba(0,0,0,0.4)',
          // The root Stack navigator (AppContainer.tsx) already applies
          // TransitionPresets.SlideFromRightIOS app-wide, which enables an
          // edge-swipe "go back" PanGestureHandler on the LEFT edge of
          // every screen — the same edge this drawer wants to open from.
          // swipeEdgeWidth kept at RNGH's own default (~50px) is fine in
          // practice since that root gesture only actually fires on
          // screens with something to go back TO, but if a future report
          // says the drawer won't open via edge-swipe on some screen,
          // that stack-level gesture is the first thing to check (see
          // AppContainer.tsx's own SystemDesignWhiteboard `gestureEnabled:
          // false` override for the exact same class of conflict).
        }}
        drawerContent={props => <CustomDrawerContent {...props} />}>
        <Drawer.Screen
          name="Home"
          component={isGated ? VerifyEmailGate : HomeStackNavigator}
        />
        <Drawer.Screen
          name="Coach"
          component={isGated ? VerifyEmailGate : !isPro ? CoachProLockGate : MessagesNavigator}
        />
        {/* Hidden from the drawer's own visible list (see
            CustomDrawerContent above, which only ever renders Home/Coach/
            Profile) but still fully real, functional screens — reached via
            src/more/MoreSrc.tsx's "Practice Interviews"/"Applications"
            rows now that there's no bottom tab bar to put them on. */}
        <Drawer.Screen
          name="Practice"
          component={isGated ? VerifyEmailGate : FindScreen}
        />
        <Drawer.Screen
          name="Interviews"
          component={isGated ? VerifyEmailGate : RequestsBottomNavigator}
          listeners={{focus: () => checkFeedbackNotification()}}
        />
        <Drawer.Screen
          name="Profile"
          component={MoreNavigator}
          listeners={{blur: () => refreshMenuBadges()}}
        />
      </Drawer.Navigator>
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
