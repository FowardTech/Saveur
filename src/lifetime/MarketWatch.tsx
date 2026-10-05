import React from 'react';
import {Linking, TouchableOpacity} from 'react-native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import * as svc from 'services/lifetimeService';
import {LifetimeScreen, Card, Loading, PrimaryButton, Pill, useAsyncAction} from './Scaffold';

const MarketWatch = () => {
  const {t} = useTranslation(['more', 'common']);
  const {busy, run} = useAsyncAction(t);
  const [digest, setDigest] = React.useState<svc.MarketDigest | null | undefined>(undefined);

  React.useEffect(() => {
    svc.getMarket().then(setDigest).catch(() => setDigest(null));
  }, []);

  const refresh = () =>
    run(async () => {
      setDigest(await svc.refreshMarket());
    });

  const stepLabel = (s: string) =>
    s === 'level'
      ? t('more:lt_stepup_level', {defaultValue: 'Next level'})
      : s === 'scope'
      ? t('more:lt_stepup_scope', {defaultValue: 'Bigger scope'})
      : s === 'domain'
      ? t('more:lt_stepup_domain', {defaultValue: 'New domain'})
      : t('more:lt_stepup_match', {defaultValue: 'Strong match'});

  return (
    <LifetimeScreen title={t('more:lt_market_title', {defaultValue: 'Job-market Watch'})}>
      <Text category="h9-s" status="placeholder" mb={12}>
        {t('more:lt_market_intro', {defaultValue: 'A quiet monthly list of roles that could be a step up - no searching required.'})}
      </Text>
      <PrimaryButton label={t('more:lt_market_refresh', {defaultValue: 'Check the market now'})} loading={busy} onPress={refresh} style={{marginBottom: 12}} />
      {digest === undefined ? (
        <Loading />
      ) : !digest || digest.empty || digest.roles.length === 0 ? (
        <Text category="h9-s" status="placeholder" center mt={20}>
          {digest?.empty
            ? t('more:lt_market_empty', {defaultValue: 'No new openings matched your profile this month. Make sure your target roles are set in Job Preferences.'})
            : t('more:lt_market_none', {defaultValue: 'Nothing here yet. Run a check to see roles that could be a step up.'})}
        </Text>
      ) : (
        <>
          {digest.summary ? (
            <Text category="h9" mb={12} style={{lineHeight: 22}}>
              {digest.summary}
            </Text>
          ) : null}
          {digest.roles.map(r => (
            <Card key={r.id}>
              <Pill label={stepLabel(r.step_up)} />
              <Text category="h8" bold mt={8}>
                {r.title}
              </Text>
              <Text category="h9-s" status="placeholder">
                {r.company}
                {r.location ? ` · ${r.location}` : ''}
              </Text>
              <Text category="h9" mt={8} style={{lineHeight: 21}}>
                {r.why}
              </Text>
              {r.apply_url ? (
                <TouchableOpacity onPress={() => Linking.openURL(r.apply_url!)} style={{marginTop: 10}}>
                  <Text category="h9" status="primary" bold>
                    {t('more:lt_view_role', {defaultValue: 'View role'})}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </Card>
          ))}
        </>
      )}
    </LifetimeScreen>
  );
};

export default MarketWatch;
