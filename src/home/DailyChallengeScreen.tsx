import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon, Input, Spinner, TopNavigation } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import * as configService from 'services/configService';
import * as dailyChallengeService from 'services/dailyChallengeService';
import { DailyChallenge } from 'services/dailyChallengeService';
import CtaButton from 'components/CtaButton';

// Product request: "I want the 'Todays Surprise challenge' card to open on
// a new screen instead of displaying the content in that same card" — the
// expand/respond/skip flow that used to live inline inside
// DailyChallengeCard.tsx (an ever-taller Home-screen card) now lives here,
// its own dedicated screen. DailyChallengeCard.tsx is now just a preview
// row that navigates here on tap; this screen owns the actual fetch/
// submit/skip state (moved essentially unchanged from the card).
const DailyChallengeScreen = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home', 'common']);

  const [challenge, setChallenge] = React.useState<DailyChallenge | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [response, setResponse] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSkipping, setIsSkipping] = React.useState(false);
  const [, forceRerender] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => configService.subscribe(forceRerender), []);

  const load = React.useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    dailyChallengeService.getTodayChallenge()
      .then(c => setChallenge(c))
      .catch(() => {
        setLoadError(t('home:daily_challenge_load_failed', { defaultValue: "Couldn't load today's challenge." }));
      })
      .finally(() => setIsLoading(false));
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  const typeName = challenge
    ? configService.getCachedConfig().daily_challenge.types.find(tt => tt.id === challenge.challengeType)?.name
      ?? challenge.challengeType
    : '';

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
    <Container style={styles.container}>
      <TopNavigation
        title={t('home:daily_challenge_title', { defaultValue: "Today's Surprise Challenge" })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder>
        {isLoading ? (
          <Flex itemsCenter justify="center" style={styles.status}>
            <Spinner size="large" />
          </Flex>
        ) : loadError ? (
          <Flex vertical itemsCenter justify="center" style={styles.status}>
            <Text category="h9-s" status="danger" center mb={12}>
              {loadError}
            </Text>
            <CtaButton size="small" onPress={load}>
              {t('common:try_again', { defaultValue: 'Try again' }).toString()}
            </CtaButton>
          </Flex>
        ) : !challenge || challenge.skipped ? (
          <Flex vertical itemsCenter justify="center" style={styles.status}>
            <Icon pack="eva" name="gift-outline" style={[globalStyle.icon40, { tintColor: theme['text-hint-color'] }]} />
            <Text category="h9-s" status="placeholder" center mt={12}>
              {t('home:daily_challenge_none_today', { defaultValue: 'No challenge for today — check back tomorrow.' })}
            </Text>
          </Flex>
        ) : (
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

            <Text category="h9-s">{challenge.promptText}</Text>

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
            ) : (
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
            )}
          </View>
        )}
      </Content>
    </Container>
  );
});

export default DailyChallengeScreen;

const themedStyles = StyleService.create({
  container: {},
  status: {
    paddingVertical: 80,
  },
  card: {
    ...globalStyle.card,
    padding: 16,
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
