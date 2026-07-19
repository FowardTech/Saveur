import AsyncStorage from '@react-native-async-storage/async-storage';
import {BillingPlanProps, EKeyAsyncStorage, SubscriptionStatusProps} from 'constants/Types';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// billingService — real backend implementation of the Billing/Subscription
// domain (see docs/BACKEND_API_SPEC.md, and the Stripe-based contract this
// file targets):
//   GET  /api/v1/billing/plans         — list plans + live Stripe price ids
//                                         (auto-provisioned server-side from
//                                         PLAN_CATALOG on first request —
//                                         idempotent, no client action needed)
//   POST /api/v1/billing/payment-sheet — {plan_code} or {mode:'payment',
//                                         amount, currency} -> Payment Sheet
//                                         init params (in-app checkout)
//   POST /api/v1/billing/checkout      — {plan_code} -> {url} (Stripe
//                                         Checkout; superseded by
//                                         payment-sheet for subscribing, see
//                                         below, but left implemented)
//   POST /api/v1/billing/portal        — {} -> {url} (Stripe Customer Portal)
//   GET  /api/v1/billing/subscription  — current plan/status/period_end
// POST /api/v1/billing/webhook is backend-only (Stripe -> backend); this app
// never calls it.
//
// Replaces the mock that used to live directly in src/more/Subscription.tsx
// (a hardcoded PLANS array + an onSubscribe that just called
// AuthContext.updateProfile({subscriptionTier}) with no payment collected).
//
// UPDATE — subscribing now goes through an in-app native Stripe Payment
// Sheet (createPaymentSheet below, POST /api/v1/billing/payment-sheet) via
// @stripe/stripe-react-native, NOT createCheckoutSession's browser-based
// flow anymore. createCheckoutSession/the old browser flow is kept below
// only because createPortalSession (downgrade/cancel/manage-in-Stripe) still
// legitimately opens a browser — there's no in-app equivalent for that one.
// See src/more/Subscription.tsx for the Payment Sheet flow itself
// (initStripe/initPaymentSheet/presentPaymentSheet calls live there, not
// here, since they need React hooks from @stripe/stripe-react-native).
//
// Old mobile flow (per spec, still true for the portal path only): POST
// /portal -> open the returned url -> user manages billing in the browser ->
// Stripe's webhook (server-to-server) updates the DB -> this app refetches
// /billing/subscription on AppState foreground to pick up the change (see
// src/more/Subscription.tsx). The Payment Sheet path below doesn't need any
// of that — presentPaymentSheet() resolves in-app when payment finishes, so
// the caller can refetch /billing/subscription immediately instead of
// waiting on an AppState foreground event.
//
// Wire format note: like authService, the backend uses snake_case
// (`price_id`, `period_end`, `cancel_at_period_end`) while the app uses
// camelCase — fromWire below is the only place that translation happens.
// ---------------------------------------------------------------------------

interface BillingPlanWire {
  id: string;
  code: string | null; // plan_code, e.g. "pro_monthly" — pass to /checkout
  tier: 'free' | 'premium' | 'premium_plus';
  name: string;
  price_id: string | null; // Stripe Price id — informational only now
  amount: number; // minor currency unit (e.g. cents); 0 for the free plan
  currency: string; // e.g. 'usd'
  interval?: 'month' | 'year' | null;
  features?: string[];
}

interface SubscriptionWire {
  tier: 'free' | 'premium' | 'premium_plus';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'none';
  price_id?: string | null;
  period_end?: number | null; // unix seconds
  cancel_at_period_end?: boolean;
}

const CURRENCY_SYMBOLS: Record<string, string> = {usd: '$', eur: '€', gbp: '£'};

function formatPrice(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency?.toLowerCase()] ?? '';
  return `${symbol}${(amount / 100).toFixed(2)}`;
}

function fromPlanWire(wire: BillingPlanWire): BillingPlanProps {
  return {
    id: wire.id,
    code: wire.code ?? null,
    tier: wire.tier,
    priceId: wire.price_id ?? null,
    title: wire.name,
    price: formatPrice(wire.amount ?? 0, wire.currency ?? 'usd'),
    period: wire.interval ? `/${wire.interval === 'month' ? 'mo' : 'yr'}` : '',
    features: wire.features ?? [],
  };
}

function fromSubscriptionWire(wire: SubscriptionWire): SubscriptionStatusProps {
  return {
    tier: wire.tier ?? 'free',
    status: wire.status ?? 'none',
    periodEnd: wire.period_end ? wire.period_end * 1000 : undefined,
    cancelAtPeriodEnd: wire.cancel_at_period_end ?? false,
  };
}

const readPlansCache = async (): Promise<BillingPlanProps[] | null> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.billingPlans);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BillingPlanProps[];
  } catch {
    return null;
  }
};

const readSubscriptionCache = async (): Promise<SubscriptionStatusProps | null> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.subscriptionStatus);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SubscriptionStatusProps;
  } catch {
    return null;
  }
};

