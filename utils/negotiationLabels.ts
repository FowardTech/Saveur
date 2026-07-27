import {NegotiationApproachId} from 'services/salaryNegotiationService';

// salaryNegotiationService.APPROACHES' title/description text was hardcoded
// English, never run through t() — a real gap flagged during the app-wide
// locale sweep ("everything... must be translated to the preferred language
// of the user"). The 4 approach ids are always the same fixed set (the
// backend's /negotiation/scenario endpoint doesn't actually return its own
// approaches — see salaryNegotiationService.getScenario), so this is a
// straightforward id -> translation-key lookup, same pattern as
// utils/learningLabels.ts's getCourseLevelLabel.
type TFunc = (key: string, options?: Record<string, unknown>) => string;

const TITLE_KEYS: Record<NegotiationApproachId, string> = {
  counter_number: 'find:approach_counter_number_title',
  full_package: 'find:approach_full_package_title',
  enthusiasm_buy_time: 'find:approach_enthusiasm_buy_time_title',
  competing_offer: 'find:approach_competing_offer_title',
};
const TITLE_DEFAULTS: Record<NegotiationApproachId, string> = {
  counter_number: 'Counter with a specific number',
  full_package: 'Ask about the full package',
  enthusiasm_buy_time: 'Express enthusiasm and buy time',
  competing_offer: 'Mention a competing offer',
};
const DESCRIPTION_KEYS: Record<NegotiationApproachId, string> = {
  counter_number: 'find:approach_counter_number_description',
  full_package: 'find:approach_full_package_description',
  enthusiasm_buy_time: 'find:approach_enthusiasm_buy_time_description',
  competing_offer: 'find:approach_competing_offer_description',
};
const DESCRIPTION_DEFAULTS: Record<NegotiationApproachId, string> = {
  counter_number: 'State a clear target base salary backed by market data.',
  full_package: 'Push on bonus, signing bonus, and equity instead of just base.',
  enthusiasm_buy_time: 'Show genuine interest, then ask for a day or two to review.',
  competing_offer: 'Let them know you have another offer on the table.',
};

export function getApproachTitle(id: NegotiationApproachId, fallback: string, t: TFunc): string {
  if (!(id in TITLE_KEYS)) return fallback;
  return t(TITLE_KEYS[id], {defaultValue: TITLE_DEFAULTS[id]});
}

export function getApproachDescription(id: NegotiationApproachId, fallback: string, t: TFunc): string {
  if (!(id in DESCRIPTION_KEYS)) return fallback;
  return t(DESCRIPTION_KEYS[id], {defaultValue: DESCRIPTION_DEFAULTS[id]});
}
