import React, { memo } from 'react';
import { TouchableOpacity } from 'react-native';
import { StyleService, useStyleSheet, Icon } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import Text from 'components/Text';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as goalTipsService from 'services/goalTipsService';
import { GoalTipProps } from 'constants/Types';

// Product request: "Daily News and daily tips banners should display at the
// top of the HomeScreen. Make sure it looks good and professional." This
// same content used to live on Home as a full padded card, then was
// deliberately removed in favor of push-notification-only delivery (see
// src/home/GoalTipDetail.tsx's own comment) -- this reintroduces it per the
// newer, explicit request, but as the compact single-row "info card" shape
// established by ContinueLearningCard.tsx/UpcomingSessionHomeCard.tsx
// rather than the old padded card, so it reads as a banner, not a
// dashboard block. Tapping through still lands on GoalTipDetail.tsx (which
// re-fetches independently, so this banner and that screen never need to
// stay in sync with each other).
//
// Ungated (no Pro/Premium check) -- goalTipsService/the backend route it
// calls have never had one, this just mirrors that. Self-hides if the user
// has no goals set (getTodayTips() returns one tip per goal, so an empty
// list here means nothing to show), same convention every other
// self-contained Home card follows.
const DailyTipsBanner = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home', 'common']);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { navigate } = navigation;

  const [tips, setTips] = React.useState<GoalTipProps[] | null>(null);

  const load = React.useCallback(() => {
    goalTipsService.getTodayTips().then(setTips).catch(() => setTips([]));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Refresh on focus, same reasoning as ContinueLearningCard.tsx -- a goal
  // added/removed on another screen (e.g. GoalsScreen) should be reflected
  // next time Home comes back into focus, not just on next cold start.
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  // BUG FIX (pre-launch i18n staleness audit): goalTipsService.getTodayTips()
  // sends `language` and comes back translated server-side, but this only
  // ever ran on mount/focus — a mid-session language switch left the tip
  // text stale until the next focus. Same i18n.on('languageChanged', ...)
  // pattern as DailyChallengeCard.tsx.
  React.useEffect(() => {
    i18n.on('languageChanged', load);
    return () => {
      i18n.off('languageChanged', load);
    };
  }, [load]);

  if (!tips || tips.length === 0) return null;
  const primary = tips[0];

  // Product request: the full "Today's tip" card is gone -- it's now a small
  // pill button at the right end of the "Today" heading (see HomeSrc.tsx),
  // still opening GoalTipDetail.
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={primary.tip}
      style={styles.pill}
      onPress={() => navigate('GoalTipDetail')}>
      <Icon pack="eva" name="bulb-outline" style={[globalStyle.icon16, { tintColor: '#f59e0b' }]} />
      <Text category="h10-s" bold numberOfLines={1} style={styles.pillText}>
        {t('home:daily_tip_banner_title', { defaultValue: "Today's tip" })}
      </Text>
    </TouchableOpacity>
  );
});

export default DailyTipsBanner;

const themedStyles = StyleService.create({
  // Same compact single-row shape as ContinueLearningCard.tsx's own `card`
  // style, so this reads as a matching banner rather than a one-off design.
  //
  // BUG FIX (product report, with screenshot: "these cards should be
  // white") — `background-basic-color-1` resolves to `#F6FAF8` (see
  // constants/theme/light.json), a faint off-white nearly indistinguishable
  // from Container's own page background at the time this fix shipped (a
  // light blue, `#F5F8FF` -- since reverted to gray, `#F0F0F0`, see
  // Container.tsx's `background-page-body` and its own comment history) —
  // the two were close enough in lightness that this card barely showed up
  // against the page at all, reading as a dull tint rather than a crisp
  // white card. `background-basic-color-2` resolves to real `#FFFFFF`, the
  // same token this app's own `heroCardWhite`/`verifyBanner` treatments
  // already used for "a card that's actually white on this page" — this
  // still matches that, and reads even more clearly against the current
  // gray page than it did against the earlier light blue.
  // Radius bumped 14 -> 20 (Google-style furnishing pass -- see
  // src/home/QuickActionGrid.tsx's own comment) to match this screen's
  // larger, softer corner language. Slightly smaller than the grid tiles'
  // own 24px since this is a much shorter single-row card.
  // White pill so it reads against the blue Today panel it sits in.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'background-basic-color-2',
  },
  pillText: {
    marginLeft: 6,
    flexShrink: 1,
  },
});
