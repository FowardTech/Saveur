import i18n from 'i18next';
import apiClient from './apiClient';

// Career Growth (post-hire retention): Saveur-Backend app/api/growth.py.
export interface PayRecord {
  id: number;
  effective_date: string;
  company?: string | null;
  role?: string | null;
  kind: string;
  currency: string;
  base_salary: number;
  bonus?: number | null;
}
export interface PaySummary {
  count: number;
  current_base?: number;
  currency?: string;
  total_growth_pct?: number;
  annualized_growth_pct?: number;
  months_since_last_change?: number;
}
export interface PromotionPlan {
  goal: string;
  payload: {
    readiness?: {score?: number; summary?: string};
    evidence?: string[];
    talking_points?: {title: string; script: string}[];
    timeline?: {when: string; action: string}[];
    risks?: string[];
  };
}

const lang = () => i18n.language || 'en';

export async function listPay() {
  const {data} = await apiClient.get<{records: PayRecord[]; summary: PaySummary}>('/api/v1/growth/pay');
  return data;
}
export async function addPay(body: Record<string, unknown>) {
  const {data} = await apiClient.post<{record: PayRecord; summary: PaySummary}>('/api/v1/growth/pay', body);
  return data;
}
export async function deletePay(id: number) {
  await apiClient.delete(`/api/v1/growth/pay/${id}`);
}
export async function getPromotionPlan() {
  const {data} = await apiClient.get<{plan: PromotionPlan | null}>('/api/v1/growth/promotion-plan');
  return data.plan;
}
export async function makePromotionPlan(body: Record<string, unknown>) {
  const {data} = await apiClient.post<{plan: PromotionPlan}>('/api/v1/growth/promotion-plan', {...body, language: lang()});
  return data.plan;
}
export async function getPendingCheckin() {
  const {data} = await apiClient.get<{checkin: {id: number} | null}>('/api/v1/growth/checkin');
  return data.checkin;
}
export async function respondCheckin(id: number, text: string) {
  await apiClient.post(`/api/v1/growth/checkin/${id}/respond`, {text});
}
