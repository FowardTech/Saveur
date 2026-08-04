import React, { memo } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Input,
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
import * as dreamCompaniesService from 'services/dreamCompaniesService';
import { DreamCompany } from 'services/dreamCompaniesService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import CtaButton from 'components/CtaButton';

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

  const [companies, setCompanies] = React.useState<DreamCompany[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [newCompany, setNewCompany] = React.useState('');
  const [newRole, setNewRole] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [refreshingId, setRefreshingId] = React.useState<number | null>(null);

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
          defaultValue: 'Track your target companies with real research, matching job alerts, and prep progress — a Pro Premium feature.',
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
        <Text category="h9-s" status="placeholder" mb={16}>
          {t('more:dream_companies_description', {
            defaultValue: 'Track the companies you actually want to work for — open jobs, interview style, and how ready you are for each.',
          })}
        </Text>

        <Layout level="2" style={styles.addCard}>
          <Input
            placeholder={t('more:company_placeholder', { defaultValue: 'e.g. Acme Corp' })}
            value={newCompany}
            onChangeText={setNewCompany}
            style={[styles.input, { marginBottom: 8 }]}
            textStyle={globalStyle.inputText}
          />
          <Input
            placeholder={t('more:role_placeholder', { defaultValue: 'e.g. Senior Product Manager' })}
            value={newRole}
            onChangeText={setNewRole}
            style={[styles.input, { marginBottom: 12 }]}
            textStyle={globalStyle.inputText}
          />
          <CtaButton disabled={!newCompany.trim() || isAdding} onPress={onAdd}>
            {isAdding
              ? <Spinner size="small" status="control" />
              : t('more:dream_company_add', { defaultValue: 'Add to Dashboard' })}
          </CtaButton>
        </Layout>

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
          companies.map(c => {
            const expanded = expandedId === c.id;
            return (
              <Layout key={c.id} level="2" style={styles.companyCard}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => setExpandedId(expanded ? null : c.id)}>
                  <Flex justify="space-between" itemsCenter>
                    <View style={{ flex: 1 }}>
                      <Text category="h7" bold numberOfLines={1}>{c.company}</Text>
                      {c.targetRole ? (
                        <Text category="h10" status="placeholder" mt={2}>{c.targetRole}</Text>
                      ) : null}
                    </View>
                    <Icon
                      pack="eva"
                      name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                      style={[globalStyle.icon20, { tintColor: theme['text-hint-color'] }]}
                    />
                  </Flex>

                  <Flex justify="flex-start" itemsCenter mt={12}>
                    {c.openJobsCount > 0 ? (
                      <View style={[styles.badge, { backgroundColor: theme['color-success-transparent-200'] }]}>
                        <Text category="h10" bold status="success">
                          {t('more:dream_company_open_jobs', { defaultValue: '{{count}} open jobs', count: c.openJobsCount })}
                        </Text>
                      </View>
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

                {expanded ? (
                  <View style={{ marginTop: 16 }}>
                    {c.intel ? (
                      <>
                        <Text category="h9-s" mb={12}>{c.intel.overview}</Text>
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
          })
        )}
      </Content>
    </Container>
  );
});

export default DreamCompanies;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  input: { ...globalStyle.inputField },
  // Radius inherited from globalStyle.card (24) — no local override.
  addCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 24,
  },
  companyCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 12,
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
});
