import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// nextStepService — post-graduation "what's next" recommendation (product
// request: "after that [graduation] redirect them to the next step and
// build up a next step career plan recommendation or suggestion for
// them"). Generated once, automatically, server-side, the moment
// graduation is processed (see Saveur-Backend's
// app/services/next_step_service.py / student_service.process_graduations)
// — this service is read-only from the client's side.
// ---------------------------------------------------------------------------

export interface NextStepPlan {
  summary: string;
  suggestedRole: string | null;
  viewed: boolean;
}

interface WirePlan {
  source?: string;
  summary?: string;
  suggested_role?: string | null;
  viewed?: boolean;
}

function mapPlan(w: WirePlan): NextStepPlan {
  return {
    summary: w.summary ?? '',
    suggestedRole: w.suggested_role ?? null,
    viewed: !!w.viewed,
  };
}

export async function getPlan(): Promise<NextStepPlan | null> {
  try {
    const {data} = await apiClient.get<{plan: WirePlan | null}>('/api/v1/next-step');
    return data.plan ? mapPlan(data.plan) : null;
  } catch {
    return null;
  }
}

export async function markViewed(): Promise<void> {
  try {
    await apiClient.post('/api/v1/next-step/viewed');
  } catch {
    // best-effort
  }
}
