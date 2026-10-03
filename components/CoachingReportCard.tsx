import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {StyleService, useStyleSheet, useTheme, Icon} from '@ui-kitten/components';
import LinearGradient from 'react-native-linear-gradient';
import {useTranslation} from 'react-i18next';
import {useFocusEffect, useNavigation, NavigationProp} from '@react-navigation/native';

import Text from 'components/Text';
import Flex from 'components/Flex';
import {globalStyle} from 'styles/globalStyle';
import {accentTintBg} from 'utils/accentPalette';
import * as coachingReportService from 'services/coachingReportService';
import {CoachingReport} from 'services/coachingReportService';
import {RootStackParamList} from 'navigation/types';

// Mobile port of Saveur-Web's components/dashboard/CoachingReportCard.tsx
// (task #44, porting task #21 "Dashboard coaching report (Yoodli-style)"
// which only ever shipped on web). Same real backend, same 4-panel shape
// (Performing Well / Key Insights / Areas to Improve / What's Next), same
// honest empty state for a user with fewer than `minRequired` graded mock
// interviews -- see coachingReportService.ts's own header comment for the
// full endpoint contract. Self-contained like this screen's other modules
// (renders nothing while loading or on a failed fetch, same as
// ContinueWatchingCard's web counterpart).
interface Panel {
  key: keyof Pick<CoachingReport, 'performingWell' | 'keyInsights' | 'areasToImprove' | 'whatsNext'>;
  icon: string;
  color: string;
  titleKey: string;
  titleDefault: string;
}

const PANELS: Panel[] = [
  {key: 'performingWell', icon: 'checkmark-circle-2-outline', color: '#10B981', titleKey: 'home:coaching_report_performing_well', titleDefault: 'Performing Well'},
  {key: 'keyInsights', icon: 'bulb-outline', color: '#52525b', titleKey: 'home:coaching_report_key_insights', titleDefault: 'Key Insights'},
  {key: 'areasToImprove', icon: 'flag-outline', color: '#F59E0B', titleKey: 'home:coaching_report_areas_to_improve', titleDefault: 'Areas to Improve'},
  {key: 'whatsNext', icon: 'arrow-forward-outline', color: '#EC4899', titleKey: 'home:coaching_report_whats_next', titleDefault: "What's Next"},
];

