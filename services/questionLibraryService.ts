import i18n from 'i18next';
import apiClient from './apiClient';

function currentLanguage(): string {
  return i18n.language || 'en';
}

// ---------------------------------------------------------------------------
// questionLibraryService — mobile port of Saveur-Web's
// components/practice/QuickPracticeQuestions.tsx fetch (task #44, porting
// task #23 "Interview Prep pre-made question library" which only ever
// shipped on web). Real backend, unchanged between platforms: GET
// /api/v1/interviews/question-library?type=&role=&language= -> {questions:
// [{id, text, type}]} (see Saveur-Backend/app/api/interviews.py's
// question_library()) -- 6 short, common questions for the given
// type/role, meant to be answered quickly and graded via the existing free
// coachService.getStarBreakdown() (POST /api/v1/coach/star), NOT a full
// mock-interview session. Free (no @require_pro), same as web.
// ---------------------------------------------------------------------------

export interface LibraryQuestion {
  id: string;
  text: string;
  type: string;
}

interface WireQuestionLibrary {
  questions?: LibraryQuestion[];
}

export async function getQuestionLibrary(interviewType: string, role: string): Promise<LibraryQuestion[]> {
  try {
    const {data} = await apiClient.get<WireQuestionLibrary>('/api/v1/interviews/question-library', {
      params: {type: interviewType, role: role || undefined, language: currentLanguage()},
    });
    return data.questions ?? [];
  } catch {
    // Non-critical, purely a lighter "browse questions" tier above the real
    // session setup -- a failed fetch just means the section doesn't
    // render (see QuickPracticeQuestions.tsx's own `null` handling).
    return [];
  }
}
