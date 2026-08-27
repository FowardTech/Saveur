import * as RNIap from 'react-native-iap';
import type {Product, ProductSubscription, Purchase} from 'react-native-iap';

import * as billingService from './billingService';
import {IapVerifyResult} from './billingService';

// ---------------------------------------------------------------------------
// iapService — the react-native-iap purchase engine backing
// src/more/Subscription.tsx and src/more/AddOns.tsx on iOS/Android (Apple
// Guideline 3.1.1 requires digital subscriptions to go through Apple's own
// In-App Purchase system, not Stripe — see billingService.ts's own comment
// on the new verify* functions this file calls). Deliberately a plain
// function/listener module, not the library's `useIAP()` hook — this needs
// to be called from two different screens with one shared connection, which
// the hook's per-component lifecycle isn't a fit for.
//
// SKUs are product ids straight from the backend catalog (SubscriptionPlan.
// code / Addon.code, or their apple_product_id/google_product_id overrides
// — see billingService.ts's BillingPlanProps.code / AddonProps.code) so
// there's exactly one id to plumb through per plan/add-on, matching what's
// configured in App Store Connect / Play Console (see docs/IAP_SETUP.md).
// ---------------------------------------------------------------------------

let connectionPromise: Promise<boolean> | null = null;

/** Idempotent — safe to call from every screen that needs IAP; only the
 * first call actually opens the store connection. */
export function ensureConnection(): Promise<boolean> {
  if (!connectionPromise) {
    connectionPromise = RNIap.initConnection().catch((err: unknown) => {
      connectionPromise = null; // let a failed connection attempt be retried
      throw err;
    });
  }
  // Non-null: the branch above always assigns it when it was null, and TS
  // can't narrow through the reassignment inside the .catch() closure above.
  return connectionPromise!;
}

export async function fetchSubscriptionProducts(skus: string[]): Promise<ProductSubscription[]> {
  if (!skus.length) return [];
  await ensureConnection();
  return (await RNIap.fetchProducts({skus, type: 'subs'})) as ProductSubscription[];
}

export async function fetchOneTimeProducts(skus: string[]): Promise<Product[]> {
  if (!skus.length) return [];
  await ensureConnection();
  return (await RNIap.fetchProducts({skus, type: 'in-app'})) as Product[];
}

async function verifyPurchaseServerSide(
  purchase: Purchase,
  mode: 'subscription' | 'product',
): Promise<IapVerifyResult> {
  // BUG FIX (product report: real-device iOS purchases were verified
  // against the Google endpoint — /api/v1/billing/iap/google/verify — and
  // predictably 503'd, since this app never configures Google Play
  // credentials for an iOS build). Root cause: this used to check
  // `purchase.platform === 'ios'`, but react-native-iap v16's Nitro-backed
  // Purchase type (PurchaseIOS/PurchaseAndroid, both extending
  // PurchaseCommon) has no `platform` field at all — see
  // type-bridge.js's convertNitroPurchaseToPurchase(), whose returned
  // object literals only ever set `store`, never `platform`. That check
  // was therefore always `undefined === 'ios'` → always false, silently
  // routing every purchase (iOS included) down the Android/Google branch
  // below. `store` (an IapStore: 'apple' | 'google' | 'horizon' |
  // 'amazon' | 'unknown') is the field that's actually populated, so that's
  // what has to be checked instead.
  if (purchase.store === 'apple') {
    // purchase.id is the StoreKit 2 transaction id react-native-iap
    // surfaces on iOS — exactly what the backend's Apple verify endpoint
    // (App Store Server API's get_transaction_info) expects. Apple's
    // single endpoint figures out subscription-vs-add-on itself, so `mode`
    // is irrelevant on this branch.
    return billingService.verifyAppleTransaction(purchase.id);
  }
  if (!purchase.purchaseToken) {
    throw new Error('Missing purchaseToken on Android purchase — cannot verify.');
  }
  return mode === 'subscription'
    ? billingService.verifyGoogleSubscription(purchase.productId, purchase.purchaseToken)
    : billingService.verifyGoogleAddon(purchase.productId, purchase.purchaseToken);
}

/**
 * Buys `sku` and, once the store reports success, verifies it against the
 * real backend (never trusts the client-side purchase event alone) before
 * finishing the transaction. Resolves with the backend's grant result;
 * rejects on a real failure. A user backing out of the native sheet
 * resolves with `{kind: 'cancelled'}` instead of rejecting — same as Stripe
 * PaymentSheet's 'Canceled' the caller already special-cases elsewhere in
 * this app.
 *
 * BUG FIX (product report, screenshot: tapping Subscribe then cancelling
 * the native App Store sheet showed an error alert whose own OK button
 * was frozen/unresponsive) — this used to reject with a generic Error
 * ("User cancelled the purchase flow"), which Subscription.tsx/AddOns.tsx
 * then immediately Alert.alert()'d on. Presenting a new alert that fast
 * after the native purchase sheet's own dismiss animation is still
 * finishing is a known iOS UIKit conflict (two view-controller
 * presentations racing) that can leave the alert's buttons unresponsive.
 * Resolving as a distinct, non-error `cancelled` kind lets both callers
 * just return quietly instead — a deliberate cancel was never really an
 * "error" worth alerting on anyway, matching the Stripe path's own
 * behavior right below in each of those files.
 *
 * Deliberately does NOT use the library's `autoFinishTransactions` default
 * — finishing before our own backend confirms the grant would mark the
 * purchase done with the store even if that grant call then failed,
 * leaving the user charged with nothing unlocked and no natural retry path
 * (re-requesting an already-finished non-consumable purchase is a
 * store-side no-op, not a fresh charge).
 */
