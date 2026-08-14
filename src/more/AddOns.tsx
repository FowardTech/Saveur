import React, {memo} from 'react';
import {Alert, Platform, RefreshControl, View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Layout, Icon} from '@ui-kitten/components';
import {NavigationProp, useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {initStripe, useStripe} from '@stripe/stripe-react-native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import CtaButton from 'components/CtaButton';
import {globalStyle} from 'styles/globalStyle';
import * as billingService from 'services/billingService';
import {AddonProps} from 'services/billingService';
import * as iapService from 'services/iapService';
import {RootStackParamList} from 'navigation/types';
import {stripeAppearance} from 'utils/stripeAppearance';

// Matches Subscription.tsx's own STRIPE_RETURN_URL — same urlScheme:
// 'saveur' registered natively (ios/Info.plist, AndroidManifest.xml).
const STRIPE_RETURN_URL = 'saveur://stripe-redirect';

// Same reasoning as Subscription.tsx's own IS_NATIVE_IAP_PLATFORM — Apple
// Guideline 3.1.1 / Google Payments Policy require these one-time add-on
// unlocks to go through each store's own IAP on iOS/Android, not Stripe.
const IS_NATIVE_IAP_PLATFORM = Platform.OS === 'ios' || Platform.OS === 'android';

// Paid Add-ons screen — product request item: "for the coding practice and
// system design whiteboard I want them to be in a separate screen called
// add-ons and they should be paid for. So users that want to do some
// coding practice can pay for it and it will be activated." One-time
// purchase (clarified: not a recurring add-on subscription), reusing the
// same in-app Stripe PaymentSheet flow Subscription.tsx uses for plans —
// see that file's payWithPaymentSheet for the fuller rationale behind each
// step below; this mirrors it but for a single-charge add-on instead of a
// recurring subscription (so there's no plan/tier polling afterward, just
// the synchronous confirm-and-unlock call).
const AddOns = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'common']);
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const {initPaymentSheet, presentPaymentSheet} = useStripe();

  const highlightCode: string | undefined = route.params?.highlightCode;

  const [addons, setAddons] = React.useState<AddonProps[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [purchasingCode, setPurchasingCode] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await billingService.listAddons();
      setAddons(data);
    } catch (error: any) {
      setLoadError(
        error?.message ?? t('more:addons_load_failed', {defaultValue: 'Could not load add-ons.'}),
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Apple/Google IAP path — the iOS/Android counterpart to the Stripe flow
  // below. iapService.purchaseAddon already verifies the real transaction
  // against the backend and grants the unlock before resolving (see that
  // file's own comment), so there's no separate confirm call needed here
  // the way the Stripe path's confirmAddonPurchase is.
  const purchaseWithIAP = async (addon: AddonProps) => {
    const result = await iapService.purchaseAddon(addon.code);
    if (result.kind === 'error') {
      throw new Error(result.error);
    }
    if (result.kind !== 'addon') {
      throw new Error('Unexpected purchase result for an add-on SKU.');
    }
    setAddons(prev =>
      prev ? prev.map(item => (item.code === addon.code ? {...item, unlocked: result.unlocked} : item)) : prev,
    );
    if (result.unlocked) {
      Alert.alert(
        t('more:addon_purchase_success_title', {defaultValue: 'Add-on activated'}),
        t('more:addon_purchase_success_body', {
          defaultValue: '{{name}} is now unlocked — head back and start practicing.',
          name: addon.name,
        }),
      );
    }
  };

  const onPurchase = async (addon: AddonProps) => {
    if (purchasingCode) return;
    setPurchasingCode(addon.code);
    try {
      if (IS_NATIVE_IAP_PLATFORM) {
        await purchaseWithIAP(addon);
        return;
      }
      const sheet = await billingService.createPaymentSheet({mode: 'payment', addonCode: addon.code});
      await initStripe({publishableKey: sheet.publishableKey, urlScheme: 'saveur'});
      const {error: initError} = await initPaymentSheet({
        merchantDisplayName: 'Saveur',
        customerId: sheet.customerId,
        customerEphemeralKeySecret: sheet.ephemeralKeySecret,
        paymentIntentClientSecret: sheet.clientSecret,
        allowsDelayedPaymentMethods: true,
        returnURL: STRIPE_RETURN_URL,
        appearance: stripeAppearance,
      });
      if (initError) {
        throw new Error(initError.message);
      }
      const {error: presentError} = await presentPaymentSheet();
      if (presentError) {
        // User backing out of the sheet isn't a failure worth alerting on.
        if (presentError.code === 'Canceled') return;
        throw new Error(presentError.message);
      }
      // Payment is confirmed by the time presentPaymentSheet resolves — ask
      // the backend to grant the unlock synchronously (same reasoning as
      // Subscription.tsx's confirmSubscription — don't make the user wait
      // out webhook latency to see it activate) rather than just trusting
      // the client-side success and flipping local state optimistically.
      const result = await billingService.confirmAddonPurchase(sheet.paymentIntentId!);
      setAddons(prev =>
        prev
          ? prev.map(item => (item.code === addon.code ? {...item, unlocked: result.unlocked} : item))
          : prev,
      );
      if (result.unlocked) {
        Alert.alert(
          t('more:addon_purchase_success_title', {defaultValue: 'Add-on activated'}),
          t('more:addon_purchase_success_body', {
            defaultValue: '{{name}} is now unlocked — head back and start practicing.',
            name: addon.name,
          }),
        );
      } else {
        // Stripe confirmed the charge but this app's backend hasn't
        // reflected the unlock yet — same honest-messaging approach as
        // Subscription.tsx's "payment received, pull to refresh" case,
        // rather than pretending it worked.
        Alert.alert(
          t('more:addon_purchase_pending_title', {defaultValue: 'Payment received'}),
          t('more:addon_purchase_pending_body', {
            defaultValue: "Your payment went through, but it's taking a bit longer than usual to activate. Pull down to refresh in a moment.",
          }),
        );
      }
    } catch (error: any) {
      Alert.alert(
        t('more:addon_purchase_failed_title', {defaultValue: "Couldn't complete purchase"}),
        error?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setPurchasingCode(null);
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:addons_title', {defaultValue: 'Add-ons'})}
        accessoryLeft={<NavigationAction />}
      />
      <Content
        padder
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading && !!addons} onRefresh={load} tintColor={theme['color-primary-500']} />}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('more:addons_description', {
            defaultValue: 'Unlock extra practice tools with a one-time purchase — pay once, keep it forever.',
          })}
        </Text>

        {isLoading && !addons ? (
          <EmptyState variant="loading" />
        ) : loadError && !addons ? (
          <EmptyState
            variant="error"
            title={t('common:something_went_wrong', {defaultValue: 'Something went wrong'})}
            body={loadError}
            actionLabel={t('common:try_again', {defaultValue: 'Try again'})}
            onAction={load}
          />
        ) : !addons || addons.length === 0 ? (
          <Text category="h9-s" status="placeholder" center mt={20}>
            {t('more:no_addons_available', {defaultValue: 'No add-ons are available right now.'})}
          </Text>
        ) : (
          addons.map(addon => (
            <Layout
              key={addon.code}
              level="2"
              style={[
                styles.addonCard,
                addon.code === highlightCode ? {borderWidth: 2, borderColor: theme['color-primary-500']} : null,
              ]}>
              <Flex justify="space-between" itemsCenter mb={4}>
                <Text category="h7" bold style={globalStyle.flexOne}>
                  {addon.name}
                </Text>
                {addon.unlocked ? (
                  <View style={[styles.unlockedPill, {backgroundColor: theme['color-success-500']}]}>
                    <Icon pack="eva" name="checkmark-outline" style={[globalStyle.icon16, {tintColor: theme['text-control-color']}]} />
                    <Text category="h10" status="control" bold ml={4}>
                      {t('more:addon_unlocked', {defaultValue: 'Unlocked'})}
                    </Text>
                  </View>
                ) : (
                  <Text category="h7" bold>
                    {billingService.formatPrice(addon.amount, addon.currency)}
                  </Text>
                )}
              </Flex>
              {addon.description ? (
                <Text category="h9-s" status="placeholder" mb={12}>
                  {addon.description}
                </Text>
              ) : null}
              {!addon.unlocked ? (
                <CtaButton
                  loading={purchasingCode === addon.code}
                  disabled={!!purchasingCode}
                  onPress={() => onPurchase(addon)}>
                  {t('more:addon_purchase_cta', {
                    defaultValue: 'Unlock for {{price}}',
                    price: billingService.formatPrice(addon.amount, addon.currency),
                  })}
                </CtaButton>
              ) : null}
              {/* Product follow-up ("add more features to the coding
                  tool so that its worth the amount its paid for" -- this
                  screen previously had NO way to actually start using an
                  unlocked add-on once purchased, just the "Unlocked"
                  pill above with nothing to press). Straight into the
                  new browsable problem hub (CodingPracticeHub.tsx).
                  coding_practice specifically -- other future addon
                  codes don't get this button since there's no generic
                  screen to route them to. */}
              {addon.unlocked && addon.code === 'coding_practice' ? (
                <CtaButton onPress={() => navigate('CodingPracticeHub')}>
                  {t('more:addon_practice_now_cta', {defaultValue: 'Practice now'})}
                </CtaButton>
              ) : null}
            </Layout>
          ))
        )}
      </Content>
    </Container>
  );
});

export default AddOns;

const themedStyles = StyleService.create({
  container: {flex: 1},
  content: {paddingBottom: 80},
  addonCard: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 16,
  },
  unlockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
});
