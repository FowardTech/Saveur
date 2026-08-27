import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import auth from '@react-native-firebase/auth';
import i18n from 'i18next';
import {BillingPlanProps, EKeyAsyncStorage, PaymentHistoryItemProps, SavedPaymentMethodProps, SubscriptionStatusProps} from 'constants/Types';
import {API_BASE_URL} from 'constants/env';
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
  recommended?: boolean;
  popular?: boolean;
  is_recommended?: boolean;
  // GET /billing/plans is now optional-auth (apiClient already attaches
  // the Firebase Bearer token on every request when signed in, so this
  // "just works" with no client change beyond reading the field) — when
  // authenticated, each plan tells us directly whether it's the one this
  // user is on, including the Free entry for a never-subscribed user. This
  // is the authoritative source for the "CURRENT PLAN" badge; the
  // priceId/tier-based matching below is now only a fallback for a backend
  // response that doesn't include this yet.
  is_current?: boolean;
  status?: string;
}

interface SubscriptionWire {
  tier: 'free' | 'premium' | 'premium_plus';
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'none';
  // "stripe" | "apple" | "google" | undefined (never-subscribed/free) — which
  // biller this subscription actually runs through. Subscription.tsx needs
  // this to know whether "Manage Billing"/cancel/resume should talk to
  // Stripe's portal (only meaningful for provider === "stripe") or send the
  // user to the OS's native subscription management instead (apple/google —
  // neither store lets a third-party backend cancel/change their billing
  // directly).
  provider?: 'stripe' | 'apple' | 'google' | null;
  price_id?: string | null;
  period_end?: number | null; // unix seconds
  cancel_at_period_end?: boolean;
  // Free-tier session gating — see services/entitlementsService.ts.
  // `sessions_limit: null` (or field entirely absent) means unlimited/not
  // yet implemented server-side; entitlementsService falls back to a local
  // count against a hardcoded cap in that case.
  sessions_used?: number;
  sessions_limit?: number | null;
  // Enough to render a "CURRENT PLAN" badge from this one call alone,
  // without also needing an authenticated /billing/plans fetch — see
  // is_current above for the (now primary) alternative path via
  // /billing/plans, and Subscription.tsx for how the two are combined.
  plan_code?: string | null;
  plan_name?: string | null;
  interval?: 'month' | 'year' | null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {usd: '$', eur: '€', gbp: '£'};

/** Exported for src/more/AddOns.tsx (and anywhere else a raw cents+currency
 * pair needs the same "$9.99"-style formatting Subscription.tsx's plan
 * cards already use). */
export function formatPrice(amount: number, currency: string): string {
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
    // Raw values for Subscription.tsx's "SAVE X%" badge — see
    // BillingPlanProps.amount's own comment.
    amount: wire.amount,
    interval: wire.interval ?? null,
    // Optional — not every backend will send this. Subscription.tsx falls
    // back to a client-side heuristic (the cheapest paid/non-free tier) when
    // no plan in the list has this set, so the "Popular" badge always shows
    // on exactly one card either way.
    recommended: wire.recommended ?? wire.popular ?? wire.is_recommended ?? false,
    // Only present when this call was authenticated (GET /billing/plans is
    // optional-auth) — undefined for a signed-out fetch, which
    // Subscription.tsx's isCurrent logic already falls back around.
    isCurrent: typeof wire.is_current === 'boolean' ? wire.is_current : undefined,
  };
}

