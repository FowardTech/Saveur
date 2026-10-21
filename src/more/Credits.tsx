import React, {memo} from 'react';
import {Alert, RefreshControl, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Layout, Icon} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';
import {SkeletonList} from 'components/Skeleton';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import * as creditsService from 'services/creditsService';
import {CreditPack, CreditTransaction} from 'services/creditsService';
import {formatPrice} from 'services/billingService';

// AI credits screen: balance + monthly reset, top-up packs (Apple/Google
// consumable in-app purchase), what each action costs, and recent activity.
const Credits = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t, i18n} = useTranslation(['common']);
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const {credits, refresh} = creditsService.useCredits();

  const [history, setHistory] = React.useState<CreditTransaction[] | null>(null);
  const [buyingCode, setBuyingCode] = React.useState<string | null>(null);
  const [showCosts, setShowCosts] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadHistory = React.useCallback(() => {
    creditsService.getHistory().then(setHistory).catch(() => setHistory([]));
  }, []);
  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), creditsService.getHistory().then(setHistory).catch(() => {})]);
    setRefreshing(false);
  };

  const actionLabel = (key: string | null) =>
    key
      ? t(`common:credits_action_${key}`, {defaultValue: key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}).toString()
      : '';

  const onBuy = async (pack: CreditPack) => {
    if (buyingCode) return;
    setBuyingCode(pack.code);
    try {
      const result = await creditsService.purchasePack(pack);
      if (result.kind === 'credits') {
        loadHistory();
        Alert.alert(
          t('common:credits_purchased', {defaultValue: 'Credits added to your account.'}),
          t('common:credits_purchased_body', {defaultValue: '+{{count}} credits', count: result.creditsGranted}).toString(),
        );
      }
    } catch (e: any) {
      Alert.alert(
        t('common:credits_purchase_failed', {defaultValue: "Couldn't complete purchase. Please try again."}),
        e?.message ?? '',
      );
    } finally {
      setBuyingCode(null);
    }
  };

  const resets = credits ? new Date(credits.resets_at).toLocaleDateString(i18n.language, {month: 'long', day: 'numeric'}) : '';
  const pct = credits && credits.allowance > 0 ? Math.min(100, Math.round((credits.monthly / credits.allowance) * 100)) : 0;
  const tierName = credits
    ? credits.tier === 'free'
      ? t('common:credits_tier_free', {defaultValue: 'Free'}).toString()
      : credits.tier === 'pro'
        ? 'Saveur Basic'
        : 'Saveur Premium'
    : '';

  const kindLabel = (h: CreditTransaction) =>
    h.kind === 'monthly_grant'
      ? t('common:credits_kind_monthly', {defaultValue: 'Monthly credits'})
      : h.kind === 'topup'
        ? t('common:credits_kind_topup', {defaultValue: 'Credit purchase'})
        : h.kind === 'refund'
          ? `${t('common:credits_kind_refund', {defaultValue: 'Refund'})}${h.action ? ` · ${actionLabel(h.action)}` : ''}`
          : h.kind === 'admin'
            ? t('common:credits_kind_admin', {defaultValue: 'Adjustment'})
            : actionLabel(h.action);

  return (
    <Container style={styles.container}>
      <TopNavigation title={t('common:credits_title', {defaultValue: 'AI credits'})} accessoryLeft={<NavigationAction />} />
      <Content
        padder
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme['color-primary-500']} />}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('common:credits_subtitle', {
            defaultValue: 'Credits power every AI feature. Your plan refills each month, and you can top up any time.',
          })}
        </Text>

        {!credits ? (
          <SkeletonList count={2} style={{paddingHorizontal: 0}} />
        ) : !credits.enabled ? (
          <Text category="h9-s" status="placeholder">
            {t('common:credits_disabled', {defaultValue: 'Credits are not in use right now.'})}
          </Text>
        ) : (
          <>
            <Layout level="2" style={styles.card}>
              <Flex justify="space-between" itemsCenter mb={6}>
                <Text category="h9" status="placeholder">
                  {t('common:credits_balance', {defaultValue: 'Available credits'})}
                </Text>
                <View style={[styles.tierPill, {backgroundColor: theme['color-primary-transparent-200']}]}>
                  <Text category="h10" bold style={{color: theme['color-primary-500']}}>
                    {tierName}
                  </Text>
                </View>
              </Flex>
              <Text category="h1" bold mb={14}>
                {credits.total}
              </Text>
              <View style={[styles.barTrack, {backgroundColor: theme['background-basic-color-3']}]}>
                <View style={[styles.barFill, {width: `${pct}%`, backgroundColor: theme['color-primary-500']}]} />
              </View>
              <Flex justify="space-between" mt={8}>
                <Text category="h10" status="placeholder" style={globalStyle.flexOne}>
                  {t('common:credits_monthly_left', {
                    defaultValue: '{{left}} of {{total}} monthly credits left',
                    left: credits.monthly,
                    total: credits.allowance,
                  })}
                </Text>
                <Text category="h10" status="placeholder">
                  {t('common:credits_resets_on', {defaultValue: 'Resets {{date}}', date: resets})}
                </Text>
              </Flex>
              {credits.topup > 0 ? (
                <Text category="h10" status="placeholder" mt={6}>
                  {t('common:credits_topup_left', {defaultValue: '+ {{count}} purchased credits (never expire)', count: credits.topup})}
                </Text>
              ) : null}
              {credits.tier !== 'premium' ? (
                <Text
                  category="h9"
                  status="link"
                  bold
                  mt={12}
                  onPress={() => navigate('Subscription')}>
                  {t('common:credits_upgrade', {defaultValue: 'Get more credits every month'})}
                </Text>
              ) : null}
            </Layout>

            <Text category="h7" bold mt={24} mb={12}>
              {t('common:credits_top_up', {defaultValue: 'Buy more credits'})}
            </Text>
            {credits.packs.map(pack => (
              <Layout key={pack.code} level="2" style={styles.packRow}>
                <Icon pack="eva" name="flash-outline" style={[globalStyle.icon24, {tintColor: theme['color-primary-500']}]} />
                <View style={styles.packText}>
                  <Text category="h8" bold>
                    {pack.credits} {t('common:credits_word', {defaultValue: 'credits'})}
                  </Text>
                  <Text category="h10" status="placeholder" mt={2}>
                    {formatPrice(pack.amount, pack.currency)}
                  </Text>
                </View>
                <CtaButton
                  size="small"
                  loading={buyingCode === pack.code}
                  disabled={!!buyingCode}
                  onPress={() => onBuy(pack)}
                  style={styles.buyBtn}>
                  {t('common:credits_buy', {defaultValue: 'Buy'})}
                </CtaButton>
              </Layout>
            ))}
            <Text category="h10" status="placeholder" mt={4}>
              {t('common:credits_pack_note', {defaultValue: 'Purchased credits are used after your monthly credits and never expire.'})}
            </Text>

            <Text
              category="h9"
              status="link"
              bold
              mt={24}
              mb={showCosts ? 10 : 0}
              onPress={() => setShowCosts(v => !v)}>
              {t('common:credits_what_cost', {defaultValue: 'What things cost'})}
            </Text>
            {showCosts ? (
              <Layout level="2" style={styles.card}>
                {Object.entries(credits.costs)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <Flex key={k} justify="space-between" itemsCenter style={styles.costRow}>
                      <Text category="h9-s" style={globalStyle.flexOne}>
                        {actionLabel(k)}
                      </Text>
                      <Text category="h9" bold status="placeholder">
                        {v}
                      </Text>
                    </Flex>
                  ))}
              </Layout>
            ) : null}
          </>
        )}

        <Text category="h7" bold mt={24} mb={12}>
          {t('common:credits_history', {defaultValue: 'Recent activity'})}
        </Text>
        {history === null ? (
          <SkeletonList count={3} style={{paddingHorizontal: 0}} />
        ) : history.length === 0 ? (
          <Text category="h9-s" status="placeholder">
            {t('common:credits_no_history', {defaultValue: 'No credit activity yet.'})}
          </Text>
        ) : (
          <Layout level="2" style={styles.card}>
            {history.map(h => (
              <Flex key={h.id} justify="space-between" itemsCenter style={styles.costRow}>
                <View style={globalStyle.flexOne}>
                  <Text category="h9-s" numberOfLines={1}>
                    {kindLabel(h)}
                  </Text>
                  <Text category="h10" status="placeholder">
                    {new Date(h.created_at).toLocaleString(i18n.language, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text category="h9" bold style={h.delta > 0 ? {color: theme['color-success-500']} : undefined}>
                  {h.delta > 0 ? `+${h.delta}` : h.delta}
                </Text>
              </Flex>
            ))}
          </Layout>
        )}
      </Content>
    </Container>
  );
});

export default Credits;

const themedStyles = StyleService.create({
  container: {flex: 1},
  content: {paddingBottom: 40},
  card: {...globalStyle.card, borderRadius: 16, padding: 16},
  tierPill: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12},
  barTrack: {height: 8, borderRadius: 4, overflow: 'hidden'},
  barFill: {height: 8, borderRadius: 4},
  packRow: {
    ...globalStyle.card,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  packText: {flex: 1, marginLeft: 12},
  buyBtn: {minWidth: 80},
  costRow: {paddingVertical: 8},
});
