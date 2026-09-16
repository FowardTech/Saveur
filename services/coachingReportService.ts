import i18n from 'i18next';
import apiClient from './apiClient';

function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// coachingReportService — mobile port of Saveur-Web's coachingReportService
// (task #44, itself built for task #21 "Dashboard coaching report
// (Yoodli-style)" on web only). Real backend, unchanged between platforms:
// GET /api/v1/coaching-report -> {empty, completed_count, min_required,
//   performing_well: [str], key_insights: [str], areas_to_improve: [str],
//   whats_next: [str]} (see Saveur-Backend/app/api/coaching_report.py +
// app/services/coaching_report_service.py). Built entirely from the user's
// own real InterviewFeedback history -- `empty: true` is a REAL state (fewer
// than `minRequired` graded sessions so far), never papered over with
// fabricated content.
// ---------------------------------------------------------------------------

export interface CoachingReport {
  empty: boolean;
  completedCount: number;
  minRequired: number;
  performingWell: string[];
  keyInsights: string[];
  areasToImprove: string[];
  whatsNext: string[];
}

interface WireCoachingReport {
  empty?: boolean;
  completed_count?: number;
  min_required?: number;
  performing_well?: string[];
  key_insights?: string[];
  areas_to_improve?: string[];
  whats_next?: string[];
}

const EMPTY_FALLBACK: CoachingReport = {
  empty: true,
  completedCount: 0,
  minRequired: 2,
  performingWell: [],
  keyInsights: [],
  areasToImprove: [],
  whatsNext: [],
};

export async function getCoachingReport(): Promise<CoachingReport | null> {
  try {
    const { data } = await apiClient.get<WireCoachingReport>('/api/v1/coaching-report', {
      params: { language: currentLanguage() },
    });
    return {
      empty: data.empty ?? true,
      completedCount: data.completed_count ?? 0,
      minRequired: data.min_required ?? EMPTY_FALLBACK.minRequired,
      performingWell: data.performing_well ?? [],
      keyInsights: data.key_insights ?? [],
      areasToImprove: data.areas_to_improve ?? [],
      whatsNext: data.whats_next ?? [],
    };
  } catch {
    // Self-contained, like the web card -- a fetch failure means the
    // caller renders nothing rather than a broken dashboard module (`null`,
    // not EMPTY_FALLBACK, so the caller can tell "failed" apart from a
    // genuine empty state).
    return null;
  }
}
