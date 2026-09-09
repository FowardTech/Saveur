import React, {memo} from 'react';
import {Alert, Image, ImageStyle, View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Spinner,
  Icon,
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
import CardBrandLogo from 'components/CardBrandLogo';
import { SkeletonList } from 'components/Skeleton';
import {Images} from 'assets/images';

// Matches Subscription.tsx's STRIPE_RETURN_URL — required by initPaymentSheet
// even in setup mode, in case a saved card's verification redirects out
// (e.g. certain bank flows) and needs to hand control back to the app.
const STRIPE_RETURN_URL = 'saveur://stripe-redirect';

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
  const [billingProvider, setBillingProvider] = React.useState<billingService.BillingProvider>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isAdding, setIsAdding] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const loadMethods = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const {methods: list, billingProvider: provider} = await billingService.listPaymentMethods();
      setMethods(list);
      setBillingProvider(provider);
    } catch (error: any) {
      setLoadError(error?.message ?? t('payment:load_cards_failed', { defaultValue: 'Could not load your saved cards.' }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Product report: "now that the user is paying for subscription via
  // apple and playstore, will the credit card used still display in the
  // payment method screen?" -- for these subscribers there was never a
  // real Stripe card to show (see billing.py's list_payment_methods route
  // comment for the actual bug this used to hit), so this screen now says
  // so plainly instead of just looking like an empty/broken card list, and
  // hides the "+" add-card action entirely (adding a Stripe card does
  // nothing for a subscription the App Store/Play Store actually bills).
  const isIapBilled = billingProvider === 'apple' || billingProvider === 'google';

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
          isIapBilled ? undefined : isAdding ? (
            <Spinner size="small" />
          ) : (
            <NavigationAction icon="plusImg" size="small" onPress={onAdd} />
          )
        }
      />
      <Content style={styles.content}>
        {isLoading ? (
          <SkeletonList count={3} style={{ paddingHorizontal: 16 }} />
        ) : isIapBilled ? (
          // REDESIGN (product request: "put back the Payment Method screen
          // -- whenever the user makes payment with apple then in the
          // payment method it should just display apple pay, same for
          // android too it should display playstore... make it
          // professional and perfect") -- was a big centered "empty state"
          // block (icon + heading + paragraph), which read like an error/
          // no-data screen rather than "here is your payment method."
          // Restyled into the SAME card-row layout the real Stripe cards
          // below use (Flex/border/pv/ml, matching visual weight) so this
          // reads as one clean payment-method entry -- "Apple Pay" or
          // "Google Play" front and center, same way a card's brand name
          // is front and center -- with the management instructions kept
          // as a smaller supporting line underneath, not the headline.
          <Flex level="2" pv={24} ml={24} justify="flex-start" border={12} style={styles.iapCard}>
            <View
              style={[
                styles.iapIconBadge,
                {backgroundColor: billingProvider === 'apple' ? '#000000' : '#00C853'},
              ]}>
              <Icon
                pack="eva"
                name={billingProvider === 'apple' ? 'credit-card-outline' : 'play-circle-outline'}
                style={[globalStyle.icon20, {tintColor: '#FFFFFF'}]}
              />
            </View>
            <View style={globalStyle.flexOne}>
              <Flex justify="flex-start" itemsCenter>
                <Text category="h6">
                  {billingProvider === 'apple'
                    ? t('payment:apple_pay_label', {defaultValue: 'Apple Pay'})
                    : t('payment:google_play_label', {defaultValue: 'Google Play'})}
                </Text>
                <View style={[styles.defaultBadge, {backgroundColor: theme['color-success-500']}]}>
                  <Text category="h10" status="control" bold>
                    {t('payment:active', {defaultValue: 'ACTIVE'})}
                  </Text>
                </View>
              </Flex>
              <Text category="h9" mt={8} status="placeholder">
                {billingProvider === 'apple'
                  ? t('payment:managed_by_apple_body_short', {
                    defaultValue: "Manage or cancel from your iPhone's Settings > [your name] > Subscriptions.",
                  })
                  : t('payment:managed_by_google_body_short', {
                    defaultValue: 'Manage or cancel from the Play Store app > Payments & subscriptions.',
                  })}
              </Text>
            </View>
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
            {/* Product request: "there are some other places too in the app
                that you can add some of those icons i uploaded too" -- a
                real illustrated debit-card icon (assets/images/index.ts's
                iconDebitCard) above this empty state's text, the same
                "hero icon above empty-state copy" pattern this app already
                uses elsewhere. Plain <Image>, no tintColor. */}
            <Image source={Images.iconDebitCard} resizeMode="contain" style={[styles.emptyIcon as ImageStyle, {marginBottom: 16}]} />
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
              borderRadius={12}
              widthAction={75}
              editLabel={t('payment:set_default', {defaultValue: 'Default'})}
              deleteLabel={t('common:delete', {defaultValue: 'Delete'})}
              onEdit={() => onSetDefault(item)}
              onDelete={() => onDelete(item)}>
              {/* FULL RESKIN: the old hairline border (borderWidth: 1,
                  'rgba(39, 39, 85, 0.12)') this comment used to describe as
                  "same hairline border globalStyle.card uses elsewhere" is
                  stale — globalStyle.card is shadow-only now, no border (see
                  styles/globalStyle.ts). Dropped it here too: swiperContainer
                  below already carries that same soft shadow
                  (globalStyle.shadow, an alias of the same cardShadow card
                  uses), so this row was double-chromed (shadow + leftover
                  border) instead of matching the app's plain shadow-card
                  look. The default-card highlight (brand blue border) stays
                  — that's a real selection ring, not card chrome. */}
              <Flex
                level="2"
                pv={24}
                ml={24}
                justify="flex-start"
                border={12}
                style={
                  item.isDefault ? {borderColor: theme['color-primary-500'], borderWidth: 1.5} : undefined
                }>
                {/* Product report (screenshot: a card labeled "Visa"
                    rendering a Mastercard-style logo): this used to always
                    render assets/icons/ic_master.png directly, regardless of
                    `item.brand` — the app only ever shipped one brand PNG,
                    so every saved card showed Mastercard's mark even when
                    it was actually a Visa/Amex/Verve/etc. card. CardBrandLogo
                    (components/CardBrandLogo.tsx) picks the real brand mark
                    off `item.brand` (Stripe's own card.brand string) and
                    only falls back to the generic Crown placeholder glyph
                    for a brand it doesn't recognize. */}
                <CardBrandLogo brand={item.brand} width={48} height={30} style={styles.iconLogoBank} />
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
  emptyIcon: {
    width: 64,
    height: 64,
  },
  iapCard: {
    ...globalStyle.shadow,
    marginBottom: 24,
    marginRight: 24,
    borderRadius: 12,
  },
  iapIconBadge: {
    width: 48,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginHorizontal: 16,
  },
  iconLogoBank: {
    // Sizing now comes from CardBrandLogo's own width/height props (48x30 —
    // a card-shaped ratio, not the square 48x48 this used to force on the
    // single Mastercard PNG it always rendered) — this style only handles
    // layout, not dimensions, so it doesn't fight those props.
    alignSelf: 'center',
    marginHorizontal: 16,
  },
  swiperContainer: {
    ...globalStyle.shadow,
    // Bug fix (Android elevation-needs-an-opaque-background — see
    // globalStyle.ts's own comment): this is the actual shadow-casting
    // View (SwiperCard's outer TouchableOpacity, see containerStyle prop),
    // separate from the visually "transparent, border-only" Flex rendered
    // inside it below — with no fill of its own, Android drew a heavy gray
    // block instead of a soft shadow. The inner Flex's explicit
    // `backgroundColor: 'transparent'` lets this color show through
    // unchanged, so the border-only look is preserved, same fill every
    // other card in the app already uses.
    
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
