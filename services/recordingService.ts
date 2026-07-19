import React from 'react';

// ---------------------------------------------------------------------------
// recordingService — SIMULATED recording only.
//
// TODO: swap for a real camera/mic library (e.g. react-native-vision-camera)
// — this currently only simulates recording, no media is captured. It was
// built this way deliberately: adding a camera/mic native dependency was too
// risky given today's native build troubleshooting, so this module gives the
// screens a complete start/stop/timer/recording-indicator flow that a real
// library can be dropped into later with a small, contained diff (only this
// file + wherever it's imported should need to change).
// ---------------------------------------------------------------------------

export interface StartRecordingResult {
  recordingId: string;
}
export interface StopRecordingResult {
  uri: string;
  durationSec: number;
}

// Tracks fake start times per recordingId so stopRecording can compute a
// "duration" even though nothing was actually captured.
const activeRecordings = new Map<string, number>();

/**
 * Begin a simulated recording. No camera/mic permission is requested and no
 * hardware is touched — this just marks a start time so stopRecording can
 * report a plausible duration.
 */
export function startRecording(mode: 'audio' | 'video'): StartRecordingResult {
  const recordingId = `rec_${mode}_${Date.now()}`;
  activeRecordings.set(recordingId, Date.now());
  return {recordingId};
}

/**
 * Stop a simulated recording and return a fake local URI + duration.
 * Resolves after a short delay to mimic finalizing/writing a file.
 */
export async function stopRecording(recordingId: string): Promise<StopRecordingResult> {
  const startedAt = activeRecordings.get(recordingId) ?? Date.now();
  activeRecordings.delete(recordingId);
  const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  await new Promise<void>(resolve => setTimeout(resolve, 300));
  return {
    // Fake local file URI — not a real file. A real implementation would
    // return the path/URI the camera library wrote to (e.g. file://...).
    uri: `mock://recordings/${recordingId}.${durationSec}s.mp4`,
    durationSec,
  };
}

/**
 * Small hook a screen can use to drive a "Recording… 00:12" indicator
 * without wiring up any real camera/mic access. Call `start()` when the user
 * taps record, `stop()` when they tap stop — `seconds` ticks up once per
 * second while `isRecording` is true.
 *
 * TODO: once a real camera/mic library is added, this hook's start/stop can
 * stay the same shape (screens don't need to change) — only the internals of
 * startRecording/stopRecording above need to call into the real library.
 */
export function useFakeRecordingTimer() {
  const [isRecording, setIsRecording] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);
  const [recordingId, setRecordingId] = React.useState<string | null>(null);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = React.useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = React.useCallback(
    (mode: 'audio' | 'video') => {
      const {recordingId: id} = startRecording(mode);
      setRecordingId(id);
      setSeconds(0);
      setIsRecording(true);
      clear();
      intervalRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    },
    [clear],
  );

  const stop = React.useCallback(async (): Promise<StopRecordingResult | null> => {
    clear();
    setIsRecording(false);
    if (!recordingId) {
      return null;
    }
    const result = await stopRecording(recordingId);
    setRecordingId(null);
    return result;
  }, [clear, recordingId]);

  React.useEffect(() => clear, [clear]);

  return {isRecording, seconds, start, stop};
}
