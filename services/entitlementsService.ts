import dayjs from 'utils/dayjs';
import {SubscriptionStatusProps} from 'constants/Types';
import * as interviewService from './interviewService';
import * as billingService from './billingService';

// ---------------------------------------------------------------------------
// entitlementsService — single source of truth for "what does this user's
// plan let them do." Currently one rule, per the agreed gating model:
// Free tier is capped at FREE_SESSIONS_PER_MONTH practice sessions per
// calendar month (any mode/type — the cap doesn't distinguish between
// voice/video/text/coding); Pro (`premium`/`premium_plus`) is unlimited.
// Extend this file (not ad-hoc checks in screens) if/when other features
// need plan-gating later.
//
// Ideally the backend is the source of truth for usage (it owns the actual
// billing-period boundary, which doesn't necessarily match the calendar
// month) — GET /api/v1/billing/subscription can optionally include
// `sessions_used`/`sessions_limit` (see services/billingService.ts). When
// the backend doesn't send those yet, this falls back to counting the
// current calendar month's sessions from local practice history against
// the hardcoded FREE_SESSIONS_PER_MONTH cap below, so gating still works
// before that backend field exists.
// ---------------------------------------------------------------------------

export const FREE_SESSIONS_PER_MONTH = 5;

/**
 * A subscription counts as "Pro" only while it's actually active/trialing —
 * `past_due`/`canceled`/`incomplete` on a paid tier still falls back to
 * free-tier limits, since the payment isn't currently in good standing.
 */
export function isProTier(status: SubscriptionStatusProps | null | undefined): boolean {
  if (!status) return false;
  return status.tier !== 'free' && (status.status === 'active' || status.status === 'trialing');
}

/**
 * A stricter check than isProTier — true only for "Pro Premium" (was
 * "Team") or "Pro (Yearly)", the two plans whose backend plan_tier is
 * "premium" (see saveur-backend/app/services/entitlements_service.py's
 * module docstring). Plain monthly Pro (tier "pro") is active/paid but
 * does NOT pass this check. Use this — not isProTier — to gate Job Alerts
 * and Learning Courses specifically; use isProTier for everything else
 * that only needs SOME paid plan.
 */
export function isPremiumTier(status: SubscriptionStatusProps | null | undefined): boolean {
  if (!status) return false;
  return status.tier === 'premium' && (status.status === 'active' || status.status === 'trialing');
}

export interface SessionEntitlement {
  isPro: boolean;
  sessionsUsed: number;
  sessionsLimit: number | null; // null = unlimited
  remaining: number | null; // null = unlimited
  canStart: boolean;
}

/**
 * Resolves whether the current user can start another practice session.
 * Pro is always unlimited. Free tier prefers the backend-reported
 * sessions_used/sessions_limit (see comment above); if the backend hasn't
 * sent those yet, it counts this calendar month's sessions from
 * interviewService.getPracticeHistory() (already cached/offline-fallback,
 * see interviewService.ts) against FREE_SESSIONS_PER_MONTH.
 */
export async function getSessionEntitlement(
  status: SubscriptionStatusProps | null | undefined,
): Promise<SessionEntitlement> {
  const pro = isProTier(status);
  if (pro) {
    return {
      isPro: true,
      sessionsUsed: status?.sessionsUsed ?? 0,
      sessionsLimit: null,
      remaining: null,
      canStart: true,
    };
  }

  const backendLimit = status?.sessionsLimit;
  let used = status?.sessionsUsed;
  const limit = backendLimit === null ? null : backendLimit ?? FREE_SESSIONS_PER_MONTH;

  if (limit !== null && used == null) {
    try {
      const history = await interviewService.getPracticeHistory();
      const now = dayjs();
      used = history.filter(session => dayjs(session.date).isSame(now, 'month')).length;
    } catch {
      // Offline / request failed and there's no cache either — don't block
      // the user from starting a session just because we couldn't count
      // their usage; err on the side of letting them through.
      used = 0;
    }
  }
  used = used ?? 0;

  const remaining = limit === null ? null : Math.max(0, limit - used);
  return {
    isPro: false,
    sessionsUsed: used,
    sessionsLimit: limit,
    remaining,
    canStart: remaining === null || remaining > 0,
  };
}

// ---------------------------------------------------------------------------
// Paid Add-ons (Coding Practice) — "for the coding practice ... I want them
// to be in a separate screen called add-ons and they should be paid for."
// Independent of subscription tier entirely (a free-tier user can buy just
// the add-on without touching Basic/Premium, and a Basic/Premium
// subscriber still has to buy it separately) — see saveur-backend/app/
// services/entitlements_service.py's "Paid Add-ons" section for the
// mirrored backend-side check. The AI coach (services/suggestedActions.ts)
// also reads this before auto-navigating someone into this screen.
//
// System Design used to be a second add-on here (systemDesignWhiteboard)
// but is no longer gated at all (product decision, once the freehand
// drawing canvas that used to justify charging for it was removed for
// being unreliable — see SystemDesignWhiteboard.tsx's header comment):
// "let it just be a regular tool like the resume builder since there is no
// more hands on drawing." It's now a plain interview type, same as
// behavioral/technical/consulting/etc. — no purchase required.
// ---------------------------------------------------------------------------

export const ADDON_CODES = {
  codingPractice: 'coding_practice',
  // PRODUCT DECISION: Practical Scenarios moved off the shared free-session
  // monthly cap (see getSessionEntitlement above) onto its own one-time
  // paid add-on, same treatment as Coding Practice — see
  // PracticalScenarioSetup.tsx's onStart and Saveur-Backend's
  // app/api/practical.py create_session() for the matching backend gate.
  practicalScenario: 'practical_scenario',
} as const;

export type AddonCode = (typeof ADDON_CODES)[keyof typeof ADDON_CODES];

/**
 * Whether the current user has purchased a given add-on. Fails CLOSED (not
 * open) on a network error — unlike getSessionEntitlement's free-session
 * fallback above, this gates a feature that costs real money, so a failed
 * lookup should never be treated as "unlocked."
 */
export async function hasAddon(addonCode: string): Promise<boolean> {
  try {
    const addons = await billingService.listAddons();
    return addons.some(addon => addon.code === addonCode && addon.unlocked);
  } catch {
    return false;
  }
}

/**
 * Maps an Interview_Type_Enum value (only Coding, now) to the add-on code
 * that gates it, or `null` for every other type (not gated by an add-on at
 * all — includes System Design, see ADDON_CODES's own comment above for
 * why). Kept here as the single mapping every gating call site
 * (FindScreen.tsx, MockInterviewSetup.tsx, suggestedActions.ts) shares, so
 * the two never drift apart.
 */
export function addonCodeForInterviewType(interviewType: string): AddonCode | null {
  if (interviewType === 'Coding') return ADDON_CODES.codingPractice;
  return null;
}
