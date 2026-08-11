import i18n from 'i18next';
import apiClient from './apiClient';

function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// whatsNextService — "What's Next" post-offer guided journey (product
// request, Pro Premium). One AI call plans negotiation talking points, a
// pre-start checklist, and a 90-day success plan together for a specific
// job offer -- explicit product-owner scope decision: "both, as a single
// guided journey", not three separate features. See
// app/api/post_offer.py's module docstring; this mirrors roadmapService.ts's
// shape closely on purpose (same first-write-wins generation, same
// ordered-steps-with-status pattern for the 90-day plan).
// ---------------------------------------------------------------------------

export interface NegotiationPoint {
  title: string;
  script: string;
}

export type ChecklistItemStatus = 'pending' | 'done';
export interface ChecklistItem {
  id: number;
  title: string;
  description: string;
  status: ChecklistItemStatus;
}

export type PlanStepStatus = 'completed' | 'current' | 'locked';
export interface PlanStep {
  order: number;
  phase: string;
  title: string;
  description: string;
  status: PlanStepStatus;
}

export interface PostOfferPlan {
  company: string;
  role: string;
  currentOffer: string | null;
  targetAsk: string | null;
  startDate: string | null;
  negotiationPoints: NegotiationPoint[];
  checklist: ChecklistItem[];
  checklistDoneCount: number;
  checklistTotalCount: number;
  ninetyDayPlan: PlanStep[];
  planCompletedCount: number;
  planTotalCount: number;
  planIsComplete: boolean;
  createdAt: string | null;
}

interface WireNegotiationPoint {
  title?: string;
  script?: string;
}
interface WireChecklistItem {
  id?: number;
  title?: string;
  description?: string;
  status?: string;
}
interface WirePlanStep {
  order?: number;
  phase?: string;
  title?: string;
  description?: string;
  status?: string;
}
interface WirePlan {
  company?: string;
  role?: string;
  current_offer?: string | null;
  target_ask?: string | null;
  start_date?: string | null;
  negotiation_points?: WireNegotiationPoint[];
  checklist?: WireChecklistItem[];
  checklist_done_count?: number;
  checklist_total_count?: number;
  ninety_day_plan?: WirePlanStep[];
  plan_completed_count?: number;
  plan_total_count?: number;
  plan_is_complete?: boolean;
  created_at?: string | null;
}

function mapPlan(raw: WirePlan): PostOfferPlan {
  return {
    company: raw.company ?? '',
    role: raw.role ?? '',
    currentOffer: raw.current_offer ?? null,
    targetAsk: raw.target_ask ?? null,
    startDate: raw.start_date ?? null,
    negotiationPoints: (raw.negotiation_points ?? []).map(p => ({
      title: p.title ?? '',
      script: p.script ?? '',
    })),
    checklist: (raw.checklist ?? []).map((c, i) => ({
      id: c.id ?? i + 1,
      title: c.title ?? '',
      description: c.description ?? '',
      status: (c.status as ChecklistItemStatus) || 'pending',
    })),
    checklistDoneCount: raw.checklist_done_count ?? 0,
    checklistTotalCount: raw.checklist_total_count ?? (raw.checklist?.length ?? 0),
    ninetyDayPlan: (raw.ninety_day_plan ?? []).map((s, i) => ({
      order: s.order ?? i + 1,
      phase: s.phase ?? '',
      title: s.title ?? '',
      description: s.description ?? '',
      status: (s.status as PlanStepStatus) || (i === 0 ? 'current' : 'locked'),
    })),
    planCompletedCount: raw.plan_completed_count ?? 0,
    planTotalCount: raw.plan_total_count ?? (raw.ninety_day_plan?.length ?? 0),
    planIsComplete: raw.plan_is_complete ?? false,
    createdAt: raw.created_at ?? null,
  };
}

/** GET /api/v1/whats-next — the caller's already-saved plan, if any. */
export async function getSavedPlan(): Promise<PostOfferPlan | null> {
  try {
    const {data} = await apiClient.get<{plan: WirePlan | null}>('/api/v1/whats-next');
    return data.plan ? mapPlan(data.plan) : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/v1/whats-next/generate — generates (or, if one already exists,
 * simply returns) a post-offer plan for this company/role. First-write-wins
 * server-side. Throws on failure so the screen can show a real error.
 */
export async function generatePlan(params: {
  company: string;
  role: string;
  currentOffer?: string;
  targetAsk?: string;
  startDate?: string; // YYYY-MM-DD
}): Promise<PostOfferPlan> {
  const {data} = await apiClient.post<WirePlan>('/api/v1/whats-next/generate', {
    company: params.company,
    role: params.role,
    current_offer: params.currentOffer || '',
    target_ask: params.targetAsk || '',
    start_date: params.startDate || '',
    language: currentLanguage(),
  });
  return mapPlan(data);
}

/** POST /api/v1/whats-next/checklist/:id/toggle — flips one checklist item
 * between pending/done. Unlike the 90-day plan, checklist items aren't
 * sequential, so any item can be toggled any time. */
export async function toggleChecklistItem(id: number): Promise<PostOfferPlan> {
  const {data} = await apiClient.post<WirePlan>(`/api/v1/whats-next/checklist/${id}/toggle`);
  return mapPlan(data);
}

/** POST /api/v1/whats-next/plan-steps/:order/complete — marks the given
 * 90-day-plan phase done. The backend rejects this unless `order` is
 * exactly the current phase, same rule as roadmapService.completeStep. */
export async function completePlanStep(order: number): Promise<PostOfferPlan> {
  const {data} = await apiClient.post<WirePlan>(`/api/v1/whats-next/plan-steps/${order}/complete`);
  return mapPlan(data);
}

/** DELETE /api/v1/whats-next — clears the saved plan so a user can build a
 * fresh one for a different offer. */
export async function resetPlan(): Promise<void> {
  try {
    await apiClient.delete('/api/v1/whats-next');
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Weekly "how's it going?" check-in (product request: "always check up on
// the user regularly to know how they are doing at the new role until the
// first 90 days are over"). See Saveur-Backend's
// app/services/post_offer_checkin_service.py.
// ---------------------------------------------------------------------------

export interface PostOfferCheckIn {
  id: number;
  weekNumber: number;
  responseText: string | null;
  responded: boolean;
}

interface WireCheckIn {
  id?: number;
  week_number?: number;
  response_text?: string | null;
  responded?: boolean;
}

function mapCheckIn(w: WireCheckIn): PostOfferCheckIn {
  return {
    id: w.id ?? 0,
    weekNumber: w.week_number ?? 0,
    responseText: w.response_text ?? null,
    responded: !!w.responded,
  };
}

/** GET /api/v1/whats-next/checkin — the caller's most recent sent-but-
 * unanswered weekly check-in, if any. Null most of the time (these only go
 * out once a week). */
export async function getPendingCheckIn(): Promise<PostOfferCheckIn | null> {
  try {
    const {data} = await apiClient.get<{checkin: WireCheckIn | null}>('/api/v1/whats-next/checkin');
    return data.checkin ? mapCheckIn(data.checkin) : null;
  } catch {
    return null;
  }
}

export async function submitCheckIn(id: number, text: string): Promise<PostOfferCheckIn> {
  const {data} = await apiClient.post<{checkin: WireCheckIn}>(`/api/v1/whats-next/checkin/${id}/respond`, {text});
  return mapCheckIn(data.checkin);
}
