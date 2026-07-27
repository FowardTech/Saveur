import i18n from 'i18next';
import apiClient from './apiClient';

function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// newsService — Daily Industry News (product request item, Pro Premium).
// GET /api/v1/news/today lazy-generates (and caches) a real, web-search-
// grounded digest for the current day the first time it's read — see
// app/api/news.py.
// ---------------------------------------------------------------------------

export interface NewsItem {
  headline: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
}

export interface DailyNews {
  day: string | null;
  items: NewsItem[];
  createdAt: string | null;
}

interface WireNewsItem {
  headline?: string;
  summary?: string;
  source_url?: string;
  source_name?: string;
}
interface WireDailyNews {
  day?: string | null;
  items?: WireNewsItem[];
  created_at?: string | null;
}

export async function getTodayNews(): Promise<DailyNews> {
  const { data } = await apiClient.get<WireDailyNews>('/api/v1/news/today', {
    params: { language: currentLanguage() },
  });
  return {
    day: data.day ?? null,
    items: (data.items ?? []).map(it => ({
      headline: it.headline ?? '',
      summary: it.summary ?? '',
      sourceUrl: it.source_url ?? '',
      sourceName: it.source_name ?? '',
    })),
    createdAt: data.created_at ?? null,
  };
}
