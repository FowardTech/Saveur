import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import {Application_Stage_Enum, EKeyAsyncStorage} from 'constants/Types';
import apiClient from './apiClient';
import * as applicationsService from './applicationsService';

// `language` per the backend's contract — constants/languages.ts,
// docs/BACKEND_SPEC_ADDENDUM_2026-07.md §16.
function currentLanguage(): string {
  return i18n.language || 'en';
}

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

interface ScenarioWire {
  offer?: SalaryOfferWireForScenario;
  approaches?: Array<{id?: NegotiationApproachId; title?: string; description?: string}>;
  total_rounds?: number;
  totalRounds?: number;
}
interface SalaryOfferWireForScenario {
  company?: string;
  title?: string;
  base_salary?: number;
  baseSalary?: number;
  bonus?: number;
  signing_bonus?: number;
  signingBonus?: number;
  equity?: string;
}

/**
 * Generate a job-offer scenario to negotiate against. Was a hard-coded
 * random pick from SCENARIO_POOL every time — same 4 fake offers for every
 * user, forever. Now tries the real backend first (GET
 * /api/v1/coach/negotiation/scenario), which can generate something
 * genuinely tailored to the account. If that's not available yet, falls
 * back to building a scenario from the user's OWN tracked applications (any
 * at the Offer stage — see applicationsService.ts) so at least the
 * company/role are real, not fabricated. Only if neither of those has
 * anything does this fall back to the static pool, as a last resort so the
 * screen is never left with nothing to show.
 */
export async function getScenario(): Promise<{offer: SalaryOffer; approaches: NegotiationApproach[]; totalRounds: number}> {
  try {
    const {data} = await apiClient.get<ScenarioWire>('/api/v1/coach/negotiation/scenario', {
      params: {language: currentLanguage()},
    });
    // Was accepting ANY truthy `data.offer`, including an empty/partial
    // object (e.g. `{}` from an endpoint that's stubbed but not fully
    // implemented yet) — that fell through to the `?? 'Your target company'`
    // / `?? 'Your target role'` / `?? 0` placeholders below and rendered
    // them as if they were real data, instead of continuing on to the
    // applications-based or static-pool fallback further down. Reported as
    // "just showing placeholders... salary per year is showing $0." Now
    // requires the offer to actually have a company/title AND a positive
    // base salary before trusting it as real.
    const o = data.offer;
    const baseSalary = o?.base_salary ?? o?.baseSalary ?? 0;
    const hasRealOffer = !!o && !!(o.company || o.title) && baseSalary > 0;
    if (hasRealOffer && o) {
      const offer: SalaryOffer = {
        company: o.company ?? 'Your target company',
        title: o.title ?? 'Your target role',
        baseSalary,
        bonus: o.bonus ?? 0,
        signingBonus: o.signing_bonus ?? o.signingBonus ?? 0,
        equity: o.equity ?? 'None',
      };
      const approaches: NegotiationApproach[] =
        data.approaches && data.approaches.length > 0
          ? data.approaches.map((a, i) => ({
              id: a.id ?? APPROACHES[i % APPROACHES.length].id,
              title: a.title ?? APPROACHES[i % APPROACHES.length].title,
              description: a.description ?? '',
            }))
          : APPROACHES;
      return {offer, approaches, totalRounds: data.total_rounds ?? data.totalRounds ?? TOTAL_ROUNDS};
    }
  } catch {
    // Not implemented yet / offline — fall through to the personalized
    // fallback below.
  }

  try {
    const applications = await applicationsService.listApplications();
    const withOffer = applications.find(a => a.stage === Application_Stage_Enum.Offer);
    if (withOffer) {
      // Real company/role from the user's own tracker; the dollar figures
      // are a reasonable estimate (this app doesn't collect real offer
      // amounts anywhere yet) explicitly framed as a practice baseline
      // rather than pretending to know their actual number.
      const base = SCENARIO_POOL[Math.floor(Math.random() * SCENARIO_POOL.length)];
      const offer: SalaryOffer = {
        ...base,
        company: withOffer.company,
        title: withOffer.role,
      };
      return {offer, approaches: APPROACHES, totalRounds: TOTAL_ROUNDS};
    }
  } catch {
    // listApplications already has its own offline fallback and rarely
    // throws, but guard anyway rather than let this block the screen.
  }

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
    language: currentLanguage(),
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

export interface NegotiationCritique {
  summary: string;
  strengths: string[];
  improvements: string[];
  totalIncreasePct: number;
}

interface NegotiationCompleteWire {
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  total_increase_pct?: number;
}

export interface NegotiationLogEntryForApi {
  round: number;
  approachTitle: string;
  ask: string;
  recruiterResponse: string;
}

/**
 * Wrap up a negotiation session: gets a real AI-written critique of *how*
 * the session was played (not just the salary delta, which the client
 * already knows) from POST /api/v1/coach/negotiation/complete, persists a
 * local history entry, and returns copy for the results screen. Previously
 * this was purely client-computed — a percentage change plus one of two
 * canned template sentences, regardless of what approaches were actually
 * chosen or how the recruiter responded — which fell well short of "AI
 * critiques" the negotiation coach was meant to give. Falls back to that
 * same local template if the AI call fails, so a transient hiccup never
 * blocks seeing a result.
 */
export async function finalizeNegotiation(
  initialOffer: SalaryOffer,
  finalOffer: SalaryOffer,
  log: NegotiationLogEntryForApi[] = [],
): Promise<NegotiationCritique> {
  const totalIncreasePct = Math.round(
    ((finalOffer.baseSalary - initialOffer.baseSalary) / initialOffer.baseSalary) * 100,
  );

  let critique: NegotiationCritique;
  try {
    const {data} = await apiClient.post<NegotiationCompleteWire>('/api/v1/coach/negotiation/complete', {
      initial_offer: toOfferWire(initialOffer),
      final_offer: toOfferWire(finalOffer),
      log: log.map(entry => ({
        round: entry.round,
        approach_title: entry.approachTitle,
        ask: entry.ask,
        recruiter_response: entry.recruiterResponse,
      })),
      language: currentLanguage(),
    });
    if (data.summary) {
      critique = {
        summary: data.summary,
        strengths: data.strengths ?? [],
        improvements: data.improvements ?? [],
        totalIncreasePct: data.total_increase_pct ?? totalIncreasePct,
      };
    } else {
      throw new Error('empty_critique');
    }
  } catch {
    critique = {
      summary:
        totalIncreasePct > 0
          ? `You negotiated your base salary up by ${totalIncreasePct}% — from $${initialOffer.baseSalary.toLocaleString()} to $${finalOffer.baseSalary.toLocaleString()}.`
          : `Your base salary stayed at $${finalOffer.baseSalary.toLocaleString()}, but you may have picked up extra bonus/signing value along the way.`,
      strengths: [],
      improvements: [],
      totalIncreasePct,
    };
  }

  const history = await readHistory();
  const entry: NegotiationHistoryEntry = {
    id: `neg_${Date.now()}`,
    date: Date.now(),
    company: finalOffer.company,
    title: finalOffer.title,
    initialBase: initialOffer.baseSalary,
    finalBase: finalOffer.baseSalary,
    increasePct: critique.totalIncreasePct,
  };
  await AsyncStorage.setItem(EKeyAsyncStorage.negotiationHistory, JSON.stringify([entry, ...history]));

  return critique;
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
