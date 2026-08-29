import React, {memo} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {StyleService, useStyleSheet, useTheme} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import UserAvatar from 'components/UserAvatar';
import {globalStyle} from 'styles/globalStyle';
import {AuthContext} from '../../../AuthContext';
import {RootStackParamList} from 'navigation/types';

interface HeaderOptionProps {
  name: string;
  avatarUrl?: string;
  email: string;
}

// SYMPHONY REDESIGN follow-up (explicit product request, with reference
// screenshot: "This is how i said i want the settings items to look like").
// Was a single flat row (avatar/name/email + a separate edit-pencil button,
// no card, no plan info at all). Now two separate cards under their own
// section, matching the reference exactly:
//   1. A "Profile" card — avatar, name, email, edit pencil, same content as
//      before, just wrapped in a real card instead of a bare row.
//   2. A "Plan" card — current plan name + a real renewal countdown (from
//      AuthContext's own `subscription.periodEnd`, not fabricated) or a
//      free-tier nudge, with an "Upgrade" button when not already on the
//      top tier. No fabricated "credits used" bar — Saveur has no unified
//      credits system (the reference's "0 of 500 credits" concept doesn't
//      map onto anything real here), so this card only shows genuine
//      account state, same "no fabricated data" convention this app's own
//      component comments already establish elsewhere (e.g.
//      MissionHeroCard.tsx).
const HeaderMoreOption = memo(({email, avatarUrl, name}: HeaderOptionProps) => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {t} = useTranslation(['more', 'common']);
  const {subscription, isPremium} = React.useContext(AuthContext);
  // Fully-qualified nested navigate (same pattern navigationRef.ts and
  // MoreSrc.tsx's own DATA_DETAILS rows already use for reaching a screen
  // nested under the Profile tab from outside a MoreStackParamList-typed
  // navigation object) rather than the bare `navigate('Profile', {screen:
  // ...})` this used before — that only type-checked because the old code
  // asserted a MainBottomTabStackParamList navigation type; this file now
  // uses one single RootStackParamList-typed navigation object so
  // `_onUpgrade` below can reach the top-level Subscription screen too.
  const _onProfile = () => navigate('MainBottomTab', {screen: 'Profile', params: {screen: 'ProfileSrc'}});
  const _onEditProfile = () => navigate('MainBottomTab', {screen: 'Profile', params: {screen: 'EditProfile'}});
  const _onUpgrade = () => navigate('Subscription');

  const daysLeft = subscription?.periodEnd
    ? Math.max(0, Math.ceil((subscription.periodEnd - Date.now()) / 86400000))
    : null;
  const isActivePaid = subscription && subscription.tier !== 'free'
    && (subscription.status === 'active' || subscription.status === 'trialing');
  const planLabel = isActivePaid
    ? subscription?.planName || t('more:plan_default_paid', {defaultValue: 'Your Plan'})
    : t('more:plan_free', {defaultValue: 'Free Plan'});
  const planSubtext = isActivePaid && daysLeft !== null
    ? t('more:plan_renews_in_days', {defaultValue: 'Renews in {{days}}d', days: daysLeft}).toString()
    : t('more:plan_free_subtext', {defaultValue: 'Upgrade for unlimited access'}).toString();

  return (
    <>
      <Text category="h6" bold style={styles.sectionHeading}>
        {t('more:profile', {defaultValue: 'Profile'})}
      </Text>
      <View style={styles.card}>
        <Flex itemsCenter justify="flex-start" style={globalStyle.flexOne} onPress={_onProfile}>
          <UserAvatar uri={avatarUrl} name={name} style={styles.avatar} />
          <View style={globalStyle.flexOne}>
            <Text category="h8" bold numberOfLines={1}>
              {name}
            </Text>
            <Text category="h10" status={'placeholder'} numberOfLines={1} mt={2}>
              {email}
            </Text>
          </View>
        </Flex>
        <NavigationAction
          icon="edit_profile"
          status="facebook"
          onPress={_onEditProfile}
        />
      </View>

      <View style={styles.card}>
        <View style={globalStyle.flexOne}>
          <Text category="h8" bold numberOfLines={1}>
            {planLabel}
          </Text>
          <Text category="h10" status={'placeholder'} numberOfLines={1} mt={2}>
            {planSubtext}
          </Text>
        </View>
        {!isPremium ? (
          <TouchableOpacity activeOpacity={0.85} onPress={_onUpgrade} style={styles.upgradeButton}>
            <Text category="h10" bold style={{color: theme['text-control-color']}}>
              {t('more:upgrade', {defaultValue: 'Upgrade'})}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );
});

export default HeaderMoreOption;

const themedStyles = StyleService.create({
  sectionHeading: {
    marginBottom: 12,
  },
  // SYMPHONY REDESIGN follow-up (explicit product correction, with
  // reference screenshot: "I told you i want the settings items to be
  // white cards just like the screenshot i showed you. No borders and
  // reduce the border radius.") — same fix as MoreSrc.tsx's own rowCard:
  // dropped the border, radius down from the app-wide 20 to 14.
  card: {
    ...globalStyle.card,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: 'background-basic-color-2',
  },
  avatar: {
    marginRight: 14,
  },
  // SYMPHONY REDESIGN follow-up (explicit product request: "all the
  // buttons I see still has 50% rounded borders" — applies app-wide).
  // Moderate radius, same 14px as CtaButton.tsx / mapping.json's Button
  // "filled" size variants, not a full pill.
  upgradeButton: {
    backgroundColor: 'color-primary-100',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
