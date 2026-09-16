import i18n from 'i18next';
import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// offerAnalyzerService — Offer/Salary Analyzer (product request: "See the
// Salary analyser too" [resume.io's /app/offer-analyzer-result]). A
// one-shot numeric market-rate calculator, deliberately separate from
// salaryNegotiationService.ts's Salary Negotiation (a conversational,
// round-based recruiter-pushback simulator) — see
// Saveur-Backend/app/api/offer_analyzer.py's module docstring for the full
// "these are complementary, not redundant" reasoning.
// ---------------------------------------------------------------------------

function currentLanguage(): string {
  return i18n.language || 'en';
}

export interface OfferAnalyzerInput {
  jobTitle: string;
  location: string;
  yearsExperience?: number;
  offeredSalary: number;
  benefits?: string;
  currency?: string;
}

export interface FairMarketRange {
  low: number | null;
  mid: number | null;
  high: number | null;
  currency: string;
}

export type OfferAssessment = 'below_market' | 'at_market' | 'above_market';

export interface OfferAnalyzerResult {
  fairMarketRange: FairMarketRange;
  suggestedCounter: number | null;
  offerAssessment: OfferAssessment;
  rationale: string;
  negotiationTip: string;
}

interface WireResult {
  fair_market_range?: {low?: number | null; mid?: number | null; high?: number | null; currency?: string};
  suggested_counter?: number | null;
  offer_assessment?: OfferAssessment;
  rationale?: string;
  negotiation_tip?: string;
}

/** POST /api/v1/offer-analyzer/analyze. Throws on failure so the screen can
 * show a real error (402/403 for a non-Pro user, same as every other
 * @require_pro-gated call in this app). */
export async function analyzeOffer(input: OfferAnalyzerInput): Promise<OfferAnalyzerResult> {
  const {data} = await apiClient.post<WireResult>('/api/v1/offer-analyzer/analyze', {
    job_title: input.jobTitle,
    location: input.location,
    years_experience: input.yearsExperience,
    offered_salary: input.offeredSalary,
    benefits: input.benefits || '',
    currency: input.currency || 'USD',
    language: currentLanguage(),
  });
  const fmr = data.fair_market_range || {};
  return {
    fairMarketRange: {
      low: fmr.low ?? null,
      mid: fmr.mid ?? null,
      high: fmr.high ?? null,
      currency: fmr.currency || input.currency || 'USD',
    },
    suggestedCounter: data.suggested_counter ?? null,
    offerAssessment: data.offer_assessment || 'at_market',
    rationale: data.rationale || '',
    negotiationTip: data.negotiation_tip || '',
  };
}
