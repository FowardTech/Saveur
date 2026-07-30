import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// moreMenuBadgesService — backs the More menu's unread badges (product
// request item: "I want the job alert, daily industry news and Weekly
// reports count badge so that users can know when new updates arrive").
//
// One GET /api/v1/more/badges call (see Saveur-Backend's
// app/api/more_badges.py) rather than three separate ones — the More screen
// fetches this once on mount/focus and fans the result out to each row.
// ---------------------------------------------------------------------------

export interface MoreMenuBadges {
  jobAlertsUnreadCount: number;
  dailyIndustryNewsUnread: boolean;
  weeklyCareerReportUnread: boolean;
}

interface MoreMenuBadgesWire {
  job_alerts_unread_count?: number;
  daily_industry_news_unread?: boolean;
  weekly_career_report_unread?: boolean;
}

const EMPTY_BADGES: MoreMenuBadges = {
  jobAlertsUnreadCount: 0,
  dailyIndustryNewsUnread: false,
  weeklyCareerReportUnread: false,
};

export async function getMoreMenuBadges(): Promise<MoreMenuBadges> {
  try {
    const {data} = await apiClient.get<MoreMenuBadgesWire>('/api/v1/more/badges');
    return {
      jobAlertsUnreadCount: Number(data?.job_alerts_unread_count) || 0,
      dailyIndustryNewsUnread: Boolean(data?.daily_industry_news_unread),
      weeklyCareerReportUnread: Boolean(data?.weekly_career_report_unread),
    };
  } catch (err) {
    // Badges are a "nice to have" indicator, not core functionality — a
    // failed fetch (offline, a free-tier user who's never hit a premium
    // gate, etc.) should just show no badges rather than break the More
    // screen or surface an error the user can't act on.
    console.warn('[moreMenuBadgesService] getMoreMenuBadges failed', err);
    return EMPTY_BADGES;
  }
}
