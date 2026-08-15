import React, { memo } from 'react';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import Text from 'components/Text';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as learningService from 'services/learningService';
import { NextLessonInfo } from 'services/learningService';
import * as configService from 'services/configService';

// Product request item: "add another card in the scroll item of upcoming
// and thats the next lesson to be taken and if the user have finished all
// the curriculums then the next card that should display in place of the
// next lesson card is a card that navigates to a screen that display
// upcoming features. And the upcoming features will be configured from the
// admin dashboard." Third card in HomeSrc.tsx's "Continue & Upcoming"
// horizontal row, same self-contained/self-hiding convention as
// ContinueLearningCard.tsx and UpcomingSessionHomeCard.tsx (its row
// partners) — fetches its own data, reports whether it has anything to show
// via onVisibilityChange, and follows ContinueLearningCard's exact compact
// white-card look (icon chip + title/subtitle + chevron) since this is the
// same kind of "resume/what's next" affordance, just curriculum-directed
// instead of "wherever I last touched anything" (see
// learningService.getNextLesson()'s own doc comment for that distinction).
//
// UNLIKE its row partners, this card doesn't just render null when there's
// no next lesson — per the product ask, it falls back to an "Upcoming
// Features" teaser (admin-configured via the Upcoming Features tab in
// Admin > Config, see app_config_service.py's "upcoming_features" section)
// that navigates to src/more/UpcomingFeatures.tsx. Only renders null when
// BOTH are empty: no next lesson AND no upcoming features configured at
// all — genuinely nothing to show in either state.
const NextLessonHomeCard = memo(({ style, onVisibilityChange }: {
  style?: StyleProp<ViewStyle>;
  onVisibilityChange?: (visible: boolean) => void;
}) => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const { t } = useTranslation(['home', 'common']);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { navigate } = navigation;

  const [nextLesson, setNextLesson] = React.useState<NextLessonInfo | null>(null);
  // Read synchronously from configService's already-fetched cache (same
  // "no separate loading state needed" convention FaqScreen/AboutScreen
  // use) rather than a second network round trip just for this card.
  const [, forceRerender] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => configService.subscribe(forceRerender), []);
  const upcomingFeatures = configService.getCachedConfig().upcoming_features.items.filter(i => i.enabled);

  const load = React.useCallback(() => {
    learningService.getNextLesson().then(setNextLesson).catch(() => {});
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Refresh on focus — finishing a module elsewhere and coming back to Home
  // should reflect the new next-lesson immediately, same convention
  // ContinueLearningCard.tsx uses for its own focus listener.
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [navigation, load]);

  const hasContent = !!nextLesson || upcomingFeatures.length > 0;
  // Hooks must run unconditionally (before the early `return null` below).
  React.useEffect(() => {
    onVisibilityChange?.(hasContent);
  }, [hasContent, onVisibilityChange]);

  if (!hasContent) return null;

  const primary = nextLesson
    ? {
        icon: 'book-open-outline',
        title: nextLesson.moduleTitle || nextLesson.topic,
        subtitle: t('home:next_lesson_subtitle', {
          defaultValue: 'Module {{current}} of {{total}} · {{topic}}',
          current: nextLesson.moduleIndex + 1,
          total: nextLesson.totalModules,
          topic: nextLesson.topic,
        }),
        onPress: () =>
          navigate('CourseSession', {
            topic: nextLesson.topic,
            totalModules: nextLesson.totalModules,
            level: nextLesson.level,
          }),
      }
    : {
        icon: 'rocket-outline',
        title: t('home:upcoming_features_card_title', { defaultValue: 'Upcoming Features' }),
        subtitle: t('home:upcoming_features_card_subtitle', {
          defaultValue: 'See what the team is building next',
        }),
        onPress: () => navigate('UpcomingFeatures'),
      };

  return (
    <TouchableOpacity activeOpacity={0.8} style={[styles.card, style]} onPress={primary.onPress}>
      <View style={styles.iconWrap}>
        <Icon pack="eva" name={primary.icon} style={[globalStyle.icon16, { tintColor: '#0063f8' }]} />
      </View>
      <View style={globalStyle.flexOne}>
        <Text category="h10" bold numberOfLines={1}>
          {primary.title}
        </Text>
        <Text category="h10" status="placeholder" numberOfLines={1} mt={1}>
          {primary.subtitle}
        </Text>
      </View>
      <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
    </TouchableOpacity>
  );
});

export default NextLessonHomeCard;

const themedStyles = StyleService.create({
  // Same compact white/bordered look as ContinueLearningCard.tsx's own
  // `card` style — see that file's comment for the full history/reasoning.
  card: {
    ...globalStyle.card,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'background-basic-color-2',
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
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