/**
 * GET /api/v1/billing/plans. Public endpoint — safe to call before/without a
 * signed-in session (e.g. a pre-signup paywall preview). Falls back to the
 * last-known cached list so the paywall isn't just a blank screen on a flaky
 * connection.
 */
export async function getPlans(): Promise<BillingPlanProps[]> {
  try {
    const {data} = await apiClient.get<BillingPlanWire[]>('/api/v1/billing/plans');
    const plans = data.map(fromPlanWire);
    await AsyncStorage.setItem(EKeyAsyncStorage.billingPlans, JSON.stringify(plans));
    return plans;
  } catch (error) {
    const cached = await readPlansCache();
    if (cached) return cached;
    throw error;
  }
}

/**
 * POST /api/v1/billing/checkout. `planCode` is a `BillingPlanProps.code`
 * (e.g. "pro_monthly") from `getPlans()` — the backend auto-provisions the
 * matching Stripe Product/Price from its own PLAN_CATALOG the first time
 * it's needed (idempotent, keyed by that code, so this never creates
 * duplicates). Should never be called for a plan with `code: null` (e.g. the
 * free tier isn't part of the Stripe catalog — the caller should route that
 * case to `createPortalSession` instead, since downgrading/canceling happens
 * via the Stripe portal, not checkout). Returns the Stripe Checkout url to
 * open with `Linking.openURL`.
 */
export async function createCheckoutSession(planCode: string): Promise<string> {
  const {data} = await apiClient.post<{url: string}>('/api/v1/billing/checkout', {
    plan_code: planCode,
  });
  return data.url;
}

// ---- In-app native Payment Sheet (@stripe/stripe-react-native) -----------

export type PaymentSheetRequest =
  | {planCode: string}
  | {mode: 'payment'; amount: number; currency: string};

export interface PaymentSheetInit {
  publishableKey: string;
  customerId: string;
  ephemeralKeySecret: string;
  clientSecret: string;
  subscriptionId?: string;
  paymentIntentId?: string;
}

interface PaymentSheetWire {
  publishable_key: string;
  customer: string;
  ephemeral_key: string;
  client_secret: string;
  subscription_id?: string;
  payment_intent_id?: string;
}

/**
 * POST /api/v1/billing/payment-sheet — the in-app replacement for
 * createCheckoutSession above when subscribing to a plan. Takes either
 * `{planCode}` (subscriptions) or `{mode: 'payment', amount, currency}`
 * (one-time charges, minor currency units e.g. cents) and returns everything
 * @stripe/stripe-react-native's initPaymentSheet needs. See
 * src/more/Subscription.tsx for the actual initStripe/initPaymentSheet/
 * presentPaymentSheet call sequence — kept out of this file since those need
 * React hooks (useStripe()), not just a network call.
 */
export async function createPaymentSheet(req: PaymentSheetRequest): Promise<PaymentSheetInit> {
  const body =
    'planCode' in req ? {plan_code: req.planCode} : {mode: req.mode, amount: req.amount, currency: req.currency};
  const {data} = await apiClient.post<PaymentSheetWire>('/api/v1/billing/payment-sheet', body);
  return {
    publishableKey: data.publishable_key,
    customerId: data.customer,
    ephemeralKeySecret: data.ephemeral_key,
    clientSecret: data.client_secret,
    subscriptionId: data.subscription_id,
    paymentIntentId: data.payment_intent_id,
  };
}

/**
 * POST /api/v1/billing/portal. Opens Stripe's hosted Customer Portal, where
 * an already-paying user can update payment methods, change plans, or cancel
 * — this is also how a "downgrade to Free" action is implemented client-side
 * (see src/more/Subscription.tsx), since there's no direct
 * "unsubscribe"/"downgrade" REST call in this contract. Returns the portal
 * url to open with `Linking.openURL`.
 */
export async function createPortalSession(): Promise<string> {
  const {data} = await apiClient.post<{url: string}>('/api/v1/billing/portal', {});
  return data.url;
}

/**
 * GET /api/v1/billing/subscription. Call this on mount and again whenever
 * the app returns to the foreground after the user has been sent to Stripe
 * Checkout/Portal (see the AppState listener in src/more/Subscription.tsx) —
 * that's how this app learns the webhook-driven server state changed, since
 * there's no deep-link redirect back into the app to trigger it directly.
 */
export async function getSubscription(): Promise<SubscriptionStatusProps> {
  try {
    const {data} = await apiClient.get<SubscriptionWire>('/api/v1/billing/subscription');
    const status = fromSubscriptionWire(data);
    await AsyncStorage.setItem(EKeyAsyncStorage.subscriptionStatus, JSON.stringify(status));
    return status;
  } catch (error) {
    const cached = await readSubscriptionCache();
    if (cached) return cached;
    throw error;
  }
}
