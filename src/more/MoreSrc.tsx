import React, {memo} from 'react';
import {Alert, TouchableOpacity, View} from 'react-native';
import {Icon, StyleService, useStyleSheet, useTheme} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {NavigationProp, useFocusEffect, useNavigation} from '@react-navigation/native';
import {RootStackParamList} from 'navigation/types';
import {EKeyAsyncStorage} from 'constants/Types';
import HeaderMoreOption from './components/HeaderMoreOption';
import ButtonOptional, { ButtonOptionalProps } from './components/ButtonOptional';
import ThemeContext from '../../ThemeContext';
import {AuthContext} from '../../AuthContext';
import * as configService from 'services/configService';
import {FeatureFlags} from 'services/configService';
import {getMoreMenuBadges, MoreMenuBadges} from 'services/moreMenuBadgesService';

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
    await AsyncStorage.removeItem(EKeyAsyncStorage.appTourSeen).catch(() => {});
    navigate('MainBottomTab', {screen: 'Home'});
  }, [navigate]);

  // Account & career-prep tools. `featureKey` (when present) gates the row
  // behind the admin dashboard's Feature Flags page (see
  // services/configService.ts) — flip it off there and the row disappears
  // on next app launch, no release needed. Rows with no featureKey are
  // considered core and always shown.
  // iconBackgroundColor/iconColor: per explicit follow-up request, the
  // subtle blue fill + blue glyph treatment above (history of that in the
  // superseded comment this replaced) is gone — every row's icon is now a
  // plain black (theme-adaptive) glyph with NO colored circle behind it.
  // `background-basic-color-2` is the same neutral gray already used for
  // every other card/icon-wrap surface in this app (HomeSrc.tsx's
  // statCard/badgesPreviewRow, etc.) rather than a fully transparent fill —
  // ButtonFill's container carries a real drop shadow (globalStyle.shadow)
  // that would otherwise render as a shape-less floating shadow blob on
  // Android (elevation draws from the view's bounds, not the PNG's actual
  // opaque pixels) if the circle itself were invisible. `status` is left in
  // place only because it still drives ButtonFill's tint fallback when
  // these overrides aren't passed (nothing does, currently). NOW applied to
  // the dark-mode toggle, push-notifications toggle, and logout row too
  // (previously deliberately excluded from the blue treatment; the new
  // "every icon black, no exceptions but stats" direction applies to them
  // as well — see those three below).
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
      title: t('more:career_goal', {defaultValue: 'Career Goal'}),
      icon: 'changeJob',
      status: 'neutral',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      onPress: () => navigate('ChangeCareType'),
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
      title: t('more:learning_courses', {defaultValue: 'Learning Courses'}),
      icon: 'tutoring',
      status: 'twitter',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'learning_courses',
      onPress: () => navigate('LearningCourses'),
    },
    {
      title: t('more:networking_assistant', {defaultValue: 'Networking Assistant'}),
      icon: 'share',
      status: 'green',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'networking',
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
      title: t('more:refer_and_earn', {defaultValue: 'Refer & Earn'}),
      icon: 'share',
      status: 'success',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'referral_program',
      onPress: () => navigate('ReferralProgram'),
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
      title: t('more:company_intelligence', {defaultValue: 'Company Intelligence'}),
      icon: 'searchHistory',
      status: 'warning',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
      featureKey: 'company_intelligence',
      onPress: () => navigate('CompanyIntelligence'),
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
      title: t('more:subscription', {defaultValue: 'Subscription'}),
      icon: 'premiumAcc',
      status: 'success',
      iconBackgroundColor: ICON_BG,
      iconColor: ICON_GLYPH,
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
    <Container style={styles.container}>
      <Content padder contentContainerStyle={styles.content}>
        <HeaderMoreOption
          name={profile?.name || t('more:default_user_name', {defaultValue: 'My Account'})}
          avatarUrl={profile?.avatarUrl}
          email={profile?.email ?? ''}
        />
        <View style={styles.details}>
          <Text category="h6" bold>
            {t('more:myDetails')}
          </Text>
          {DATA_DETAILS.map((item, i) => {
            return (
              <ButtonOptional
                icon={item.icon}
                title={item.title}
                status={item.status}
                iconBackgroundColor={item.iconBackgroundColor}
                iconColor={item.iconColor}
                key={i}
                onPress={item.onPress}
                navigateSrc={item.navigateSrc}
                badgeCount={item.badgeCount}
                badgeDot={item.badgeDot}
              />
            );
          })}
        </View>
        <View style={styles.application}>
          <Text category="h6" bold>
            {t('more:application')}
          </Text>
          {DATA_APPLICATION.map((item, i) => {
            return (
              <ButtonOptional
                icon={item.icon}
                title={item.title}
                status={item.status}
                iconBackgroundColor={item.iconBackgroundColor}
                iconColor={item.iconColor}
                onPress={item.onPress}
                key={i}
                navigateSrc={item.navigateSrc}
              />
            );
          })}
          <ButtonOptional
            withToggle
            icon="darkMode"
            title={t('more:switch-dark-mode')}
            status={'danger'}
            iconBackgroundColor={ICON_BG}
            iconColor={ICON_GLYPH}
            checked={darkMode}
            onPress={toggleTheme}
            navigateSrc={undefined}
          />
          {/* Master push-notification opt-out. Was nowhere in the app —
              once a push arrived, there was no in-app way to stop future
              ones short of disabling notifications at the OS level.
              Persisted server-side (User.notifications_enabled,
              PATCH /api/users/me) and enforced in
              app/services/push_service.py, not just a decorative local
              switch. */}
          <ButtonOptional
            withToggle
            icon="notification"
            title={t('more:push_notifications', {defaultValue: 'Push Notifications'})}
            status={'facebook'}
            iconBackgroundColor={ICON_BG}
            iconColor={ICON_GLYPH}
            checked={notificationsEnabled}
            onPress={onToggleNotifications}
            navigateSrc={undefined}
          />
          {/* "Refer Friend & Family" used to be a separate row here, pointing
              at the old ReferFriend.tsx stub (hardcoded fake link, never
              wired to the real backend). It duplicated the actual referral
              feature, which already has its own entry above in
              DATA_DETAILS ("Refer & Earn" -> ReferralProgram.tsx) — the
              stub file, its route, and its type entries have since been
              deleted entirely rather than left registered-but-unreachable. */}
          {/* Uses a plain eva Icon rather than ButtonOptional/ButtonFill —
              those are hardcoded to the "assets" icon pack (see
              ButtonFill.tsx), which has no logout/exit glyph bundled and
              adding one means shipping new @2x/@3x image assets. eva's
              built-in icon set already has "log-out-outline", so this row
              is styled to match the others without that dependency. */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onLogout}
            disabled={isSigningOut}
            style={[styles.logoutRow, {opacity: isSigningOut ? 0.6 : 1}]}>
            {/* Was color-danger-100 (a reddish circle) + text-primary-color
                glyph -- brought in line with every other row above: neutral
                gray circle, black glyph. */}
            <View style={[styles.logoutIconWrap, {backgroundColor: theme['background-basic-color-2']}]}>
              <Icon
                pack="eva"
                name="log-out-outline"
                style={{width: 20, height: 20, tintColor: theme['text-basic-color']}}
              />
            </View>
            <Text ml={24} category="para-m">
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
    marginBottom: 48,
  },
  application: {},
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  logoutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
