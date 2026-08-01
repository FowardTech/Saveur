import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage} from 'constants/Types';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// referralService — double-sided $5 referral program.
//
// Deep link capture: saveur://referral?code=XXXXXXX is registered (see
// ios/caren_family/Info.plist, android AndroidManifest.xml — the "saveur"
// scheme already existed for Stripe's payment-sheet redirect, this reuses
// it). App.tsx listens for that URL (cold start + warm) and calls
// storePendingCode() below; authService.provisionProfile() then reads it
// back and sends it as `referred_by_code` on the next POST /users/me, which
// is the moment the backend actually records the referral
// (app/services/referral_service.py). The reward itself ($5 Stripe account
// credit to both sides) only fires once the referee subscribes to a paid
// plan — see the backend spec addendum §6.
// ---------------------------------------------------------------------------

export interface ReferralSummary {
  code: string;
  shareUrl: string;
  deepLink: string;
  rewardAmountCents: number;
  referredCount: number;
  pendingCount: number;
  rewardedCount: number;
  creditEarnedCents: number;
}

interface ReferralSummaryWire {
  code: string;
  share_url: string;
  deep_link: string;
  reward_amount_cents: number;
  referred_count: number;
  pending_count: number;
  rewarded_count: number;
  credit_earned_cents: number;
}

function fromWire(w: ReferralSummaryWire): ReferralSummary {
  return {
    code: w.code,
    shareUrl: w.share_url,
    deepLink: w.deep_link,
    rewardAmountCents: w.reward_amount_cents,
    referredCount: w.referred_count,
    pendingCount: w.pending_count,
    rewardedCount: w.rewarded_count,
    creditEarnedCents: w.credit_earned_cents,
  };
}

/** GET /api/v1/referrals/me — the current user's own referral code, share
 * link, and stats on who they've referred so far. */
export async function getMyReferral(): Promise<ReferralSummary> {
  const {data} = await apiClient.get<ReferralSummaryWire>('/api/v1/referrals/me');
  return fromWire(data);
}

/** POST /api/v1/referrals/redeem — manual fallback for attaching a code to
 * the current user when the deep link didn't fire (e.g. typed in by hand).
 * Returns false (rather than throwing) on an invalid/self/already-referred
 * code, since that's an expected, user-facing outcome, not an error. */
export async function redeemCode(code: string): Promise<boolean> {
  try {
    const {data} = await apiClient.post<{ok?: boolean}>('/api/v1/referrals/redeem', {code});
    return !!data.ok;
  } catch {
    return false;
  }
}

function extractCodeFromUrl(url: string): string | null {
  try {
    // Two shapes now reach this: saveur://referral?code=XXXXXXX (custom
    // scheme, query param) and, once Universal Links are live,
    // https://share.saveurnow.com/r/XXXXXXX (a real https path — see
    // app/web.py's referral_redirect() on the backend and
    // caren_family.entitlements' associated-domains entry; the regex below
    // is domain-agnostic, so old https://api.saveurnow.com/r/XXXXXXX links
    // shared before share.saveurnow.com existed still resolve fine too).
    // Custom scheme URLs don't always parse cleanly with the standard URL()
    // constructor across RN's JS engines, so this stays a plain regex
    // rather than relying on URL/URLSearchParams for either shape.
    const queryMatch = url.match(/[?&]code=([^&]+)/i);
    if (queryMatch) return decodeURIComponent(queryMatch[1]).trim().toUpperCase();
    const pathMatch = url.match(/\/r\/([^/?#]+)/i);
    return pathMatch ? decodeURIComponent(pathMatch[1]).trim().toUpperCase() : null;
  } catch {
    return null;
  }
}

/** Called from App.tsx's deep-link handler for any incoming URL — a no-op
 * for URLs that aren't a referral link (e.g. the existing
 * saveur://stripe-redirect used by the payment sheet). Checks for either
 * the word "referral" (custom scheme) OR the "/r/" path segment
 * (Universal Link) — a bare https://share.saveurnow.com/r/CODE URL doesn't
 * contain the word "referral" anywhere in it. */
export async function handleIncomingUrl(url: string | null | undefined): Promise<void> {
  if (!url || (!url.includes('referral') && !/\/r\/[^/?#]+/i.test(url))) return;
  const code = extractCodeFromUrl(url);
  if (code) {
    await AsyncStorage.setItem(EKeyAsyncStorage.pendingReferralCode, code);
  }
}

export async function getPendingCode(): Promise<string | null> {
  return AsyncStorage.getItem(EKeyAsyncStorage.pendingReferralCode);
}

export async function clearPendingCode(): Promise<void> {
  await AsyncStorage.removeItem(EKeyAsyncStorage.pendingReferralCode);
}
