import { globalStyle } from 'styles/globalStyle';
import DatePickerField from 'components/DatePickerField';
import React, {memo} from 'react';
import {Alert, TouchableOpacity, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Input, Layout} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';
import FormSheet from 'components/FormSheet';
import {RootStackParamList} from 'navigation/types';
import * as growth from 'services/growthService';
import {PayRecord, PaySummary, PromotionPlan} from 'services/growthService';
import * as configService from 'services/configService';

// Career Growth — the post-hire loop: pay tracking over time (free), market
// check + raise/promotion plan (paid), quarterly check-in prompt. Mirrors
// Saveur-Web's app/career/growth/page.tsx.
const KINDS = ['start', 'raise', 'promotion', 'job_change', 'other'];

const fmt = (n?: number | null, cur = 'USD') => {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, {style: 'currency', currency: cur, maximumFractionDigits: 0}).format(n);
  } catch {
    return `${Math.round(n)} ${cur}`;
  }
};

const Chip = ({label, selected, onPress}: {label: string; selected: boolean; onPress: () => void}) => {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        borderWidth: 1.5,
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 12,
        margin: 4,
        borderColor: selected ? theme['color-primary-500'] : theme['border-basic-color-3'],
        backgroundColor: selected ? theme['color-primary-transparent-200'] : 'transparent',
      }}>
      <Text category="h9-s" bold={selected} style={selected ? {color: theme['color-primary-500']} : undefined}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const CareerGrowth = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'common']);

  const payOn = configService.isFeatureEnabled('pay_tracking');
  const planOn = configService.isFeatureEnabled('promotion_plan');
  const marketOn = configService.isFeatureEnabled('market_check');
  const [tab, setTab] = React.useState<'pay' | 'plan'>(payOn || !planOn ? 'pay' : 'plan');
  const [payOpen, setPayOpen] = React.useState(false);
  const [planOpen, setPlanOpen] = React.useState(false);
  const [records, setRecords] = React.useState<PayRecord[]>([]);
  const [summary, setSummary] = React.useState<PaySummary>({count: 0});
  const [plan, setPlan] = React.useState<PromotionPlan | null>(null);
  const [checkinId, setCheckinId] = React.useState<number | null>(null);
  const [checkinText, setCheckinText] = React.useState('');

  const [kind, setKind] = React.useState('start');
  const [date, setDate] = React.useState('');
  const [base, setBase] = React.useState('');
  const [bonus, setBonus] = React.useState('');
  const [role, setRole] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const [goal, setGoal] = React.useState('promotion');
  const [curRole, setCurRole] = React.useState('');
  const [targetRole, setTargetRole] = React.useState('');
  const [tenure, setTenure] = React.useState('');
  const [context, setContext] = React.useState('');
  const [planning, setPlanning] = React.useState(false);

  const load = React.useCallback(async () => {
    // Independent loads: the promotion plan is Premium-only, so a Basic user's 402 there
    // must not stop their pay records from loading.
    const [p, pl, c] = await Promise.allSettled([growth.listPay(), growth.getPromotionPlan(), growth.getPendingCheckin()]);
    if (p.status === 'fulfilled') {
      setRecords(p.value.records);
      setSummary(p.value.summary);
    }
    if (pl.status === 'fulfilled') setPlan(pl.value);
    if (c.status === 'fulfilled') setCheckinId(c.value?.id ?? null);
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  const onError = (e: any) => {
    if (e?.status === 402 || e?.status === 403) {
      // premium_required => promotion plan (Premium); otherwise a Basic-plan feature.
      const premium = e?.error === 'premium_required';
      Alert.alert(
        premium
          ? t('more:growth_premium_title', {defaultValue: 'Premium feature'})
          : t('more:growth_paid_title', {defaultValue: 'Paid feature'}),
        premium
          ? t('more:growth_premium_body', {defaultValue: 'The promotion plan is a Premium feature. Upgrade to Premium to unlock it.'}).toString()
          : t('more:growth_paywall', {defaultValue: 'Pay tracking is available on paid plans.'}).toString(),
        [
          {text: t('common:cancel', {defaultValue: 'Cancel'}), style: 'cancel'},
          {
            text: premium ? t('more:growth_upgrade_premium', {defaultValue: 'Upgrade to Premium'}) : t('more:upgrade', {defaultValue: 'Upgrade'}),
            onPress: () => navigate('Subscription'),
          },
        ],
      );
    } else {
      Alert.alert(t('common:something_went_wrong', {defaultValue: 'Something went wrong'}), e?.message ?? '');
    }
  };

  const onAddPay = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const r = await growth.addPay({
        effective_date: date.trim(),
        base_salary: Number(base.replace(/[^0-9.]/g, '')),
        bonus: bonus ? Number(bonus.replace(/[^0-9.]/g, '')) : undefined,
        role: role || undefined,
        company: company || undefined,
        kind,
      });
      setRecords(prev => [...prev, r.record].sort((a, b) => a.effective_date.localeCompare(b.effective_date)));
      setSummary(r.summary);
      setBase('');
      setBonus('');
    } catch (e: any) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };


  const onPlan = async () => {
    if (planning || !curRole.trim()) return;
    setPlanning(true);
    try {
      setPlan(
        await growth.makePromotionPlan({
          goal,
          current_role: curRole.trim(),
          target_role: targetRole.trim() || undefined,
          tenure_months: tenure ? Number(tenure) : undefined,
          context: context.trim() || undefined,
        }),
      );
    } catch (e: any) {
      onError(e);
    } finally {
      setPlanning(false);
    }
  };

  const onCheckin = async () => {
    if (!checkinId) return;
    await growth.respondCheckin(checkinId, checkinText).catch(() => {});
    setCheckinId(null);
    setCheckinText('');
  };

  const kindLabel = (k: string) => t(`more:growth_kind_${k}`, {defaultValue: k.replace('_', ' ')}).toString();

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('more:career_growth', {defaultValue: 'Career Growth'})} accessoryLeft={<NavigationAction />} />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={12}>
          {t('more:growth_subtitle', {defaultValue: "Track your pay over time, check if you're paid fairly, and prepare for your next raise or promotion."})}
        </Text>

        <FormSheet
          visible={!!checkinId}
          title={t('more:growth_checkin_title', {defaultValue: 'Quarterly check-in'}).toString()}
          subtitle={t('more:growth_checkin_body', {defaultValue: "Any new wins, a raise, or a new role? We'll save it to your Career Diary as promotion evidence."}).toString()}
          onClose={() => setCheckinId(null)}>
          <Input multiline value={checkinText} onChangeText={setCheckinText} textStyle={{minHeight: 110}} style={{marginBottom: 12}} />
          <CtaButton onPress={onCheckin}>{t('common:save', {defaultValue: 'Save'})}</CtaButton>
        </FormSheet>

        <Flex wrap justify="flex-start" style={{marginHorizontal: -4, marginBottom: 8}}>
          {payOn ? <Chip label={t('more:growth_tab_pay', {defaultValue: 'Pay tracking'}).toString()} selected={tab === 'pay'} onPress={() => setTab('pay')} /> : null}
          {planOn ? <Chip label={t('more:growth_tab_plan', {defaultValue: 'Raise & promotion plan'}).toString()} selected={tab === 'plan'} onPress={() => setTab('plan')} /> : null}
        </Flex>

        {tab === 'pay' ? (
          <>
            {summary.count > 0 ? (
              <Layout level="2" style={styles.card}>
                <Text category="h8" bold>{fmt(summary.current_base, summary.currency)}</Text>
                <Text category="h9-s" status="placeholder">
                  {t('more:growth_current_base', {defaultValue: 'Current base'})}
                  {summary.total_growth_pct != null ? ` · ${summary.total_growth_pct}% ${t('more:growth_total', {defaultValue: 'total'})}` : ''}
                  {summary.annualized_growth_pct != null ? ` · ${summary.annualized_growth_pct}%/${t('more:growth_year', {defaultValue: 'yr'})}` : ''}
                  {summary.months_since_last_change != null ? ` · ${summary.months_since_last_change} ${t('more:growth_months_since', {defaultValue: 'mo since change'})}` : ''}
                </Text>
              </Layout>
            ) : null}

            <CtaButton onPress={() => setPayOpen(true)} style={{marginBottom: 12}}>
              {t('more:growth_log_pay', {defaultValue: 'Log a pay change'})}
            </CtaButton>
            <FormSheet visible={payOpen} title={t('more:growth_log_pay', {defaultValue: 'Log a pay change'}).toString()} onClose={() => setPayOpen(false)}>
              <Flex wrap justify="flex-start" style={{marginHorizontal: -4, marginBottom: 8}}>
                {KINDS.map(k => (
                  <Chip key={k} label={kindLabel(k)} selected={k === kind} onPress={() => setKind(k)} />
                ))}
              </Flex>
              <DatePickerField placeholder={t('more:growth_date_placeholder', {defaultValue: 'Effective date'}).toString()} value={date} onChange={setDate} style={{marginBottom: 8}} />
              <Input placeholder={t('more:growth_base_placeholder', {defaultValue: 'Base salary (yearly)'}).toString()} keyboardType="numeric" value={base} onChangeText={setBase} style={[styles.input, globalStyle.sheetInput]} />
              <Input placeholder={t('more:growth_bonus_placeholder', {defaultValue: 'Bonus (optional)'}).toString()} keyboardType="numeric" value={bonus} onChangeText={setBonus} style={[styles.input, globalStyle.sheetInput]} />
              <Input placeholder={t('more:growth_role_placeholder', {defaultValue: 'Role'}).toString()} value={role} onChangeText={setRole} style={[styles.input, globalStyle.sheetInput]} />
              <Input placeholder={t('more:growth_company_placeholder', {defaultValue: 'Company'}).toString()} value={company} onChangeText={setCompany} style={[styles.input, globalStyle.sheetInput]} />
              <CtaButton disabled={saving || !date.trim() || !base.trim()} onPress={async () => { await onAddPay(); setPayOpen(false); }}>
                {t('more:growth_add', {defaultValue: 'Add'})}
              </CtaButton>
            </FormSheet>

            {records.length > 0 ? (
              <Layout level="2" style={styles.card}>
                {[...records].reverse().map(r => (
                  <Flex key={r.id} justify="space-between" itemsCenter style={{paddingVertical: 6}}>
                    <View style={{flex: 1}}>
                      <Text category="h9" bold>{fmt(r.base_salary, r.currency)} · {kindLabel(r.kind)}</Text>
                      <Text category="h10" status="placeholder">
                        {r.effective_date}{r.role ? ` · ${r.role}` : ''}{r.company ? ` · ${r.company}` : ''}
                      </Text>
                    </View>
                    <Text
                      category="h10"
                      status="danger"
                      onPress={async () => {
                        await growth.deletePay(r.id).catch(() => {});
                        load();
                      }}>
                      {t('common:delete', {defaultValue: 'Delete'})}
                    </Text>
                  </Flex>
                ))}
              </Layout>
            ) : null}

            {records.length > 0 && marketOn ? (
              <Layout level="2" style={styles.card}>
                <Text category="h8" bold mb={4}>{t('more:growth_market_title', {defaultValue: 'Am I paid fairly?'})}</Text>
                <Text category="h9-s" status="placeholder" mb={8}>
                  {t('more:growth_market_body', {defaultValue: 'Compare your current pay with the market range for your role.'})}
                </Text>
                <CtaButton
                  onPress={() =>
                    navigate('SalaryBenchmark', {
                      kind: 'current',
                      title: records[records.length - 1]?.role ?? '',
                      salary: summary.current_base ? String(summary.current_base) : '',
                      currency: summary.currency ?? '',
                    })
                  }>
                  {t('more:growth_check', {defaultValue: 'Check against the market'})}
                </CtaButton>
              </Layout>
            ) : null}
          </>
        ) : (
          <>
            <CtaButton onPress={() => setPlanOpen(true)} style={{marginBottom: 12}}>
              {plan ? t('more:growth_regenerate', {defaultValue: 'Regenerate plan'}) : t('more:growth_generate', {defaultValue: 'Build my plan'})}
            </CtaButton>
            <FormSheet visible={planOpen} title={t('more:growth_tab_plan', {defaultValue: 'Raise & promotion plan'}).toString()} onClose={() => setPlanOpen(false)}>
              <Flex wrap justify="flex-start" style={{marginHorizontal: -4, marginBottom: 8}}>
                <Chip label={t('more:growth_goal_promotion', {defaultValue: 'Promotion'}).toString()} selected={goal === 'promotion'} onPress={() => setGoal('promotion')} />
                <Chip label={t('more:growth_goal_raise', {defaultValue: 'Raise'}).toString()} selected={goal === 'raise'} onPress={() => setGoal('raise')} />
              </Flex>
              <Input placeholder={t('more:growth_current_role', {defaultValue: 'Current role'}).toString()} value={curRole} onChangeText={setCurRole} style={[styles.input, globalStyle.sheetInput]} />
              <Input placeholder={t('more:growth_target_role', {defaultValue: 'Target role (optional)'}).toString()} value={targetRole} onChangeText={setTargetRole} style={[styles.input, globalStyle.sheetInput]} />
              <Input placeholder={t('more:growth_tenure', {defaultValue: 'Months in this role'}).toString()} keyboardType="numeric" value={tenure} onChangeText={setTenure} style={[styles.input, globalStyle.sheetInput]} />
              <Input
                multiline
                placeholder={t('more:growth_context_placeholder', {defaultValue: 'Anything else: recent wins, manager feedback, company situation…'}).toString()}
                value={context}
                onChangeText={setContext}
                textStyle={{minHeight: 96}}
                style={[styles.input, globalStyle.sheetInput]}
              />
              <CtaButton disabled={planning || !curRole.trim()} onPress={async () => { setPlanOpen(false); await onPlan(); }}>
                {planning
                  ? t('more:growth_planning', {defaultValue: 'Building plan…'})
                  : plan
                  ? t('more:growth_regenerate', {defaultValue: 'Regenerate plan'})
                  : t('more:growth_generate', {defaultValue: 'Build my plan'})}
              </CtaButton>
            </FormSheet>

            {plan ? (
              <Layout level="2" style={styles.card}>
                {plan.payload.readiness ? (
                  <View style={{marginBottom: 10}}>
                    <Text category="h9" bold>
                      {t('more:growth_readiness', {defaultValue: 'Readiness'})}: {plan.payload.readiness.score ?? '—'}/100
                    </Text>
                    <Text category="h9-s" status="placeholder">{plan.payload.readiness.summary}</Text>
                  </View>
                ) : null}
                {plan.payload.evidence?.length ? (
                  <View style={{marginBottom: 10}}>
                    <Text category="h9" bold>{t('more:growth_evidence', {defaultValue: 'Your evidence'})}</Text>
                    {plan.payload.evidence.map((e, i) => <Text key={i} category="h9-s">• {e}</Text>)}
                  </View>
                ) : null}
                {plan.payload.talking_points?.length ? (
                  <View style={{marginBottom: 10}}>
                    <Text category="h9" bold>{t('more:growth_talking_points', {defaultValue: 'What to say'})}</Text>
                    {plan.payload.talking_points.map((tp, i) => (
                      <View key={i} style={{marginTop: 6}}>
                        <Text category="h9-s" bold>{tp.title}</Text>
                        <Text category="h9-s" status="placeholder">“{tp.script}”</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {plan.payload.timeline?.length ? (
                  <View style={{marginBottom: 10}}>
                    <Text category="h9" bold>{t('more:growth_timeline', {defaultValue: 'Timeline'})}</Text>
                    {plan.payload.timeline.map((s, i) => <Text key={i} category="h9-s">• {s.when}: {s.action}</Text>)}
                  </View>
                ) : null}
                {plan.payload.risks?.length ? (
                  <View>
                    <Text category="h9" bold>{t('more:growth_risks', {defaultValue: 'Watch out for'})}</Text>
                    {plan.payload.risks.map((r, i) => <Text key={i} category="h9-s" status="placeholder">• {r}</Text>)}
                  </View>
                ) : null}
              </Layout>
            ) : null}
          </>
        )}
      </Content>
    </Container>
  );
});

export default CareerGrowth;

const themedStyles = StyleService.create({
  container: {flex: 1},
  content: {paddingBottom: 80},
  card: {borderRadius: 20, padding: 14, marginBottom: 12},
  input: {marginBottom: 8},
});
