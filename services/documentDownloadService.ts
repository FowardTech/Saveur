import {Platform} from 'react-native';
import RNBlobUtil from 'react-native-blob-util';

// ---------------------------------------------------------------------------
// Shared, validated download step for every "download my generated CV/
// cover letter/resume variant" flow (GenerateResume.tsx, CoverLetterGenerator
// .tsx, ResumeVariants.tsx, GeneratedDocuments.tsx).
//
// Bug this fixes (product request item -- "storing the file on the device as
// html content instead of the actual pdf or docx"): `RNBlobUtil.fetch()`
// resolves successfully for ANY HTTP response, including a Flask 404 error
// page. None of the four download call sites ever inspected the response
// status or Content-Type before treating the downloaded bytes as the final
// file, so any stale/expired document URL (e.g. a GeneratedDocument row
// created before the storage-volume fix, or any other backend 404) silently
// produced a real ".pdf"/".docx" file on the device that was actually an
// HTML "Not Found" page -- exactly the symptom reported. This is the one
// place all four screens now go through, so a bad response can never again
// reach the share sheet / Downloads folder as if it were a real document.
// ---------------------------------------------------------------------------

export class DocumentUnavailableError extends Error {
  constructor(
    message = "This document isn't available anymore. Please regenerate it and try again.",
  ) {
    super(message);
    this.name = 'DocumentUnavailableError';
  }
}

/**
 * Downloads `url` to a local cache file and validates the response before
 * returning its path. Throws DocumentUnavailableError (never resolves with a
 * bad file) if the server returned a non-2xx status or an HTML/JSON error
 * body instead of the real document.
 */
export async function downloadDocumentFile(url: string, filename: string): Promise<string> {
  const dest = `${RNBlobUtil.fs.dirs.CacheDir}/${Date.now()}_${filename}`;
  const res = await RNBlobUtil.config({path: dest, overwrite: true}).fetch('GET', url);
  const info = res.info();
  const rawContentType = info.headers?.['Content-Type'] ?? info.headers?.['content-type'] ?? '';
  const contentType = String(rawContentType).toLowerCase();
  const isBadStatus = info.status < 200 || info.status >= 300;
  // A real PDF/DOCX response is never text/html or application/json --
  // that's exactly what a Flask error page (or any JSON error body) looks
  // like, so treating either as a failure catches this regardless of the
  // exact success Content-Type a given backend/CDN happens to send.
  const looksLikeErrorBody = contentType.includes('text/html') || contentType.includes('application/json');
  if (isBadStatus || looksLikeErrorBody) {
    await RNBlobUtil.fs.unlink(dest).catch(() => {});
    throw new DocumentUnavailableError();
  }
  return dest;
}

/**
 * Moves an already-downloaded-and-validated file into the public Downloads
 * folder and registers it with Android's DownloadManager so it shows up
 * with a normal system "download complete" notification -- same end-user
 * result as the old `addAndroidDownloads: {useDownloadManager: true}` config
 * option, but only ever run on a file we've already confirmed is real,
 * instead of handing DownloadManager the live URL directly (which offered no
 * chance to validate the response first).
 */
export async function saveToAndroidDownloads(
  tempPath: string,
  filename: string,
  mime: string,
): Promise<string> {
  const finalPath = `${RNBlobUtil.fs.dirs.DownloadDir}/${filename}`;
  await RNBlobUtil.fs.mv(tempPath, finalPath);
  await RNBlobUtil.android.addCompleteDownload({
    title: filename,
    description: filename,
    mime,
    path: finalPath,
    showNotification: true,
  });
  return finalPath;
}

export function mimeForFormat(format: 'pdf' | 'docx' | string): string {
  return format === 'docx'
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'application/pdf';
}

export const isAndroid = Platform.OS === 'android';
