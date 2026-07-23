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
import { stripeAppearance } from 'utils/stripeAppearance';
import { getSessionEntitlement } from 'services/entitlementsService';
import { AuthContext } from '../../AuthContext';

// Matches urlScheme: 'saveur' passed to initStripe() below, and the
// CFBundleURLTypes/intent-filter registered natively for it (ios/Info.plist,
// AndroidManifest.xml) — see those files for why this exact string.
const STRIPE_RETURN_URL = 'saveur://stripe-redirect';

type PlanId = UserProfileProps['subscriptionTier'];

// Defined at module scope (not inline in JSX) so it's a stable component
// reference across renders — passing a freshly-created arrow function to
// accessoryLeft on every render would make UI Kitten treat it as a new
// component type each time.
const renderCheckoutSpinner = () => <Spinner size="small" status="control" />;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Stripe confirms a payment synchronously (presentPaymentSheet resolving,
// or the user returning from the portal), but this app's own backend only
// learns the plan actually changed once *it* separately receives Stripe's
// webhook (invoice.payment_succeeded / customer.subscription.updated) — an
// async round trip that can lag the client by a few seconds. A single
// immediate GET /billing/subscription right after can easily race ahead of
// that webhook and read back stale data, which is what "I subscribed and
// it didn't activate" almost always is. Poll briefly instead of trusting
// the first read, and only report success once the fetched tier actually
// matches what was purchased — if it still hasn't landed after ~9s, say so
// honestly rather than silently declaring success or leaving the user
// wondering, since the payment did go through even if this backend hasn't
// caught up yet.
const SUBSCRIPTION_POLL_ATTEMPTS = 6;
const SUBSCRIPTION_POLL_INTERVAL_MS = 1500;

async function pollForSubscriptionTier(expectedTier: PlanId): Promise<{
  status: SubscriptionStatusProps;
  matched: boolean;
}> {
  let status = await billingService.getSubscription();
  for (let attempt = 0; attempt < SUBSCRIPTION_POLL_ATTEMPTS; attempt++) {
    const matched = status.tier === expectedTier && (status.status === 'active' || status.status === 'trialing');
    if (matched) return { status, matched: true };
    await sleep(SUBSCRIPTION_POLL_INTERVAL_MS);
    status = await billingService.getSubscription();
  }
  const matched = status.tier === expectedTier && (status.status === 'active' || status.status === 'trialing');
  return { status, matched };
}

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
  // Refreshed after a confirmed plan change below so the app-wide gating
  // state (services/entitlementsService.ts, checked from
  // MockInterviewSetup.tsx) doesn't go stale until the next app relaunch —
  // this screen's own `subscription` state above is for display only.
  const { refreshSubscription: refreshAuthSubscription } = React.useContext(AuthContext);

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

  // Once a free-tier user is out of free sessions this month, drop the Free
  // card from the list entirely — "switch to" the plan they're already on
  // and already out of room on is a dead end, not a real choice. See
  // services/entitlementsService.ts for the underlying cap logic.
  const [freeSessionsExhausted, setFreeSessionsExhausted] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    getSessionEntitlement(subscription).then(entitlement => {
      if (!cancelled) setFreeSessionsExhausted(!entitlement.isPro && entitlement.remaining === 0);
    });
    return () => {
      cancelled = true;
    };
  }, [subscription]);

  const visiblePlans = React.useMemo(
    () => (freeSessionsExhausted ? plans?.filter(p => p.tier !== 'free') ?? [] : plans ?? []),
    [plans, freeSessionsExhausted],
  );

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
      const attemptedTier = attemptedTierRef.current;
      // Poll (not a single read) when there's a specific tier to check
      // against — same webhook-lag rationale as pollForSubscriptionTier
      // above. A plain background refresh (no attemptedTier) stays a single
      // read, since there's nothing specific to wait for.
      const subscriptionData = attemptedTier
        ? (await pollForSubscriptionTier(attemptedTier)).status
        : await billingService.getSubscription();
      setSubscription(subscriptionData);
      refreshAuthSubscription();
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
  }, [fromOnboarding, onContinueOnboarding, refreshAuthSubscription, t]);

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
      // Was the plain Stripe default sheet before — see utils/stripeAppearance.ts.
      appearance: stripeAppearance,
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
    // presentPaymentSheet resolves — poll rather than waiting on an
    // AppState foreground event, but still poll (not a single read) since
    // this backend's own record can lag Stripe's webhook by a few seconds
    // (see pollForSubscriptionTier above).
    const { status: subscriptionData, matched } = await pollForSubscriptionTier(plan.tier);
    setSubscription(subscriptionData);
    refreshAuthSubscription();
    if (matched) {
      setJustSubscribedTier(subscriptionData.tier);
      if (fromOnboarding) {
        onContinueOnboarding();
      } else {
        // Regular (non-onboarding) purchase — take the user to a dedicated
        // success screen rather than just flipping the inline "You're all
        // set" text on this same screen. A receipt (with PDF attachment) is
        // already on its way to their email at this point — see the
        // backend's invoice.paid/payment_intent.succeeded webhook handlers
        // (app/api/billing.py) and receipt_service.process_new_payment.
        navigate('SuccessScr', {
          successScr: {
            title: t('more:payment_success_title', { defaultValue: 'Payment successful' }),
            description: t('more:payment_success_body', {
              defaultValue: 'Your payment for {{plan}} was successful. A receipt has been sent to your email.',
              plan: plan.title,
            }),
            logo: true,
            children: [
              {
                title: t('more:view_payment_history', { defaultValue: 'View Payment History' }),
                onPress: () => navigate('PaymentHistory'),
                status: 'basic',
              },
              {
                title: t('common:done', { defaultValue: 'Done' }),
                onPress: () => navigate('MainBottomTab'),
                status: 'outline',
              },
            ],
            buttonsViewStyle: { marginHorizontal: 32 },
          },
        });
      }
    } else {
      // Stripe confirmed the charge, but this app's backend hasn't reflected
      // the new plan yet — tell the user the truth instead of pretending it
      // worked or silently leaving them staring at "Free" with no reply.
      Alert.alert(
        t('more:subscription_pending_title', { defaultValue: 'Payment received' }),
        t('more:subscription_pending_body', {
          defaultValue: "Your payment went through, but it's taking a bit longer than usual to show up here. Pull down to refresh in a moment.",
        }),
      );
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

  // "Manage Billing" — lets an already-subscribed user cancel, toggle
  // auto-renewal, or update their payment method, all inside Stripe's own
  // hosted Customer Portal. There's no direct cancel/auto-renewal-toggle
  // REST endpoint in this app's contract (see billingService.ts), so this is
  // the real, non-fabricated way to expose those actions: Stripe's portal
  // already supports all three out of the box. Uses the same
  // pendingCheckoutRef/AppState pattern as manageInPortal below so returning
  // from the portal (e.g. after canceling) refreshes this screen's status.
  const [isOpeningPortal, setIsOpeningPortal] = React.useState(false);
  const onManageBilling = async () => {
    if (isOpeningPortal) return;
    setIsOpeningPortal(true);
    try {
      const url = await billingService.createPortalSession();
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        throw new Error(t('more:subscription_link_unsupported', { defaultValue: 'This device cannot open the checkout link.' }));
      }
      attemptedTierRef.current = subscription?.tier ?? null;
      pendingCheckoutRef.current = true;
      await Linking.openURL(url);
    } catch (error: any) {
      Alert.alert(
        t('more:subscription_portal_failed_title', { defaultValue: "Couldn't open billing management" }),
        error?.message ?? t('common:try_again_later', { defaultValue: 'Please try again in a moment.' }),
      );
    } finally {
      setIsOpeningPortal(false);
    }
  };

  // In-app cancel/resume — the direct answer to "cancel subscription and
  // cancel auto-renewal without going to the Stripe interface". Both hit the
  // new POST /billing/subscription/cancel|resume endpoints (billingService.ts)
  // and update `subscription` from the response directly rather than
  // refetching, so the "Cancels on {{date}}" text above flips immediately.
  // Cancel schedules the change for the end of the current paid period
  // (access continues until then) rather than cancelling immediately — same
  // behavior Stripe's own portal gives, just without leaving the app.
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [isResuming, setIsResuming] = React.useState(false);

  const onCancelSubscription = React.useCallback(() => {
    if (isCancelling) return;
    Alert.alert(
      t('more:cancel_subscription_confirm_title', { defaultValue: 'Cancel subscription?' }),
      t('more:cancel_subscription_confirm_body', {
        defaultValue: "You'll keep your current plan's access until the end of this billing period, then it won't renew.",
      }),
      [
        { text: t('common:back', { defaultValue: 'Back' }), style: 'cancel' },
        {
          text: t('more:cancel_subscription', { defaultValue: 'Cancel subscription' }),
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              const updated = await billingService.cancelSubscription();
              setSubscription(updated);
              refreshAuthSubscription();
            } catch (error: any) {
              Alert.alert(
                t('more:cancel_subscription_failed_title', { defaultValue: "Couldn't cancel subscription" }),
                error?.message ?? t('common:try_again_later', { defaultValue: 'Please try again in a moment.' }),
              );
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ],
    );
  }, [isCancelling, refreshAuthSubscription, t]);

  const onResumeSubscription = React.useCallback(async () => {
    if (isResuming) return;
    setIsResuming(true);
    try {
      const updated = await billingService.resumeSubscription();
      setSubscription(updated);
      refreshAuthSubscription();
    } catch (error: any) {
      Alert.alert(
        t('more:resume_subscription_failed_title', { defaultValue: "Couldn't turn auto-renew back on" }),
        error?.message ?? t('common:try_again_later', { defaultValue: 'Please try again in a moment.' }),
      );
    } finally {
      setIsResuming(false);
    }
  }, [isResuming, refreshAuthSubscription, t]);

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

        {/* Vertical stack — each card shows its own feature list, and
            exactly one card carries a "Popular" badge: whichever plan the
            backend flags (BillingPlanProps.recommended — see
            billingService.ts) or, if none is flagged, the cheapest paid
            plan (first plan with a non-null code), so there's always
            exactly one badge shown. The Free plan itself is dropped from
            this list once the user has used up their free sessions (see
            entitlementsService.ts) — nudging them straight to a paid plan
            instead of letting them "switch to" the plan they're already on
            and already out of room on. */}
        <View style={{ paddingTop: 14 }}>
          {visiblePlans.map((plan, planIndex) => {
            // Falls back to plan.code, then the array index, because the
            // backend has been observed sending plans with a missing/
            // duplicate `id` (that's what triggered React's "unique key"
            // warning here) — plan.id alone isn't reliably unique. This same
            // identifier is also used below for isCheckingOut/onSelectPlan's
            // tracking, since a duplicate id there was making multiple plan
            // cards show "Opening checkout…" at once when only one was
            // tapped.
            const planKey = plan.id || plan.code || `plan-${planIndex}`;
            // Two plans can share the same `tier` (e.g. Pro Monthly/Yearly
            // are both tier: "premium"), so plain tier-matching can't tell
            // them apart. In order of preference:
            //  1. plan.isCurrent — GET /billing/plans, called with a Bearer
            //     token (optional-auth; apiClient always attaches one when
            //     signed in), tells each plan directly whether it's the
            //     user's current one. Most authoritative — includes the
            //     Free plan being correctly flagged for a never-subscribed
            //     user, not just paid plans.
            //  2. plan.code === subscription.planCode — GET /billing/subscription
            //     now also returns which plan_code the user is on.
            //  3. plan.priceId === subscription.priceId — the underlying
            //     Stripe Price, if the backend sends that instead/as well.
            //  4. plan.tier === currentTier — last resort; ambiguous
            //     between same-tier plans, but still correct for telling
            //     Free apart from any paid tier.
            const isCurrent =
              typeof plan.isCurrent === 'boolean'
                ? plan.isCurrent
                : subscription?.planCode && plan.code
                ? plan.code === subscription.planCode
                : subscription?.priceId && plan.priceId
                ? plan.priceId === subscription.priceId
                : plan.tier === currentTier;
            const justSubscribed = justSubscribedTier === plan.tier;
            const isCheckingOut = checkoutPlanId === planKey;
            const anyFlagged = visiblePlans.some(p => p.recommended);
            const isRecommended =
              plan.recommended ?? (!anyFlagged && plan.code === visiblePlans.find(p => p.code)?.code && !!plan.code);
            return (
              <Layout
                key={planKey}
                level="2"
                style={[
                  styles.planCard,
                  isCurrent && { borderColor: theme['color-primary-500'], borderWidth: 2 },
                  isRecommended && !isCurrent && { borderColor: theme['color-primary-300'], borderWidth: 2 },
                ]}>
                {isRecommended ? (
                  <View style={[styles.popularRibbon, { backgroundColor: theme['color-primary-500'] }]}>
                    <Text category="h10" bold status="control">
                      {t('more:most_popular', { defaultValue: 'MOST POPULAR' })}
                    </Text>
                  </View>
                ) : null}
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
                  <View>
                    {justSubscribed ? (
                      <Text category="h9" status="success" bold mt={8} mb={8}>
                        {t('more:subscribed_success', { defaultValue: "You're all set — this plan is now active." })}
                      </Text>
                    ) : null}
                    {/* Status detail: renewal/cancel date when known, otherwise
                        a plain status label (trialing/past_due/etc). No date
                        is shown for the free plan, which has no period_end. */}
                    {subscription?.periodEnd ? (
                      <Text category="h10" status="placeholder" mt={4} mb={8}>
                        {subscription.cancelAtPeriodEnd
                          ? t('more:subscription_cancels_on', {
                              defaultValue: 'Cancels on {{date}} — you keep access until then.',
                              date: new Date(subscription.periodEnd).toLocaleDateString(),
                            })
                          : t('more:subscription_renews_on', {
                              defaultValue: 'Renews on {{date}}',
                              date: new Date(subscription.periodEnd).toLocaleDateString(),
                            })}
                      </Text>
                    ) : subscription?.status && subscription.status !== 'none' && subscription.status !== 'active' ? (
                      <Text category="h10" status={subscription.status === 'past_due' ? 'danger' : 'placeholder'} mt={4} mb={8}>
                        {t('more:subscription_status_label', { defaultValue: 'Status: {{status}}', status: subscription.status })}
                      </Text>
                    ) : null}
                    {plan.code ? (
                      <View>
                        {/* Primary in-app cancel/resume — no Stripe portal
                            round-trip needed for the most common action.
                            "Manage Billing" below stays as the fallback for
                            things this app doesn't have its own UI for yet
                            (payment method, invoices). */}
                        {subscription?.cancelAtPeriodEnd ? (
                          <Button
                            children={isResuming ? t('more:resuming', { defaultValue: 'Turning back on…' }) : t('more:resume_subscription', { defaultValue: 'Turn on auto-renew' })}
                            status="primary"
                            appearance="outline"
                            size="small"
                            disabled={isResuming}
                            onPress={onResumeSubscription}
                            style={{ marginTop: 4 }}
                          />
                        ) : (
                          <Button
                            children={isCancelling ? t('more:cancelling', { defaultValue: 'Cancelling…' }) : t('more:cancel_subscription', { defaultValue: 'Cancel subscription' })}
                            status="danger"
                            appearance="ghost"
                            size="small"
                            disabled={isCancelling}
                            onPress={onCancelSubscription}
                            style={{ marginTop: 4 }}
                          />
                        )}
                        <Button
                          children={isOpeningPortal ? t('more:opening', { defaultValue: 'Opening…' }) : t('more:manage_billing', { defaultValue: 'Manage Billing' })}
                          status="basic"
                          appearance="outline"
                          size="small"
                          disabled={isOpeningPortal}
                          onPress={onManageBilling}
                          style={{ marginTop: 8 }}
                        />
                      </View>
                    ) : null}
                  </View>
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
        </View>
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
  popularRibbon: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    borderRadius: 99,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
});
