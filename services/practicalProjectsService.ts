import i18n from 'i18next';
import apiClient from './apiClient';

// Practical Scenario projects (Saveur-Backend app/api/practical.py,
// "Practical Scenario PROJECTS") — industry-specific written deliverables
// stored as CodingProject rows with project_type="practical".
export interface PracticalProjectSummary {
  id: number;
  name: string;
  industry: string;
}
export interface PracticalProjectDetail extends PracticalProjectSummary {
  files: {path: string; content: string}[];
}

interface Wire {
  id: number;
  name: string;
  language_hint?: string | null;
  files?: {path: string; content: string}[];
}
const sum = (w: Wire): PracticalProjectSummary => ({id: w.id, name: w.name, industry: w.language_hint ?? ''});
const detail = (w: Wire): PracticalProjectDetail => ({...sum(w), files: w.files ?? []});

export async function listPracticalProjects(): Promise<PracticalProjectSummary[]> {
  const {data} = await apiClient.get<Wire[]>('/api/v1/practical/projects');
  return data.map(sum);
}
export async function createPracticalProject(type: string, role?: string): Promise<PracticalProjectDetail> {
  const {data} = await apiClient.post<Wire>('/api/v1/practical/projects', {
    type,
    role,
    language: i18n.language || 'en',
  });
  return detail(data);
}
export async function getPracticalProject(id: number | string): Promise<PracticalProjectDetail> {
  const {data} = await apiClient.get<Wire>(`/api/v1/practical/projects/${id}`);
  return detail(data);
}
export async function savePracticalProject(
  id: number | string,
  files: {path: string; content: string}[],
): Promise<PracticalProjectDetail> {
  const {data} = await apiClient.put<Wire>(`/api/v1/practical/projects/${id}/files`, {files});
  return detail(data);
}
