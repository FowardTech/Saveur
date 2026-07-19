import React, { memo } from 'react';
import { Alert, AppState, Linking, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { initStripe, useStripe } from '@stripe/stripe-react-native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { BillingPlanProps, SubscriptionStatusProps, UserProfileProps } from 'constants/Types';
import * as billingService from 'services/billingService';
import { RootStackParamList, SubscriptionScreenNavigationProp } from 'navigation/types';

// Matches urlScheme="saveur" on <StripeProvider> in App.tsx and the
// CFBundleURLTypes/intent-filter registered natively for it — see those
// files for why this exact string.
const STRIPE_RETURN_URL = 'saveur://stripe-redirect';

type PlanId = UserProfileProps['subscriptionTier'];

// Defined at module scope (not inline in JSX) so it's a stable component
// reference across renders — passing a freshly-created arrow function to
// accessoryLeft on every render would make UI Kitten treat it as a new
// component type each time.
const renderCheckoutSpinner = () => <Spinner size="small" status="control" />;

// Real Stripe-backed paywall/plan screen — see services/billingService.ts for
// the endpoints this talks to and docs/BACKEND_API_SPEC.md for the fuller
// contract.
//
// Two different checkout paths, depending on the plan tapped:
//  - Paid plan (plan.code set): in-app native Payment Sheet
//    (@stripe/stripe-react-native) via POST /billing/payment-sheet. Resolves
//    synchronously — no browser hand-off, no AppState tracking needed for
//    this path. This is the primary flow now (replaces the old
//    createCheckoutSession-in-a-browser-tab approach).
//  - No-code plan (the free tier, when the backend includes it — used for
//    "switch to this plan"/downgrade): still opens Stripe's Customer Portal
//    in the system browser via createPortalSession, since there's no
//    in-app-Payment-Sheet equivalent for managing/canceling an existing
//    subscription. The AppState listener + refetchSubscription below exist
//    ONLY to catch the user returning from *this* browser-based portal path.
const Subscription = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<SubscriptionScreenNavigationProp>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const { fromOnboarding, onboardingSuccessPayload } = route.params ?? {};

  const [plans, setPlans] = React.useState<BillingPlanProps[] | null>(null);
  const [subscription, setSubscription] = React.useState<SubscriptionStatusProps | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [checkoutPlanId, setCheckoutPlanId] = React.useState<string | null>(null);
  const [justSubscribedTier, setJustSubscribedTier] = React.useState<PlanId | null>(null);

  // Which tier the user most recently tried to buy/change to, and whether a
  // checkout/portal tab is currently "in flight" (opened but not yet
  // confirmed). Refs, not state, because they're only read from the
  // AppState listener/refetch — they shouldn't trigger re-renders.
  const attemptedTierRef = React.useRef<PlanId | null>(null);
  const pendingCheckoutRef = React.useRef(false);

  const currentTier: PlanId = subscription?.tier ?? 'free';

  const onContinueOnboarding = React.useCallback(() => {
    if (onboardingSuccessPayload) {
      navigate('SuccessScr', { successScr: onboardingSuccessPayload });
    } else {
      navigate('MainBottomTab');
    }
  }, [navigate, onboardingSuccessPayload]);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [plansData, subscriptionData] = await Promise.all([
        billingService.getPlans(),
        billingService.getSubscription(),
      ]);
      setPlans(plansData);
      setSubscription(subscriptionData);
    } catch (error: any) {
      setLoadError(
        error?.message ?? t('more:subscription_load_failed', { defaultValue: 'Could not load subscription plans.' }),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Fired when the user returns to the app after being sent to Stripe
  // Checkout/Portal in the system browser. There's no deep link telling us
  // *how* they left (paid vs. backed out), so we just refetch and compare
  // against what they were trying to buy — if the tier + status now match,
  // treat it as a success; otherwise leave them on this screen to retry.
  const refetchSubscription = React.useCallback(async () => {
    try {
      const subscriptionData = await billingService.getSubscription();
      setSubscription(subscriptionData);
      const attemptedTier = attemptedTierRef.current;
      const paymentLikelySucceeded =
        !!attemptedTier &&
        subscriptionData.tier === attemptedTier &&
        (subscriptionData.status === 'active' || subscriptionData.status === 'trialing');
      if (paymentLikelySucceeded) {
        setJustSubscribedTier(subscriptionData.tier);
        // Onboarding flow: once the plan change is actually confirmed
        // server-side, move straight on instead of making the user tap a
        // separate "Continue" afterward.
        if (fromOnboarding) {
          onContinueOnboarding();
        }
      }
    } catch (error: any) {
      Alert.alert(
        t('more:subscription_refresh_failed_title', { defaultValue: "Couldn't refresh your subscription" }),
        error?.message ?? t('more:subscription_refresh_failed_body', { defaultValue: 'Pull down or reopen this screen to try again.' }),
      );
    } finally {
      attemptedTierRef.current = null;
      pendingCheckoutRef.current = false;
    }
  }, [fromOnboarding, onContinueOnboarding, t]);

  React.useEffect(() => {
    const subscriptionListener = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && pendingCheckoutRef.current) {
        refetchSubscription();
      }
    });
    return () => subscriptionListener.remove();
  }, [refetchSubscription]);

  // Paid plan -> in-app Payment Sheet. Fetches Payment Sheet init params
  // from the backend, points the Stripe SDK at the right publishable key
  // (initStripe — see App.tsx's StripeProvider comment for why this is
  // called here instead of known upfront), then presents the native sheet.
  // The sheet itself is customer-scoped (customerId + ephemeralKeySecret),
  // so a card the user saved on a previous purchase already shows up here
  // automatically — that's the "make use of the payment method section"
  // request: Stripe's own saved-card storage on the Customer object *is*
  // that integration point, there's no separate call needed to surface it.
  const payWithPaymentSheet = async (plan: BillingPlanProps) => {
    if (!plan.code) return; // guarded by caller, but keeps this fn self-contained
    const sheet = await billingService.createPaymentSheet({ planCode: plan.code });
    await initStripe({ publishableKey: sheet.publishableKey, urlScheme: 'saveur' });
    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: 'Saveur',
      customerId: sheet.customerId,
      customerEphemeralKeySecret: sheet.ephemeralKeySecret,
      paymentIntentClientSecret: sheet.clientSecret,
      allowsDelayedPaymentMethods: true,
      returnURL: STRIPE_RETURN_URL,
    });
    if (initError) {
      throw new Error(initError.message);
    }
    const { error: presentError } = await presentPaymentSheet();
    if (presentError) {
      // User backing out of the sheet isn't a failure worth alerting on —
      // just leave them back on this screen, same as backing out of the
      // old browser tab silently did.
      if (presentError.code === 'Canceled') return;
      throw new Error(presentError.message);
    }
    // Unlike the portal/browser path, payment is confirmed by the time
    // presentPaymentSheet resolves — refetch immediately rather than
    // waiting on an AppState foreground event.
    const subscriptionData = await billingService.getSubscription();
    setSubscription(subscriptionData);
    setJustSubscribedTier(subscriptionData.tier);
    if (fromOnboarding) {
      onContinueOnboarding();
    }
  };

  // No-code plan (free tier / downgrade) -> Stripe Customer Portal in the
  // system browser, same as before — see the AppState listener above for
  // how the return trip is detected.
  const manageInPortal = async (plan: BillingPlanProps) => {
    const url = await billingService.createPortalSession();
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      throw new Error(t('more:subscription_link_unsupported', { defaultValue: 'This device cannot open the checkout link.' }));
    }
    attemptedTierRef.current = plan.tier;
    pendingCheckoutRef.current = true;
    await Linking.openURL(url);
  };

  const onSelectPlan = async (plan: BillingPlanProps, planKey: string) => {
    if (checkoutPlanId) return;
    setCheckoutPlanId(planKey);
    setJustSubscribedTier(null);
    try {
      if (plan.code) {
        await payWithPaymentSheet(plan);
      } else {
        await manageInPortal(plan);
      }
    } catch (error: any) {
      attemptedTierRef.current = null;
      pendingCheckoutRef.current = false;
      Alert.alert(
        t('more:subscription_checkout_failed_title', { defaultValue: 'Could not start checkout' }),
        error?.message ?? t('more:subscription_checkout_failed_body', { defaultValue: 'Please try again in a moment.' }),
      );
    } finally {
      setCheckoutPlanId(null);
    }
  };

  if (loading) {
    return (
      <Container style={styles.container}>
        <TopNavigation
          title={t('more:subscription', { defaultValue: 'Subscription' })}
          accessoryLeft={fromOnboarding ? undefined : <NavigationAction />}
        />
        <Flex style={{ flex: 1 }} itemsCenter justify="center">
          <Spinner size="large" />
        </Flex>
      </Container>
    );
  }

  if (loadError || !plans) {
    return (
      <Container style={styles.container}>
        <TopNavigation
          title={t('more:subscription', { defaultValue: 'Subscription' })}
          accessoryLeft={fromOnboarding ? undefined : <NavigationAction />}
        />
        <Content padder contentContainerStyle={styles.content}>
          <Text category="h9-s" status="danger" mb={20}>
            {loadError ?? t('more:subscription_load_failed', { defaultValue: 'Could not load subscription plans.' })}
          </Text>
          <Button children={t('common:try_again', { defaultValue: 'Try again' })} onPress={loadAll} style={{ marginBottom: 4 }} />
          {fromOnboarding ? (
            <Button
              status="basic"
              appearance="ghost"
              children={t('more:skip_for_now', { defaultValue: 'Skip for now — stay on Free' })}
              onPress={onContinueOnboarding}
            />
          ) : null}
        </Content>
      </Container>
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:subscription', { defaultValue: 'Subscription' })}
        accessoryLeft={fromOnboarding ? undefined : <NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {fromOnboarding
            ? t('more:subscription_onboarding_description', {
                defaultValue: 'Pick a plan to unlock more of the AI coach — or start free and upgrade anytime.',
              })
            : t('more:subscription_description', {
                defaultValue: "Pick a plan to unlock more of the AI coach. You'll pay securely right here via Stripe.",
              })}
        </Text>

        {plans.map((plan, planIndex) => {
          // Falls back to plan.code, then the array index, because the
          // backend has been observed sending plans with a missing/
          // duplicate `id` (that's what triggered React's "unique key"
          // warning here) — plan.id alone isn't reliably unique. This same
          // identifier is also used below for isCheckingOut/onSelectPlan's
          // tracking, since a duplicate id there was making multiple plan
          // cards show "Opening checkout…" at once when only one was
          // tapped.
          const planKey = plan.id || plan.code || `plan-${planIndex}`;
          const isCurrent = plan.tier === currentTier;
          const justSubscribed = justSubscribedTier === plan.tier;
          const isCheckingOut = checkoutPlanId === planKey;
          return (
            <Layout
              key={planKey}
              level="2"
              style={[
                styles.planCard,
                isCurrent && { borderColor: theme['color-primary-500'], borderWidth: 2 },
              ]}>
              <Flex justify="space-between" itemsCenter mb={8}>
                <Text category="h6" bold>{plan.title}</Text>
                {isCurrent ? (
                  <View style={[styles.currentBadge, { backgroundColor: theme['color-primary-500'] }]}>
                    <Text category="h10" bold status="control">
                      {t('more:current_plan', { defaultValue: 'CURRENT PLAN' })}
                    </Text>
                  </View>
                ) : null}
              </Flex>
              <Text category="h3" bold mb={16}>
                {plan.price}
                <Text category="h9-s" status="placeholder">{plan.period}</Text>
              </Text>
              {plan.features.map((feature, i) => (
                <Flex key={i} justify="flex-start" itemsCenter mb={10}>
                  <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon16, { tintColor: theme['color-success-500'] }]} />
                  <Text category="h9-s" ml={10}>{feature}</Text>
                </Flex>
              ))}
              {isCurrent ? (
                justSubscribed ? (
                  <Text category="h9" status="success" bold mt={8}>
                    {t('more:subscribed_success', { defaultValue: "You're all set — this plan is now active." })}
                  </Text>
                ) : null
              ) : (
                <Button
                  children={
                    isCheckingOut
                      ? t('more:subscribing', { defaultValue: 'Opening checkout…' })
                      : plan.code
                      ? t('more:subscribe', { defaultValue: 'Subscribe' })
                      : t('more:downgrade', { defaultValue: 'Switch to this plan' })
                  }
                  disabled={!!checkoutPlanId}
                  accessoryLeft={isCheckingOut ? renderCheckoutSpinner : undefined}
                  onPress={() => onSelectPlan(plan, planKey)}
                  style={{ marginTop: 4 }}
                />
              )}
            </Layout>
          );
        })}
        {fromOnboarding ? (
          <Button
            status="basic"
            appearance="ghost"
            children={t('more:skip_for_now', { defaultValue: 'Skip for now — stay on Free' })}
            onPress={onContinueOnboarding}
            style={{ marginTop: 4 }}
          />
        ) : null}
      </Content>
    </Container>
  );
});

export default Subscription;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  planCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  currentBadge: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
});
