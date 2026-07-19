import AsyncStorage from '@react-native-async-storage/async-storage';
import {EKeyAsyncStorage} from 'constants/Types';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// salaryNegotiationService — partial real backend implementation.
//
// Backs src/practice/SalaryNegotiation.tsx: a scenario-based negotiation
// simulator. Per this task's endpoint contract, only the "recruiter-style
// pushback simulator" round itself is a real backend call —
// POST /api/v1/coach/negotiation, `{offer, ask, context}` (see submitRound
// below). Scenario generation and session finalization/history have no
// corresponding endpoint in this pass, so `getScenario`, `finalizeNegotiation`,
// and `getNegotiationHistory` stay local/mocked exactly as before.
//
// Wire-shape / design-decision note: the given contract's request shape
// (`{offer, ask, context}`) doesn't map 1:1 onto this screen's UI, which
// lets the user pick one of four canned *approaches* per round rather than
// typing a free-text ask. `ask` is filled in from the chosen approach's
// `description` (a plain-English statement of what that approach says to
// the recruiter — e.g. "Push on bonus, signing bonus, and equity instead of
// just base."), and `context` carries the round number/total rounds/approach
// id/prior-round log so the backend can generate a response that's aware of
// where in the negotiation the user is. The response shape isn't pinned down
// either, so the reader below checks a few plausible key spellings and falls
// back to keeping the offer unchanged if a bump isn't present, mirroring the
// defensive-mapping pattern used in feedbackService.ts/coachService.ts.
// ---------------------------------------------------------------------------

export interface SalaryOffer {
  company: string;
  title: string;
  baseSalary: number;
  bonus: number;
  signingBonus: number;
  equity: string;
}
export type NegotiationApproachId =
  | 'counter_number'
  | 'full_package'
  | 'enthusiasm_buy_time'
  | 'competing_offer';
export interface NegotiationApproach {
  id: NegotiationApproachId;
  title: string;
  description: string;
}
export interface NegotiationRoundResult {
  recruiterResponse: string;
  updatedOffer: SalaryOffer;
  isFinalRound: boolean;
}
export interface NegotiationHistoryEntry {
  id: string;
  date: number;
  company: string;
  title: string;
  initialBase: number;
  finalBase: number;
  increasePct: number;
}

const FAKE_LATENCY_MS = 700;
const delay = (ms: number = FAKE_LATENCY_MS) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

export const TOTAL_ROUNDS = 3;

export const APPROACHES: NegotiationApproach[] = [
  {
    id: 'counter_number',
    title: 'Counter with a specific number',
    description: 'State a clear target base salary backed by market data.',
  },
  {
    id: 'full_package',
    title: 'Ask about the full package',
    description: 'Push on bonus, signing bonus, and equity instead of just base.',
  },
  {
    id: 'enthusiasm_buy_time',
    title: 'Express enthusiasm and buy time',
    description: 'Show genuine interest, then ask for a day or two to review.',
  },
  {
    id: 'competing_offer',
    title: 'Mention a competing offer',
    description: 'Let them know you have another offer on the table.',
  },
];

const SCENARIO_POOL: SalaryOffer[] = [
  {company: 'Nimbus Analytics', title: 'Senior Product Manager', baseSalary: 145000, bonus: 10000, signingBonus: 5000, equity: '$60,000 over 4 years'},
  {company: 'Solace Robotics', title: 'Software Engineer II', baseSalary: 132000, bonus: 8000, signingBonus: 3000, equity: '$45,000 over 4 years'},
  {company: 'Brightpath Health', title: 'Customer Success Lead', baseSalary: 98000, bonus: 6000, signingBonus: 2000, equity: 'None'},
  {company: 'Lark & Co Consulting', title: 'Associate Consultant', baseSalary: 110000, bonus: 12000, signingBonus: 4000, equity: 'None'},
];

/**
 * Generate a fresh mock job-offer scenario to negotiate against. No scenario-
 * generation endpoint is part of this pass's contract, so this stays a local
 * random pick from a static pool — only `submitRound` below is a real call.
 *
 * BACKEND TODO: GET /negotiation/scenario — a real implementation might
 *   generate this from the user's actual tracked applications/offers
 *   (see applicationsService.ts) instead of a random mock pool.
 */
export async function getScenario(): Promise<{offer: SalaryOffer; approaches: NegotiationApproach[]; totalRounds: number}> {
  await delay(500);
  const offer = SCENARIO_POOL[Math.floor(Math.random() * SCENARIO_POOL.length)];
  return {offer: {...offer}, approaches: APPROACHES, totalRounds: TOTAL_ROUNDS};
}

