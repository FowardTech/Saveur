import React, { memo } from 'react';
import { Pressable, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Flex from 'components/Flex';
import CircularProgress from 'components/CircularProgress';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import { EKeyAsyncStorage, accountScopedKey } from 'constants/Types';
import { AuthContext } from '../../AuthContext';
import { CoachReadiness, ReadinessStep } from 'hooks/useCoachReadiness';

// "Coach readiness" card at the very top of Home — product report: new
// users aren't told what to do first so the AI coach can give them the most
// help. Leads with the four inputs the coach actually builds its context
// from (resume, target roles/countries, career goal, Career DNA assessment —
// see hooks/useCoachReadiness.ts), shows a readiness %, and flags the first
// unfinished step as "Start here". It cannot be closed while any essential
// step is missing; once all four are done it shows a "coach is ready" row
// the user can close for good. Mirrors the web app's
// components/dashboard/GettingStartedChecklist.tsx.
export function navigateToStep(navigation: NavigationProp<RootStackParamList>, step: ReadinessStep) {
  (navigation.navigate as (...args: unknown[]) => void)(step.route, step.route === 'CareerAssessment' ? {} : undefined);
}

const CoachReadinessCard = memo(({ readiness }: { readiness: CoachReadiness }) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const { t } = useTranslation(['home', 'common']);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { profile } = React.useContext(AuthContext);
  // undefined = still reading AsyncStorage — render nothing yet (no flash).
  const [closed, setClosed] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    if (!profile) return; // not gated on profile.uid — it's never populated on mobile
    AsyncStorage.getItem(accountScopedKey(EKeyAsyncStorage.coachReadinessClosed, profile.uid))
      .then(v => setClosed(!!v))
      .catch(() => setClosed(false));
  }, [profile]);

  const onClose = React.useCallback(() => {
    setClosed(true);
    AsyncStorage.setItem(accountScopedKey(EKeyAsyncStorage.coachReadinessClosed, profile?.uid), '1').catch(() => {});
  }, [profile?.uid]);

  if (readiness.loading || closed === undefined) return null;
  const { steps, allDone, percent, next, doneCount, total } = readiness;
  // Only a COMPLETED setup can be closed away; an unfinished one always shows.
  if (allDone && closed) return null;

  return (
    <View style={styles.card}>
      <Flex justify="space-between" itemsCenter>
        <Flex itemsCenter justify="flex-start" style={globalStyle.flexOne}>
          <CircularProgress
            progress={percent}
            size={52}
            strokeWidth={6}
            color={allDone ? theme['color-success-500'] : theme['color-primary-100']}
          >
            <Text category="h9" bold>
              {`${percent}%`}
            </Text>
          </CircularProgress>
          <View style={[globalStyle.flexOne, styles.headText]}>
            <Text category="h8" bold>
              {allDone
                ? t('home:coach_readiness_done_title', { defaultValue: 'Your AI coach is ready' })
                : t('home:coach_readiness_title', { defaultValue: 'Set up your AI career coach' })}
            </Text>
            <Text category="h9-s" status="placeholder" mt={2}>
              {allDone
                ? t('home:coach_readiness_done_subtitle', {
                    defaultValue:
                      'Saveur now has what it needs to personalize your coaching, practice and recommendations.',
                  })
                : t('home:coach_readiness_subtitle', {
                    defaultValue:
                      'Complete these {{count}} steps first — your coach gives much better, more personal help once it knows you.',
                    count: total - doneCount,
                  })}
            </Text>
          </View>
        </Flex>
        {allDone && (
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, { tintColor: theme['text-hint-color'] }]} />
          </TouchableOpacity>
        )}
      </Flex>

      <View style={styles.steps}>
        {steps.map((step, i) => {
          const isNext = next?.key === step.key;
          return (
            <Pressable
              key={step.key}
              onPress={() => navigateToStep(navigation, step)}
              style={[styles.stepRow, step.done && styles.stepDone, isNext && styles.stepNext]}
            >
              <View
                style={[
                  styles.stepBadge,
                  {
                    backgroundColor: step.done
                      ? theme['color-tile-mint-bg']
                      : isNext
                        ? theme['color-primary-100']
                        : theme['background-basic-color-3'],
                  },
                ]}
              >
                {step.done ? (
                  <Icon pack="eva" name="checkmark-outline" style={{ width: 16, height: 16, tintColor: theme['color-tile-mint-text'] }} />
                ) : (
                  <Text category="h9" bold style={{ color: isNext ? '#FFFFFF' : theme['text-hint-color'] }}>
                    {String(i + 1)}
                  </Text>
                )}
              </View>
              <View style={[globalStyle.flexOne, styles.stepText]}>
                <Text category="h9" bold style={step.done ? styles.struck : undefined} status={step.done ? 'placeholder' : undefined}>
                  {step.label}
                </Text>
                {!step.done && (
                  <Text category="h10" status="placeholder" mt={2}>
                    {step.why}
                  </Text>
                )}
              </View>
              {isNext && (
                <View style={styles.startPill}>
                  <Text category="h10" bold style={styles.startPillText}>
                    {t('home:coach_readiness_start_here', { defaultValue: 'Start here' })}
                  </Text>
                </View>
              )}
              {!step.done && (
                <Icon pack="eva" name="arrow-forward-outline" style={{ width: 16, height: 16, tintColor: theme['text-hint-color'] }} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

export default CoachReadinessCard;

const themedStyles = StyleService.create({
  card: {
    ...globalStyle.card,
    borderRadius: 20,
    padding: 16,
    marginTop: 12,
    marginBottom: 16,
    backgroundColor: 'background-basic-color-2',
    borderWidth: 1,
    borderColor: 'color-primary-100',
  },
  headText: { marginLeft: 12 },
  steps: { marginTop: 14 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginTop: 8,
    backgroundColor: 'background-basic-color-1',
  },
  stepNext: { borderWidth: 1, borderColor: 'color-primary-100' },
  stepDone: { opacity: 0.75 },
  stepBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { marginLeft: 10, marginRight: 6 },
  struck: { textDecorationLine: 'line-through' },
  startPill: {
    backgroundColor: 'color-primary-100',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginRight: 8,
  },
  startPillText: { color: '#FFFFFF' },
});
