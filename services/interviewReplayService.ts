import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// interviewReplayService — Video Interview Replay (product request item).
// Now backed by a REAL recorded video when one exists: Video-mode sessions
// record locally via react-native-vision-camera throughout the live
// interview (see services/videoAnalysisService.ts's startVideoRecording/
// stopVideoRecording) and upload the finished file right after the session
// ends (interviewService.uploadSessionVideo) — see
// app/api/feedback.py's replay() docstring for the full backend side.
// `videoUrl` is null for Voice/Text-mode sessions (nothing was ever
// recorded) and for a Video-mode session whose upload hasn't landed yet —
// InterviewReplay.tsx falls back to the transcript+metrics timeline alone
// in that case, same as before this existed.
// ---------------------------------------------------------------------------

export interface ReplayTranscriptEntry {
  role: string;
  text: string;
  tMs: number;
}

export interface ReplayAnnotation {
  tMs: number;
  type: 'confidence_dip' | 'strong_moment' | string;
  label: string;
}

export interface ReplayVoiceMetrics {
  wordsPerMinute: number | null;
  fillerCount: number | null;
  longPauses: number | null;
}

export interface SessionReplay {
  durationMs: number;
  /** Playable URL for the real recorded video, or null if this session has
   * none (Voice/Text mode, or a Video-mode upload that hasn't landed yet). */
  videoUrl: string | null;
  videoDurationSec: number | null;
  transcript: ReplayTranscriptEntry[];
  voiceMetrics: ReplayVoiceMetrics | null;
  annotations: ReplayAnnotation[];
}

interface WireReplay {
  duration_ms?: number;
  video_url?: string | null;
  video_duration_sec?: number | null;
  transcript?: Array<{ role?: string; text?: string; t_ms?: number }>;
  voice_metrics?: { words_per_minute?: number; filler_count?: number; long_pauses?: number } | null;
  annotations?: Array<{ t_ms?: number; type?: string; label?: string }>;
}

export async function getSessionReplay(sessionId: string | number): Promise<SessionReplay> {
  const { data } = await apiClient.get<WireReplay>(`/api/v1/feedback/session/${sessionId}/replay`);
  return {
    durationMs: data.duration_ms ?? 0,
    videoUrl: data.video_url ?? null,
    videoDurationSec: data.video_duration_sec ?? null,
    transcript: (data.transcript ?? []).map(m => ({
      role: m.role ?? '', text: m.text ?? '', tMs: m.t_ms ?? 0,
    })),
    voiceMetrics: data.voice_metrics
      ? {
          wordsPerMinute: data.voice_metrics.words_per_minute ?? null,
          fillerCount: data.voice_metrics.filler_count ?? null,
          longPauses: data.voice_metrics.long_pauses ?? null,
        }
      : null,
    annotations: (data.annotations ?? []).map(a => ({
      tMs: a.t_ms ?? 0, type: (a.type as ReplayAnnotation['type']) ?? '', label: a.label ?? '',
    })),
  };
}

export function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
