import React, { memo } from 'react';
import { View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import { globalStyle } from 'styles/globalStyle';
import * as careerDnaService from 'services/careerDnaService';
import { CareerDnaProfile } from 'services/careerDnaService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import CtaButton from 'components/CtaButton';

// Career DNA (product request item — merges what was pitched separately as
// "Career DNA" and "Career Genome", the exact same concept). Unlike a
// resume, this is a living profile the AI keeps refining from real
// activity — mock interview performance over time, career diary entries,
// roadmap/course progress, stated goals — see
// saveur-backend/app/services/career_dna_service.py for the full signal
// list and regeneration logic. This screen intentionally has no "edit"
// affordance: the whole point is that it's derived from what you actually
// do in the app, not a form you fill out.
const CareerDna = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const { isPro } = React.useContext(AuthContext);

  const [profile, setProfile] = React.useState<CareerDnaProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setProfile(await careerDnaService.getProfile());
    } catch (e: any) {
      setLoadError(e?.message ?? t('more:career_dna_load_failed', { defaultValue: 'Could not load your Career DNA.' }));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      setProfile(await careerDnaService.refreshProfile());
    } catch {
      // Best-effort — leave the existing profile shown rather than clearing it on a failed refresh.
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isPro) {
    return (
      <ProLockGate
        title={t('more:career_dna', { defaultValue: 'Career DNA' })}
        description={t('more:career_dna_pro_gate_description', {
          defaultValue: 'A living profile the AI builds from your real activity — interviews, courses, progress — and refines every week. A Pro feature.',
        })}
      />
    );
  }

  const traits = profile?.traits;
  const traitRows: Array<{ label: string; value?: string | string[] }> = traits
    ? [
        { label: t('more:career_dna_communication_style', { defaultValue: 'Communication style' }), value: traits.communication_style },
        { label: t('more:career_dna_leadership_style', { defaultValue: 'Leadership style' }), value: traits.leadership_style },
        { label: t('more:career_dna_learning_speed', { defaultValue: 'Learning speed' }), value: traits.learning_speed },
        { label: t('more:career_dna_confidence_pattern', { defaultValue: 'Confidence pattern' }), value: traits.confidence_pattern },
        { label: t('more:career_dna_preferred_environment', { defaultValue: 'Preferred environment' }), value: traits.preferred_environment },
        { label: t('more:career_dna_ideal_management_style', { defaultValue: 'Ideal management style' }), value: traits.ideal_management_style },
        { label: t('more:career_dna_ideal_company_size', { defaultValue: 'Ideal company size' }), value: traits.ideal_company_size },
      ]
    : [];

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:career_dna', { defaultValue: 'Career DNA' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        {isLoading ? (
          <EmptyState variant="loading" />
        ) : loadError ? (
          <EmptyState
            variant="error"
            title={t('common:something_went_wrong', { defaultValue: 'Something went wrong' })}
            body={loadError}
            actionLabel={t('common:try_again', { defaultValue: 'Try again' })}
            onAction={load}
          />
        ) : !profile?.hasProfile ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 60 }}>
            <Icon pack="eva" name="activity-outline" style={[globalStyle.icon40, { tintColor: theme['text-hint-color'] }]} />
            <Text category="h7" bold center mt={20}>
              {t('more:career_dna_not_enough_data_title', { defaultValue: 'Your Career DNA is still forming' })}
            </Text>
            <Text category="h9-s" status="placeholder" center mt={8} maxWidth={280}>
              {t('more:career_dna_not_enough_data_body', {
                defaultValue: 'Keep practicing interviews, logging your career diary, and working through your roadmap — your profile unlocks once there’s enough real activity to learn from.',
              })}
            </Text>
          </Flex>
        ) : (
          <>
            <Layout level="2" style={styles.narrativeCard}>
              <Flex justify="flex-start" itemsCenter mb={10}>
                <Icon pack="eva" name="activity-outline" style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]} />
                <Text category="h8" bold ml={8}>
                  {t('more:career_dna_narrative_title', { defaultValue: 'What we’ve learned about you' })}
                </Text>
              </Flex>
              <Text category="h9">{profile.narrative}</Text>
              <Text category="h10" status="placeholder" mt={12}>
                {t('more:career_dna_version_line', {
                  defaultValue: 'Version {{version}} • updated from {{count}} signals',
                  version: profile.version,
                  count: profile.signalCount,
                })}
              </Text>
            </Layout>

            {traitRows.filter(r => r.value).map(row => (
              <Layout key={row.label} level="2" style={styles.traitCard}>
                <Text category="h10" status="placeholder" mb={4}>{row.label}</Text>
                <Text category="h9" bold>{row.value as string}</Text>
              </Layout>
            ))}

            {traits?.technical_strengths?.length ? (
              <ChipSection
                title={t('more:career_dna_technical_strengths', { defaultValue: 'Technical strengths' })}
                items={traits.technical_strengths}
                status="success"
                styles={styles}
                theme={theme}
              />
            ) : null}

            {traits?.ideal_industries?.length ? (
              <ChipSection
                title={t('more:career_dna_ideal_industries', { defaultValue: 'Ideal industries' })}
                items={traits.ideal_industries}
                status="link"
                styles={styles}
                theme={theme}
              />
            ) : null}

            {traits?.learning_preferences?.length ? (
              <ChipSection
                title={t('more:career_dna_learning_preferences', { defaultValue: 'Learning preferences' })}
                items={traits.learning_preferences}
                status="link"
                styles={styles}
                theme={theme}
              />
            ) : null}

            {traits?.blind_spots?.length ? (
              // Soft amber tile (product request item, layout reference:
              // colored pastel tiles rather than plain white cards) — same
              // "warning" meaning as before, just tinted instead of a
              // neutral card with a colored heading.
              <View style={[styles.traitCard, { backgroundColor: 'rgba(254, 152, 112, 0.15)' }]}>
                <Text category="h9" bold status="warning" mb={8}>
                  {t('more:career_dna_blind_spots', { defaultValue: 'Blind spots to watch' })}
                </Text>
                {traits.blind_spots.map((s, i) => (
                  <Text key={i} category="h9-s" mb={4}>{'• '}{s}</Text>
                ))}
              </View>
            ) : null}

            {traits?.career_risks?.length ? (
              <View style={[styles.traitCard, { backgroundColor: theme['color-tile-rose-bg'] }]}>
                <Text category="h9" bold style={{ color: theme['color-tile-rose-text'] }} mb={8}>
                  {t('more:career_dna_career_risks', { defaultValue: 'Career risks if patterns continue' })}
                </Text>
                {traits.career_risks.map((s, i) => (
                  <Text key={i} category="h9-s" mb={4}>{'• '}{s}</Text>
                ))}
              </View>
            ) : null}

            <CtaButton
              style={{ marginTop: 12 }}
              disabled={isRefreshing}
              onPress={onRefresh}>
              {isRefreshing
                ? <Spinner size="small" status="control" />
                : t('more:career_dna_refresh', { defaultValue: 'Refresh my Career DNA' })}
            </CtaButton>
          </>
        )}
      </Content>
    </Container>
  );
});

function ChipSection({ title, items, status, styles, theme }: {
  title: string; items: string[]; status: 'success' | 'link'; styles: any; theme: Record<string, string>;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text category="h9" bold status="placeholder" mb={8}>{title}</Text>
      <Flex justify="flex-start" wrap>
        {items.map((item, i) => (
          <View
            key={i}
            style={[
              styles.chip,
              { backgroundColor: status === 'success' ? theme['color-success-transparent-200'] : theme['color-primary-transparent-200'] },
            ]}>
            <Text category="h10" bold status={status}>{item}</Text>
          </View>
        ))}
      </Flex>
    </View>
  );
}

export default CareerDna;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  // Radius inherited from globalStyle.card (24, app-wide "big rounded
  // card" token) — no local override, unlike before the wellness-app-
  // inspired reskin pass (was pinned to 16 here specifically).
  narrativeCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 16,
  },
  // Slightly smaller than the full 24 (these are small individual trait
  // rows, not the main narrative card) but still noticeably rounder than
  // the pre-reskin 12.
  traitCard: {
    ...globalStyle.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
});
