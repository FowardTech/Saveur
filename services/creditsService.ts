import React from 'react';
import i18n from 'i18next';
import {Alert, Platform} from 'react-native';
import apiClient from './apiClient';
import * as iapService from './iapService';
import * as store from './creditsStore';

// ---------------------------------------------------------------------------
// AI usage credits (see Saveur-Backend's app/services/credits_service.py).
// Every AI action costs credits; each plan refills a monthly allowance
// (no rollover) and purchased top-ups never expire. This module holds the
// balance in a tiny module-level store (no extra state library), exposes a
// useCredits() hook, keeps itself fresh after any write request, and buys
// top-up packs through Apple/Google in-app purchase (consumables).
// ---------------------------------------------------------------------------

export interface CreditPack {
  code: string;
  name: string;
  credits: number;
  amount: number; // cents
  currency: string;
}

export interface CreditsOverview {
  enabled: boolean;
  monthly: number;
  topup: number;
  total: number;
  allowance: number;
  tier: 'free' | 'pro' | 'premium';
  resets_at: string;
  costs: Record<string, number>;
  packs: CreditPack[];
}

export interface CreditTransaction {
  id: number;
  delta: number;
  kind: 'monthly_grant' | 'spend' | 'refund' | 'topup' | 'admin';
  action: string | null;
  balance_after: number;
  note: string | null;
  created_at: string;
}

export async function refreshCredits(): Promise<CreditsOverview | null> {
  try {
    const {data} = await apiClient.get<CreditsOverview>('/api/v1/credits');
    store.setCurrent(data);
  } catch {
    // keep the last known balance
  }
  return store.getCurrent<CreditsOverview>();
}
store.setRefresher(() => {
  refreshCredits();
});

export function clearCredits() {
  store.setCurrent(null);
}

export async function getHistory(limit = 50): Promise<CreditTransaction[]> {
  const {data} = await apiClient.get<CreditTransaction[]>('/api/v1/credits/history', {params: {limit}});
  return data ?? [];
}

/** React hook: current overview (null until the first fetch). */
export function useCredits() {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    const unsub = store.subscribe(force);
    if (!store.getCurrent()) refreshCredits();
    return unsub;
  }, []);
  const credits = store.getCurrent<CreditsOverview>();
  return {
    credits,
    refresh: refreshCredits,
    costOf: (action: string) => (credits?.enabled ? credits.costs?.[action] ?? 0 : 0),
  };
}

export const setInsufficientCreditsHandler = store.setInsufficientCreditsHandler;
export type InsufficientPayload = store.InsufficientPayload;

// ---- top-up purchase (consumable in-app purchase) ----

export type PackPurchaseResult = {kind: 'credits'; creditsGranted: number} | {kind: 'cancelled'};

export async function purchasePack(pack: CreditPack): Promise<PackPurchaseResult> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error(String(i18n.t('common:credit_topups_mobile_only', {defaultValue: 'Credit top-ups are available in the iOS and Android apps.'})));
  }
  const result = await iapService.purchaseCreditPack(pack.code);
  if (result.kind === 'cancelled') return {kind: 'cancelled'};
  if (result.kind === 'error') throw new Error(result.error);
  if (result.kind !== 'credits') throw new Error('Unexpected purchase result for a credit pack.');
  await refreshCredits();
  return {kind: 'credits', creditsGranted: result.creditsGranted};
}

/** Prompt used by AppContainer's handler. */
export function showOutOfCreditsAlert(
  p: store.InsufficientPayload,
  t: (k: string, o?: Record<string, unknown>) => string,
  goBuy: () => void,
) {
  Alert.alert(
    t('common:credits_out_title', {defaultValue: "You're out of credits"}),
    p.required != null
      ? t('common:credits_out_body', {
          defaultValue: 'This needs {{required}} credits and you have {{available}}. Buy more credits, or wait for your monthly reset.',
          required: p.required,
          available: p.available ?? 0,
        })
      : p.message ?? '',
    [
      {text: t('common:credits_not_now', {defaultValue: 'Not now'}), style: 'cancel'},
      {text: t('common:credits_buy_credits', {defaultValue: 'Buy credits'}), onPress: goBuy},
    ],
  );
}
