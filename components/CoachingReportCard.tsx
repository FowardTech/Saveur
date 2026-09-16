import React from 'react';
import {View} from 'react-native';
import {StyleService, useStyleSheet, Icon} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';
import {useFocusEffect, useNavigation, NavigationProp} from '@react-navigation/native';

import Text from 'components/Text';
import Flex from 'components/Flex';
import EmptyState from 'components/EmptyState';
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
  {key: 'keyInsights', icon: 'bulb-outline', color: '#8B5CF6', titleKey: 'home:coaching_report_key_insights', titleDefault: 'Key Insights'},
  {key: 'areasToImprove', icon: 'flag-outline', color: '#F59E0B', titleKey: 'home:coaching_report_areas_to_improve', titleDefault: 'Areas to Improve'},
  {key: 'whatsNext', icon: 'arrow-forward-outline', color: '#EC4899', titleKey: 'home:coaching_report_whats_next', titleDefault: "What's Next"},
];

const CoachingReportCard = () => {
  const {t} = useTranslation(['home', 'common']);
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
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

  if (report.empty) {
    return (
      <View style={styles.wrap}>
        <EmptyState
          title={t('home:coaching_report_title', {defaultValue: 'Your Coaching Report'}).toString()}
          body={t('home:coaching_report_empty_body', {
            defaultValue: 'Your coaching report is empty — complete {{count}} mock interviews to see what you’re doing well and what to work on next.',
            count: report.minRequired,
          }).toString()}
          actionLabel={t('home:coaching_report_empty_cta', {defaultValue: 'Practice a mock interview'}).toString()}
          onAction={() => navigate('MainBottomTab', {screen: 'Practice'})}
          style={styles.emptyState}
        />
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
  emptyState: {
    paddingVertical: 24,
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