export function purchase(sku: string, type: 'subs' | 'in-app'): Promise<IapVerifyResult> {
  return new Promise((resolve, reject) => {
    let updateSub: {remove: () => void} | undefined;
    let errorSub: {remove: () => void} | undefined;
    let settled = false;
    const cleanup = () => {
      updateSub?.remove();
      errorSub?.remove();
    };
    const settle = (fn: () => void) => {
      if (settled) return; // purchaseUpdatedListener can fire more than once per request on some devices/paths
      settled = true;
      cleanup();
      fn();
    };

    updateSub = RNIap.purchaseUpdatedListener(async (purchased: Purchase) => {
      if (purchased.productId !== sku) return; // a stray/unrelated event (e.g. a leftover pending transaction)
      try {
        const mode = type === 'subs' ? 'subscription' : 'product';
        const result = await verifyPurchaseServerSide(purchased, mode);
        if (result.kind === 'error') {
          settle(() => reject(new Error(result.error)));
          return;
        }
        await RNIap.finishTransaction({purchase: purchased, isConsumable: false});
        settle(() => resolve(result));
      } catch (err) {
        settle(() => reject(err));
      }
    });
    errorSub = RNIap.purchaseErrorListener((error: unknown) => {
      if (RNIap.isUserCancelledError(error)) {
        settle(() => resolve({kind: 'cancelled'}));
        return;
      }
      settle(() => reject(error));
    });

    ensureConnection()
      // BUG FIX (product report: buying a subscription always failed
      // instantly with a native "SKU not found" error, even with a valid
      // StoreKit Configuration file selected in the Xcode scheme and the
      // product ID matching exactly). Root cause: this function used to
      // call RNIap.requestPurchase(sku) directly, with no prior
      // RNIap.fetchProducts() call for that sku anywhere in the app.
      // react-native-iap's iOS layer caches each sku's product type
      // (subscription vs one-time) from whatever the last fetchProducts()
      // call told it — requestPurchase() reads that cache to decide which
      // StoreKit query to run, and with an empty cache it falls back to
      // treating every sku as a one-time in-app product. A subscription
      // sku queried that way is never found, hence "SKU not found" even
      // though the product genuinely exists in the active StoreKit
      // config/App Store Connect catalog. Fetching the product first (with
      // the correct `type`) both warms that cache with the right type AND
      // gives a much clearer error up front if the sku genuinely doesn't
      // exist anywhere (typo, wrong environment, catalog/config code
      // mismatch) instead of the vague native message.
      .then(() => RNIap.fetchProducts({skus: [sku], type}))
      .then(products => {
        if (!products?.length) {
          throw new Error(
            `No StoreKit product found for "${sku}" (type: ${type}). Check that this exact product ID exists in the active StoreKit Configuration (local testing) or has been created in App Store Connect (sandbox/production), and that the scheme's StoreKit Configuration is actually selected for this build.`,
          );
        }
        return RNIap.requestPurchase({
          request: {apple: {sku}, google: {skus: [sku]}},
          type,
        });
      })
      .catch(err => settle(() => reject(err)));
  });
}

export function purchaseSubscription(sku: string): Promise<IapVerifyResult> {
  return purchase(sku, 'subs');
}

export function purchaseAddon(sku: string): Promise<IapVerifyResult> {
  return purchase(sku, 'in-app');
}

/**
 * "Restore Purchases" — required by Apple (Guideline 3.1.2) for any app
 * selling non-consumable/subscription IAP, since a reinstall or new device
 * has no local record of a prior purchase. Re-verifies every restorable
 * purchase against the backend the same way a fresh purchase is (never
 * trusts the local restore list alone), so restoring ends up with exactly
 * the same server-side entitlements a fresh purchase would have granted.
 */
export async function restorePurchases(): Promise<{restoredCount: number; errors: unknown[]}> {
  await ensureConnection();
  const purchases = await RNIap.getAvailablePurchases();
  let restoredCount = 0;
  const errors: unknown[] = [];
  for (const p of purchases) {
    try {
      // react-native-iap doesn't tell us subscription-vs-one-time from a
      // restored purchase directly. On iOS this doesn't matter (Apple's
      // one verify endpoint self-detects). On Android, try the
      // subscription endpoint first (the more common IAP kind in this
      // app) and fall back to the product endpoint on an
      // unknown_product_id — the backend catalog lookup is the real
      // authority either way. (See the `store`-vs-`platform` note in
      // verifyPurchaseServerSide above — Purchase has no `platform` field
      // at runtime, so this has to key off `store` too.)
      let result = await verifyPurchaseServerSide(p, 'subscription');
      if (result.kind === 'error' && result.error === 'unknown_product_id' && p.store === 'google') {
        result = await verifyPurchaseServerSide(p, 'product');
      }
      if (result.kind === 'error') {
        errors.push(result.error);
      } else {
        restoredCount += 1;
      }
    } catch (err) {
      errors.push(err);
    }
  }
  return {restoredCount, errors};
}

/** Opens the OS's native subscription-management UI (App Store's "Manage
 * Subscriptions" / Play Store's subscription center) — the IAP-provider
 * counterpart to Subscription.tsx's Stripe Customer Portal, since neither
 * store lets a third party (this app's own backend) cancel or change an
 * Apple/Google-billed subscription directly. */
export function openNativeSubscriptionManagement(): Promise<void> {
  return RNIap.deepLinkToSubscriptions();
}
