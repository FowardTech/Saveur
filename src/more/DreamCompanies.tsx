import React, { memo } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Input,
  Icon,
  Spinner,
  Button,
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
import CompanyLogoAvatar from 'components/CompanyLogoAvatar';
import {accentColorForKey, accentTintBg} from 'utils/accentPalette';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as dreamCompaniesService from 'services/dreamCompaniesService';
import { DreamCompany } from 'services/dreamCompaniesService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import CtaButton from 'components/CtaButton';

// Product request item: "readiness score" — 3-tier color coding so a
// glance at the badge tells you where a company stands without reading
// the number: green once genuinely interview-ready, blue while there's
// real but partial prep, gray when there's essentially nothing yet.
function readinessTier(score: number): 'success' | 'link' | 'neutral' {
  if (score >= 70) return 'success';
  if (score >= 35) return 'link';
  return 'neutral';
}

// Dream Company Dashboard (product request item) — a persisted, tracked
// list of target companies, each with cached AI research (same generation
// as Company Intelligence — src/more/CompanyIntelligence.tsx — just
// persisted here instead of generate-on-demand-and-discard) and real prep-
// progress: interview sessions actually practiced with this company set,
// and whether it's tracked in the Applications list.
const DreamCompanies = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  // Product decision: Dream Company Dashboard moved from plain Pro to Pro
  // Premium (Pro Yearly also qualifies — see AuthContext's
  // isPremium/isPremiumTier, mirroring the backend's require_premium on
  // this feature's endpoints), unlike the underlying Company Intelligence
  // feature it builds on, which stays plain-Pro-gated.
  const { isPremium } = React.useContext(AuthContext);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const [companies, setCompanies] = React.useState<DreamCompany[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [newCompany, setNewCompany] = React.useState('');
  const [newRole, setNewRole] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [refreshingId, setRefreshingId] = React.useState<number | null>(null);
  const [togglingPriorityId, setTogglingPriorityId] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setCompanies(await dreamCompaniesService.listDreamCompanies());
    } catch (e: any) {
      setLoadError(e?.message ?? t('more:dream_companies_load_failed', { defaultValue: 'Could not load your dream companies.' }));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Product request item: "I want forms like this in the app to appear as
  // bottom sheets just like it is in the Resume Evolution" — this "add a
  // company" form used to sit permanently open at the top of the screen;
  // now it's a slide-up Modal sheet (same Modal + KeyboardAvoidingView +
  // rounded Layout pattern as src/more/ResumeVariants.tsx's "+ New Variant"
  // sheet), opened from a compact trigger card instead.
  const [showAddSheet, setShowAddSheet] = React.useState(false);

  const onAdd = async () => {
    const name = newCompany.trim();
    if (!name || isAdding) return;
    setIsAdding(true);
    try {
      const added = await dreamCompaniesService.addDreamCompany(name, newRole.trim());
      setCompanies(prev => [...(prev ?? []), added]);
      setNewCompany('');
      setNewRole('');
      setExpandedId(added.id);
      setShowAddSheet(false);
    } catch (e: any) {
      Alert.alert(
        t('more:dream_company_add_failed_title', { defaultValue: "Couldn't add company" }),
        e?.message ?? t('common:something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' }),
      );
    } finally {
      setIsAdding(false);
    }
  };

  const onRefresh = async (id: number) => {
    if (refreshingId) return;
    setRefreshingId(id);
    try {
      const updated = await dreamCompaniesService.refreshDreamCompany(id);
      setCompanies(prev => (prev ?? []).map(c => (c.id === id ? updated : c)));
    } catch {
      // Leave existing cached research in place on a failed refresh.
    } finally {
      setRefreshingId(null);
    }
  };

  // Product request item: "Priority / 'Top choice' marking" — optimistic,
  // same low-stakes-toggle pattern as JobAlerts.tsx's onTogglePin (flip
  // locally, revert on a rare failure rather than blocking on the network
  // for something this lightweight). Also re-sorts to match the backend's
  // own top-choice-first ordering (list_companies) so a newly-starred
  // company visibly jumps to the top instead of looking like nothing
  // happened until the next full reload.
  const onTogglePriority = async (company: DreamCompany) => {
    if (togglingPriorityId) return;
    setTogglingPriorityId(company.id);
    const nextValue = !company.isTopChoice;
    setCompanies(prev =>
      (prev ?? [])
        .map(c => (c.id === company.id ? { ...c, isTopChoice: nextValue } : c))
        .sort((a, b) => Number(b.isTopChoice) - Number(a.isTopChoice)),
    );
    try {
      await dreamCompaniesService.toggleDreamCompanyPriority(company.id, nextValue);
    } catch {
      setCompanies(prev =>
        (prev ?? [])
          .map(c => (c.id === company.id ? { ...c, isTopChoice: !nextValue } : c))
          .sort((a, b) => Number(b.isTopChoice) - Number(a.isTopChoice)),
      );
    } finally {
      setTogglingPriorityId(null);
    }
  };

  const onPracticeInterview = (company: DreamCompany) => {
    navigation.navigate('MockInterviewSetup', { company: company.company, role: company.targetRole ?? undefined });
  };

  const onGenerateCoverLetter = (company: DreamCompany) => {
    navigation.navigate('CoverLetterGenerator', { company: company.company, role: company.targetRole ?? undefined });
  };

  const onRemove = (id: number) => {
    Alert.alert(
      t('more:dream_company_remove_confirm_title', { defaultValue: 'Stop tracking this company?' }),
      t('more:dream_company_remove_confirm_body', { defaultValue: 'You can always add it back later.' }),
      [
        { text: t('common:cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common:remove', { defaultValue: 'Remove' }),
          style: 'destructive',
          onPress: async () => {
            setCompanies(prev => (prev ?? []).filter(c => c.id !== id));
            try {
              await dreamCompaniesService.removeDreamCompany(id);
            } catch {
              load(); // resync if the delete actually failed server-side
            }
          },
        },
      ],
    );
  };

  if (!isPremium) {
    return (
      <ProLockGate
        variant="premium"
        title={t('more:dream_companies', { defaultValue: 'Dream Company Dashboard' })}
        description={t('more:dream_companies_premium_gate_description', {
          defaultValue: 'Track your target companies with real research, matching job alerts, and prep progress — a Premium feature.',
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:dream_companies', { defaultValue: 'Dream Company Dashboard' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        {/* Product request: "some features in the app users don't know
            what they are for... supposed to have a small banner card
            explaining what they are... a subtle light blue banner" —
            replaces the old plain placeholder-gray description line with
            the same explanatory copy, restyled as the requested banner.
            Shortened to 2 lines (product report: "the text in the info
            banner... too long") — see InfoBox.tsx's own numberOfLines={2}. */}
        <InfoBox icon="flag-outline" variant="info" style={{ marginBottom: 16 }}>
          {t('more:dream_companies_description', {
            defaultValue: 'Track target companies — jobs, interview prep, and your readiness for each.',
          })}
        </InfoBox>

        <TouchableOpacity activeOpacity={0.8} style={styles.addTrigger} onPress={() => setShowAddSheet(true)}>
          {/* REVERTED (product ask: "remove the backgrounds from the
              icons... give the icons themselves the platform blue") --
              this cycled through a color-primary-transparent-100 tint
              circle and a GradientIconBadge; no badge/background now,
              plain plus glyph tinted platform blue (#0063f8) directly. */}
          <Icon pack="eva" name="plus-outline" style={[globalStyle.icon20, { tintColor: '#0063f8', marginRight: 12 }]} />
          <Text category="h9" bold style={globalStyle.flexOne}>
            {t('more:dream_company_add', { defaultValue: 'Add to Dashboard' })}
          </Text>
          <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
        </TouchableOpacity>
        {/* Product report: "link the company intelligence from the dream
            company dashboard... instead of it being in a separate
            feature" — Company Intelligence (src/more/CompanyIntelligence.tsx)
            is the same AI research shown per-company below, just for a
            one-off lookup before you've decided to track anywhere. No
            longer its own row in the main menu (see MoreSrc.tsx); this is
            now the only way in. */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('CompanyIntelligence', {})}
          style={{ marginTop: 12, marginBottom: 20, alignSelf: 'center' }}>
          <Text category="h10" bold status="link">
            {t('more:dream_company_lookup_link', {
              defaultValue: 'Just researching? Look up any company →',
            })}
          </Text>
        </TouchableOpacity>

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
        ) : !companies || companies.length === 0 ? (
          <EmptyState
            icon="flag-outline"
            body={t('more:dream_companies_empty', { defaultValue: 'Add a company above to start tracking it.' })}
            style={{ paddingVertical: 24 }}
          />
        ) : (
          <>
            {/* Product request: "the dream company dashboard is called a
                dashboard for a reason, so it's supposed to have a lot of
                features in it" — a real dashboard-style summary rather
                than jumping straight into a flat list, same 3-stat-column
                treatment this app already uses for other summary headers.
                All three numbers are the same readiness_score/prep data
                each card below already renders, just rolled up. */}
            <Layout level="2" style={styles.summaryCard}>
              <Flex justify="space-between">
                <Flex vertical itemsCenter style={globalStyle.flexOne}>
                  <Text category="h5" bold>{companies.length}</Text>
                  <Text category="h10" status="placeholder" center mt={2}>
                    {t('more:dream_company_summary_tracked', { defaultValue: 'Tracked' })}
                  </Text>
                </Flex>
                <View style={styles.summaryDivider} />
                <Flex vertical itemsCenter style={globalStyle.flexOne}>
                  <Text category="h5" bold>
                    {Math.round(companies.reduce((sum, c) => sum + c.readinessScore, 0) / companies.length)}%
                  </Text>
                  <Text category="h10" status="placeholder" center mt={2}>
                    {t('more:dream_company_summary_readiness', { defaultValue: 'Avg. readiness' })}
                  </Text>
                </Flex>
                <View style={styles.summaryDivider} />
                <Flex vertical itemsCenter style={globalStyle.flexOne}>
                  <Text category="h5" bold>{companies.filter(c => c.readinessScore < 35).length}</Text>
                  <Text category="h10" status="placeholder" center mt={2}>
                    {t('more:dream_company_summary_needs_practice', { defaultValue: 'Need practice' })}
                  </Text>
                </Flex>
              </Flex>
            </Layout>

            {companies.map(c => {
            const expanded = expandedId === c.id;
            const tier = readinessTier(c.readinessScore);
            // Product follow-up ("the color style and blend is not
            // consistent throughout the app... use it in certain other
            // places too") — same pastel-icon-badge treatment as
            // Home/JobAlerts.tsx, on the no-logo fallback circle. Hashed
            // on company name so it stays the same color across
            // re-sorts/expand-collapse rather than shifting by row index.
            const accent = accentColorForKey(c.company);
            return (
              <Layout
                key={c.id}
                level="2"
                style={[
                  styles.companyCard,
                  // Same "stands out from the rest of the list" purple-
                  // border treatment JobAlerts.tsx uses for an unread
                  // alert — here for a top choice instead.
                  c.isTopChoice && { borderColor: theme['color-accent-purple'], borderWidth: 1 },
                ]}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => setExpandedId(expanded ? null : c.id)}>
                  <Flex justify="space-between" itemsCenter>
                    <View style={{ flex: 1 }}>
                      <Flex justify="flex-start" itemsCenter>
                        {/* Product report: "when users type the company
                            they want the app should display the logo of
                            the company there too so that users can
                            identify this company anywhere" — same
                            CompanyLogoAvatar (real logo, or initials when
                            unavailable) Job Alerts already uses. */}
                        <CompanyLogoAvatar
                          logoUrl={c.logoUrl}
                          companyName={c.company}
                          size="small"
                          fallbackTintColor={accent}
                          fallbackBgColor={accentTintBg(accent)}
                          style={{ marginRight: 10 }}
                        />
                        <Text category="h7" bold numberOfLines={1} style={globalStyle.flexOne}>{c.company}</Text>
                      </Flex>
                      {c.targetRole ? (
                        <Text category="h10" status="placeholder" mt={2}>{c.targetRole}</Text>
                      ) : null}
                    </View>
                    {/* Product request item: "Priority / 'Top choice'
                        marking" — nested TouchableOpacity inside the outer
                        expand-toggle one, same pattern already proven in
                        JobAlerts.tsx's bookmark-pin icon on each alert row. */}
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      disabled={togglingPriorityId === c.id}
                      onPress={() => onTogglePriority(c)}
                      style={{ marginRight: 4 }}>
                      <Icon
                        pack="assets"
                        name={c.isTopChoice ? 'bookmarkActive' : 'bookmark'}
                        style={[
                          globalStyle.icon20,
                          { tintColor: c.isTopChoice ? theme['color-accent-purple'] : theme['text-placeholder-color'] },
                        ]}
                      />
                    </TouchableOpacity>
                    {/* Product request: "add a delete icon beside the pin
                        icon so that users can delete the company" — the
                        only way to remove a company used to be the
                        "Remove" text action buried inside the expanded
                        research view below (easy to miss, and required
                        expanding the card first). Reuses the exact same
                        onRemove confirm-alert flow that action already
                        calls, just exposed here too for a one-tap delete
                        without expanding. */}
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => onRemove(c.id)}
                      style={{ marginRight: 4 }}>
                      <Icon
                        pack="eva"
                        name="trash-2-outline"
                        style={[globalStyle.icon20, { tintColor: theme['text-placeholder-color'] }]}
                      />
                    </TouchableOpacity>
                    <Icon
                      pack="eva"
                      name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                      style={[globalStyle.icon20, { tintColor: theme['text-hint-color'] }]}
                    />
                  </Flex>

                  <Flex justify="flex-start" itemsCenter wrap mt={12}>
                    {/* Product request item: "readiness score" — see
                        readinessTier's own comment for the 3-tier coloring. */}
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor:
                            tier === 'success'
                              ? theme['color-success-transparent-200']
                              : tier === 'link'
                              ? theme['color-primary-transparent-200']
                              : theme['background-basic-color-3'],
                        },
                      ]}>
                      <Text category="h10" bold status={tier === 'neutral' ? 'basic' : tier}>
                        {t('more:dream_company_readiness', { defaultValue: '{{score}}% ready', score: c.readinessScore })}
                      </Text>
                    </View>
                    {/* Product request item: "Job alert match highlight" —
                        distinct from the plain open-jobs count badge below:
                        this specifically means something NEW showed up
                        since it was last checked. */}
                    {c.hasNewJobAlert ? (
                      <View style={[styles.badge, { backgroundColor: theme['color-accent-purple-bg'] }]}>
                        <Text category="h10" bold style={{ color: theme['color-accent-purple'] }}>
                          {t('more:dream_company_new_job_match', { defaultValue: 'New job match!' })}
                        </Text>
                      </View>
                    ) : null}
                    {c.openJobsCount > 0 ? (
                      // Product request: "users should be able to click on
                      // the job pill and it should take the user to a page
                      // that lists the number of jobs fetched for that
                      // company" — navigates to JobAlerts pre-filtered to
                      // this company (see navigation/types.tsx's
                      // JobAlerts.companyFilter and JobAlerts.tsx's
                      // searchQuery seeding), reusing that screen's existing
                      // company-matching alerts rather than building a
                      // second jobs-list screen. A nested TouchableOpacity
                      // inside the outer expand-toggle one, same pattern the
                      // bookmark/delete icons already use on this row.
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('JobAlerts', { companyFilter: c.company })}
                        style={[styles.badge, { backgroundColor: theme['color-success-transparent-200'] }]}>
                        <Text category="h10" bold status="success">
                          {t('more:dream_company_open_jobs', { defaultValue: '{{count}} open jobs', count: c.openJobsCount })}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {c.prepProgress.sessionsPracticed > 0 ? (
                      <View style={[styles.badge, { backgroundColor: theme['color-primary-transparent-200'] }]}>
                        <Text category="h10" bold status="link">
                          {t('more:dream_company_sessions_practiced', {
                            defaultValue: '{{count}} sessions practiced',
                            count: c.prepProgress.sessionsPracticed,
                          })}
                        </Text>
                      </View>
                    ) : null}
                    {c.prepProgress.applicationTracked ? (
                      <View style={[styles.badge, { backgroundColor: theme['background-basic-color-3'] }]}>
                        <Text category="h10" bold>
                          {t('more:dream_company_application_tracked', { defaultValue: 'Application tracked' })}
                        </Text>
                      </View>
                    ) : null}
                  </Flex>
                </TouchableOpacity>

                {/* Product request item: "Quick actions per company" —
                    deliberately a sibling of the expand-toggle
                    TouchableOpacity above (not nested inside it) so
                    there's no touch-capture ambiguity, and deliberately
                    ALWAYS visible (not gated on `expanded`) since the
                    whole point is one tap straight into the next real
                    action without first having to expand the card to
                    find it. */}
                <Flex justify="flex-start" wrap mt={12}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => onPracticeInterview(c)}
                    // BUG FIX (product report, screenshot: "the button text
                    // in the blue button... is not visible") — this pill's
                    // background was color-primary-100 with its icon/text
                    // tinted color-primary-500; constants/theme/
                    // appTheme.json defines BOTH as the exact same hex
                    // (#0063f8, the flat brand blue), so the text was
                    // rendering in the identical color as its own
                    // background — same brand blue, zero contrast, not a
                    // dark/light-mode issue. Swapped to the light,
                    // ~8%-opacity primary tint the rest of this screen
                    // already uses for "info" surfaces (InfoBox above,
                    // the readiness badge's `link` tier) so
                    // color-primary-500 text/icon actually shows up
                    // against it.
                    style={[styles.quickActionPill, { backgroundColor: theme['color-primary-transparent-200'], marginRight: 8, marginBottom: 8 }]}>
                    <Icon pack="eva" name="mic-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'], marginRight: 6 }]} />
                    <Text category="h10" bold style={{ color: theme['color-primary-500'] }}>
                      {t('more:dream_company_practice_cta', { defaultValue: 'Practice interview' })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => onGenerateCoverLetter(c)}
                    style={[styles.quickActionPill, { backgroundColor: theme['background-basic-color-3'], marginBottom: 8 }]}>
                    <Icon pack="eva" name="file-text-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'], marginRight: 6 }]} />
                    <Text category="h10" bold>
                      {t('more:dream_company_cover_letter_cta', { defaultValue: 'Generate cover letter' })}
                    </Text>
                  </TouchableOpacity>
                </Flex>

                {expanded ? (
                  <View style={{ marginTop: 16 }}>
                    {c.intel ? (
                      <>
                        <Text category="h9-s" mb={12}>{c.intel.overview}</Text>
                        {c.intel.salaryRange ? (
                          <View style={styles.expandedSubcard}>
                            <Text category="h10" bold mb={4}>
                              {t('more:salary_insights', { defaultValue: 'Salary Insights' })}
                            </Text>
                            <Text category="h10" status="placeholder">{c.intel.salaryRange}</Text>
                          </View>
                        ) : null}
                        {c.intel.interviewProcess ? (
                          <View style={styles.expandedSubcard}>
                            <Text category="h10" bold mb={4}>
                              {t('more:interview_process', { defaultValue: 'Interview Process' })}
                            </Text>
                            <Text category="h10" status="placeholder">{c.intel.interviewProcess}</Text>
                          </View>
                        ) : null}
                        {c.intel.likelyQuestions.length ? (
                          <>
                            <Text category="h9" bold mb={8}>
                              {t('more:likely_questions', { defaultValue: 'Likely Interview Questions' })}
                            </Text>
                            {c.intel.likelyQuestions.map((q, i) => (
                              <Text key={i} category="h10" mb={6}>{i + 1}. {q}</Text>
                            ))}
                          </>
                        ) : null}
                      </>
                    ) : (
                      <Text category="h9-s" status="placeholder" mb={12}>
                        {t('more:dream_company_no_research_yet', { defaultValue: 'Research not available yet — try refreshing.' })}
                      </Text>
                    )}
                    {c.researchStale ? (
                      <Text category="h10" status="warning" mb={8}>
                        {t('more:dream_company_research_stale', { defaultValue: 'This research may be out of date.' })}
                      </Text>
                    ) : null}
                    <Flex justify="flex-start">
                      <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={refreshingId === c.id}
                        onPress={() => onRefresh(c.id)}
                        style={[styles.actionPill, { marginRight: 12 }]}>
                        {refreshingId === c.id ? (
                          <Spinner size="tiny" />
                        ) : (
                          <Text category="h10" bold status="link">
                            {t('more:dream_company_refresh_research', { defaultValue: 'Refresh research' })}
                          </Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => onRemove(c.id)} style={styles.actionPill}>
                        <Text category="h10" bold status="danger">
                          {t('common:remove', { defaultValue: 'Remove' })}
                        </Text>
                      </TouchableOpacity>
                    </Flex>
                  </View>
                ) : null}
              </Layout>
            );
            })}
          </>
        )}
      </Content>

      <Modal visible={showAddSheet} transparent animationType="slide" onRequestClose={() => setShowAddSheet(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Layout level="1" style={styles.modalSheet}>
            {/* Product request: "all bottom sheets should have a close
                button" -- see NetworkingAssistant.tsx's identical fix for
                the fuller reasoning; same header-row treatment here. */}
            <Flex justify="space-between" itemsCenter mb={16}>
              <Text category="h7" bold>
                {t('more:dream_company_add', { defaultValue: 'Add to Dashboard' })}
              </Text>
              <TouchableOpacity onPress={() => setShowAddSheet(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, { tintColor: theme['text-basic-color'] }]} />
              </TouchableOpacity>
            </Flex>
            <Input
              placeholder={t('more:company_placeholder', { defaultValue: 'e.g. Acme Corp' })}
              value={newCompany}
              onChangeText={setNewCompany}
              style={[styles.input, { marginBottom: 12 }]}
              textStyle={globalStyle.inputText}
            />
            <Input
              placeholder={t('more:role_placeholder', { defaultValue: 'e.g. Senior Product Manager' })}
              value={newRole}
              onChangeText={setNewRole}
              style={[styles.input, { marginBottom: 20 }]}
              textStyle={globalStyle.inputText}
            />
            <CtaButton disabled={!newCompany.trim() || isAdding} onPress={onAdd}>
              {isAdding
                ? <Spinner size="small" status="control" />
                : t('more:dream_company_add', { defaultValue: 'Add to Dashboard' })}
            </CtaButton>
            <Button appearance="outline" style={{ marginTop: 12 }} onPress={() => setShowAddSheet(false)}>
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </Button>
          </Layout>
        </KeyboardAvoidingView>
      </Modal>
    </Container>
  );
});

export default DreamCompanies;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  input: { ...globalStyle.inputField },
  // Compact trigger card that opens the "add a company" bottom sheet (see
  // the Modal below) — replaces the old always-open inline form.
  addTrigger: {
    ...globalStyle.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  companyCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 12,
    // No border by default — same "only the highlighted state gets one"
    // fix JobAlerts.tsx's alertCard already applies (a bare `borderWidth`
    // with no color renders as a stray black hairline).
  },
  // Dashboard summary header (product request item) — 3 stat columns
  // separated by thin dividers, same treatment as this app's other
  // multi-stat summary cards.
  summaryCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 20,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: 'border-basic-color-3',
    marginHorizontal: 4,
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 4,
  },
  actionPill: {
    paddingVertical: 6,
  },
  // Quick action pills (product request item) — flat, no shadow (same
  // reasoning as LearningCourses.tsx's weekActionPill: these sit inside an
  // already-elevated card, a second shadow source here would look off).
  quickActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  expandedSubcard: {
    backgroundColor: 'background-basic-color-3',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
});
