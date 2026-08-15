import React, { memo } from 'react';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import { StyleService, useStyleSheet, Icon } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';

import Text from 'components/Text';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as scheduledInterviewService from 'services/scheduledInterviewService';
import { getInterviewTypeLabel } from 'utils/interviewTypeLabels';

// Product request item: "the upcoming session already scheduled should be
// placed side by side with the continue learning card at the top in the
// homescreen." This is the DISPLAY half of the "Upcoming Session" block
// that used to live inline on src/practice/MyProgress.tsx's old streak
// card (the "if nextSession exists" branch) — the SCHEDULING half (the
// "+ Schedule" / "nothing scheduled yet" prompt) moved separately to the
// top of src/find/FindScreen.tsx (the Practice tab), see that file's own
// comment. Splitting these in two matches the product request exactly:
// "schedule a session" belongs where a user goes to practice, "here's
// what's already on your calendar" belongs on Home, next to the other
// compact resume-where-you-left-off card.
//
// Self-contained (fetches its own data, same convention as
// ContinueLearningCard/DailyChallengeCard) — renders null when there's
// nothing scheduled, so it's always safe to mount unconditionally.
// `style` is accepted so HomeSrc can lay this out side-by-side with
// ContinueLearningCard in a horizontal row (see HomeSrc.tsx's own comment
// at that call site for exactly how); when only one of the two has
// content, the other renders null and contributes no layout space, so this
// naturally expands to fill the row on its own.
//
// REDESIGN (product follow-up: "The upcoming session card background
// should be the default blue background and font color should be white.
// No borders") — was the same white/bordered compact row as
// ContinueLearningCard; now solid brand-blue (color-primary-500, the same
// blue this app's icon tints/CTAs already use) with white text/icons and
// no hairline border, so the two cards read as visually distinct at a
// glance now that they sit side by side.
const UpcomingSessionHomeCard = memo(({ style, onVisibilityChange }: {
  style?: StyleProp<ViewStyle>;
  // BUG FIX (product report: "the Today's Plan section in the homescreen,
  // nothing is there its empty") — same fix as ContinueLearningCard.tsx's
  // own onVisibilityChange, see that file's comment for the full story.
  onVisibilityChange?: (visible: boolean) => void;
}) => {
  const styles = useStyleSheet(themedStyles);
  // BUG FIX (product report: "the time and date in the upcoming schedule
  // need to be translated too") — this card's date/time text was never
  // missing an i18n key, it was passing `undefined` as the locale to
  // `toLocaleString`, which makes JS fall back to the *device's* system
  // locale rather than the language the user picked inside the app. Those
  // two are usually the same but very often aren't (e.g. a phone left on
  // English iOS settings while the user picked Spanish inside Saveur), so
  // this always rendered in whatever locale the OS happened to be in.
  // `i18n.language` is the same "es"/"fr"/"zh" etc. code already used
  // elsewhere in this app (see DailyChallengeCard.tsx) and is valid
  // directly as a BCP-47 locale for the Intl/toLocaleString APIs.
  const { t, i18n } = useTranslation(['home', 'find']);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();

  const [nextSession, setNextSession] = React.useState<
    Awaited<ReturnType<typeof scheduledInterviewService.listUpcoming>>[number] | undefined
  >(undefined);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      scheduledInterviewService.listUpcoming().then(list => {
        if (!cancelled) setNextSession(list[0]);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Hooks must run unconditionally (before the early `return null` below).
  React.useEffect(() => {
    onVisibilityChange?.(!!nextSession);
  }, [nextSession, onVisibilityChange]);

  if (!nextSession) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.card, style]}
      onPress={() =>
        navigate('MockInterviewSetup', {
          interviewType: nextSession.interviewType,
          mode: nextSession.mode,
          difficulty: nextSession.difficulty,
          role: nextSession.role,
          company: nextSession.company,
          durationMin: nextSession.durationMin,
        })
      }>
      <View style={styles.iconWrap}>
        <Icon pack="eva" name="calendar-outline" style={[globalStyle.icon16, { tintColor: '#fff' }]} />
      </View>
      <View style={globalStyle.flexOne}>
        <Text category="h10" bold numberOfLines={1} style={styles.titleText}>
          {getInterviewTypeLabel(nextSession.interviewType, t)}
        </Text>
        <Text category="h10" numberOfLines={1} mt={1} style={styles.subtitleText}>
          {new Date(nextSession.scheduledAt).toLocaleString(i18n.language, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, { tintColor: '#fff' }]} />
    </TouchableOpacity>
  );
});

export default UpcomingSessionHomeCard;

const themedStyles = StyleService.create({
  // Same compact single-row shape as ContinueLearningCard.tsx's own card
  // style (radius, padding, row layout), so the two still read as a
  // matching pair size/shape-wise when they sit side by side on Home.
  //
  // REDESIGN (product follow-up: "The upcoming session card background
  // should be the default blue background and font color should be
  // white. No borders") — solid color-primary-500 fill instead of the
  // white/bordered look ContinueLearningCard keeps; borderWidth explicitly
  // zeroed to cancel out globalStyle.card's own hairline border (spread
  // above) since a border reads as unnecessary/muddy on top of a solid
  // color fill.
  // Radius bumped 14 -> 20 (Google-style furnishing pass -- see
  // src/home/QuickActionGrid.tsx's own comment) to match this screen's
  // larger, softer corner language.
  card: {
    ...globalStyle.card,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'color-primary-500',
    borderWidth: 0,
  },
  // Translucent white circle (rather than the light-blue tint
  // ContinueLearningCard's matching iconWrap uses) so the icon behind it
  // still reads as a distinct "chip" against the now-solid-blue card
  // instead of nearly disappearing into it.
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  titleText: {
    color: '#fff',
  },
  // Slightly translucent white (not full-strength) so the bold white title
  // above it stays the clear visual anchor of the two, same "translucent
  // white for secondary text on a solid color fill" convention already
  // used elsewhere in this app (e.g. AddOns.tsx's colored promo cards).
  subtitleText: {
    color: 'rgba(255,255,255,0.85)',
  },
});
