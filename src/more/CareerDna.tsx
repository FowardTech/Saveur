import React, { memo } from 'react';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Icon,
  Input,
  Spinner,
} from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import InfoBox from 'components/InfoBox';
import { globalStyle } from 'styles/globalStyle';
import { tileColorAt } from 'styles/tileColors';
import { RootStackParamList } from 'navigation/types';
import { SuggestedActionId } from 'constants/Types';
import * as careerDnaService from 'services/careerDnaService';
import { CareerDnaFitCheck, CareerDnaHistoryEntry, CareerDnaProfile } from 'services/careerDnaService';
import { actionTitle, ACTION_META, runSuggestedAction } from 'services/suggestedActions';
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
  // Product decision: Career DNA moved from plain Pro to Pro Premium (Pro
  // Yearly also qualifies — see AuthContext's isPremium/isPremiumTier for
  // the full tier breakdown, mirroring the backend's require_premium on
  // this feature's endpoints).
  const { isPremium } = React.useContext(AuthContext);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const [profile, setProfile] = React.useState<CareerDnaProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Product request item: "profile-over-time trend" — lazy-loaded only
  // when the user actually taps "View history" (not on every screen
  // mount) since most visits won't need it and it's a separate network
  // round trip from the main profile GET.
  const [isHistoryVisible, setIsHistoryVisible] = React.useState(false);
  const [history, setHistory] = React.useState<CareerDnaHistoryEntry[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);

  // Product request item: "compare against a job description" — see
  // services/careerDnaService.ts's fitCheck comment on how this differs
  // from JD Analyzer's resume/skills match.
  const [jdText, setJdText] = React.useState('');
  const [isCheckingFit, setIsCheckingFit] = React.useState(false);
  const [fitResult, setFitResult] = React.useState<CareerDnaFitCheck | null>(null);
  const [fitError, setFitError] = React.useState<string | null>(null);

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

  const onViewHistory = async () => {
    setIsHistoryVisible(true);
    if (history || isLoadingHistory) return;
    setIsLoadingHistory(true);
    try {
      setHistory(await careerDnaService.getHistory());
    } catch {
      setHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const onRunNextStep = (id: SuggestedActionId) => {
    runSuggestedAction(id, navigation.navigate as any);
  };

  const onCheckFit = async () => {
    if (!jdText.trim() || isCheckingFit) return;
    setIsCheckingFit(true);
    setFitError(null);
    setFitResult(null);
    try {
      setFitResult(await careerDnaService.fitCheck(jdText.trim()));
    } catch (e: any) {
      setFitError(e?.message ?? t('more:career_dna_fit_check_failed', { defaultValue: "Couldn't check fit right now. Please try again." }));
    } finally {
      setIsCheckingFit(false);
    }
  };

  if (!isPremium) {
    return (
      <ProLockGate
        variant="premium"
        title={t('more:career_dna', { defaultValue: 'Career DNA' })}
        description={t('more:career_dna_premium_gate_description', {
          defaultValue: 'A living profile the AI builds from your real activity — interviews, courses, progress — and refines every week. A Pro Premium feature.',
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
        {/* Product request: "some features in the app users don't know
            what they are for... supposed to have a small banner card
            explaining what they are... a subtle light blue banner" —
            shown in every state (loading/error/not-enough-data/real
            profile) since it explains the feature itself, not the
            current profile's contents. */}
        <InfoBox icon="activity-outline" variant="info" style={{ marginBottom: 16 }}>
          {t('more:career_dna_description', {
            defaultValue: 'Your AI-built profile from real activity — so coaching actually knows you.',
          })}
        </InfoBox>
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
              <Flex justify="space-between" itemsCenter mt={12}>
                <Text category="h10" status="placeholder">
                  {t('more:career_dna_version_line', {
                    defaultValue: 'Version {{version}} • updated from {{count}} signals',
                    version: profile.version,
                    count: profile.signalCount,
                  })}
                </Text>
                {/* Product request item: "profile-over-time trend". */}
                {profile.version > 1 ? (
                  <TouchableOpacity onPress={onViewHistory}>
                    <Text category="h10" status="link" bold>
                      {t('more:career_dna_view_history', { defaultValue: 'View history' })}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </Flex>
            </Layout>

            {/* Product request item: "actionable next steps tied to blind
                spots" — reuses the exact same action id/navigation system
                the AI Coach's SUGGESTED_ACTION already uses
                (services/suggestedActions.ts), so this is genuinely no new
                UI/navigation concept, just a second place that can surface
                one. */}
            {profile.nextStepActionIds.length ? (
              <Layout level="2" style={styles.narrativeCard}>
                <Text category="h8" bold mb={10}>
                  {t('more:career_dna_next_steps_title', { defaultValue: 'Recommended next steps' })}
                </Text>
                {profile.nextStepActionIds.map(id => {
                  const meta = ACTION_META[id];
                  if (!meta) return null;
                  return (
                    <TouchableOpacity
                      key={id}
                      activeOpacity={0.7}
                      onPress={() => onRunNextStep(id)}
                      style={styles.nextStepRow}>
                      <View style={[styles.nextStepIconWrap, { backgroundColor: theme['color-primary-transparent-200'] }]}>
                        <Icon pack="eva" name={meta.icon} style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
                      </View>
                      <Text category="h9-s" style={{ flex: 1, marginLeft: 10 }}>{actionTitle(id)}</Text>
                      {/* pack="assets" name="chevronRight" (NOT pack="eva")
                          — "chevron-right-outline" isn't registered in the
                          eva pack; this exact mistake crashed
                          CourseSession.tsx once before (see that file's own
                          fix comment). */}
                      <Icon pack="assets" name="chevronRight" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
                    </TouchableOpacity>
                  );
                })}
              </Layout>
            ) : null}

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
              <View style={[styles.traitCard, { backgroundColor: theme[tileColorAt(3).bg] }]}>
                <Text category="h9" bold style={{ color: theme[tileColorAt(3).text] }} mb={8}>
                  {t('more:career_dna_career_risks', { defaultValue: 'Career risks if patterns continue' })}
                </Text>
                {traits.career_risks.map((s, i) => (
                  <Text key={i} category="h9-s" mb={4}>{'• '}{s}</Text>
                ))}
              </View>
            ) : null}

            <CtaButton
              style={{ marginTop: 12, marginBottom: 20 }}
              disabled={isRefreshing}
              onPress={onRefresh}>
              {isRefreshing
                ? <Spinner size="small" status="control" />
                : t('more:career_dna_refresh', { defaultValue: 'Refresh my Career DNA' })}
            </CtaButton>

            {/* Product request item: "compare against a job description" —
                see services/careerDnaService.ts's fitCheck comment: a
                work-style/culture fit read, distinct from JD Analyzer's
                resume/skills match, so a user pasting the same JD into
                both gets two genuinely different, non-redundant answers. */}
            <Layout level="2" style={styles.narrativeCard}>
              <Text category="h8" bold mb={4}>
                {t('more:career_dna_fit_check_title', { defaultValue: 'Job Fit Check' })}
              </Text>
              <Text category="h9-s" status="placeholder" mb={12}>
                {t('more:career_dna_fit_check_description', {
                  defaultValue: "Paste a job description to see how your work style matches the role — not a skills check (that's the JD Analyzer), just fit.",
                })}
              </Text>
              <Input
                placeholder={t('more:career_dna_fit_check_placeholder', { defaultValue: 'Paste the job description here…' })}
                value={jdText}
                onChangeText={setJdText}
                multiline
                textStyle={[globalStyle.inputText, { minHeight: 80, textAlignVertical: 'top' }]}
                style={globalStyle.inputField}
              />
              <CtaButton
                style={{ marginTop: 12 }}
                disabled={!jdText.trim() || isCheckingFit}
                onPress={onCheckFit}>
                {isCheckingFit
                  ? <Spinner size="small" status="control" />
                  : t('more:career_dna_fit_check_cta', { defaultValue: 'Check my fit' })}
              </CtaButton>

              {fitError ? <Text category="h10" status="danger" mt={12}>{fitError}</Text> : null}

              {fitResult ? (
                <View style={{ marginTop: 16 }}>
                  <Flex justify="flex-start" itemsCenter mb={8}>
                    <Text category="h3" bold style={{ color: theme['text-basic-color'] }}>{fitResult.fitScore}%</Text>
                    <Text category="h10" status="placeholder" ml={8}>
                      {t('more:career_dna_fit_score_label', { defaultValue: 'style fit' })}
                    </Text>
                  </Flex>
                  <Text category="h9-s" mb={12}>{fitResult.fitSummary}</Text>
                  {fitResult.styleStrengths.length ? (
                    <View style={{ marginBottom: 12 }}>
                      <Text category="h10" bold status="success" mb={6}>
                        {t('more:career_dna_fit_strengths', { defaultValue: 'Style strengths for this role' })}
                      </Text>
                      {fitResult.styleStrengths.map((s, i) => (
                        <Text key={i} category="h9-s" mb={4}>{'• '}{s}</Text>
                      ))}
                    </View>
                  ) : null}
                  {fitResult.potentialFrictionPoints.length ? (
                    <View>
                      <Text category="h10" bold status="warning" mb={6}>
                        {t('more:career_dna_fit_friction', { defaultValue: 'Potential friction points' })}
                      </Text>
                      {fitResult.potentialFrictionPoints.map((s, i) => (
                        <Text key={i} category="h9-s" mb={4}>{'• '}{s}</Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Layout>
          </>
        )}
      </Content>

      {/* Product request item: "profile-over-time trend" — same bottom-
          sheet Modal pattern as RequestsInPass.tsx's filter sheet. */}
      <Modal
        visible={isHistoryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsHistoryVisible(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsHistoryVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <Text category="h7" bold mb={16}>
              {t('more:career_dna_history_title', { defaultValue: 'How your profile has changed' })}
            </Text>
            {isLoadingHistory ? (
              <Flex center style={{ paddingVertical: 24 }}>
                <Spinner size="small" />
              </Flex>
            ) : !history || history.length === 0 ? (
              <Text category="h9-s" status="placeholder" center style={{ paddingVertical: 24 }}>
                {t('more:career_dna_history_empty', { defaultValue: 'No earlier versions yet.' })}
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 380 }} nestedScrollEnabled>
                {history.map(entry => (
                  <View key={entry.version} style={styles.historyRow}>
                    <Text category="h10" bold status="placeholder" mb={4}>
                      {t('more:career_dna_history_version_label', {
                        defaultValue: 'Version {{version}}{{date}}',
                        version: entry.version,
                        date: entry.generatedAt ? ` • ${new Date(entry.generatedAt).toLocaleDateString()}` : '',
                      })}
                    </Text>
                    <Text category="h9-s">{entry.narrative}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
            <CtaButton style={{ marginTop: 20 }} onPress={() => setIsHistoryVisible(false)}>
              {t('common:done', { defaultValue: 'Done' })}
            </CtaButton>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  // "Recommended next steps" rows (product request item) — flat rows
  // inside the card, not separate cards each, since these are meant to
  // scan as one tidy list rather than a stack of individually-shadowed
  // tiles.
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'background-basic-color-3',
  },
  nextStepIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Profile-history bottom sheet — same pattern as
  // src/requests/RequestsInPass.tsx's filter Modal.
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: 'background-basic-color-1',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 32,
  },
  historyRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'border-basic-color-3',
  },
});
