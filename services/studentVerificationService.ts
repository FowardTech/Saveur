import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// studentVerificationService — Student verification + discounted billing
// (product request item). University search is backed by a real, worldwide
// public directory (Hipolabs) — see app/services/student_service.py's
// module docstring. Year-of-study is restricted to final-year server-side,
// independent of what's shown here.
// ---------------------------------------------------------------------------

export type YearOfStudy = 'final_year';
// Shown in the picker so a non-final-year student understands why they
// can't proceed, rather than the option simply not existing — only
// 'final_year' is ever sent to the backend as an actual selection.
export const YEAR_OPTIONS: { value: string; isEligible: boolean }[] = [
  { value: '1st_year', isEligible: false },
  { value: '2nd_year', isEligible: false },
  { value: '3rd_year', isEligible: false },
  { value: 'final_year', isEligible: true },
];

export interface University {
  name: string;
  country: string;
  countryCode: string;
  domains: string[];
}

interface WireUniversity {
  name?: string;
  country?: string;
  country_code?: string;
  domains?: string[];
}

export async function searchUniversities(query: string, country?: string): Promise<University[]> {
  if (!query.trim() && !country) return [];
  try {
    const { data } = await apiClient.get<{ items?: WireUniversity[] }>('/api/v1/student/universities', {
      params: { query: query.trim(), country },
    });
    return (data.items ?? []).map(u => ({
      name: u.name ?? '', country: u.country ?? '', countryCode: u.country_code ?? '',
      domains: u.domains ?? [],
    }));
  } catch {
    return [];
  }
}

export interface StudentProfile {
  universityName: string | null;
  universityCountry: string | null;
  schoolEmail: string | null;
  schoolEmailVerified: boolean;
  yearOfStudy: string | null;
  graduationDate: string | null;
  isStudent: boolean;
  studentDiscountActive: boolean;
  graduated: boolean;
}

interface WireProfile {
  university_name?: string | null;
  university_country?: string | null;
  school_email?: string | null;
  school_email_verified?: boolean;
  year_of_study?: string | null;
  graduation_date?: string | null;
  is_student?: boolean;
  student_discount_active?: boolean;
  graduated?: boolean;
}

function mapProfile(w: WireProfile): StudentProfile {
  return {
    universityName: w.university_name ?? null,
    universityCountry: w.university_country ?? null,
    schoolEmail: w.school_email ?? null,
    schoolEmailVerified: !!w.school_email_verified,
    yearOfStudy: w.year_of_study ?? null,
    graduationDate: w.graduation_date ?? null,
    isStudent: !!w.is_student,
    studentDiscountActive: !!w.student_discount_active,
    graduated: !!w.graduated,
  };
}

export async function getStatus(): Promise<StudentProfile | null> {
  try {
    const { data } = await apiClient.get<{ profile?: WireProfile | null }>('/api/v1/student/status');
    return data.profile ? mapProfile(data.profile) : null;
  } catch {
    return null;
  }
}

/** Throws (with a real message) on rejection — invalid country, non-final
 * year, bad graduation date, etc. */
export async function sendVerificationCode(input: {
  universityName: string;
  universityCountry: string;
  schoolEmail: string;
  yearOfStudy: string;
  graduationDate: string; // YYYY-MM-DD
}): Promise<void> {
  await apiClient.post('/api/v1/student/verify/send-code', {
    university_name: input.universityName,
    university_country: input.universityCountry,
    school_email: input.schoolEmail,
    year_of_study: input.yearOfStudy,
    graduation_date: input.graduationDate,
  });
}

/** Throws on a wrong/expired code. */
export async function confirmVerificationCode(code: string): Promise<StudentProfile> {
  const { data } = await apiClient.post<{ profile?: WireProfile }>('/api/v1/student/verify/confirm-code', { code });
  return mapProfile(data.profile ?? {});
}
