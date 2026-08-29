import React, {memo} from 'react';
import {Alert, TouchableOpacity, View} from 'react-native';
import {Icon, StyleService, useStyleSheet, useTheme} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Text from 'components/Text';
import Flex from 'components/Flex';
import Content from 'components/Content';
import Container from 'components/Container';
import {NavigationProp, useFocusEffect, useNavigation} from '@react-navigation/native';
import {RootStackParamList} from 'navigation/types';
import {EKeyAsyncStorage, accountScopedKey} from 'constants/Types';
import HeaderMoreOption from './components/HeaderMoreOption';
import DrawerMenuButton from 'components/DrawerMenuButton';
import ButtonOptional, { ButtonOptionalProps } from './components/ButtonOptional';
import ThemeContext from '../../ThemeContext';
import {AuthContext} from '../../AuthContext';
import * as configService from 'services/configService';
import {FeatureFlags} from 'services/configService';
import {getMoreMenuBadges, MoreMenuBadges} from 'services/moreMenuBadgesService';
import {globalStyle} from 'styles/globalStyle';

const MoreSrc = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {t} = useTranslation(['more', 'payment', 'common']);

  // Was local-only state before (a Toggle that flipped its own visual state
  // but never touched the app's actual theme) — now wired to the real
  // ThemeContext so this switch actually changes the app's light/dark theme.
  const {theme: appTheme, toggleTheme} = React.useContext(ThemeContext);
  const darkMode = appTheme === 'dark';
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const {profile, signOut, updateProfile} = React.useContext(AuthContext);

  // Unread badges for Job Alerts / Weekly Career Report / Daily Industry
  // News rows below (product request item — see services/
  // moreMenuBadgesService.ts). Refetched on every screen focus (not just
  // mount) so returning here after actually reading a job alert or opening
  // the weekly report/news screen clears the badge without needing an app
  // restart.
  const [badges, setBadges] = React.useState<MoreMenuBadges | null>(null);
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      getMoreMenuBadges().then(result => {
        if (!cancelled) setBadges(result);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Master push-notification toggle. Defaults true (matches
  // User.notifications_enabled's server-side default) so existing users who
  // haven't touched this yet see it "on" rather than misleadingly "off".
  const notificationsEnabled = profile?.notificationsEnabled ?? true;
  const [isTogglingNotifications, setIsTogglingNotifications] = React.useState(false);
  const onToggleNotifications = React.useCallback(async () => {
    if (isTogglingNotifications) return;
    setIsTogglingNotifications(true);
    try {
      await updateProfile({notificationsEnabled: !notificationsEnabled});
    } catch (error: any) {
      Alert.alert(
        t('more:notifications_toggle_failed_title', {defaultValue: "Couldn't update that"}),
        error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setIsTogglingNotifications(false);
    }
  }, [isTogglingNotifications, notificationsEnabled, updateProfile, t]);

  // There was no way to sign out anywhere in the app before this — once
  // signed in, a user was stuck signed in. signOut() clears the Firebase
  // session (AuthContext), and the explicit navigate() below sends them to
  // Login directly rather than relying on AppContainer's initialRouteName
  // logic, which only runs once at cold start, not on an in-app sign-out.
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const onLogout = React.useCallback(() => {
    Alert.alert(
      t('more:logout_confirm_title', {defaultValue: 'Log out?'}),
      t('more:logout_confirm_body', {defaultValue: "You'll need to sign back in to use the app."}),
      [
        {text: t('common:cancel', {defaultValue: 'Cancel'}), style: 'cancel'},
        {
          text: t('more:logout', {defaultValue: 'Log out'}),
          style: 'destructive',
          onPress: async () => {
            if (isSigningOut) return;
            setIsSigningOut(true);
            try {
              await signOut();
              navigate('AuthStack', {screen: 'Login'});
            } catch (error: any) {
              Alert.alert(
                t('more:logout_failed_title', {defaultValue: "Couldn't log out"}),
                error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
              );
            } finally {
              setIsSigningOut(false);
            }
          },
        },
      ],
    );
  }, [signOut, navigate, isSigningOut, t]);

  // Permanent account deletion moved to src/more/ProfileSrc.tsx (My Profile)
  // — was a plain row directly on this main Settings list, right below Log
  // out, one careless tap away from an irreversible action. Now it only
  // lives on the My Profile sub-screen, reached deliberately via the row
  // below or the avatar tap in HeaderMoreOption.

  // Removed: the "Resend welcome email" row. A user-facing resend button
  // for a one-time onboarding email didn't have a real use case once past
  // signup, and was a support/debug affordance that didn't belong in the
  // main app surface.

  // Replays the one-time "how this app works" walkthrough (components/
  // AppTour.tsx) — clears the flag it's gated on, then jumps back to Home,
  // whose useFocusEffect check re-reads that flag on every focus (not just
  // mount) specifically so this replay works without needing Home to
  // remount.
  //
  // Was `navigate('MainBottomTab')` with no target screen — that's a no-op
  // when called from here, because this row lives inside the Profile tab,
  // which IS the currently-focused screen inside MainBottomTab already.
  // React Navigation doesn't fire any focus change (and Home's
  // useFocusEffect never re-runs) when you "navigate" to a screen that's
  // already active. Explicitly targeting the Home tab forces the actual
  // tab switch, which is what made "Show app tour" look like a dead button.
  const onReplayTour = React.useCallback(async () => {
    await AsyncStorage.removeItem(accountScopedKey(EKeyAsyncStorage.appTourSeen, profile?.uid)).catch(() => {});
    navigate('MainBottomTab', {screen: 'Home'});
  }, [navigate, profile?.uid]);

  // Account & career-prep tools. `featureKey` (when present) gates the row
  // behind the admin dashboard's Feature Flags page (see
  // services/configService.ts) — flip it off there and the row disappears
  // on next app launch, no release needed. Rows with no featureKey are
  // considered core and always shown.
  // iconBackgroundColor/iconColor history: plain black glyph, no
  // background -> a colored-square badge behind each icon (iOS Settings
  // reference) with a per-row STATUS_COLORS lookup -> two rounds of
  // retinting/darkening that badge's colors -> and now, immediate product
  // follow-up: "The icons background color are still looking awful to
  // me... What if we remove the backgrounds from the icons... and give
  // the icons themselves... the ones in the menu the black color they
  // were before." Back to exactly that: every row's icon is a plain,
  // theme-adaptive black-in-light/white-in-dark glyph again, no colored
  // circle or square behind it. STATUS_COLORS is gone (it only ever
  // existed to feed that now-removed badge); every render call site below
  // passes `iconColor={ICON_GLYPH}` instead of
  // `iconBackgroundColor={STATUS_COLORS[...]}`. `status` itself is left
  // in place on each DATA_DETAILS/DATA_APPLICATION entry only because
  // ButtonOptionalProps still requires it as a field (harmless, unread by
  // anything now). ICON_BG is the same story -- every one of the ~36
  // entries below still sets `iconBackgroundColor: ICON_BG` (now an inert
  // prop, see ButtonOptional.tsx's own comment), so the constant stays
  // declared purely so those data-array literals keep compiling without a
  // separate sweep to strip every single one.
  const ICON_BG = theme['background-basic-color-2'];
  const ICON_GLYPH = theme['text-basic-color'];
  const DATA_DETAILS: (ButtonOptionalProps & {featureKey?: keyof FeatureFlags})[] = [
    {
      // Also where account deletion now lives (see ProfileSrc.tsx) — moved
      // off this main list so it isn't a single careless tap away.
      title: t('more:my_profile', {defaultValue: 'My Profile'}),
      icon: 'edit_profile',
      status: 'facebook',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      navigateSrc: 'ProfileSrc',
    },
    {
      // SYMPHONY REDESIGN (drawer nav shell): Practice used to be its own
      // bottom-tab icon (see navigation/MainBottomTab.tsx's "Practice" tab,
      // now hidden — replaced by a 3-item Home/Chat/More drawer with no
      // bottom nav at all). Every feature that isn't Home/Chat now needs
      // a real entry point somewhere inside More, so this row is that
      // entry point. Route name ('Practice') and destination (FindScreen)
      // are unchanged — it's still the same screen nested in the same
      // place in the navigation tree, just reached via this row's
      // navigate() instead of a tab press.
      title: t('more:tab_practice', {defaultValue: 'Practice Interviews'}),
      icon: 'search',
      status: 'facebook',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      // Fully-qualified nested navigate (matches onReplayTour's own
      // `navigate('MainBottomTab', {screen: 'Home'})` above) rather than a
      // bare `navigate('Practice')` -- 'Practice' isn't a RootStackParamList
      // key (it only exists inside MainBottomTabStackParamList), so the bare
      // form wouldn't type-check against this file's
      // `NavigationProp<RootStackParamList>`.
      onPress: () => navigate('MainBottomTab', {screen: 'Practice'}),
    },
    {
      // Same story as Practice above — was the "Applications" bottom tab
      // (route name "Interviews", see MainBottomTab.tsx's own comment on
      // why the route name and label differ), now only reachable from here.
      title: t('more:tab_interviews', {defaultValue: 'Applications'}),
      icon: 'bookmark',
      status: 'facebook',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      // Interviews' own nested param list has no `| undefined` (see
      // navigation/types.tsx's MainBottomTabStackParamList) -- has to be
      // given a starting nested screen, same as navigationRef.ts's own
      // `navigate('MainBottomTab', {screen: 'Interviews', params: {screen:
      // 'RequestsSrc'}})` for a "content_shared"/application-tracker push.
      onPress: () => navigate('MainBottomTab', {screen: 'Interviews', params: {screen: 'RequestsSrc'}}),
    },
    {
      // Product follow-up: Home was redesigned down to two big entry-point
      // cards (Career Coach / Practice) — everything that used to be on the
      // Home dashboard (streak/XP/check-in, week strip, continue learning,
      // daily challenge, leaderboard) now lives on this row's destination,
      // src/practice/MyProgress.tsx, alongside its own pre-existing goal/
      // roadmap/stats content. This is the new front door to all of it.
      title: t('more:my_progress', {defaultValue: 'My Progress'}),
      icon: 'increase',
      status: 'facebook',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('MyProgress'),
    },
    {
      title: t('more:resume_builder', {defaultValue: 'Resume Builder'}),
      icon: 'myPost',
      status: 'facebook',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('ResumeBuilder'),
    },
    {
      title: t('more:jd_analyzer', {defaultValue: 'JD Analyzer'}),
      icon: 'edit_full',
      status: 'twitter-3',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('JDAnalyzer'),
    },
    {
      // Was mis-navigating to MyChildren, a leftover from the pre-Saveur
      // childcare template — no real document manager screen existed yet.
      title: t('more:my-documents', {defaultValue: 'My Documents'}),
      icon: 'stats',
      status: 'warning',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('MyDocuments'),
    },
    {
      // Was a direct jump to the goal picker (ChangeCareType) — now opens
      // the fuller Goals screen first (current goal + target roles/
      // countries counts, weekly practice/application targets, streak
      // progress), which itself links into ChangeCareType for actually
      // changing the goal. See src/more/GoalsScreen.tsx.
      title: t('more:goals', {defaultValue: 'Goals'}),
      icon: 'changeJob',
      status: 'neutral',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('GoalsScreen'),
    },
    {
      // "Change it later" for the roles/countries collected once at signup
      // (SignupSecondStep) — see src/more/JobPreferences.tsx. Was previously
      // impossible to update without deleting and recreating the account.
      title: t('more:job_preferences', {defaultValue: 'Target Roles & Countries'}),
      icon: 'search',
      status: 'twitter-3',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('JobPreferences'),
    },
    {
      title: t('more:job_alerts', {defaultValue: 'Job Alerts'}),
      icon: 'notification',
      status: 'twitter',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'job_alerts',
      badgeCount: badges?.jobAlertsUnreadCount,
      onPress: () => navigate('JobAlerts'),
    },
    {
      title: t('more:learning_courses', {defaultValue: 'Learning Courses'}),
      icon: 'tutoring',
      status: 'twitter',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'learning_courses',
      onPress: () => navigate('LearningCourses'),
    },
    {
      // Product request item: "implement the ability for users to save a
      // video too" — a sub-feature of Learning Courses (the bookmark
      // toggle lives in InAppVideoPlayer.tsx), so reuses that same
      // featureKey rather than needing its own admin-togglable flag.
      title: t('more:saved_videos', {defaultValue: 'Saved Videos'}),
      icon: 'bookmark',
      status: 'twitter',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'learning_courses',
      onPress: () => navigate('SavedVideos'),
    },
    {
      title: t('more:networking_assistant', {defaultValue: 'Networking Assistant'}),
      icon: 'share',
      status: 'green',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'networking',
      // Product request: "the Networking Assistant icon in the settings
      // should have a count badge too so that users can know that new
      // events are in the networking assistant screen" — same
      // badgeCount pattern Job Alerts already uses above, backed by the
      // same GET /api/v1/more/badges call (see
      // services/moreMenuBadgesService.ts).
      badgeCount: badges?.careerEventsUnreadCount,
      onPress: () => navigate('NetworkingAssistant'),
    },
    {
      title: t('more:career_diary', {defaultValue: 'Career Diary'}),
      icon: 'calendar',
      status: 'basic',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'career_diary',
      onPress: () => navigate('CareerDiary'),
    },
    {
      title: t('more:career_roadmap', {defaultValue: 'AI Career Roadmap'}),
      icon: 'increase',
      status: 'twitter',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'career_roadmap',
      onPress: () => navigate('CareerRoadmap'),
    },
    {
      title: t('more:whats_next_title', {defaultValue: "What's Next"}),
      icon: 'dollar',
      status: 'success',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'post_offer_plan',
      onPress: () => navigate('WhatsNext'),
    },
    {
      title: t('more:refer_and_earn', {defaultValue: 'Refer & Earn'}),
      icon: 'share',
      status: 'success',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'referral_program',
      onPress: () => navigate('ReferralProgram'),
    },
    {
      title: t('more:shared_with_me', {defaultValue: 'Shared with Me'}),
      icon: 'share',
      status: 'primary',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('SharedWithMe'),
    },
    {
      title: t('more:weekly_career_report', {defaultValue: 'Weekly Career Report'}),
      icon: 'stats',
      status: 'success',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'weekly_career_report',
      badgeDot: badges?.weeklyCareerReportUnread,
      onPress: () => navigate('WeeklyCareerReport'),
    },
    {
      title: t('more:daily_industry_news', {defaultValue: 'Daily Industry News'}),
      icon: 'notification',
      status: 'twitter',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'daily_industry_news',
      badgeDot: badges?.dailyIndustryNewsUnread,
      onPress: () => navigate('DailyIndustryNews'),
    },
    {
      title: t('more:resume_evolution', {defaultValue: 'Resume Evolution'}),
      icon: 'increase',
      status: 'facebook',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'resume_evolution',
      onPress: () => navigate('ResumeVariants'),
    },
    {
      // Redownload previously generated resumes/CVs, cover letters, and
      // resume variants — see services/generatedDocumentsService.ts. No
      // featureKey: this is a plain personal document library, not an AI
      // feature with its own admin on/off toggle.
      title: t('more:generated_documents', {defaultValue: 'Generated Documents'}),
      icon: 'myPost',
      status: 'green',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('GeneratedDocuments'),
    },
    {
      title: t('more:linkedin_optimizer', {defaultValue: 'LinkedIn Optimizer'}),
      icon: 'share',
      status: 'facebook',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'linkedin_optimizer',
      onPress: () => navigate('LinkedInOptimizer'),
    },
    {
      title: t('more:emotional_coach', {defaultValue: 'Emotional Coach'}),
      icon: 'like_comment',
      status: 'success',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'emotional_coach',
      onPress: () => navigate('EmotionalCoach'),
    },
    {
      // Product report: "I think there are some of the features in the
      // company intelligence that are also in the dream company dashboard
      // (interview process, likely interview questions are in both)... its
      // better to link the company intelligence from the dream company
      // dashboard. So the company intelligence should be part of the dream
      // company dashboard instead of it being in a separate feature." No
      // longer its own row here — DreamCompanies.tsx now links to it
      // directly (see that screen's "Just researching a company?" link),
      // since the two screens show the exact same AI research (overview,
      // salary, interview process, likely questions) and having both as
      // top-level menu items made them look like duplicate features. The
      // screen/route itself is unchanged (still useful standalone: look up
      // a company without committing to track it), just reached from
      // inside the dashboard now instead of the main menu.
      title: t('more:dream_companies', {defaultValue: 'Dream Company Dashboard'}),
      icon: 'searchHistory',
      status: 'primary',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'dream_company_dashboard',
      onPress: () => navigate('DreamCompanies'),
    },
    {
      title: t('more:career_dna', {defaultValue: 'Career DNA'}),
      icon: 'increase',
      status: 'danger',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'career_dna',
      onPress: () => navigate('CareerDna'),
    },
    {
      // AI Career Twin (product decision: made Premium-only) — a working
      // backend + client service existed with no screen wired up to it at
      // all until this pass; see services/aiTwinService.ts's own comment.
      title: t('more:ai_career_twin', {defaultValue: 'AI Career Twin'}),
      icon: 'aiCareerTwin',
      status: 'success',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('AICareerTwin'),
    },
    {
      title: t('more:student_verification', {defaultValue: 'Student Package and Verification'}),
      icon: 'bgCheck',
      status: 'twitter',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'student_verification',
      onPress: () => navigate('StudentVerification'),
    },
    {
      // Paid Add-ons (product request item) — "for the coding practice and
      // system design whiteboard I want them to be in a separate screen
      // called add-ons and they should be paid for." One-time-purchase
      // catalog, independent of subscription tier — see src/more/AddOns.tsx
      // and services/billingService.ts's Addon section.
      title: t('more:addons_title', {defaultValue: 'Add-ons'}),
      icon: 'premiumAcc',
      status: 'twitter',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('AddOns'),
    },
    {
      title: t('more:subscription', {defaultValue: 'Subscription'}),
      icon: 'premiumAcc',
      status: 'success',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      // Gold "PRO" pill next to the one row that's literally "go
      // manage/buy your Pro plan" — see ButtonOptional.tsx's own comment.
      showProBadge: true,
      onPress: () => navigate('Subscription'),
    },
    {
      title: t('more:payment_methods', {defaultValue: 'Payment Methods'}),
      icon: 'payment',
      status: 'facebook',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      navigateSrc: 'PaymentMethod',
    },
    {
      title: t('more:payment_history', {defaultValue: 'Payment History'}),
      icon: 'searchHistory',
      status: 'warning',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('PaymentHistory'),
    },
    {
      // Biometric app-lock + email-code 2FA — see src/more/SecuritySettings.tsx.
      title: t('more:security', {defaultValue: 'Security'}),
      icon: 'security',
      status: 'basic',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('SecuritySettings'),
    },
  ].filter(item => !item.featureKey || configService.isFeatureEnabled(item.featureKey));
  // General / support.
  const DATA_APPLICATION: ButtonOptionalProps[] = [
    {
      title: t('more:language', {defaultValue: 'Language'}),
      icon: 'changeJob',
      status: 'basic',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('SelectLanguage'),
    },
    {
      title: t('more:about-caren'),
      icon: 'stats',
      status: 'basic',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate("AboutScreen"),
    },
    {
      title: t('more:help-&-faq'),
      icon: 'helpWhite',
      status: 'placeholder',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate("FaqScreen"),
    },
    {
      title: t('more:show_app_tour', {defaultValue: 'Show app tour'}),
      icon: 'stats',
      status: 'twitter',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: onReplayTour,
    },
    {
      // Product direction: the periodic QA rating prompt
      // (components/AppRatingModal.tsx) should be visible to "the user
      // that sent the ratings too", not just the admin dashboard.
      title: t('more:my_ratings', {defaultValue: 'My Ratings'}),
      // 'rateFull' (ic_rate_full.png) — the same star-rating icon already
      // used elsewhere in this app (HomeSrc.tsx, SalaryNegotiation.tsx).
      // 'star'/'star-outline' were tempting names but don't actually exist
      // in assets/icons/index.ts's registry (ChangeCareType/index.tsx uses
      // 'star-outline' too, which renders blank for the same reason — a
      // pre-existing bug elsewhere, not one to repeat here).
      icon: 'rateFull',
      status: 'warning',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('MyRatings'),
    },
    {
      title: t('more:privacy-of-policy'),
      icon: 'term',
      status: 'green',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate("PolicyScreen"),
    },
  ];
  return (
    // SYMPHONY REDESIGN follow-up (explicit product request: "give the
    // settings screen the same app background so that the white cards can
    // be seen"). Was forced to level="2" (solid white) by an earlier,
    // since-superseded product report ("I want the menu screen background
    // to be completely white") — that made sense back when this screen's
    // rows were a single flat list with no cards of their own, but now
    // every row IS its own white card (see rowCard's own comment above),
    // so a white screen background left them with zero contrast, exactly
    // the bug reported. Back to Container's own default now (level="3",
    // light gray in light mode / level="1" in dark mode — see
    // Container.tsx's own comment), same background every other screen in
    // the app uses, so these white cards read as raised cards again
    // instead of disappearing into the page.
    <Container style={styles.container}>
      <Content padder contentContainerStyle={styles.content}>
        {/* SYMPHONY REDESIGN follow-up (explicit product request: "move
            the menu thumbnail icon up to be on the same level with the
            greetings"). Was its own standalone row sitting above
            HeaderMoreOption with nothing beside it — the only one of the
            3 drawer root screens (Home/Chat/More) where the menu icon
            wasn't already level with a title/greeting in the same row
            (HeaderHome.tsx's greeting, Chat.tsx's TopNavigation title).
            Paired with a real screen title here now, same pattern. */}
        <Flex justify="flex-start" itemsCenter mb={16}>
          <DrawerMenuButton />
          <Text category="h5" bold ml={8}>
            {t('more:settings_title', {defaultValue: 'Settings'})}
          </Text>
        </Flex>
        <HeaderMoreOption
          name={profile?.name || t('more:default_user_name', {defaultValue: 'My Account'})}
          avatarUrl={profile?.avatarUrl}
          email={profile?.email ?? ''}
        />
        <View style={styles.details}>
          <Text category="h6" bold style={styles.sectionHeading}>
            {t('more:myDetails')}
          </Text>
          {/* SYMPHONY REDESIGN (explicit product request, with reference
              screenshots: "I want the settings screen items to be in form
              of cards just the way you see it in the symphony
              screenshot"). Each row is now its OWN separate rounded card
              with real spacing between them (see `rowCard` below), not one
              grouped section card with hairline dividers between rows —
              supersedes the "full 100% width, no border radius, no
              dividers" flat-list decision this screen's own history
              carries (see the superseded `sectionCard` comment this
              replaces), same "an explicit reskin request supersedes an
              earlier, since-superseded decision" reasoning as CtaButton.tsx's
              pill shape and MainDrawer.tsx's own history. ButtonOptional
              itself is UNCHANGED — its own transparent background just
              shows this wrapping card's white/dark fill through. */}
          {DATA_DETAILS.map((item, i) => (
            <View key={i} style={styles.rowCard}>
              <ButtonOptional
                icon={item.icon}
                title={item.title}
                status={item.status}
                iconColor={item.iconColor}
                onPress={item.onPress}
                navigateSrc={item.navigateSrc}
                badgeCount={item.badgeCount}
                badgeDot={item.badgeDot}
              />
            </View>
          ))}
        </View>
        <View style={styles.application}>
          <Text category="h6" bold style={styles.sectionHeading}>
            {t('more:application')}
          </Text>
          {DATA_APPLICATION.map((item, i) => (
            <View key={i} style={styles.rowCard}>
              <ButtonOptional
                icon={item.icon}
                title={item.title}
                status={item.status}
                iconColor={item.iconColor}
                onPress={item.onPress}
                navigateSrc={item.navigateSrc}
              />
            </View>
          ))}
          <View style={styles.rowCard}>
            <ButtonOptional
              withToggle
              icon="darkMode"
              title={t('more:switch-dark-mode')}
              status={'danger'}
              iconColor={ICON_GLYPH}
              checked={darkMode}
              onPress={toggleTheme}
              navigateSrc={undefined}
            />
          </View>
          {/* Master push-notification opt-out. Was nowhere in the app —
              once a push arrived, there was no in-app way to stop future
              ones short of disabling notifications at the OS level.
              Persisted server-side (User.notifications_enabled,
              PATCH /api/users/me) and enforced in
              app/services/push_service.py, not just a decorative local
              switch. */}
          <View style={styles.rowCard}>
            <ButtonOptional
              withToggle
              icon="notification"
              title={t('more:push_notifications', {defaultValue: 'Push Notifications'})}
              status={'facebook'}
              iconColor={ICON_GLYPH}
              checked={notificationsEnabled}
              onPress={onToggleNotifications}
              navigateSrc={undefined}
            />
          </View>
          {/* "Refer Friend & Family" used to be a separate row here, pointing
              at the old ReferFriend.tsx stub (hardcoded fake link, never
              wired to the real backend). It duplicated the actual referral
              feature, which already has its own entry above in
              DATA_DETAILS ("Refer & Earn" -> ReferralProgram.tsx) — the
              stub file, its route, and its type entries have since been
              deleted entirely rather than left registered-but-unreachable. */}
          {/* FULL RESKIN: Log out kept as its own separate card below the
              main section, matching the reference's convention of pulling
              a destructive/standalone action out of the grouped list. Uses
              a plain eva Icon rather than ButtonOptional/ButtonFill —
              those are hardcoded to the "assets" icon pack (see
              ButtonFill.tsx), which has no logout/exit glyph bundled and
              adding one means shipping new @2x/@3x image assets. eva's
              built-in icon set already has "log-out-outline", so this row
              is styled to match the others without that dependency. */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onLogout}
            disabled={isSigningOut}
            style={[
              globalStyle.card,
              styles.logoutRow,
              {opacity: isSigningOut ? 0.6 : 1},
            ]}>
            {/* REVERTED (product follow-up: "remove the backgrounds from
                the icons... the ones in the menu the black color they
                were before") — this is the one row on this screen
                rendering its own icon by hand instead of through
                ButtonOptional (see the comment above), so it needs the
                same plain-glyph-no-badge treatment applied manually to
                stay consistent with every row above it (see
                ButtonOptional.tsx's own REVERTED comment for the full
                history). */}
            <Icon
              pack="eva"
              name="log-out-outline"
              style={{width: 20, height: 20, tintColor: ICON_GLYPH}}
            />
            {/* Matches ButtonOptional.tsx's own row-label treatment -- this
                is the one row on this screen that renders its own Text
                directly instead of going through ButtonOptional (see the
                comment above), so it needs the same by-hand treatment to
                stay consistent with every row above it. Latest follow-up
                ("revert the blackness... back to normal but reduce the
                font weight"): full-strength text-basic-color again (no
                opacity), `medium` weight instead. */}
            <Text ml={16} category="para-m" medium>
              {isSigningOut
                ? t('more:logging_out', {defaultValue: 'Logging out…'})
                : t('more:logout', {defaultValue: 'Log out'})}
            </Text>
          </TouchableOpacity>
        </View>
      </Content>
    </Container>
  );
});

export default MoreSrc;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 24,
    paddingBottom: 80,
  },

  details: {
    marginBottom: 20,
  },
  application: {
    marginBottom: 16,
  },
  sectionHeading: {
    marginBottom: 12,
  },
  // SYMPHONY REDESIGN follow-up (explicit product correction, with
  // reference screenshot: "I told you i want the settings items to be
  // white cards just like the screenshot i showed you. No borders and
  // reduce the border radius."). The borderWidth/borderColor added in the
  // prior pass contradicted this app's own established "no borders on
  // cards" rule (see globalStyle.ts's own `card`/`cardBorder` history) —
  // removed. Radius knocked down from globalStyle.card's app-wide 20 to
  // 14 (same moderate radius CtaButton.tsx/mapping.json's buttons already
  // settled on this session), overriding the spread below since this is a
  // deliberately smaller radius than the shared 20px token, not a change
  // to the token itself. `overflow: hidden` keeps ButtonOptional's row
  // content from spilling past this card's own rounded corners.
  rowCard: {
    ...globalStyle.card,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: 'background-basic-color-2',
    overflow: 'hidden',
  },
  // Sign-out gets its own standalone card below the grouped list (see the
  // render call site's own comment) rather than sitting inside the
  // Application card — same rowCard shell as every other row above (no
  // border, 14px radius, same product correction as rowCard above).
  logoutRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'background-basic-color-2',
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginTop: 20,
  },
});
