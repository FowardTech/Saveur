import i18n from 'i18next';
import apiClient from './apiClient';

function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// careerReportService — AI Weekly Career Report (product request item, Pro
// feature). GET /api/v1/career-report lazy-generates (and caches) a report
// for the current ISO week the first time it's read — see
// app/api/career_report.py.
// ---------------------------------------------------------------------------

export interface WeeklyReportStats {
  sessionsCompleted: number;
  practiceMinutes: number;
  applicationsSubmitted: number;
  avgInterviewScore: number | null;
  currentStreak: number;
  sessionTypes: string[];
}

export interface WeeklyReport {
  weekStart: string | null;
  stats: WeeklyReportStats;
  summary: string | null;
  highlights: string[];
  recommendations: string[];
  createdAt: string | null;
  noActivity: boolean;
}

interface WireStats {
  sessions_completed?: number;
  practice_minutes?: number;
  applications_submitted?: number;
  avg_interview_score?: number | null;
  current_streak?: number;
  session_types?: string[];
}

interface WireReport {
  week_start?: string | null;
  stats?: WireStats;
  summary?: string | null;
  highlights?: string[];
  recommendations?: string[];
  created_at?: string | null;
  no_activity?: boolean;
}

function mapReport(raw: WireReport): WeeklyReport {
  const s = raw.stats ?? {};
  return {
    weekStart: raw.week_start ?? null,
    stats: {
      sessionsCompleted: s.sessions_completed ?? 0,
      practiceMinutes: s.practice_minutes ?? 0,
      applicationsSubmitted: s.applications_submitted ?? 0,
      avgInterviewScore: s.avg_interview_score ?? null,
      currentStreak: s.current_streak ?? 0,
      sessionTypes: s.session_types ?? [],
    },
    summary: raw.summary ?? null,
    highlights: raw.highlights ?? [],
    recommendations: raw.recommendations ?? [],
    createdAt: raw.created_at ?? null,
    noActivity: !!raw.no_activity,
  };
}

/** Throws on failure (network/provider error, or non-Pro 402) so the screen
 * can distinguish "not Pro" from "generation failed". */
export async function getWeeklyReport(): Promise<WeeklyReport> {
  const { data } = await apiClient.get<WireReport>('/api/v1/career-report', {
    params: { language: currentLanguage() },
  });
  return mapReport(data);
}
