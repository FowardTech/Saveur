import {LocationPickerField, CurrencyPickerField} from 'components/PickerFields';
import React, {memo} from 'react';
import {Alert, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Input, Layout, Spinner} from '@ui-kitten/components';
import {NavigationProp, RouteProp, useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';
import FormSheet from 'components/FormSheet';
import {RootStackParamList} from 'navigation/types';
import * as service from 'services/salaryBenchmarkService';
import {SalaryBenchmark as Benchmark} from 'services/salaryBenchmarkService';

// Numeric salary benchmark: role + location + experience -> P10-P90 range.
const SalaryBenchmark = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const p = useRoute<RouteProp<RootStackParamList, 'SalaryBenchmark'>>().params;
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t, i18n} = useTranslation(['more', 'common']);

  const [open, setOpen] = React.useState(!!p?.kind);
  const [title, setTitle] = React.useState(p?.title ?? '');
  const [location, setLocation] = React.useState(p?.location ?? '');
  const [years, setYears] = React.useState(p?.years ?? '');
  const [currency, setCurrency] = React.useState(p?.currency ?? '');
  const [salary, setSalary] = React.useState(p?.salary ?? '');
  const [kind, setKind] = React.useState<'offer' | 'current'>(p?.kind === 'offer' ? 'offer' : 'current');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<Benchmark | null>(null);

  const run = async () => {
    if (loading || !title.trim() || !location.trim()) return;
    setLoading(true);
    try {
      setResult(
        await service.getSalaryBenchmark({
          title: title.trim(),
          location: location.trim(),
          years_experience: years ? Number(years) : undefined,
          currency: currency.trim() || undefined,
          your_salary: salary ? Number(salary) : undefined,
          kind: salary ? kind : undefined,
        }),
      );
      setOpen(false);
    } catch (e: any) {
      if (e?.status === 402 || e?.code === 'pro_required') {
        Alert.alert(
          String(t('more:salary_bm_paid_title', {defaultValue: 'Paid feature'})),
          String(t('more:salary_bm_paid_body', {defaultValue: 'Comparing your own number is available on paid plans.'})),
          [
            {text: String(t('common:cancel', {defaultValue: 'Cancel'})), style: 'cancel'},
            {text: String(t('more:upgrade', {defaultValue: 'Upgrade'})), onPress: () => navigate('Subscription')},
          ],
        );
        return;
      }
      Alert.alert(String(t('common:something_went_wrong', {defaultValue: 'Something went wrong'})), e?.message);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number, cur: string) => {
    try {
      return new Intl.NumberFormat(i18n.language, {style: 'currency', currency: cur, maximumFractionDigits: 0}).format(n);
    } catch {
      return `${cur} ${Math.round(n).toLocaleString()}`;
    }
  };

  const pc = result?.percentiles;
  const span = pc ? Math.max(pc.p90 - pc.p10, 1) : 1;
  const pct = (v: number) => (pc ? `${Math.max(0, Math.min(100, ((v - pc.p10) / span) * 100))}%` : '0%');
  const rows: {key: keyof Benchmark['percentiles']; label: string}[] = [
    {key: 'p10', label: String(t('more:salary_bm_p10', {defaultValue: 'Low (10th percentile)'}))},
    {key: 'p25', label: String(t('more:salary_bm_p25', {defaultValue: '25th percentile'}))},
    {key: 'p50', label: String(t('more:salary_bm_p50', {defaultValue: 'Typical (median)'}))},
    {key: 'p75', label: String(t('more:salary_bm_p75', {defaultValue: '75th percentile'}))},
    {key: 'p90', label: String(t('more:salary_bm_p90', {defaultValue: 'High (90th percentile)'}))},
  ];

  return (
    <Container style={styles.container}>
      <TopNavigation title={String(t('more:salary_benchmark', {defaultValue: 'Salary Benchmark'}))} accessoryLeft={<NavigationAction />} />
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={12}>
          {t('more:salary_bm_subtitle', {defaultValue: 'See the market pay range for any role, location and experience level.'})}
        </Text>
        <CtaButton onPress={() => setOpen(true)} style={{marginBottom: 16}}>
          {result ? t('more:salary_bm_new', {defaultValue: 'New benchmark'}) : t('more:salary_bm_start', {defaultValue: 'Get salary range'})}
        </CtaButton>

        {result && pc ? (
          <Layout level="2" style={styles.card}>
            <Text category="h10" status="placeholder">{t('more:salary_bm_typical', {defaultValue: 'Typical yearly base'})}</Text>
            <Text category="h4" bold mt={2}>{fmt(pc.p50, result.currency)}</Text>
            <Text category="h9-s" status="placeholder">
              {fmt(pc.p10, result.currency)} – {fmt(pc.p90, result.currency)}
            </Text>
            {result.position && result.your_salary != null ? (
              <View style={styles.tip}>
                <Text category="h9" bold>
                  {result.kind === 'offer' ? t('more:salary_bm_your_offer', {defaultValue: 'Your offer'}) : t('more:salary_bm_your_pay', {defaultValue: 'Your pay'})}: {fmt(result.your_salary, result.currency)} ·{' '}
                  {t(`more:salary_bm_position_${result.position}`, {defaultValue: result.position.replace(/_/g, ' ')})}
                </Text>
                {result.gap_pct != null ? (
                  <Text category="h9-s" status="placeholder" mt={2}>
                    {Math.abs(result.gap_pct)}% {result.gap_pct >= 0 ? t('more:salary_bm_below_median', {defaultValue: 'below the median'}) : t('more:salary_bm_above_median', {defaultValue: 'above the median'})}
                  </Text>
                ) : null}
                {result.suggested_ask != null ? (
                  <Text category="h9-s" mt={2}>
                    {t('more:salary_bm_suggested_ask', {defaultValue: 'Suggested ask'})}: <Text category="h9-s" bold>{fmt(result.suggested_ask, result.currency)}</Text>
                  </Text>
                ) : null}
              </View>
            ) : null}
            <View style={styles.bar}>
              <View style={[styles.barMid, {left: pct(pc.p25) as any, width: `${((pc.p75 - pc.p25) / span) * 100}%` as any}]} />
              <View style={[styles.marker, {left: pct(pc.p50) as any, backgroundColor: theme['text-basic-color']}]} />
            </View>
            {rows.map(r => (
              <View key={r.key} style={styles.row}>
                <Text category="h9-s" status="placeholder">{r.label}</Text>
                <Text category="h9" bold>{fmt(pc[r.key], result.currency)}</Text>
              </View>
            ))}
            <Text category="h10" status="placeholder" mt={10}>
              {t('more:salary_bm_confidence', {defaultValue: 'Confidence'})}: {t(`more:salary_bm_confidence_${result.confidence}`, {defaultValue: result.confidence})}
            </Text>
            {result.factors.length > 0 ? (
              <View style={{marginTop: 12}}>
                <Text category="h9" bold mb={4}>{t('more:salary_bm_factors', {defaultValue: 'What moves this number'})}</Text>
                {result.factors.map((f, i) => (
                  <Text key={i} category="h9-s" mt={4}>
                    {f.effect === 'raises' ? '↑' : '↓'} <Text category="h9-s" bold>{f.name}:</Text> {f.detail}
                  </Text>
                ))}
              </View>
            ) : null}
            {result.negotiation_tip ? (
              <View style={styles.tip}>
                <Text category="h9-s">{result.negotiation_tip}</Text>
              </View>
            ) : null}
            {result.caveat ? <Text category="h10" status="placeholder" mt={10}>{result.caveat}</Text> : null}
            <View style={{marginTop: 14, flexDirection: 'row'}}>
              <Text category="h9" status="link" bold onPress={() => navigate('SalaryNegotiation')}>
                {t('more:salary_bm_to_negotiation', {defaultValue: 'Practice negotiating'})}
              </Text>
            </View>
          </Layout>
        ) : null}
      </Content>

      <FormSheet
        visible={open}
        title={String(t('more:salary_benchmark', {defaultValue: 'Salary Benchmark'}))}
        onClose={() => setOpen(false)}>
        <Input placeholder={String(t('more:salary_bm_role', {defaultValue: 'Job title (e.g. Product Manager)'}))} value={title} onChangeText={setTitle} style={styles.input} />
        <LocationPickerField placeholder={String(t('more:salary_bm_location', {defaultValue: 'Select country and city'}))} value={location} onChange={setLocation} style={styles.input} />
        <Input placeholder={String(t('more:salary_bm_years', {defaultValue: 'Years of experience'}))} keyboardType="numeric" value={years} onChangeText={setYears} style={styles.input} />
        <CurrencyPickerField optional placeholder={String(t('more:salary_bm_currency', {defaultValue: 'Currency (optional)'}))} value={currency} onChange={setCurrency} style={styles.input} />
        <Text category="h9" bold mb={8}>{t('more:salary_bm_compare', {defaultValue: 'Compare your own number (optional)'})}</Text>
        <View style={{flexDirection: 'row', marginBottom: 12}}>
          {(['offer', 'current'] as const).map(k => (
            <Text
              key={k}
              category="h9"
              bold={kind === k}
              onPress={() => setKind(k)}
              style={[styles.chip, kind === k ? styles.chipOn : null]}>
              {k === 'offer' ? t('more:salary_bm_kind_offer', {defaultValue: 'A job offer'}) : t('more:salary_bm_kind_current', {defaultValue: 'My current pay'})}
            </Text>
          ))}
        </View>
        <Input placeholder={String(t('more:salary_bm_your_salary', {defaultValue: 'Yearly base salary'}))} keyboardType="numeric" value={salary} onChangeText={setSalary} style={styles.input} />
        <CtaButton disabled={loading || !title.trim() || !location.trim()} onPress={run}>
          {loading ? () => <Spinner size="small" status="basic" /> : t('more:salary_bm_start', {defaultValue: 'Get salary range'})}
        </CtaButton>
      </FormSheet>
    </Container>
  );
});

export default SalaryBenchmark;

const themedStyles = StyleService.create({
  container: {flex: 1},
  content: {paddingBottom: 80},
  card: {borderRadius: 14, padding: 16},
  input: {marginBottom: 12},
  chip: {borderWidth: 1, borderColor: 'border-card-default', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, marginRight: 8, overflow: 'hidden'},
  chipOn: {backgroundColor: 'background-basic-color-4'},
  bar: {height: 8, borderRadius: 4, backgroundColor: 'background-basic-color-3', marginVertical: 16, justifyContent: 'center'},
  barMid: {position: 'absolute', top: 0, bottom: 0, borderRadius: 4, backgroundColor: 'background-basic-color-4'},
  marker: {position: 'absolute', top: -4, width: 4, height: 16, borderRadius: 2},
  row: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'border-card-default'},
  tip: {marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: 'background-basic-color-3'},
});