const CoachingReportCard = () => {
  const {t} = useTranslation(['home', 'common']);
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const [report, setReport] = React.useState<CoachingReport | null>(null);

  // Checked on every Home focus (not just mount) so finishing a mock
  // interview and returning to Home shows the freshly-updated report
  // without needing a full app restart -- same convention this screen's
  // other focus-refreshed modules (nextSession, unreadCount) already use.
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      coachingReportService.getCoachingReport().then(r => {
        if (!cancelled) setReport(r);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (!report) return null;

  // BUG FIX (product report: "This is the design I want for the empty
  // coaching report card in the mobile app. I dont like the one currently
  // there now"): this used to render the shared, generic EmptyState block
  // (a big centered illustration + centered title/body + a plain text
  // link, same as every other "nothing here yet" screen in the app).
  // Replaced with a mobile port of Saveur-Web's own empty state for this
  // exact card (components/dashboard/CoachingReportCard.tsx) instead — a
  // left-aligned dashed-border card with a small purple icon badge, a real
  // solid CTA pill button (not a text link), and the same subtle
  // brand-to-purple gradient wash that card's non-empty state already
  // used, rather than reaching for the generic component every other
  // empty list on the app shares.
  // BUG FIX (product report, with screenshot: "The practice button is not
  // showing well. Its cut off halve way"): LinearGradient was the flex
  // container the button/text actually laid out inside -- react-native-
  // linear-gradient doesn't always report its content-driven height back
  // to Yoga reliably (a known issue with the library, worse on Android),
  // so the dashed-border outer View sometimes sized itself a beat short
  // of the button that was actually painted inside the gradient, leaving
  // the button's bottom half rendered outside/overlapping the card's own
  // boundary instead of safely inside it. Restructured so the gradient is
  // a pure absolute-fill BACKGROUND layer (StyleSheet.absoluteFillObject,
  // no children, nothing for it to lay out) behind a plain, normal-flow
  // View that actually holds the icon/title/body/button -- that plain
  // View's own height reliably drives emptyOuter's height (plain Views
  // auto-size to content correctly), and the gradient just paints
  // whatever final size Yoga settles on.
  if (report.empty) {
    return (
      <View style={styles.emptyOuter}>
        <LinearGradient
          colors={['#52525b0D', '#52525b0D', '#52525b00']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.emptyContent}>
          <View style={styles.emptyIcon}>
            <Icon pack="eva" name="bar-chart-2-outline" style={[globalStyle.icon20, {tintColor: '#52525b'}]} />
          </View>
          <Text category="h9-s" bold mt={12}>
            {t('home:coaching_report_title', {defaultValue: 'Your Coaching Report'})}
          </Text>
          <Text category="h10" status="placeholder" mt={4}>
            {t('home:coaching_report_empty_body', {
              defaultValue: 'Your coaching report is empty — complete {{count}} mock interviews to see what you’re doing well and what to work on next.',
              count: report.minRequired,
            })}
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.emptyCta, {backgroundColor: theme['color-primary-500']}]}
            onPress={() => navigate('MainBottomTab', {screen: 'Practice'})}>
            <Icon pack="eva" name="mic-outline" style={[globalStyle.icon16, {tintColor: '#fff'}]} />
            <Text category="h10-s" bold ml={6} style={{color: '#fff'}}>
              {t('home:coaching_report_empty_cta', {defaultValue: 'Practice a mock interview'})}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Flex itemsCenter mb={14}>
        <View style={styles.headerIcon}>
          <Icon pack="eva" name="bar-chart-2-outline" style={[globalStyle.icon16, {tintColor: '#fff'}]} />
        </View>
        <View style={[globalStyle.flexOne, styles.headerText]}>
          <Text category="h9-s" bold>
            {t('home:coaching_report_title', {defaultValue: 'Your Coaching Report'})}
          </Text>
          <Text category="h10" status="placeholder">
            {t('home:coaching_report_based_on', {
              defaultValue: 'Based on your last {{count}} mock interviews',
              count: report.completedCount,
            })}
          </Text>
        </View>
      </Flex>
      {PANELS.map(panel => {
        const items = report[panel.key];
        return (
          <View
            key={panel.key}
            style={[styles.panel, {backgroundColor: accentTintBg(panel.color), borderLeftColor: panel.color}]}>
            <View style={[styles.chip, {backgroundColor: `${panel.color}33`}]}>
              <Icon pack="eva" name={panel.icon} style={[globalStyle.icon16, {tintColor: panel.color}]} />
              <Text category="h10-s" bold style={[styles.chipText, {color: panel.color}]}>
                {t(panel.titleKey, {defaultValue: panel.titleDefault})}
              </Text>
            </View>
            {items.length > 0 ? (
              items.map((item, i) => (
                <Text key={i} category="h10" mt={i === 0 ? 2 : 4}>
                  {'• '}
                  {item}
                </Text>
              ))
            ) : (
              <Text category="h10" status="placeholder">
                {t('home:coaching_report_panel_empty', {defaultValue: 'Nothing here yet.'})}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

export default CoachingReportCard;

const themedStyles = StyleService.create({
  wrap: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.15)',
    padding: 16,
    marginTop: 16,
    backgroundColor: 'background-basic-color-1',
  },
  // BUG FIX (product report: "This is the design I want for the empty
  // coaching report card in the mobile app", then follow-up "The practice
  // button is not showing well. Its cut off halve way"): the dashed
  // border lives on this outer View; `overflow: 'hidden'` clips the
  // absolute-fill gradient background (emptyOuter's only OTHER child --
  // see the JSX comment above emptyContent's usage) to the same rounded
  // corners. Content itself is a normal-flow sibling (emptyContent below)
  // that drives this View's actual height, so overflow:hidden here only
  // ever trims the gradient's square corners down to the border's rounded
  // ones -- it can't clip real content, since content isn't the thing
  // being measured for size anymore. NOTE: React Native's dashed/dotted
  // border + borderRadius combination is known to render slightly
  // differently between iOS and Android (Android can square off a corner
  // or two) -- an accepted platform limitation, not a bug in this styling.
  emptyOuter: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#52525b40',
    overflow: 'hidden',
  },
  emptyContent: {
    padding: 20,
    alignItems: 'flex-start',
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: accentTintBg('#52525b'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 16,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'color-primary-500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    marginLeft: 10,
  },
  panel: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 12,
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    marginBottom: 8,
  },
  chipText: {
    marginLeft: 4,
  },
});
