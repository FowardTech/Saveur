import React, {memo} from 'react';
import {Alert, Platform, Share} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Icon,
  Button,
  Spinner,
} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import {globalStyle} from 'styles/globalStyle';
import {PaymentHistoryItemProps} from 'constants/Types';
import * as billingService from 'services/billingService';

const CURRENCY_SYMBOLS: Record<string, string> = {usd: '$', eur: '€', gbp: '£'};

function formatAmount(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency?.toLowerCase()] ?? '';
  return `${symbol}${(amount / 100).toFixed(2)}${symbol ? '' : ` ${currency?.toUpperCase()}`}`;
}

const BRAND_ICON: Record<string, string> = {
  visa: 'master',
  mastercard: 'master',
};

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
  const {t} = useTranslation(['more', 'common']);

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
          <Flex vertical itemsCenter justify="center" style={{paddingVertical: 60}}>
            <Spinner size="large" />
          </Flex>
        ) : loadError ? (
          <Flex vertical itemsCenter justify="center" style={{paddingVertical: 40}}>
            <Text category="h9-s" status="danger" center mb={16}>
              {loadError}
            </Text>
            <Text category="h9" status="link" bold onPress={loadPayments}>
              {t('common:try_again', {defaultValue: 'Try again'})}
            </Text>
          </Flex>
        ) : !payments || payments.length === 0 ? (
          <Flex vertical itemsCenter justify="center" style={{paddingVertical: 60}}>
            <Icon pack="eva" name="credit-card-outline" style={{width: 32, height: 32, tintColor: theme['text-hint-color'], marginBottom: 12}} />
            <Text category="h7" bold center mb={8}>
              {t('more:payment_history_empty_title', {defaultValue: 'No payments yet'})}
            </Text>
            <Text category="h9-s" status="placeholder" center>
              {t('more:payment_history_empty_body', {defaultValue: 'Your completed payments will show up here.'})}
            </Text>
          </Flex>
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
                  {new Date(payment.createdAt).toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'})}
                </Text>
                {payment.cardBrand && payment.cardLast4 ? (
                  <Flex justify="flex-start" itemsCenter mt={10}>
                    <Icon pack="assets" name={BRAND_ICON[payment.cardBrand.toLowerCase()] ?? 'master'} style={styles.cardIcon} />
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
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  cardIcon: {
    width: 28,
    height: 20,
  },
});
