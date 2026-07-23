import React, {memo} from 'react';
import {Alert, View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import {useTranslation} from 'react-i18next';
import {initStripe, useStripe} from '@stripe/stripe-react-native';

import Content from 'components/Content';
import Container from 'components/Container';
import NavigationAction from 'components/NavigationAction';
import {SavedPaymentMethodProps} from 'constants/Types';
import Flex from 'components/Flex';
import Text from 'components/Text';
import {globalStyle} from 'styles/globalStyle';
import SwiperCard from 'components/SwiperCard';
import * as billingService from 'services/billingService';
import {stripeAppearance} from 'utils/stripeAppearance';

// Matches Subscription.tsx's STRIPE_RETURN_URL — required by initPaymentSheet
// even in setup mode, in case a saved card's verification redirects out
// (e.g. certain bank flows) and needs to hand control back to the app.
const STRIPE_RETURN_URL = 'saveur://stripe-redirect';

const BRAND_ICON: Record<string, string> = {
  visa: 'master',
  mastercard: 'master',
};

// Real saved-card management — GET/POST/DELETE /api/v1/billing/payment-methods
// (see services/billingService.ts). Replaces the old DATA_PAYMENT mock list
// and the "AddMorePayment" manual card-number-entry screen (which posted raw
// card numbers through this app's own form — not how Stripe wants cards
// collected, and not PCI-compliant) with Stripe's native Payment Sheet in
// *setup* mode (POST /billing/setup-intent -> initPaymentSheet with
// setupIntentClientSecret, not paymentIntentClientSecret). Swipe left on a
// card to set it default or remove it (SwiperCard's edit/delete slots,
// relabeled).
const PaymentMethod = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['payment', 'common']);
  const {initPaymentSheet, presentPaymentSheet} = useStripe();

  const [methods, setMethods] = React.useState<SavedPaymentMethodProps[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const loadMethods = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await billingService.listPaymentMethods();
      setMethods(list);
    } catch (error: any) {
      setLoadError(error?.message ?? 'Could not load your saved cards.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  const onAdd = async () => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      const setup = await billingService.createSetupIntent();
      await initStripe({publishableKey: setup.publishableKey, urlScheme: 'saveur'});
      const {error: initError} = await initPaymentSheet({
        merchantDisplayName: 'Saveur',
        customerId: setup.customerId,
        customerEphemeralKeySecret: setup.ephemeralKeySecret,
        setupIntentClientSecret: setup.clientSecret,
        allowsDelayedPaymentMethods: false,
        returnURL: STRIPE_RETURN_URL,
        appearance: stripeAppearance,
      });
      if (initError) throw new Error(initError.message);
      const {error: presentError} = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code === 'Canceled') return;
        throw new Error(presentError.message);
      }
      await loadMethods();
    } catch (error: any) {
      Alert.alert(
        t('payment:add_card_failed_title', {defaultValue: "Couldn't add card"}),
        error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setIsAdding(false);
    }
  };

  const onSetDefault = async (method: SavedPaymentMethodProps) => {
    if (method.isDefault || busyId) return;
    setBusyId(method.id);
    // Optimistic — flip the local default flag immediately rather than
    // waiting on a full refetch, since this is purely a "which one is
    // starred" change with no other data to reconcile.
    setMethods(prev => prev?.map(m => ({...m, isDefault: m.id === method.id})) ?? prev);
    try {
      await billingService.setDefaultPaymentMethod(method.id);
    } catch (error: any) {
      Alert.alert(
        t('payment:set_default_failed_title', {defaultValue: "Couldn't update default card"}),
        error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
      loadMethods();
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (method: SavedPaymentMethodProps) => {
    if (busyId) return;
    setBusyId(method.id);
    const previous = methods;
    setMethods(prev => prev?.filter(m => m.id !== method.id) ?? prev);
    try {
      await billingService.deletePaymentMethod(method.id);
    } catch (error: any) {
      setMethods(previous ?? null);
      Alert.alert(
        t('payment:remove_card_failed_title', {defaultValue: "Couldn't remove card"}),
        error?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('payment:payment-method')}
        accessoryLeft={<NavigationAction />}
        accessoryRight={
          isAdding ? (
            <Spinner size="small" />
          ) : (
            <NavigationAction icon="plusImg" size="small" onPress={onAdd} />
          )
        }
      />
      <Content style={styles.content}>
        {isLoading ? (
          <Flex vertical itemsCenter justify="center" style={{paddingVertical: 60}}>
            <Spinner size="large" />
          </Flex>
        ) : loadError ? (
          <Flex vertical itemsCenter justify="center" style={{paddingVertical: 40, paddingHorizontal: 24}}>
            <Text category="h9-s" status="danger" center mb={16}>
              {loadError}
            </Text>
            <Text category="h9" status="link" bold onPress={loadMethods}>
              {t('common:try_again', {defaultValue: 'Try again'})}
            </Text>
          </Flex>
        ) : !methods || methods.length === 0 ? (
          <Flex vertical itemsCenter justify="center" style={{paddingVertical: 60, paddingHorizontal: 24}}>
            <Text category="h9-s" status="placeholder" center mb={16}>
              {t('payment:no_saved_cards', {defaultValue: "No saved cards yet — add one to speed up checkout."})}
            </Text>
            <Text category="h9" status="link" bold onPress={onAdd}>
              {t('payment:add_payment_method', {defaultValue: 'Add payment method'})}
            </Text>
          </Flex>
        ) : (
          methods.map(item => (
            <SwiperCard
              key={item.id}
              id={item.id}
              containerStyle={styles.swiperContainer}
              widthAction={75}
              editLabel={t('payment:set_default', {defaultValue: 'Default'})}
              deleteLabel={t('common:delete', {defaultValue: 'Delete'})}
              onEdit={() => onSetDefault(item)}
              onDelete={() => onDelete(item)}>
              <Flex
                level="2"
                pv={24}
                ml={24}
                justify="flex-start"
                border={12}
                style={item.isDefault ? {borderColor: theme['color-primary-500'], borderWidth: 1.5} : undefined}>
                <Icon pack="assets" name={BRAND_ICON[item.brand?.toLowerCase()] ?? 'master'} style={styles.iconLogoBank} />
                <View style={globalStyle.flexOne}>
                  <Flex justify="flex-start" itemsCenter>
                    <Text category="h6" style={{textTransform: 'capitalize'}}>
                      {item.brand}
                    </Text>
                    {item.isDefault ? (
                      <View style={[styles.defaultBadge, {backgroundColor: theme['color-primary-500']}]}>
                        <Text category="h10" status="control" bold>
                          {t('payment:default', {defaultValue: 'DEFAULT'})}
                        </Text>
                      </View>
                    ) : null}
                  </Flex>
                  <Text category="h8" mt={8} status="placeholder">
                    xxxx - xxxx - xxxx - {item.last4}
                  </Text>
                  <Text category="h10" mt={2} status="placeholder">
                    {t('payment:expires', {defaultValue: 'Expires'})} {String(item.expMonth).padStart(2, '0')}/{item.expYear}
                  </Text>
                </View>
              </Flex>
            </SwiperCard>
          ))
        )}
      </Content>
    </Container>
  );
});

export default PaymentMethod;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 32,
  },
  iconLogoBank: {
    width: 48,
    height: 48,
    alignSelf: 'center',
    marginHorizontal: 16,
  },
  swiperContainer: {
    ...globalStyle.shadow,
    marginBottom: 24,
    borderRadius: 12,
    marginRight: 24,
  },
  defaultBadge: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginLeft: 8,
  },
});
