import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon, Input, Spinner } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import * as configService from 'services/configService';
import * as dailyChallengeService from 'services/dailyChallengeService';
import { DailyChallenge } from 'services/dailyChallengeService';
import CtaButton from 'components/CtaButton';

// Surprise Daily Challenge (product request item) — one unexpected practice
// challenge a day (elevator pitch, coding problem, salary negotiation,
// leadership scenario, public speaking — see saveur-backend's
// app_config_service.py "daily_challenge" section for the admin-editable
// type pool). Self-contained: owns its own fetch/expand/submit/skip state
// so HomeSrc.tsx just renders <DailyChallengeCard /> and never has to know
// its internals. Renders null (not even a loading spinner) until there's
// something real to show, and again if the feature is off — this card is a
// bonus surface on an already-busy Home screen, not something worth a
// loading-state flash for.
const DailyChallengeCard = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home', 'common']);

  const [challenge, setChallenge] = React.useState<DailyChallenge | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [response, setResponse] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSkipping, setIsSkipping] = React.useState(false);

  const enabled = configService.isFeatureEnabled('daily_challenge');

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    dailyChallengeService.getTodayChallenge().then(c => {
      if (!cancelled) setChallenge(c);
    }).catch(() => {
      // Best-effort — a missing daily challenge just means the card stays hidden.
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled || !challenge || challenge.skipped) return null;

  const typeName =
    configService.getCachedConfig().daily_challenge.types.find(tt => tt.id === challenge.challengeType)?.name
    ?? challenge.challengeType;

  const onSubmit = async () => {
    if (!response.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      setChallenge(await dailyChallengeService.submitChallengeResponse(response.trim()));
    } catch {
      // Best-effort — leave the input as-is so the user can retry.
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSkip = async () => {
    if (isSkipping) return;
    setIsSkipping(true);
    try {
      setChallenge(await dailyChallengeService.skipTodayChallenge());
    } catch {
      // Best-effort.
    } finally {
      setIsSkipping(false);
    }
  };

  return (
    <View style={styles.card}>
      <Flex justify="flex-start" itemsCenter mb={8}>
        <Icon pack="eva" name="gift-outline" style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]} />
        <Text category="h9" bold ml={8} style={globalStyle.flexOne}>
          {t('home:daily_challenge_title', { defaultValue: "Today's Surprise Challenge" })}
        </Text>
        <View style={[styles.typeBadge, { backgroundColor: theme['color-primary-transparent-200'] }]}>
          <Text category="h10" bold status="link">{typeName}</Text>
        </View>
      </Flex>

      <Text category="h9-s" numberOfLines={expanded ? undefined : 3}>
        {challenge.promptText}
      </Text>

      {challenge.completed ? (
        <View style={styles.feedbackBox}>
          <Flex justify="flex-start" itemsCenter mb={6}>
            <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon16, { tintColor: theme['color-success-500'] }]} />
            <Text category="h10" bold status="success" ml={6}>
              {t('home:daily_challenge_completed', { defaultValue: '+{{xp}} XP earned', xp: challenge.xpAwarded })}
            </Text>
          </Flex>
          {challenge.aiFeedback ? <Text category="h10" status="placeholder">{challenge.aiFeedback}</Text> : null}
        </View>
      ) : expanded ? (
        <View style={{ marginTop: 12 }}>
          <Input
            placeholder={t('home:daily_challenge_response_placeholder', { defaultValue: 'Type your response…' })}
            value={response}
            onChangeText={setResponse}
            multiline
            style={styles.responseInput}
            textStyle={globalStyle.inputText}
          />
          <Flex justify="flex-start" mt={10}>
            <CtaButton
              size="small"
              disabled={!response.trim() || isSubmitting}
              onPress={onSubmit}
              style={{ marginRight: 12 }}>
              {isSubmitting ? <Spinner size="small" status="control" /> : t('home:daily_challenge_submit', { defaultValue: 'Submit' })}
            </CtaButton>
            <TouchableOpacity activeOpacity={0.7} disabled={isSkipping} onPress={onSkip}>
              <Text category="h10" bold status="placeholder">
                {isSkipping ? t('common:loading', { defaultValue: 'Loading…' }) : t('home:daily_challenge_skip', { defaultValue: 'Skip today' })}
              </Text>
            </TouchableOpacity>
          </Flex>
        </View>
      ) : (
        <TouchableOpacity activeOpacity={0.7} onPress={() => setExpanded(true)} style={{ marginTop: 10 }}>
          <Text category="h10" bold status="link">
            {t('home:daily_challenge_start', { defaultValue: 'Take the challenge' })}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

export default DailyChallengeCard;

const themedStyles = StyleService.create({
  card: {
    ...globalStyle.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    backgroundColor: 'background-basic-color-2',
  },
  typeBadge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  responseInput: {
    ...globalStyle.inputField,
    minHeight: 80,
  },
  feedbackBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'background-basic-color-3',
  },
});
