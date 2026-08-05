import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// dayActivityService — tap-a-calendar-day activity feed (product request
// item: "tapping any date/day should open a bottom sheet listing all
// career-related activities the user completed that day"). See
// Saveur-Backend's app/api/day_activity.py +
// app/services/day_activity_service.py.
// ---------------------------------------------------------------------------

export type DayActivityItemType =
  | 'mock_interview'
  | 'practical_scenario'
  | 'daily_challenge'
  | 'daily_checkin_goal'
  | 'daily_checkin_reflection'
  | 'career_diary'
  | 'learning_course'
  | 'job_application'
  | 'xp_earned';

export interface DayActivityItem {
  type: DayActivityItemType;
  title: string;
  subtitle: string | null;
  time: string | null;
}

interface DayActivityWire {
  day: string;
  items: {
    type: DayActivityItemType;
    title: string;
    subtitle: string | null;
    time: string | null;
  }[];
}

function toIsoDate(date: Date): string {
  // YYYY-MM-DD in LOCAL time (not toISOString, which converts to UTC first
  // and can roll the date backward/forward near midnight) — the user tapped
  // a specific day on their own local calendar strip, so that's the day
  // that should be sent, not whatever UTC happens to consider "today".
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getDayActivity(date: Date): Promise<DayActivityItem[]> {
  const {data} = await apiClient.get<DayActivityWire>('/api/v1/activity/day', {
    params: {date: toIsoDate(date)},
  });
  return data.items ?? [];
}
