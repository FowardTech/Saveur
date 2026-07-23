import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// careerDiaryService — Career Diary: a plain journal where users log what
// they did, learned, or achieved on a given day regarding a role, career,
// or job. Real backend CRUD (app/api/career_diary.py) — no AI involved,
// this is the user's own record.
// ---------------------------------------------------------------------------

export type DiaryCategory = 'did' | 'learned' | 'achieved';

export interface CareerDiaryEntry {
  id: number;
  entryDate: string; // "YYYY-MM-DD"
  category?: DiaryCategory;
  role?: string;
  text: string;
  createdAt: number | null;
}

interface EntryWire {
  id: number;
  entry_date?: string;
  category?: string;
  role?: string;
  text: string;
  created_at?: string;
  updated_at?: string;
}

function fromWire(w: EntryWire): CareerDiaryEntry {
  return {
    id: w.id,
    entryDate: w.entry_date ?? '',
    category: (w.category as DiaryCategory) || undefined,
    role: w.role || undefined,
    text: w.text,
    createdAt: w.created_at ? new Date(w.created_at).getTime() : null,
  };
}

/** GET /api/v1/career-diary — most recent first. `days` (default 90, 0 = no
 * limit) bounds how far back entries are fetched; `role` filters to a
 * single tagged role/career. */
export async function listEntries(opts?: {days?: number; role?: string}): Promise<CareerDiaryEntry[]> {
  const {data} = await apiClient.get<{items?: EntryWire[]}>('/api/v1/career-diary', {
    params: {days: opts?.days, role: opts?.role},
  });
  return (data.items ?? []).map(fromWire);
}

/** POST /api/v1/career-diary. `entryDate` defaults to today server-side if omitted. */
export async function createEntry(input: {
  text: string;
  category?: DiaryCategory;
  role?: string;
  entryDate?: string;
}): Promise<CareerDiaryEntry> {
  const {data} = await apiClient.post<EntryWire>('/api/v1/career-diary', {
    text: input.text,
    category: input.category,
    role: input.role,
    entry_date: input.entryDate,
  });
  return fromWire(data);
}

export async function updateEntry(
  id: number,
  input: Partial<{text: string; category: DiaryCategory; role: string; entryDate: string}>,
): Promise<CareerDiaryEntry> {
  const {data} = await apiClient.patch<EntryWire>(`/api/v1/career-diary/${id}`, {
    text: input.text,
    category: input.category,
    role: input.role,
    entry_date: input.entryDate,
  });
  return fromWire(data);
}

export async function deleteEntry(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/career-diary/${id}`);
}
