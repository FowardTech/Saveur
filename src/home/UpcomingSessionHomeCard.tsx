import React, { memo } from 'react';
import { Alert, StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import { StyleService, useStyleSheet, Icon } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';

import Text from 'components/Text';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as scheduledInterviewService from 'services/scheduledInterviewService';
import { getInterviewTypeLabel } from 'utils/interviewTypeLabels';
import { SkeletonHomeCardRow } from 'components/Skeleton';

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
  // Product request: "I want skeleton loader in app" — see
  // ContinueLearningCard.tsx's identical addition (its row partner here)
  // for the full reasoning: without this, a user with a real scheduled
  // session still saw a blank gap for the entire round trip before this
  // card popped in.
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    return scheduledInterviewService.listUpcoming()
      .then(list => setNextSession(list[0]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      scheduledInterviewService.listUpcoming().then(list => {
        if (!cancelled) setNextSession(list[0]);
      }).finally(() => {
        if (!cancelled) setLoading(false);
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

  // Product report: "The upcoming interview should not navigate anywhere
  // until the date of the session reaches." This card used to navigate
  // straight into MockInterviewSetup the instant it was tapped, any time
  // before the scheduled moment — letting someone start the "scheduled"
  // interview early defeats the point of scheduling it for a specific
  // time (e.g. a mock interview meant to simulate a real one at a set
  // time). Gated on the actual scheduled instant (not just the calendar
  // date) — `scheduledAt` is a precise timestamp, and comparing at
  // day-granularity would let someone jump in hours early on the
  // scheduled day itself.
  const isSessionReady = !!nextSession && Date.now() >= nextSession.scheduledAt;

  const onPress = () => {
    if (!nextSession) return;
    if (!isSessionReady) {
      Alert.alert(
        t('home:upcoming_session_not_ready_title', { defaultValue: 'Not quite time yet' }),
        t('home:upcoming_session_not_ready_body', {
          defaultValue: 'This session unlocks at {{time}}.',
          time: new Date(nextSession.scheduledAt).toLocaleString(i18n.language, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }),
        }),
      );
      return;
    }
    navigate('MockInterviewSetup', {
      interviewType: nextSession.interviewType,
      mode: nextSession.mode,
      difficulty: nextSession.difficulty,
      role: nextSession.role,
      company: nextSession.company,
      durationMin: nextSession.durationMin,
    });
  };

  // Product report: "User should be able to delete an upcoming interview
  // session if they want to." Same confirm-then-optimistically-remove
  // flow DreamCompanies.tsx's own delete button already uses — clears the
  // card immediately (removeScheduled always clears the local cache even
  // if the network call fails), re-syncing from the server only if the
  // delete actually failed, so a real failure doesn't leave a card the
  // user already dismissed silently reappearing without explanation.
  const onDelete = () => {
    if (!nextSession) return;
    const id = nextSession.id;
    Alert.alert(
      t('home:upcoming_session_delete_confirm_title', { defaultValue: 'Cancel this session?' }),
      t('home:upcoming_session_delete_confirm_body', { defaultValue: 'You can always schedule a new one later.' }),
      [
        { text: t('common:cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common:delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: async () => {
            setNextSession(undefined);
            try {
              await scheduledInterviewService.removeScheduled(id);
              load();
            } catch {
              load(); // resync if the delete actually failed server-side
            }
          },
        },
      ],
    );
  };

  if (loading) return <SkeletonHomeCardRow style={style} />;
  if (!nextSession) return null;

  return (
    <TouchableOpacity activeOpacity={0.8} style={[styles.card, style]} onPress={onPress}>
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
      {/* Not-ready-yet indicator (see isSessionReady's own comment) — a
          locked padlock in place of the usual "go" arrow, so the card
          visually signals it isn't tappable-through yet before the user
          even taps it and hits the alert. */}
      <Icon
        pack="eva"
        name={isSessionReady ? 'arrow-forward-outline' : 'lock-outline'}
        style={[globalStyle.icon16, { tintColor: '#fff' }]}
      />
      {/* Delete button — a small translucent-white circle overlaid on the
          card's top-right corner (same "chip against a solid color fill"
          treatment as iconWrap below) rather than a third icon squeezed
          into the already-compact main row, and separate from the main
          onPress so tapping it never also triggers navigation/the
          not-ready alert. */}
      <TouchableOpacity
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={onDelete}
        style={styles.deleteButton}>
        <Icon pack="eva" name="close-outline" style={[globalStyle.icon16, { tintColor: '#fff' }]} />
      </TouchableOpacity>
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
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 12,
    // BUG FIX (product report: "the cancel icon... is not visible... some
    // part of it is cut out", round 3) -- plain paddingHorizontal: 12
    // let the trailing status icon (arrow/lock) sit flush against the same
    // top-right corner the absolutely-positioned deleteButton overlays,
    // so the two visually collided/overlapped instead of the delete
    // button ever actually being its own clean, cut-out-free chip.
    // paddingRight bumped to 34 so the row's real flex content (including
    // that trailing icon) stops well clear of deleteButton's own
    // reserved corner (see that style's own comment for its exact
    // position/size) -- horizontal separation alone is enough to keep
    // them from ever overlapping, regardless of either one's vertical
    // position within the row.
    paddingRight: 34,
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
  // Delete button — see the "User should be able to delete an upcoming
  // interview session" comment at the call site. Sits inside the card's
  // own top-right corner rather than sitting inline in the row.
  // BUG FIX (product report: "the cancel icon on the upcoming session
  // card... is not visible well enough") -- was a translucent WHITE circle
  // (rgba(255,255,255,0.25)) behind a solid white glyph, which barely
  // differs in tone from its own backdrop and reads as a faint smudge
  // rather than a clear tap target against the card's blue fill. A
  // translucent BLACK circle behind the same white glyph gives real
  // contrast against both the icon on top of it and the blue card behind
  // it, plus a thin white ring (borderWidth/borderColor below) so the
  // whole chip stays legible even in the lightest corner of the card's
  // fill.
  // BUG FIX, round 2 (product report: "still not visible some part of it
  // is cut out") -- the circle used to be overlaid HALF-OUTSIDE the card
  // (top: -7, right: -7), poking past the card's own bounds. This card is
  // one of three sitting inside a horizontal ScrollView on Home
  // (HomeSrc.tsx's "Continue & Upcoming" row) -- a horizontal ScrollView
  // clips its content to its own frame on the perpendicular (vertical)
  // axis, so that negative top offset was getting sliced off by the
  // ScrollView's own top edge rather than actually rendering above the
  // card. Moved fully INSIDE the card's own padding box (top/right: 6,
  // both positive) so it can never be clipped by any scroll container
  // regardless of layout, at the cost of sitting a little further from
  // the literal corner.
  deleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    // borderWidth: 1,
    // borderColor: 'rgba(255,255,255,0.5)',
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
