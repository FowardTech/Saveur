import React from 'react';
import {View} from 'react-native';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import {LocationPickerField} from 'components/PickerFields';
import * as svc from 'services/lifetimeService';
import {LifetimeScreen, Card, Loading, PrimaryButton, Pill, useAsyncAction} from './Scaffold';

const fmt = (n: number, cur: string) => {
  try {
    return new Intl.NumberFormat(undefined, {style: 'currency', currency: cur, maximumFractionDigits: 0}).format(n);
  } catch {
    return `${Math.round(n)} ${cur}`;
  }
};

const PayWatch = () => {
  const {t} = useTranslation(['more', 'common']);
  const navigation = useNavigation<NavigationProp<any>>();
  const {busy, run} = useAsyncAction(t);
  const [state, setState] = React.useState<{latest: svc.PayCheck | null; due: boolean} | null>(null);
  const [location, setLocation] = React.useState('');

  React.useEffect(() => {
    svc.getPay().then(setState).catch(() => setState({latest: null, due: true}));
  }, []);

  const check = () =>
    run(async () => {
      const latest = await svc.runPayCheck(location || undefined);
      setState({latest, due: false});
    });

  const p = state?.latest;
  return (
    <LifetimeScreen title={t('more:lt_pay_title', {defaultValue: 'Pay & Market Alerts'})}>
      <Text category="h9-s" status="placeholder" mb={12}>
        {t('more:lt_pay_intro', {defaultValue: 'A yearly benchmark of your pay against the market. We will nudge you when you fall behind.'})}
      </Text>
      {!state ? (
        <Loading />
      ) : (
        <>
          {state.due ? (
            <Card style={{backgroundColor: 'rgba(255,138,61,0.14)'}}>
              <Text category="h9" bold>
                {t('more:lt_pay_due', {defaultValue: 'Time for your yearly pay check'})}
              </Text>
            </Card>
          ) : null}
          <Text category="h10" status="placeholder" mb={4}>
            {t('more:lt_pay_location', {defaultValue: 'Where do you work? (optional)'})}
          </Text>
          <LocationPickerField value={location} onChange={setLocation} style={{marginBottom: 12}} />
          <PrimaryButton label={t('more:lt_pay_run', {defaultValue: 'Check my pay now'})} loading={busy} onPress={check} style={{marginBottom: 12}} />
          {p ? (
            <>
              <Card>
                <Pill
                  label={p.behind ? t('more:lt_pay_behind', {defaultValue: 'Behind the market'}) : t('more:lt_pay_ok', {defaultValue: 'In line with the market'})}
                  color={p.behind ? '#FF8A3D' : '#19B87A'}
                />
                <Text category="h4" bold mt={10}>
                  {fmt(p.current_base, p.currency)}
                </Text>
                <Text category="h9-s" status="placeholder">
                  {t('more:lt_pay_your_base', {defaultValue: 'Your current base'})}
                  {p.role ? ` · ${p.role}` : ''}
                  {p.location ? ` · ${p.location}` : ''}
                </Text>
                {p.gap_pct ? (
                  <Text category="h9" mt={10}>
                    {p.gap_pct > 0
                      ? t('more:lt_pay_gap_below', {defaultValue: 'About {{pct}}% below the market median.', pct: Math.abs(Math.round(p.gap_pct))})
                      : t('more:lt_pay_gap_above', {defaultValue: 'About {{pct}}% above the market median.', pct: Math.abs(Math.round(p.gap_pct))})}
                  </Text>
                ) : null}
              </Card>
              <Card>
                <Text category="h8" bold mb={4}>
                  {t('more:lt_pay_market', {defaultValue: 'Market range'})}
                </Text>
                {(
                  [
                    ['p25', t('more:lt_p25', {defaultValue: 'Lower quartile'})],
                    ['p50', t('more:lt_p50', {defaultValue: 'Median'})],
                    ['p75', t('more:lt_p75', {defaultValue: 'Upper quartile'})],
                  ] as const
                ).map(([k, label]) => (
                  <View key={k} style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 6}}>
                    <Text category="h9-s" status="placeholder">
                      {label}
                    </Text>
                    <Text category="h9" bold>
                      {fmt(p.market[k], p.currency)}
                    </Text>
                  </View>
                ))}
                {p.suggested_ask ? (
                  <Text category="h9" bold mt={12}>
                    {t('more:lt_pay_ask', {defaultValue: 'Suggested ask'})}: {fmt(p.suggested_ask, p.currency)}
                  </Text>
                ) : null}
                {p.tip ? (
                  <Text category="h9-s" mt={10} style={{lineHeight: 21}}>
                    {p.tip}
                  </Text>
                ) : null}
                {p.caveat ? (
                  <Text category="h10" status="placeholder" mt={8}>
                    {p.caveat}
                  </Text>
                ) : null}
              </Card>
              {p.behind ? (
                <PrimaryButton label={t('more:lt_pay_negotiate', {defaultValue: 'Practice asking for a raise'})} onPress={() => navigation.navigate('RolePlay', {scenario: 'promotion_ask', title: String(t('more:lt_pay_negotiate', {defaultValue: 'Practice asking for a raise'}))})} />
              ) : null}
            </>
          ) : (
            <Text category="h9-s" status="placeholder" center mt={12}>
              {t('more:lt_pay_none', {defaultValue: 'Add your current pay in Career Growth, then run your first check.'})}
            </Text>
          )}
        </>
      )}
    </LifetimeScreen>
  );
};

export default PayWatch;
