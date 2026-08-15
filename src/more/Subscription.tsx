import React, { memo } from 'react';
import { Alert, AppState, Linking, Platform, TouchableOpacity, View } from 'react-native';
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
import * as iapService from 'services/iapService';
import { RootStackParamList, SubscriptionScreenNavigationProp } from 'navigation/types';
import { stripeAppearance } from 'utils/stripeAppearance';
import { getSessionEntitlement } from 'services/entitlementsService';
import { AuthContext } from '../../AuthContext';
import CtaButton from 'components/CtaButton';

// Matches urlScheme: 'saveur' passed to initStripe() below, and the
// CFBundleURLTypes/intent-filter registered natively for it (ios/Info.plist,
// AndroidManifest.xml) — see those files for why this exact string.
const STRIPE_RETURN_URL = 'saveur://stripe-redirect';

// Apple Guideline 3.1.1 (and Google's own Payments Policy) require digital
// subscriptions to go through each store's own In-App Purchase system on
// iOS/Android — see services/iapService.ts's module comment. The Stripe
// Payment Sheet path below is kept intact (not deleted) since it's still
// the correct flow for any non-iOS/Android build of this codebase (e.g. a
// future web/desktop target), but on an actual phone this is always true.
const IS_NATIVE_IAP_PLATFORM = Platform.OS === 'ios' || Platform.OS === 'android';

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
  const { t, i18n } = useTranslation(['more', 'common']);
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

  // BUG FIX (pre-launch i18n staleness audit — "once language changes all
  // content must change to that language whether the content was there
  // before language switch or not"): billingService.getPlans() sends
  // `language: i18n.language` and the backend translates plan name/
  // description/features server-side, but this only ever ran once at
  // mount — a mid-session language switch left the plan cards in whatever
  // language was active when this screen first loaded. Same
  // i18n.on('languageChanged', ...) re-fetch pattern already used by
  // DailyChallengeCard.tsx/DailyChallengeScreen.tsx.
  React.useEffect(() => {
    i18n.on('languageChanged', loadAll);
    return () => {
      i18n.off('languageChanged', loadAll);
    };
  }, [loadAll, i18n]);

  // BUG FIX (product report: "Dream Company Dashboard says I need Premium
  // — I'm subscribed to Premium"): traced to Saveur-Backend's
  // price_to_plan_tier() silently downgrading a subscriber's stored plan
  // to "pro" whenever their Stripe price_id no longer matches the CURRENT
  // pricing catalog (happens to every existing subscriber the next time
  // their subscription resyncs after an admin reprices that plan — see
  // that function's own comment for the full mechanism). That backend fix
  // stops it from happening again, but it only self-corrects on the NEXT
  // resync (a webhook renewal, which can be weeks away) — there was no
  // way for an affected user to force one from inside the app. This
  // screen's own `loadAll` above only ever calls the PASSIVE
  // GET /subscription (a raw read of whatever's already cached in our
  // DB), never the reconciling POST /subscription/confirm — that endpoint
  // was only ever wired to fire once, automatically, right after a fresh
  // purchase (see payWithPaymentSheet below). This is that same endpoint,
  // exposed as a manual action so anyone in this exact situation (or any
  // other stale-plan-cache case) has a real, immediate fix instead of
  // waiting on the next billing cycle.
  const [isRefreshingStatus, setIsRefreshingStatus] = React.useState(false);
  const onRefreshStatus = React.useCallback(async () => {
    if (isRefreshingStatus) return;
    setIsRefreshingStatus(true);
    try {
      const fresh = await billingService.confirmSubscription();
      setSubscription(fresh);
      // Same reasoning as payWithPaymentSheet's own refreshAuthSubscription
      // call below — keeps every OTHER premium-gated screen in sync too,
      // not just this one, without requiring a full app relaunch.
      refreshAuthSubscription();
    } catch (error: any) {
      Alert.alert(
        t('more:subscription_refresh_failed_title', { defaultValue: "Couldn't refresh your subscription" }),
        error?.message ?? t('common:something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' }),
      );
    } finally {
      setIsRefreshingStatus(false);
    }
  }, [isRefreshingStatus, refreshAuthSubscription, t]);

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
    // Payment is confirmed by the time presentPaymentSheet resolves, but
    // this backend's own plan/status only used to get set once its
    // customer.subscription.updated/created webhook separately arrived —
    // an async hop this screen had no control over, and which the "Payment
    // received... pull down to refresh" message was really describing.
    // confirmSubscription() closes that gap: it asks the backend to read
    // the subscription straight from Stripe's live API and update its own
    // record synchronously, right now, instead of waiting on a webhook that
    // might be slow, or in some environments never arrive at all. Try that
    // first — it's a single fast round-trip — and only fall back to the
    // webhook-lag poll below if it didn't come back matched (e.g. a flaky
    // network blip on this one call, or Stripe itself hasn't settled the
    // subscription to active/trialing yet for some other reason).
    let subscriptionData: SubscriptionStatusProps;
    let matched: boolean;
    try {
      subscriptionData = await billingService.confirmSubscription(sheet.subscriptionId);
      matched = subscriptionData.tier === plan.tier
        && (subscriptionData.status === 'active' || subscriptionData.status === 'trialing');
    } catch {
      matched = false;
      subscriptionData = subscription ?? (await billingService.getSubscription());
    }
    if (!matched) {
      ({ status: subscriptionData, matched } = await pollForSubscriptionTier(plan.tier));
    }
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

  // Paid plan -> Apple/Google native In-App Purchase (services/iapService.ts)
  // — the iOS/Android counterpart to payWithPaymentSheet above. Unlike
  // Stripe, the store itself collects payment and reports success/failure
  // synchronously via the purchase listener inside iapService.purchase();
  // by the time this resolves, the backend has already verified the real
  // transaction against Apple/Google's own servers and granted the
  // entitlement (see apple_iap_service.py / google_play_iap_service.py) —
  // no webhook-lag polling needed the way the Stripe path requires.
  const payWithIAP = async (plan: BillingPlanProps) => {
    if (!plan.code) return;
    const result = await iapService.purchaseSubscription(plan.code);
    if (result.kind === 'error') {
      throw new Error(result.error);
    }
    if (result.kind !== 'subscription') {
      // Shouldn't happen for a plan SKU, but fail loudly rather than
      // silently treating an unexpected shape as success.
      throw new Error('Unexpected purchase result for a subscription SKU.');
    }
    setSubscription(result);
    refreshAuthSubscription();
    setJustSubscribedTier(result.tier);
    if (fromOnboarding) {
      onContinueOnboarding();
    } else {
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
  };

  // "Restore Purchases" — required by Apple (Guideline 3.1.2) for any app
  // with non-consumable/subscription IAP, since a reinstalled app or a new
  // device has no local record of a prior purchase. Not gated behind
  // isPremium/plan state — always visible on iOS/Android so it's reachable
  // exactly when someone actually needs it (right after reinstalling,
  // before any subscription data has loaded from this app's own backend).
  const [isRestoring, setIsRestoring] = React.useState(false);
  const onRestorePurchases = React.useCallback(async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      const { restoredCount } = await iapService.restorePurchases();
      const fresh = await billingService.getSubscription();
      setSubscription(fresh);
      refreshAuthSubscription();
      Alert.alert(
        restoredCount > 0
          ? t('more:restore_purchases_success_title', { defaultValue: 'Purchases restored' })
          : t('more:restore_purchases_none_title', { defaultValue: 'Nothing to restore' }),
        restoredCount > 0
          ? t('more:restore_purchases_success_body', { defaultValue: 'Your previous purchases have been restored.' })
          : t('more:restore_purchases_none_body', { defaultValue: "We couldn't find any previous purchases on this account." }),
      );
    } catch (error: any) {
      Alert.alert(
        t('more:restore_purchases_failed_title', { defaultValue: "Couldn't restore purchases" }),
        error?.message ?? t('common:try_again_later', { defaultValue: 'Please try again in a moment.' }),
      );
    } finally {
      setIsRestoring(false);
    }
  }, [isRestoring, refreshAuthSubscription, t]);

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
      // A subscription billed through Apple/Google has no Stripe customer
      // to open a portal for — send the user to the OS's own subscription
      // management instead (App Store's "Manage Subscriptions" / Play
      // Store's subscription center), the only place that billing can
      // actually be changed/cancelled from.
      if (subscription?.provider === 'apple' || subscription?.provider === 'google') {
        await iapService.openNativeSubscriptionManagement();
        return;
      }
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
    // Apple/Google own the renewal toggle for their own billed
    // subscriptions — there's no Stripe subscription row to schedule a
    // cancellation on. Same native-management redirect as onManageBilling.
    if (subscription?.provider === 'apple' || subscription?.provider === 'google') {
      iapService.openNativeSubscriptionManagement();
      return;
    }
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
  }, [isCancelling, refreshAuthSubscription, subscription, t]);

  const onResumeSubscription = React.useCallback(async () => {
    if (isResuming) return;
    if (subscription?.provider === 'apple' || subscription?.provider === 'google') {
      iapService.openNativeSubscriptionManagement();
      return;
    }
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
  }, [isResuming, refreshAuthSubscription, subscription, t]);

  const onSelectPlan = async (plan: BillingPlanProps, planKey: string) => {
    if (checkoutPlanId) return;
    setCheckoutPlanId(planKey);
    setJustSubscribedTier(null);
    try {
      if (plan.code) {
        // Apple Guideline 3.1.1 / Google Payments Policy: subscriptions must
        // be sold through each store's own IAP on iOS/Android — see
        // IS_NATIVE_IAP_PLATFORM's own comment above.
        if (IS_NATIVE_IAP_PLATFORM) {
          await payWithIAP(plan);
        } else {
          await payWithPaymentSheet(plan);
        }
      } else if (subscription?.provider === 'apple' || subscription?.provider === 'google') {
        // "Switch to Free" from an Apple/Google-billed plan isn't a
        // purchase to make — it's letting the current subscription lapse,
        // which only the OS's own subscription management can do.
        await iapService.openNativeSubscriptionManagement();
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
          <CtaButton children={t('common:try_again', { defaultValue: 'Try again' })} onPress={loadAll} style={{ marginBottom: 4 }} />
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
                defaultValue: IS_NATIVE_IAP_PLATFORM
                  ? `Pick a plan to unlock more of the AI coach. You'll pay securely through your ${Platform.OS === 'ios' ? 'App Store' : 'Google Play'} account.`
                  : "Pick a plan to unlock more of the AI coach. You'll pay securely right here via Stripe.",
              })}
        </Text>

        {/* Manual resync action (see onRefreshStatus's own comment) — only
            shown for an already-paying Stripe subscriber; the backend call
            this makes (POST /subscription/confirm) re-reads a live Stripe
            subscription, which an Apple/Google-billed subscriber doesn't
            have — "Restore Purchases" below is that case's real equivalent. */}
        {!fromOnboarding && currentTier !== 'free' && (!subscription?.provider || subscription.provider === 'stripe') ? (
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={isRefreshingStatus}
            onPress={onRefreshStatus}
            style={styles.refreshStatusLink}>
            {isRefreshingStatus ? (
              <Spinner size="tiny" />
            ) : (
              <Icon pack="eva" name="refresh-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
            )}
            {/* BUG FIX (screenshot: link text invisible in light mode) —
                was status="primary", which resolves to text-primary-color
                (constants/theme/light.json: near-white $color-basic-100,
                meant for text ON a solid primary-colored fill like a
                button, not as colored link text on the plain background
                here) — same recurring bug already fixed this way across
                the app (CareerDiary.tsx, PracticalScenarioSession.tsx,
                etc). Explicit color-primary-500 matches the Icon above and
                is visible in both themes. */}
            <Text category="h10" bold ml={6} style={{color: theme['color-primary-500']}}>
              {t('more:subscription_refresh_status_cta', { defaultValue: "Not seeing your correct plan? Refresh status" })}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* "Restore Purchases" — required by Apple (Guideline 3.1.2) for any
            app selling non-consumable/subscription IAP. Always visible on
            iOS/Android (not gated on tier) — a reinstall/new device has no
            local record of a prior purchase, so this needs to be reachable
            before this screen even knows the user was ever subscribed. */}
        {IS_NATIVE_IAP_PLATFORM ? (
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={isRestoring}
            onPress={onRestorePurchases}
            style={styles.refreshStatusLink}>
            {isRestoring ? (
              <Spinner size="tiny" />
            ) : (
              <Icon pack="eva" name="undo-outline" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
            )}
            {/* Same status="primary" -> invisible-in-light-mode fix as the
                refresh-status link above. */}
            <Text category="h10" bold ml={6} style={{color: theme['color-primary-500']}}>
              {t('more:restore_purchases_cta', { defaultValue: 'Restore purchases' })}
            </Text>
          </TouchableOpacity>
        ) : null}

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
            // At most one plan is ever flagged recommended-and-not-current
            // at a time (see isRecommended above), so that single plan —
            // the upsell this whole screen exists to drive — is the hero
            // that gets the flat solid-blue fill treatment. A plan the
            // user is already on never becomes the hero even if flagged
            // recommended; "upgrade to the plan you're already on" isn't a
            // real upsell.
            const isHero = isRecommended && !isCurrent;
            const cardBody = (
              <>
                {isRecommended ? (
                  <View style={[styles.popularRibbon, isHero ? styles.popularRibbonHero : { backgroundColor: theme['color-primary-500'] }]}>
                    <Text category="h10" bold status={isHero ? 'basic' : 'control'} style={isHero ? styles.popularRibbonHeroText : undefined}>
                      {t('more:most_popular', { defaultValue: 'MOST POPULAR' })}
                    </Text>
                  </View>
                ) : null}
                <Flex justify="space-between" itemsCenter mb={8}>
                  <Text category="h6" bold style={isHero ? styles.heroText : undefined}>{plan.title}</Text>
                  {isCurrent ? (
                    <View style={[styles.currentBadge, { backgroundColor: theme['color-primary-500'] }]}>
                      <Text category="h10" bold status="control">
                        {t('more:current_plan', { defaultValue: 'CURRENT PLAN' })}
                      </Text>
                    </View>
                  ) : null}
                </Flex>
                <Text category="h3" bold mb={16} style={isHero ? styles.heroText : undefined}>
                  {plan.price}
                  <Text category="h9-s" status={isHero ? 'basic' : 'placeholder'} style={isHero ? styles.heroSubText : undefined}>{plan.period}</Text>
                </Text>
                {plan.features.map((feature, i) => (
                  <Flex key={i} justify="flex-start" itemsCenter mb={10}>
                    <Icon pack="eva" name="checkmark-circle-2-outline" style={[globalStyle.icon16, { tintColor: isHero ? '#FFFFFF' : theme['text-basic-color'] }]} />
                    <Text category="h9-s" ml={10} style={isHero ? styles.heroText : undefined}>{feature}</Text>
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
                              date: new Date(subscription.periodEnd).toLocaleDateString(i18n.language),
                            })
                          : t('more:subscription_renews_on', {
                              defaultValue: 'Renews on {{date}}',
                              date: new Date(subscription.periodEnd).toLocaleDateString(i18n.language),
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
                ) : isHero ? (
                  // Plain TouchableOpacity, not CtaButton — same reasoning as
                  // HomeSrc.tsx's checkInButton: CtaButton always renders
                  // white text on a solid brand-blue fill by design, which
                  // would be nearly invisible on top of this card's own blue
                  // gradient. An inverted white-pill/blue-text control reads
                  // correctly against the fill instead.
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={!!checkoutPlanId}
                    onPress={() => onSelectPlan(plan, planKey)}
                    style={[styles.heroSubscribeButton, !!checkoutPlanId && styles.heroSubscribeButtonDisabled]}>
                    {isCheckingOut ? (
                      <Spinner size="small" status="primary" />
                    ) : (
                      <Text category="h9-s" bold style={styles.heroSubscribeButtonText}>
                        {plan.code
                          ? t('more:subscribe', { defaultValue: 'Subscribe' })
                          : t('more:downgrade', { defaultValue: 'Switch to this plan' })}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <CtaButton
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
              </>
            );
            // Flat solid-blue hero card (gradient fill removed — reserved
            // for the homescreen XP card only) — see the isHero comment
            // above for why only ever one plan at a time qualifies.
            return isHero ? (
              <View key={planKey} style={[styles.planCardHero, styles.planCardHeroInner]}>
                {cardBody}
              </View>
            ) : (
              <Layout
                key={planKey}
                level="2"
                style={[styles.planCard, isCurrent && { borderColor: theme['color-primary-500'], borderWidth: 2 }]}>
                {cardBody}
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
  refreshStatusLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  planCard: {
    ...globalStyle.card,
    padding: 20,
    marginBottom: 16,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
    // No border by default — was `borderWidth: 2` with no matching
    // `borderColor`, which React Native silently renders as a black
    // 2px border on every card (bug report: "black border on
    // Subscription/Payment cards"). Only the current-plan state gets a
    // border now, and it explicitly sets its own color+width at the
    // usage site.
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
  // Flat solid-blue hero card (gradient fill removed) — the ribbon flips to
  // a white fill/blue text (`popularRibbonHero`) since the original
  // solid-blue ribbon would blend into this card's own blue fill.
  // Product report: "colored cards like this are not supposed to have box
  // shadows" -- this hero card fills solid brand blue, and globalStyle.
  // card's dark neutral shadow (tuned for a plain white card) reads as a
  // muddy halo behind a saturated color fill instead of a crisp colored
  // card. shadowOpacity/elevation explicitly zeroed to cancel out the
  // shadow half of globalStyle.card's spread.
  planCardHero: {
    ...globalStyle.card,
    marginBottom: 16,
    backgroundColor: 'color-primary-500',
    shadowOpacity: 0,
    elevation: 0,
  },
  planCardHeroInner: {
    padding: 20,
  },
  popularRibbonHero: {
    backgroundColor: '#FFFFFF',
  },
  popularRibbonHeroText: {
    color: '#0063f8',
  },
  heroText: {
    color: '#FFFFFF',
  },
  heroSubText: {
    color: 'rgba(255,255,255,0.8)',
  },
  heroSubscribeButton: {
    marginTop: 4,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  heroSubscribeButtonDisabled: {
    opacity: 0.6,
  },
  heroSubscribeButtonText: {
    color: '#0063f8',
  },
});
