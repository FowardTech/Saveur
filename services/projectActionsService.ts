import {Alert, Platform, Share} from 'react-native';
import apiClient from './apiClient';
import {downloadDocumentFile, saveToAndroidDownloads} from './documentDownloadService';

// Export / external-link helpers shared by Coding Projects and Practical
// Scenario projects (both are CodingProject rows server-side — see
// Saveur-Backend app/services/project_share_service.py).
export type ProjectKind = 'coding' | 'practical';

// Same web app origin the web client itself is deployed on
// (NEXT_PUBLIC_SITE_URL in Saveur-Web/.env.production.example).
const WEB_APP_URL = 'https://app.saveurnow.com';

const base = (kind: ProjectKind) =>
  kind === 'practical' ? '/api/v1/practical/projects' : '/api/v1/coding/projects';

/** GET .../export -> zip; saves to Downloads (Android) or opens the share
 * sheet (iOS), mirroring the resume/cover-letter download flow. */
export async function exportProjectZip(kind: ProjectKind, id: number | string): Promise<{filename: string}> {
  const {data} = await apiClient.get<{url: string; filename: string}>(`${base(kind)}/${id}/export`);
  const tempPath = await downloadDocumentFile(data.url, data.filename);
  if (Platform.OS === 'android') {
    await saveToAndroidDownloads(tempPath, data.filename, 'application/zip');
  } else {
    await Share.share({url: `file://${tempPath}`, title: data.filename});
  }
  return {filename: data.filename};
}

/** POST .../share-link -> public read-only URL for non-Saveur viewers. */
export async function getProjectPublicUrl(kind: ProjectKind, id: number | string): Promise<string> {
  const {data} = await apiClient.post<{token: string}>(`${base(kind)}/${id}/share-link`);
  return `${WEB_APP_URL}/shared/project/${data.token}`;
}

export function alertExportDone(title: string, message: string) {
  Alert.alert(title, message);
}
