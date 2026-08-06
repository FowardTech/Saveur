import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import Text from 'components/Text';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as configService from 'services/configService';
import * as dailyChallengeService from 'services/dailyChallengeService';
import { DailyChallenge } from 'services/dailyChallengeService';

// Surprise Daily Challenge (product request item) — one unexpected practice
// challenge a day (elevator pitch, coding problem, salary negotiation,
// leadership scenario, public speaking — see saveur-backend's
// app_config_service.py "daily_challenge" section for the admin-editable
// type pool). Self-contained: owns its own fetch state so HomeSrc.tsx just
// renders <DailyChallengeCard /> and never has to know its internals.
// Renders null (not even a loading spinner) until there's something real
// to show, and again if the feature is off — this card is a bonus surface
// on an already-busy Home screen, not something worth a loading-state
// flash for.
//
// Product follow-up: "I want the 'Todays Surprise challenge' card to open
// on a new screen instead of displaying the content in that same card" —
// this used to expand in place (an <Input>, Submit/Skip row, all inline)
// growing the Home screen's tallest card even taller. Now a plain preview
// row/card — title, type badge, a one-line prompt teaser — that navigates
// to DailyChallengeScreen.tsx on tap, which owns the actual respond/skip
// flow (moved there essentially unchanged).
const DailyChallengeCard = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home', 'common']);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();

  const [challenge, setChallenge] = React.useState<DailyChallenge | null>(null);
  // BUG FIX ("the content of this refused to translate" — the type badge,
  // e.g. "Public Speaking", stayed English after a mid-session language
  // switch): the type name below reads configService.getCachedConfig()
  // directly in render, but this card never subscribed to config updates
  // the way FaqScreen/AboutScreen already do — so it kept showing
  // whatever snapshot it had at mount even after configService.ts's
  // languageChanged listener finished re-fetching the translated catalog
  // in the background. Same subscribe/forceRerender pattern as those two
  // screens.
  const [, forceRerender] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => configService.subscribe(forceRerender), []);

  const enabled = configService.isFeatureEnabled('daily_challenge');

  // SECOND BUG FIX (same report, still reproducing after the type-badge fix
  // above): the badge was only half the problem. `challenge.promptText` —
  // the actual challenge paragraph — comes from dailyChallengeService's own
  // per-user `/daily-challenge/today` fetch below, which is a *different*
  // request from the public config catalog configService subscribes to, so
  // subscribing to configService never touched it. And unlike FAQ/About/
  // configService, nothing here ever re-ran that fetch on a language
  // switch — the effect's dependency array was just `[enabled]`, so it
  // fired once at mount and then never again for the lifetime of the
  // mounted card. dailyChallengeService.getTodayChallenge() has already
  // sent `language: i18n.language` correctly this whole time (see that
  // file's own earlier bug-fix comment) — the request was always asking
  // for the right language, this card just never asked again after the
  // user switched. Listening for i18next's own 'languageChanged' event
  // directly (rather than configService's pub/sub, which is scoped to
  // config-only content) and re-running the fetch closes that gap.
  const fetchChallenge = React.useCallback(() => {
    if (!enabled) return;
    dailyChallengeService.getTodayChallenge().then(c => {
      setChallenge(c);
    }).catch(() => {
      // Best-effort — a missing daily challenge just means the card stays hidden.
    });
  }, [enabled]);

  React.useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  React.useEffect(() => {
    i18n.on('languageChanged', fetchChallenge);
    return () => {
      i18n.off('languageChanged', fetchChallenge);
    };
  }, [fetchChallenge]);

  if (!enabled || !challenge || challenge.skipped) return null;

  const typeName =
    configService.getCachedConfig().daily_challenge.types.find(tt => tt.id === challenge.challengeType)?.name
    ?? challenge.challengeType;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.card}
      onPress={() => navigate('DailyChallenge')}>
      <Flex justify="flex-start" itemsCenter mb={8}>
        <Icon pack="eva" name="gift-outline" style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]} />
        <Text category="h9" bold ml={8} style={globalStyle.flexOne}>
          {t('home:daily_challenge_title', { defaultValue: "Today's Surprise Challenge" })}
        </Text>
        <View style={[styles.typeBadge, { backgroundColor: theme['color-primary-transparent-200'] }]}>
          <Text category="h10" bold status="link">{typeName}</Text>
        </View>
      </Flex>

      <Text category="h9-s" numberOfLines={2}>
        {challenge.promptText}
      </Text>

      <Flex justify="space-between" itemsCenter mt={10}>
        <Text category="h10" bold status="link">
          {challenge.completed
            ? t('home:daily_challenge_completed', { defaultValue: '+{{xp}} XP earned', xp: challenge.xpAwarded })
            : t('home:daily_challenge_start', { defaultValue: 'Take the challenge' })}
        </Text>
        <Icon pack="assets" name="chevronRight" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
      </Flex>
    </TouchableOpacity>
  );
});

export default DailyChallengeCard;

const themedStyles = StyleService.create({
  // Radius inherited from globalStyle.card (24) — no local override.
  card: {
    ...globalStyle.card,
    padding: 16,
    marginTop: 24,
    backgroundColor: 'background-basic-color-2',
  },
  typeBadge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
});