// ---- POST /api/v1/coach/negotiation wire shapes ----
interface SalaryOfferWire {
  company: string;
  title: string;
  base_salary: number;
  bonus: number;
  signing_bonus: number;
  equity: string;
}
function toOfferWire(offer: SalaryOffer): SalaryOfferWire {
  return {
    company: offer.company,
    title: offer.title,
    base_salary: offer.baseSalary,
    bonus: offer.bonus,
    signing_bonus: offer.signingBonus,
    equity: offer.equity,
  };
}
function fromOfferWire(wire: SalaryOfferWire | undefined, fallback: SalaryOffer): SalaryOffer {
  if (!wire) return fallback;
  return {
    company: wire.company ?? fallback.company,
    title: wire.title ?? fallback.title,
    baseSalary: wire.base_salary ?? fallback.baseSalary,
    bonus: wire.bonus ?? fallback.bonus,
    signingBonus: wire.signing_bonus ?? fallback.signingBonus,
    equity: wire.equity ?? fallback.equity,
  };
}
interface NegotiationResponseWire {
  response?: string;
  message?: string;
  recruiter_response?: string;
  recruiterResponse?: string;
  updated_offer?: SalaryOfferWire;
  updatedOffer?: SalaryOfferWire;
  counter_offer?: SalaryOfferWire;
  is_final_round?: boolean;
  isFinalRound?: boolean;
}

/**
 * POST /api/v1/coach/negotiation — recruiter-style pushback simulator for
 * the round the user just played.
 *
 * Design decision: the given request contract is `{offer, ask, context}`,
 * not the round/approachId/currentOffer shape this screen used to send to
 * the (now-removed) mock `/negotiation/rounds` endpoint — see the file-level
 * comment for how those map: `ask` is the chosen approach's description,
 * `context` carries round/approach bookkeeping so the backend can generate a
 * response aware of where the negotiation stands.
 */
export async function submitRound(
  round: number,
  approach: NegotiationApproach,
  currentOffer: SalaryOffer,
  totalRounds: number = TOTAL_ROUNDS,
): Promise<NegotiationRoundResult> {
  const {data} = await apiClient.post<NegotiationResponseWire>('/api/v1/coach/negotiation', {
    offer: toOfferWire(currentOffer),
    ask: approach.description,
    context: {
      round,
      totalRounds,
      approachId: approach.id,
      approachTitle: approach.title,
    },
  });

  const recruiterResponse =
    data.recruiter_response ?? data.recruiterResponse ?? data.response ?? data.message ?? '';
  const updatedOffer = fromOfferWire(data.updated_offer ?? data.updatedOffer ?? data.counter_offer, currentOffer);
  const isFinalRound = data.is_final_round ?? data.isFinalRound ?? round >= totalRounds;

  return {recruiterResponse, updatedOffer, isFinalRound};
}

const readHistory = async (): Promise<NegotiationHistoryEntry[]> => {
  const raw = await AsyncStorage.getItem(EKeyAsyncStorage.negotiationHistory);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as NegotiationHistoryEntry[];
  } catch {
    return [];
  }
};

/**
 * Wrap up a negotiation session: persist a summary entry and return
 * human-readable copy for the results screen.
 *
 * BACKEND TODO: POST /negotiation/sessions/complete
 *   request:  { initialOffer, finalOffer }
 *   response: { summary, totalIncreasePct }
 */
export async function finalizeNegotiation(
  initialOffer: SalaryOffer,
  finalOffer: SalaryOffer,
): Promise<{summary: string; totalIncreasePct: number}> {
  await delay(400);
  const totalIncreasePct = Math.round(
    ((finalOffer.baseSalary - initialOffer.baseSalary) / initialOffer.baseSalary) * 100,
  );
  const summary =
    totalIncreasePct > 0
      ? `You negotiated your base salary up by ${totalIncreasePct}% — from $${initialOffer.baseSalary.toLocaleString()} to $${finalOffer.baseSalary.toLocaleString()}.`
      : `Your base salary stayed at $${finalOffer.baseSalary.toLocaleString()}, but you may have picked up extra bonus/signing value along the way.`;

  const history = await readHistory();
  const entry: NegotiationHistoryEntry = {
    id: `neg_${Date.now()}`,
    date: Date.now(),
    company: finalOffer.company,
    title: finalOffer.title,
    initialBase: initialOffer.baseSalary,
    finalBase: finalOffer.baseSalary,
    increasePct: totalIncreasePct,
  };
  await AsyncStorage.setItem(EKeyAsyncStorage.negotiationHistory, JSON.stringify([entry, ...history]));

  return {summary, totalIncreasePct};
}

/**
 * Read past negotiation session summaries.
 *
 * BACKEND TODO: GET /negotiation/sessions
 */
export async function getNegotiationHistory(): Promise<NegotiationHistoryEntry[]> {
  await delay(300);
  return readHistory();
}
