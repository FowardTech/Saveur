import React from 'react';

/** Shared upload state for any file upload (resume, documents, ...). `uploading`
 * carries a real percentage (axios onUploadProgress); `processing` is the short
 * stretch after the bytes are sent while the server stores/parses the file. */
export interface UploadStatusState {
  name: string;
  sizeBytes?: number | null;
  percent: number;
  phase: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
}

export function useUploadStatus() {
  const [status, setStatus] = React.useState<UploadStatusState | null>(null);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };
  React.useEffect(() => clearTimer, []);

  const begin = React.useCallback((name: string, sizeBytes?: number | null) => {
    clearTimer();
    setStatus({name, sizeBytes, percent: 0, phase: 'uploading'});
  }, []);
  const progress = React.useCallback((percent: number) => {
    setStatus(prev => (prev ? {...prev, percent, phase: percent >= 100 ? 'processing' : 'uploading'} : prev));
  }, []);
  const done = React.useCallback(() => {
    setStatus(prev => (prev ? {...prev, percent: 100, phase: 'done'} : prev));
    clearTimer();
    // Success confirmation fades on its own; errors stay until dismissed.
    hideTimer.current = setTimeout(() => setStatus(prev => (prev && prev.phase === 'done' ? null : prev)), 4000);
  }, []);
  const fail = React.useCallback((error: string) => {
    clearTimer();
    setStatus(prev => (prev ? {...prev, phase: 'error', error} : {name: '', percent: 0, phase: 'error', error}));
  }, []);
  const dismiss = React.useCallback(() => {
    clearTimer();
    setStatus(null);
  }, []);

  return {status, begin, progress, done, fail, dismiss};
}
