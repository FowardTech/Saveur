import React, { memo } from 'react';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';
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
// ContinueLearningCard in a flex row; when only one of the two has
// content, the other renders null and contributes no layout space, so this
// naturally expands to fill the row on its own.
const UpcomingSessionHomeCard = memo(({ style }: { style?: StyleProp<ViewStyle> }) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const { t } = useTranslation(['home', 'find']);
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
        <Icon pack="eva" name="calendar-outline" style={[globalStyle.icon16, { tintColor: '#0063f8' }]} />
      </View>
      <View style={globalStyle.flexOne}>
        <Text category="h10" bold numberOfLines={1}>
          {getInterviewTypeLabel(nextSession.interviewType, t)}
        </Text>
        <Text category="h10" status="placeholder" numberOfLines={1} mt={1}>
          {new Date(nextSession.scheduledAt).toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
    </TouchableOpacity>
  );
});

export default UpcomingSessionHomeCard;

const themedStyles = StyleService.create({
  // Same compact single-row white treatment as ContinueLearningCard.tsx's
  // own card style, so the two read as a matching pair when they sit
  // side by side on Home.
  card: {
    ...globalStyle.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'background-basic-color-1',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'color-primary-transparent-100',
  },
});
