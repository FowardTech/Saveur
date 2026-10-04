import i18n from 'i18next';
import apiClient from './apiClient';

// Practical Scenario projects (Saveur-Backend app/api/practical.py,
// "Practical Scenario PROJECTS") — industry-specific written deliverables
// stored as CodingProject rows with project_type="practical".
export interface StageFeedback {
  score: number;
  passed: boolean;
  summary: string;
  strengths: string[];
  improvements: string[];
  follow_up: string;
}
export interface ProjectStage {
  n: number;
  title: string;
  task: string;
  template: string;
  twist: string;
  deliverable_type?: 'text' | 'document' | 'presentation' | 'spreadsheet' | 'audio' | 'video';
  status: 'locked' | 'active' | 'done';
  attempts: number;
  feedback: StageFeedback | null;
}
export interface ProjectState {
  persona: {name: string; title: string};
  stages: ProjectStage[];
  final: null | {overall_score: number; verdict: string; top_strengths: string[]; growth_areas: string[]};
}
export interface PracticalProjectSummary {
  id: number;
  name: string;
  industry: string;
}
export interface PracticalProjectDetail extends PracticalProjectSummary {
  state?: ProjectState | null;
  files: {path: string; content: string; content_original?: string}[];
}

interface Wire {
  id: number;
  name: string;
  language_hint?: string | null;
  files?: {path: string; content: string; content_original?: string}[];
  state?: ProjectState | null;
}
const sum = (w: Wire): PracticalProjectSummary => ({id: w.id, name: w.name, industry: w.language_hint ?? ''});
const detail = (w: Wire): PracticalProjectDetail => ({...sum(w), files: w.files ?? [], state: w.state ?? null});

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

export interface StageAttachment {
  name: string;
  kind: 'document' | 'media';
  text: string;
  truncated?: boolean;
}

export async function submitProjectStage(
  id: number | string,
  n: number,
  content: string,
  attachments: StageAttachment[] = [],
): Promise<PracticalProjectDetail> {
  const {data} = await apiClient.post<Wire>(`/api/v1/practical/projects/${id}/stages/${n}/submit`, {
    content,
    attachments,
  });
  return detail(data);
}

/** Upload a document (pdf/docx/pptx/xlsx/csv/txt/md); the backend returns its extracted text. */
export async function uploadStageDocument(
  id: number | string,
  file: {uri: string; name: string; mimeType?: string | null},
): Promise<StageAttachment> {
  const formData = new FormData();
  formData.append('file', {uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream'} as any);
  const {data} = await apiClient.post<StageAttachment>(`/api/v1/practical/projects/${id}/attachments/file`, formData);
  return data;
}

/** Attach a public audio/video link; the backend transcribes it. */
export async function attachStageMediaUrl(id: number | string, url: string): Promise<StageAttachment> {
  const {data} = await apiClient.post<StageAttachment>(`/api/v1/practical/projects/${id}/attachments/url`, {url});
  return data;
}
export async function finishPracticalProject(id: number | string): Promise<PracticalProjectDetail> {
  const {data} = await apiClient.post<Wire>(`/api/v1/practical/projects/${id}/finish`, {});
  return detail(data);
}
