import i18n from 'i18next';
import apiClient from './apiClient';

export interface SalaryBenchmark {
  title: string;
  location: string;
  years_experience: number | null;
  currency: string;
  percentiles: {p10: number; p25: number; p50: number; p75: number; p90: number};
  confidence: 'low' | 'medium' | 'high';
  factors: {name: string; effect: 'raises' | 'lowers'; detail: string}[];
  negotiation_tip: string;
  caveat: string;
  your_salary?: number;
  kind?: 'offer' | 'current';
  position?: 'below_market' | 'at_market' | 'above_market';
  gap_pct?: number | null;
  suggested_ask?: number | null;
}

export async function getSalaryBenchmark(body: {
  title: string;
  location: string;
  years_experience?: number;
  currency?: string;
  your_salary?: number;
  kind?: 'offer' | 'current';
}): Promise<SalaryBenchmark> {
  const {data} = await apiClient.post<SalaryBenchmark>('/api/v1/salary/benchmark', {
    ...body,
    language: i18n.language || 'en',
  });
  return data;
}
