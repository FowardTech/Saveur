import React, {memo} from 'react';
import {View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Layout, Spinner} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import dayjs from 'dayjs';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CompanyLogoAvatar from 'components/CompanyLogoAvatar';
import EmptyState from 'components/EmptyState';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import {Application_Stage_Enum, JobApplicationProps} from 'constants/Types';
import * as applicationsService from 'services/applicationsService';
import {accentColorForKey, accentTintBg} from 'utils/accentPalette';

// Multi-offer comparison (premium Job Tracker feature, product follow-up:
// "multi-offer comparison/decision support when someone's juggling more
// than one"). Reads every application currently in the Offer stage and
// lays their offer_amount/offer_currency/offer_deadline (see
// ApplicationDetails.tsx's offer-fields editor) side by side.
const CompareOffers = memo(() => {
  const {goBack, navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {t} = useTranslation(['request', 'common']);

  const [offers, setOffers] = React.useState<JobApplicationProps[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    applicationsService
      .listApplications()
      .then(all => {
        if (!cancelled) {
          setOffers(all.filter(a => a.stage === Application_Stage_Enum.Offer));
        }
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message ?? t('request:compare_offers_load_failed', {defaultValue: "Couldn't load your offers."}));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Highest offer_amount wins the "best offer" highlight — only meaningful
  // when every compared offer shares the same currency, which is the
  // common case (most users compare offers within one country/market); a
  // mixed-currency comparison still shows every figure, just without the
  // highlight, rather than attempting a currency conversion this app has
  // no live exchange-rate source for.
  const amounts = (offers ?? []).map(o => o.offerAmount).filter((v): v is number => v != null);
  const currencies = new Set((offers ?? []).map(o => o.offerCurrency).filter(Boolean));
  const canHighlightBest = amounts.length >= 2 && currencies.size <= 1;
  const bestAmount = canHighlightBest ? Math.max(...amounts) : null;

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={<NavigationAction icon={'back'} onPress={goBack} />}
        title={<Text center category="h6" bold>{t('request:compare_offers_title', {defaultValue: 'Compare offers'})}</Text>}
      />
      <Content padder contentContainerStyle={styles.content}>
        {error ? (
          <Text category="h9-s" status="danger" center mt={24}>{error}</Text>
        ) : offers === null ? (
          <Flex vertical itemsCenter justify="center" style={{paddingVertical: 60}}>
            <Spinner size="medium" />
          </Flex>
        ) : offers.length === 0 ? (
          <EmptyState
            icon="award-outline"
            title={t('request:compare_offers_empty_title', {defaultValue: 'No offers yet'})}
            body={t('request:compare_offers_empty_body', {defaultValue: 'Once an application reaches the Offer stage, it’ll show up here.'})}
          />
        ) : (
          offers.map(offer => {
            const accent = accentColorForKey(offer.company);
            const isBest = bestAmount !== null && offer.offerAmount === bestAmount;
            return (
              <Layout
                key={offer.id}
                level="2"
                style={[styles.offerCard, isBest ? {borderColor: theme['color-success-500'], borderWidth: 1.5} : null]}>
                <Flex
                  justify="flex-start"
                  itemsCenter
                  onPress={() => navigate('RequestStack', {screen: 'ApplicationDetails', params: {id: offer.id}})}>
                  <CompanyLogoAvatar
                    logoUrl={offer.companyLogoUrl}
                    companyName={offer.company}
                    size="small"
                    fallbackIcon="briefcase-outline"
                    fallbackTintColor={accent}
                    fallbackBgColor={accentTintBg(accent)}
                    style={{marginRight: 10}}
                  />
                  <View style={globalStyle.flexOne}>
                    <Text category="h9" bold numberOfLines={1}>{offer.company}</Text>
                    <Text category="h10" status="placeholder" numberOfLines={1} mt={2}>{offer.role}</Text>
                  </View>
                  {isBest ? (
                    <View style={[styles.bestBadge, {backgroundColor: accentTintBg('#10B981')}]}>
                      <Text category="h10" bold style={{color: '#10B981'}}>
                        {t('request:compare_offers_best', {defaultValue: 'Highest'})}
                      </Text>
                    </View>
                  ) : null}
                </Flex>
                <View style={styles.divider} />
                <Flex justify="space-between">
                  <View>
                    <Text category="h10" status="placeholder">
                      {t('request:compare_offers_amount', {defaultValue: 'Offer'})}
                    </Text>
                    <Text category="h7" bold mt={2}>
                      {offer.offerAmount != null
                        ? `${offer.offerCurrency ?? ''} ${offer.offerAmount.toLocaleString()}`.trim()
                        : t('request:compare_offers_not_set', {defaultValue: 'Not set'})}
                    </Text>
                  </View>
                  <View>
                    <Text category="h10" status="placeholder">
                      {t('request:compare_offers_deadline', {defaultValue: 'Decision deadline'})}
                    </Text>
                    <Text category="h7" bold mt={2}>
                      {offer.offerDeadline
                        ? dayjs.utc(offer.offerDeadline).format('MMM DD, YYYY')
                        : t('request:compare_offers_not_set', {defaultValue: 'Not set'})}
                    </Text>
                  </View>
                </Flex>
              </Layout>
            );
          })
        )}
      </Content>
    </Container>
  );
});

export default CompareOffers;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  offerCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: 'border-basic-color-3',
    marginVertical: 14,
  },
  bestBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
});
