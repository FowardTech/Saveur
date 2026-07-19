import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// jdService — real backend implementation.
//
// Backs the JDAnalyzer screen: paste a job description, get a match score +
// gap analysis. Stateless — no persistence needed here (each analysis is a
// one-off). Two backend endpoints back this domain now:
//   POST /api/v1/jd/analyze — { jd_text } -> keywords, must-haves, seniority
//   POST /api/v1/jd/match   — { jd_text } -> match score vs. the user's resume
// The screen only ever showed a single combined result (score + missing
// skills + keyword suggestions), so `analyzeJobDescription` below calls both
// endpoints in parallel and merges them into that same shape — no screen
// changes needed. `analyzeJD`/`matchJD` are also exported individually for
// any future UI that wants the two results split apart.
// ---------------------------------------------------------------------------

export interface JDAnalyzeResult {
  keywords: string[];
  mustHaves: string[];
  seniority: string;
}
export interface JDMatchResult {
  score: number;
  missingSkills: string[];
}
export interface JDAnalysisResult {
  score: number;
  missingSkills: string[];
  keywordSuggestions: string[];
}

interface JDAnalyzeWire {
  keywords?: string[];
  must_haves?: string[];
  seniority?: string;
}
interface JDMatchWire {
  score?: number;
  missing_skills?: string[];
}

/**
 * POST /api/v1/jd/analyze — extract keywords, must-have requirements, and
 * seniority level from a pasted job description.
 */
export async function analyzeJD(jdText: string): Promise<JDAnalyzeResult> {
  const {data} = await apiClient.post<JDAnalyzeWire>('/api/v1/jd/analyze', {
    jd_text: jdText,
  });
  return {
    keywords: data.keywords ?? [],
    mustHaves: data.must_haves ?? [],
    seniority: data.seniority ?? '',
  };
}

/**
 * POST /api/v1/jd/match — compare a pasted job description against the
 * user's stored resume (§6) and return a match score + missing skills.
 */
export async function matchJD(jdText: string): Promise<JDMatchResult> {
  const {data} = await apiClient.post<JDMatchWire>('/api/v1/jd/match', {
    jd_text: jdText,
  });
  return {
    score: data.score ?? 0,
    missingSkills: data.missing_skills ?? [],
  };
}

/**
 * Combines analyzeJD + matchJD into the single result JDAnalyzer.tsx renders
 * today: match score + missing skills from /jd/match, keyword suggestions
 * from /jd/analyze. If the match call doesn't return missing skills, falls
 * back to the analyze call's must-have requirements so the "Missing Skills"
 * section still has useful content.
 */
export async function analyzeJobDescription(text: string): Promise<JDAnalysisResult> {
  const trimmed = text.trim();
  const [analysis, match] = await Promise.all([analyzeJD(trimmed), matchJD(trimmed)]);
  return {
    score: match.score,
    missingSkills: match.missingSkills.length ? match.missingSkills : analysis.mustHaves,
    keywordSuggestions: analysis.keywords,
  };
}