function fromSubscriptionWire(wire: SubscriptionWire): SubscriptionStatusProps {
  return {
    tier: wire.tier ?? 'free',
    status: wire.status ?? 'none',
    provider: wire.provider ?? null,
    periodEnd: wire.period_end ? wire.period_end * 1000 : undefined,
    cancelAtPeriodEnd: wire.cancel_at_period_end ?? false,
    sessionsUsed: typeof wire.sessions_used === 'number' ? wire.sessions_used : undefined,
    sessionsLimit: wire.sessions_limit !== undefined ? wire.sessions_limit : undefined,
    // Previously read off `wire` but dropped here — Subscription.tsx now
    // uses this to tell apart two plans on the same tier (see
    // SubscriptionStatusProps.priceId's comment in constants/Types.tsx).
    priceId: wire.price_id ?? null,
    // planCode/planName — a second, standalone way to identify which exact
    // plan (not just tier) the user is on, straight from this one call.
    // Subscription.tsx prefers plans[].isCurrent when present, then falls
    // back to matching plan.code === planCode here, then priceId, then
    // plain tier — see that file's isCurrent comment for the full order.
    planCode: wire.plan_code ?? null,
    planName: wire.plan_name ?? null,
    interval: wire.interval ?? null,
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
 *
 * BUG FIX (product report: "subscription/payment screens" stuck in English
 * regardless of language) — this never told the backend what language to
 * respond in, so plan name/description/features always came back as plain
 * admin-authored English. The backend now translates those fields when
 * `language` is non-English (see app/api/billing.py's plans()) — same
 * pattern as every other language-aware service call in this app.
 */
export async function getPlans(): Promise<BillingPlanProps[]> {
  try {
    const {data} = await apiClient.get<BillingPlanWire[]>('/api/v1/billing/plans', {
      params: {language: i18n.language || 'en'},
    });
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
  // `couponCode` (optional, subscription only): an admin-managed discount
  // code (see coupon_service.py) — should already have been checked via
  // `validateCoupon` below before the user reaches the actual pay button,
  // but the backend re-validates independently regardless (never trusts
  // the client's own belief that a code is still valid).
  | {planCode: string; couponCode?: string}
  | {mode: 'payment'; amount: number; currency: string}
  // Paid Add-ons feature ("I want [Coding Practice / System Design
  // Whiteboard] to be in a separate screen called add-ons and they should
  // be paid for") — amount/currency are deliberately NOT sent here; the
  // backend re-reads them from the Addon catalog row server-side (see
  // app/api/billing.py's payment_sheet() docstring) so this client can't
  // spoof a price for a real product purchase.
  | {mode: 'payment'; addonCode: string};

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
    'planCode' in req
      ? {plan_code: req.planCode, coupon_code: req.couponCode}
      : 'addonCode' in req
      ? {mode: req.mode, addon_code: req.addonCode}
      : {mode: req.mode, amount: req.amount, currency: req.currency};
  const {data} = await apiClient.post<PaymentSheetWire>('/api/v1/billing/payment-sheet', body);
  // Guard rail, not paranoia: an empty/missing publishable_key handed
  // straight to @stripe/stripe-react-native's initStripe() doesn't fail
  // gracefully — Stripe's native SDK hits a FATAL assertion and takes the
  // whole app down instantly (confirmed: this exact crash happened once
  // already, from StripeProvider getting an empty key at boot; the fix for
  // that surfaced this second instance, from this endpoint's response
  // itself being incomplete). Every other service in this app just throws
  // a catchable JS error on a malformed response — this one gets an
  // explicit check because the failure mode on the other side of it is so
  // much worse than usual.
  if (!data.publishable_key || !data.customer || !data.ephemeral_key || !data.client_secret) {
    throw new Error(
      'The backend did not return everything the checkout needs (publishable_key/customer/ephemeral_key/client_secret) — cannot start Stripe checkout safely.',
    );
  }
  return {
    publishableKey: data.publishable_key,
    customerId: data.customer,
    ephemeralKeySecret: data.ephemeral_key,
    clientSecret: data.client_secret,
    subscriptionId: data.subscription_id,
    paymentIntentId: data.payment_intent_id,
  };
}

export interface CouponValidationResult {
  valid: boolean;
  percentOff?: number | null;
  amountOff?: number | null;
  currency?: string;
  errorCode?: string;
}

/**
 * POST /api/v1/billing/coupons/validate — lets Subscription.tsx's coupon
 * field show a live "20% off applied" / error state before the user taps
 * the actual pay button. Never throws on an invalid/ineligible code (a 400
 * with a machine-readable `error` is treated the same as `{valid: false}`,
 * so the caller doesn't need its own try/catch just to render "invalid
 * code") — only a genuine network/auth failure propagates as a thrown
 * error, same convention as the rest of this file.
 */
export async function validateCoupon(code: string, planCode: string): Promise<CouponValidationResult> {
  try {
    const {data} = await apiClient.post<{
      valid: boolean;
      percent_off?: number | null;
      amount_off?: number | null;
      currency?: string;
    }>('/api/v1/billing/coupons/validate', {code, plan_code: planCode});
    return {
      valid: data.valid,
      percentOff: data.percent_off,
      amountOff: data.amount_off,
      currency: data.currency,
    };
  } catch (error: any) {
    const errorCode = error?.response?.data?.error;
    if (errorCode) {
      return {valid: false, errorCode};
    }
    throw error;
  }
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
 * POST /api/v1/billing/subscription/cancel — schedules cancellation at the
 * end of the current billing period (access continues until then; Stripe's
 * webhook flips the plan to free once it actually ends). This is the direct
 * in-app counterpart to what used to require sending the user out to
 * Stripe's hosted Customer Portal (createPortalSession/onManageBilling in
 * Subscription.tsx) just to turn off auto-renewal.
 */
export async function cancelSubscription(): Promise<SubscriptionStatusProps> {
  const {data} = await apiClient.post<SubscriptionWire>('/api/v1/billing/subscription/cancel', {});
  return fromSubscriptionWire(data as SubscriptionWire);
}

/**
 * POST /api/v1/billing/subscription/resume — undoes a scheduled
 * cancellation (turns auto-renewal back on), as long as the current period
 * hasn't actually ended yet.
 */
export async function resumeSubscription(): Promise<SubscriptionStatusProps> {
  const {data} = await apiClient.post<SubscriptionWire>('/api/v1/billing/subscription/resume', {});
  return fromSubscriptionWire(data as SubscriptionWire);
}

// ---- Saved payment methods (Payment Methods screen) -----------------------
//   POST   /api/v1/billing/setup-intent          — SetupIntent to save a
//                                                   card, no charge
//   GET    /api/v1/billing/payment-methods        — list saved cards
//   POST   /api/v1/billing/payment-methods/:id/default — set default card
//   DELETE /api/v1/billing/payment-methods/:id    — remove a card
// Same customer as createPaymentSheet above — cards saved here are what a
// later subscription charge automatically uses (SetupIntent's
// usage: "off_session", per the backend contract), which is the "make use
// of the payment method section" integration point.

export interface SetupIntentInit {
  publishableKey: string;
  customerId: string;
  ephemeralKeySecret: string;
  clientSecret: string;
  setupIntentId: string;
}

interface SetupIntentWire {
  publishable_key: string;
  customer: string;
  ephemeral_key: string;
  client_secret: string;
  setup_intent_id: string;
}

/**
 * POST /api/v1/billing/setup-intent — init params for
 * @stripe/stripe-react-native's initPaymentSheet in *setup* mode
 * (setupIntentClientSecret, not paymentIntentClientSecret — see
 * src/more/PaymentMethod.tsx for the actual initPaymentSheet/
 * presentPaymentSheet call sequence). Same empty-response guard as
 * createPaymentSheet above, for the same reason: an empty publishable_key
 * reaching Stripe's native SDK is a fatal, non-catchable crash, not a
 * regular JS error.
 */
export async function createSetupIntent(): Promise<SetupIntentInit> {
  const {data} = await apiClient.post<SetupIntentWire>('/api/v1/billing/setup-intent', {});
  if (!data.publishable_key || !data.customer || !data.ephemeral_key || !data.client_secret) {
    throw new Error(
      'The backend did not return everything needed to save a card (publishable_key/customer/ephemeral_key/client_secret) — cannot open the card form safely.',
    );
  }
  return {
    publishableKey: data.publishable_key,
    customerId: data.customer,
    ephemeralKeySecret: data.ephemeral_key,
    clientSecret: data.client_secret,
    setupIntentId: data.setup_intent_id,
  };
}

interface SavedPaymentMethodWire {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

function fromPaymentMethodWire(wire: SavedPaymentMethodWire): SavedPaymentMethodProps {
  return {
    id: wire.id,
    brand: wire.brand,
    last4: wire.last4,
    expMonth: wire.exp_month,
    expYear: wire.exp_year,
    isDefault: wire.is_default ?? false,
  };
}

/**
 * GET /api/v1/billing/payment-methods — the backend wraps the array in
 * `{data: [...]}` per the contract (unlike this app's other list
 * endpoints, which return a bare array) — unwrapped here so the caller
 * doesn't need to know that.
 */
export async function listPaymentMethods(): Promise<SavedPaymentMethodProps[]> {
  const {data} = await apiClient.get<{data: SavedPaymentMethodWire[]}>('/api/v1/billing/payment-methods');
  return (data.data ?? []).map(fromPaymentMethodWire);
}

/** POST /api/v1/billing/payment-methods/{id}/default */
export async function setDefaultPaymentMethod(id: string): Promise<void> {
  await apiClient.post(`/api/v1/billing/payment-methods/${id}/default`, {});
}

/** DELETE /api/v1/billing/payment-methods/{id} */
export async function deletePaymentMethod(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/billing/payment-methods/${id}`);
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

/**
 * POST /api/v1/billing/subscription/confirm — call this immediately after
 * `presentPaymentSheet()` resolves successfully in Subscription.tsx, instead
 * of (or before) blindly polling `getSubscription()`. `/payment-sheet`
 * creates the Stripe Subscription synchronously but never itself sets the
 * local plan/status — historically only the async
 * customer.subscription.updated/created webhook did that, so the success
 * screen depended entirely on that webhook arriving within the client's
 * poll window. This endpoint instead has the backend read the subscription
 * straight from Stripe's live API and update the local record in the same
 * request, so the true post-payment status is available on the very next
 * call — no waiting on webhook delivery timing at all. `subscriptionId` is
 * optional (the backend already knows it from `createPaymentSheet`'s own
 * response) but passed through here anyway since Subscription.tsx already
 * has it in hand from that same response.
 */
export async function confirmSubscription(subscriptionId?: string): Promise<SubscriptionStatusProps> {
  const {data} = await apiClient.post<SubscriptionWire>('/api/v1/billing/subscription/confirm', {
    subscription_id: subscriptionId,
  });
  const status = fromSubscriptionWire(data);
  await AsyncStorage.setItem(EKeyAsyncStorage.subscriptionStatus, JSON.stringify(status));
  return status;
}

// ---- Payment History / receipts ------------------------------------------
//   GET  /api/v1/billing/payments                       — list past payments
//   GET  /api/v1/billing/payments/:id/receipt.pdf        — download the PDF
//   POST /api/v1/billing/payments/:id/send-receipt       — re-send to email
// See src/more/PaymentHistory.tsx for the screen these back, and
// app/models/payment.py / app/services/receipt_service.py on the backend.

interface PaymentHistoryWire {
  id: number;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  card_brand: string | null;
  card_last4: string | null;
  discount_amount: number | null;
  receipt_sent_at: string | null;
  created_at: string | null;
}

function fromPaymentWire(wire: PaymentHistoryWire): PaymentHistoryItemProps {
  return {
    id: wire.id,
    amount: wire.amount ?? 0,
    currency: wire.currency ?? 'usd',
    status: wire.status ?? 'succeeded',
    description: wire.description,
    cardBrand: wire.card_brand,
    cardLast4: wire.card_last4,
    discountAmount: wire.discount_amount ?? null,
    receiptSentAt: wire.receipt_sent_at ? new Date(wire.receipt_sent_at).getTime() : null,
    createdAt: wire.created_at ? new Date(wire.created_at).getTime() : Date.now(),
  };
}

/** GET /api/v1/billing/payments — most-recent-first list for the Payment
 * History screen. Backend wraps the array in `{data: [...]}`, same
 * convention as listPaymentMethods above. */
export async function listPayments(): Promise<PaymentHistoryItemProps[]> {
  const {data} = await apiClient.get<{data: PaymentHistoryWire[]}>('/api/v1/billing/payments');
  return (data.data ?? []).map(fromPaymentWire);
}

/** POST /api/v1/billing/payments/:id/send-receipt — re-sends the receipt
 * email (with a freshly-generated PDF attached) on demand. Returns the
 * email address it was sent to, so the caller can show "Sent to
 * you@example.com" without needing a separate profile lookup. */
export async function sendReceiptEmail(paymentId: number): Promise<{sentTo: string}> {
  // BUG FIX (product report: "emails, pdf, docx and receipts and
  // documents must be translated to the user's preferred language") --
  // was sending an empty body, so this receipt email had no way to know
  // which language to render in.
  const {data} = await apiClient.post<{ok: boolean; sent_to: string}>(
    `/api/v1/billing/payments/${paymentId}/send-receipt`,
    {language: i18n.language || 'en'},
  );
  return {sentTo: data.sent_to};
}

/**
 * Downloads the receipt PDF for `paymentId` to the device and returns the
 * local file path — same react-native-blob-util pattern as
 * src/more/GenerateResume.tsx's onDownload (Android: DownloadManager into
 * the public Downloads folder; iOS: CacheDir, then the caller shares it).
 * Unlike GenerateResume's flow (which downloads an unauthenticated signed
 * URL), this hits an authenticated backend endpoint directly, so the
 * Firebase ID token is attached as a header here manually — RNBlobUtil's
 * fetch doesn't go through apiClient's axios interceptors.
 */
export async function downloadReceiptPdf(payment: PaymentHistoryItemProps): Promise<{path: string; filename: string}> {
  const user = auth().currentUser;
  if (!user) {
    throw new Error(
      i18n.t('payment:sign_in_required_receipt', {
        defaultValue: 'You need to be signed in to download a receipt.',
      }),
    );
  }
  const idToken = await user.getIdToken();
  // BUG FIX -- was missing language entirely (this PDF is fetched by
  // RNBlobUtil directly, not through apiClient, so it needs the param on
  // the URL itself rather than an axios `params` object).
  const url = `${API_BASE_URL}/api/v1/billing/payments/${payment.id}/receipt.pdf?language=${encodeURIComponent(i18n.language || 'en')}`;
  const filename = `Saveur-Receipt-${payment.id}.pdf`;
  const headers = {Authorization: `Bearer ${idToken}`};

  if (Platform.OS === 'android') {
    const res = await RNBlobUtil.config({
      addAndroidDownloads: {
        useDownloadManager: true,
        notification: true,
        title: filename,
        description: 'Downloading receipt…',
        mime: 'application/pdf',
        mediaScannable: true,
        path: `${RNBlobUtil.fs.dirs.DownloadDir}/${filename}`,
      },
    }).fetch('GET', url, headers);
    return {path: res.path(), filename};
  }
  const dest = `${RNBlobUtil.fs.dirs.CacheDir}/${filename}`;
  const res = await RNBlobUtil.config({path: dest, overwrite: true}).fetch('GET', url, headers);
  return {path: res.path(), filename};
}

// ---- Paid Add-ons (Coding Practice / System Design Whiteboard) -----------
// "for the coding practice and system design whiteboard I want them to be
// in a separate screen called add-ons and they should be paid for ...
// configurable in the admin" — one-time purchase, unlocked forever, via
// the same in-app PaymentSheet flow above (createPaymentSheet({mode:
// 'payment', addonCode})). See src/more/AddOns.tsx for the actual
// initPaymentSheet/presentPaymentSheet call sequence, and
// services/entitlementsService.ts's getAddonEntitlement for the
// pre-navigation gate used at every Coding Practice / System Design entry
// point.

export interface AddonProps {
  code: string;
  name: string;
  description: string | null;
  amount: number; // minor currency unit (cents)
  currency: string;
  unlocked: boolean;
}

interface AddonWire {
  code: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  is_active: boolean;
  unlocked: boolean;
}

function fromAddonWire(wire: AddonWire): AddonProps {
  return {
    code: wire.code,
    name: wire.name,
    description: wire.description,
    amount: wire.amount ?? 0,
    currency: wire.currency ?? 'usd',
    unlocked: !!wire.unlocked,
  };
}

// ---- Apple / Google In-App Purchase (iOS/Android, replaces the Stripe
// Payment Sheet flow above for subscriptions/add-ons on mobile — Apple
// Guideline 3.1.1 requires digital subscriptions to go through Apple's own
// IAP, not a third-party processor). See services/iapService.ts for the
// actual react-native-iap purchase flow that calls these; this file only
// wraps the two backend verify endpoints. ----

// Discriminated on `kind` so a single call site (iapService.ts) can handle
// whichever shape came back without knowing in advance — Apple's verify
// endpoint in particular doesn't know upfront whether a transaction_id is a
// subscription or an add-on (see backend's apple_iap_service.
// grant_from_transaction).
export type IapVerifyResult =
  | (SubscriptionStatusProps & {kind: 'subscription'})
  | {kind: 'addon'; addonCode: string; unlocked: boolean; unlockedAddons: string[]}
  | {kind: 'error'; error: string};

interface IapVerifyWire {
  error?: string;
  kind?: 'subscription' | 'addon';
  addon_code?: string;
  unlocked?: boolean;
  unlocked_addons?: string[];
  // ...plus every SubscriptionWire field when kind === 'subscription'.
  [key: string]: unknown;
}

function fromIapVerifyWire(wire: IapVerifyWire): IapVerifyResult {
  if (wire.error) return {kind: 'error', error: wire.error};
  if (wire.kind === 'addon') {
    return {
      kind: 'addon',
      addonCode: wire.addon_code ?? '',
      unlocked: !!wire.unlocked,
      unlockedAddons: wire.unlocked_addons ?? [],
    };
  }
  return {kind: 'subscription', ...fromSubscriptionWire(wire as unknown as SubscriptionWire)};
}

/** POST /api/v1/billing/iap/apple/verify — {transaction_id}. Apple's own
 * single verify endpoint figures out subscription-vs-add-on itself from
 * the transaction's product id, so there's only one call here (unlike the
 * Google functions below, which need two — see google_play_iap_service.py's
 * module docstring for why the Play Developer API doesn't unify those). */
export async function verifyAppleTransaction(transactionId: string): Promise<IapVerifyResult> {
  const {data} = await apiClient.post<IapVerifyWire>('/api/v1/billing/iap/apple/verify', {
    transaction_id: transactionId,
  });
  return fromIapVerifyWire(data);
}

/** POST /api/v1/billing/iap/google/verify — {mode:"subscription", product_id, purchase_token}. */
export async function verifyGoogleSubscription(productId: string, purchaseToken: string): Promise<IapVerifyResult> {
  const {data} = await apiClient.post<IapVerifyWire>('/api/v1/billing/iap/google/verify', {
    mode: 'subscription', product_id: productId, purchase_token: purchaseToken,
  });
  return fromIapVerifyWire(data);
}

/** POST /api/v1/billing/iap/google/verify — {mode:"product", product_id, purchase_token}
 * (the one-time-purchase / add-on counterpart to verifyGoogleSubscription above). */
export async function verifyGoogleAddon(productId: string, purchaseToken: string): Promise<IapVerifyResult> {
  const {data} = await apiClient.post<IapVerifyWire>('/api/v1/billing/iap/google/verify', {
    mode: 'product', product_id: productId, purchase_token: purchaseToken,
  });
  return fromIapVerifyWire(data);
}

/** GET /api/v1/billing/addons — the Add-ons screen's catalog, each entry
 * already annotated with whether the current user has unlocked it. */
export async function listAddons(): Promise<AddonProps[]> {
  // BUG FIX (product report: Add-ons screen's "Coding Practice" title/
  // description still showing English on a Chinese locale) -- this catalog
  // fetch was missing the same `language` param this file's config fetch
  // above (line ~208) already sends.
  const {data} = await apiClient.get<AddonWire[]>('/api/v1/billing/addons', {
    params: {language: i18n.language || 'en'},
  });
  return (data ?? []).map(fromAddonWire);
}

/**
 * POST /api/v1/billing/addons/confirm — call this immediately after
 * `presentPaymentSheet()` resolves successfully for an add-on purchase,
 * same reasoning as confirmSubscription above: this synchronously
 * re-checks Stripe and grants the unlock in the same request, rather than
 * waiting on the payment_intent.succeeded webhook to land before the
 * add-on shows as active.
 */
export async function confirmAddonPurchase(paymentIntentId: string): Promise<{addonCode: string; unlocked: boolean}> {
  const {data} = await apiClient.post<{addon_code: string; unlocked: boolean}>('/api/v1/billing/addons/confirm', {
    payment_intent_id: paymentIntentId,
  });
  return {addonCode: data.addon_code, unlocked: !!data.unlocked};
}
