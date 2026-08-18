import React, {memo} from 'react';
import {Alert, Platform, Share, View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Spinner,
} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import { SkeletonList } from 'components/Skeleton';
import {globalStyle} from 'styles/globalStyle';
import {PaymentHistoryItemProps} from 'constants/Types';
import * as billingService from 'services/billingService';
import CardBrandLogo from 'components/CardBrandLogo';

const CURRENCY_SYMBOLS: Record<string, string> = {usd: '$', eur: '€', gbp: '£'};

function formatAmount(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency?.toLowerCase()] ?? '';
  return `${symbol}${(amount / 100).toFixed(2)}${symbol ? '' : ` ${currency?.toUpperCase()}`}`;
}

// Payment History — GET /api/v1/billing/payments (see services/
// billingService.ts and app/api/billing.py's list_payments/download_receipt/
// send_receipt_now on the backend). Reached from MoreSrc.tsx, right next to
// Subscription/Payment Methods. Each row is one successfully captured Stripe
// charge (subscription invoice or one-time payment) with the card used for
// it, and two actions: re-send the receipt email, or download the PDF
// straight to the device.
const PaymentHistory = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t, i18n} = useTranslation(['more', 'common']);

  const [payments, setPayments] = React.useState<PaymentHistoryItemProps[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [sendingId, setSendingId] = React.useState<number | null>(null);
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null);

  const loadPayments = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await billingService.listPayments();
      setPayments(list);
    } catch (error: any) {
      setLoadError(
        error?.message ?? t('more:payment_history_load_failed', {defaultValue: 'Could not load your payment history.'}),
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const onSendReceipt = async (payment: PaymentHistoryItemProps) => {
    if (sendingId) return;
    setSendingId(payment.id);
    try {
      const {sentTo} = await billingService.sendReceiptEmail(payment.id);
      Alert.alert(
        t('more:receipt_sent_title', {defaultValue: 'Receipt sent'}),
        t('more:receipt_sent_body', {defaultValue: 'Check your inbox at {{email}}.', email: sentTo}),
      );
    } catch (error: any) {
      Alert.alert(
        t('more:receipt_send_failed_title', {defaultValue: "Couldn't send that receipt"}),
        error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setSendingId(null);
    }
  };

  const onDownloadReceipt = async (payment: PaymentHistoryItemProps) => {
    if (downloadingId) return;
    setDownloadingId(payment.id);
    try {
      const {path, filename} = await billingService.downloadReceiptPdf(payment);
      if (Platform.OS === 'android') {
        Alert.alert(
          t('more:receipt_download_started_title', {defaultValue: 'Download started'}),
          t('more:receipt_download_started_body', {defaultValue: '{{filename}} is downloading.', filename}),
        );
      } else {
        await Share.share({url: `file://${path}`, title: filename});
      }
    } catch (error: any) {
      Alert.alert(
        t('more:receipt_download_failed_title', {defaultValue: "Couldn't download that receipt"}),
        error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:payment_history', {defaultValue: 'Payment History'})}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        {isLoading ? (
          <SkeletonList count={4} style={{ paddingHorizontal: 16 }} />
        ) : loadError ? (
          <EmptyState
            variant="error"
            title={t('common:something_went_wrong', {defaultValue: 'Something went wrong'})}
            body={loadError}
            actionLabel={t('common:try_again', {defaultValue: 'Try again'})}
            onAction={loadPayments}
          />
        ) : !payments || payments.length === 0 ? (
          <EmptyState
            icon="credit-card-outline"
            title={t('more:payment_history_empty_title', {defaultValue: 'No payments yet'})}
            body={t('more:payment_history_empty_body', {defaultValue: 'Your completed payments will show up here.'})}
          />
        ) : (
          <>
            <Text category="h9-s" status="placeholder" mb={16}>
              {t('more:payment_history_description', {
                defaultValue: "All the payments you've made on Saveur, with the card used for each.",
              })}
            </Text>
            {payments.map(payment => (
              <Layout key={payment.id} level="2" style={styles.card}>
                <Flex justify="space-between" itemsCenter>
                  <Text category="h6" bold style={globalStyle.flexOne}>
                    {payment.description ?? t('more:subscription', {defaultValue: 'Subscription'})}
                  </Text>
                  <Text category="h6" bold>
                    {formatAmount(payment.amount, payment.currency)}
                  </Text>
                </Flex>
                <Text category="h10" status="placeholder" mt={4}>
                  {new Date(payment.createdAt).toLocaleDateString(i18n.language, {year: 'numeric', month: 'long', day: 'numeric'})}
                </Text>
                {/* Product report: "why are we having $69.00/month and then
                    $66.93. The user needs to know which is the discount and
                    which is the normal price" — payment.description already
                    carries Stripe's list-price string (e.g. "Saveur Pro
                    Premium (at $69.00 / month)"), but nothing explained why
                    the amount charged, above, was a different number. When a
                    coupon actually applied (discountAmount > 0), spell out
                    the breakdown instead of leaving the two numbers to
                    speak for themselves. */}
                {payment.discountAmount ? (
                  <View style={styles.discountBreakdown}>
                    <Flex justify="space-between" mt={2}>
                      <Text category="h10" status="placeholder">
                        {t('more:receipt_list_price', {defaultValue: 'List price'})}
                      </Text>
                      <Text category="h10" status="placeholder">
                        {formatAmount(payment.amount + payment.discountAmount, payment.currency)}
                      </Text>
                    </Flex>
                    <Flex justify="space-between" mt={2}>
                      <Text category="h10" status="success">
                        {t('more:receipt_discount_applied', {defaultValue: 'Discount applied'})}
                      </Text>
                      <Text category="h10" status="success">
                        -{formatAmount(payment.discountAmount, payment.currency)}
                      </Text>
                    </Flex>
                    <Flex justify="space-between" mt={4}>
                      <Text category="h10" bold>
                        {t('more:receipt_total_charged', {defaultValue: 'Total charged'})}
                      </Text>
                      <Text category="h10" bold>
                        {formatAmount(payment.amount, payment.currency)}
                      </Text>
                    </Flex>
                  </View>
                ) : null}
                {payment.cardBrand && payment.cardLast4 ? (
                  <Flex justify="flex-start" itemsCenter mt={10}>
                    {/* Product report: "in the payment history it should
                        also display the logo of the card used instead of
                        displaying the crown icon. The crown icon should be
                        a fallback" — BRAND_ICON used to map every brand
                        (only visa/mastercard were even listed) to the same
                        "master" asset key, which resolves to a plain tinted
                        Crown glyph (see assets/AssetIconsPack.tsx), not a
                        real card logo. CardBrandLogo renders the actual
                        brand mark for payment.cardBrand and only falls back
                        to that Crown glyph when the brand isn't recognized. */}
                    <CardBrandLogo brand={payment.cardBrand} width={28} height={18} style={styles.cardIcon} />
                    <Text category="h10" status="placeholder" ml={8} style={{textTransform: 'capitalize'}}>
                      {payment.cardBrand} •••• {payment.cardLast4}
                    </Text>
                  </Flex>
                ) : null}
                <Flex justify="flex-start" itemsCenter mt={16} wrap>
                  <Button
                    size="small"
                    status="basic"
                    appearance="outline"
                    style={{marginRight: 10, marginBottom: 10}}
                    disabled={sendingId === payment.id}
                    accessoryLeft={sendingId === payment.id ? () => <Spinner size="small" status="basic" /> : undefined}
                    onPress={() => onSendReceipt(payment)}>
                    {sendingId === payment.id
                      ? t('more:sending_receipt', {defaultValue: 'Sending…'})
                      : t('more:send_receipt_to_email', {defaultValue: 'Send receipt to email'})}
                  </Button>
                  <Button
                    size="small"
                    // Was status="primary" — constants/theme/mapping.json's
                    // ghost+primary variant maps textColor to the
                    // "text-primary-color" token, which light.json defines
                    // as `$color-basic-100` — the exact same value as this
                    // card's own background (background-basic-color-2 is
                    // also `$color-basic-100`). That made this button's
                    // text render as white-on-white: present and tappable,
                    // just literally invisible. "info" isn't overridden in
                    // light.json/dark.json, so it keeps Eva's normal
                    // distinct blue and stays visible against the card in
                    // both themes.
                    status="info"
                    appearance="ghost"
                    style={{marginBottom: 10,}}
                    disabled={downloadingId === payment.id}
                    accessoryLeft={downloadingId === payment.id ? () => <Spinner size="small" status="primary" /> : undefined}
                    onPress={() => onDownloadReceipt(payment)}>
                    {downloadingId === payment.id
                      ? t('more:downloading_receipt', {defaultValue: 'Downloading…'})
                      : t('more:download_receipt', {defaultValue: 'Download receipt'})}
                  </Button>
                </Flex>
              </Layout>
            ))}
          </>
        )}
      </Content>
    </Container>
  );
});

export default PaymentHistory;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  card: {
    ...globalStyle.card,
    padding: 18,
    marginBottom: 16,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
    // See the "Send receipt"/"Download receipt" buttons below for why
    // their status choices stay as-is regardless of this: that
    // white-on-white bug was about a button's text color exactly matching
    // background-basic-color-2's own value, not about the card's fill.
  },
  cardIcon: {
    // Sizing comes from CardBrandLogo's own width/height props now (see the
    // call site above) — left empty rather than removed so a future tweak
    // has an obvious place to add layout-only styling (margins, etc.)
    // without fighting those props the way a width/height here would.
  },
  discountBreakdown: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'border-basic-color-3',
  },
});
