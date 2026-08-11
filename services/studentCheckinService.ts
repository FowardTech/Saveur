import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// studentCheckinService — weekly "how's this term going?" check-in for
// verified students (product request: "For students I want the App to
// always check up on them too regularly until their graduation date"). See
// Saveur-Backend's app/services/student_checkin_service.py. Distinct from
// studentVerificationService.ts (that's the one-time verification flow;
// this is the recurring check-in once a student is active).
// ---------------------------------------------------------------------------

export interface StudentCheckIn {
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

function mapCheckIn(w: WireCheckIn): StudentCheckIn {
  return {
    id: w.id ?? 0,
    weekNumber: w.week_number ?? 0,
    responseText: w.response_text ?? null,
    responded: !!w.responded,
  };
}

/** GET /api/v1/student/checkin — the caller's most recent sent-but-
 * unanswered weekly check-in, if any. Null for anyone who isn't a currently
 * active verified student, or most weeks (these only go out once a week). */
export async function getPendingCheckIn(): Promise<StudentCheckIn | null> {
  try {
    const {data} = await apiClient.get<{checkin: WireCheckIn | null}>('/api/v1/student/checkin');
    return data.checkin ? mapCheckIn(data.checkin) : null;
  } catch {
    return null;
  }
}

export async function submitCheckIn(id: number, text: string): Promise<StudentCheckIn> {
  const {data} = await apiClient.post<{checkin: WireCheckIn}>(`/api/v1/student/checkin/${id}/respond`, {text});
  return mapCheckIn(data.checkin);
}
