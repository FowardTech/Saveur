import apiClient from './apiClient';

// ---------------------------------------------------------------------------
// interviewReplayService — Video Interview Replay (product request item).
// Scoped as a transcript + annotated-metrics timeline, not actual video
// playback — see app/api/feedback.py's replay() docstring for why: the
// app's camera pipeline never actually stores video, only live-derived
// per-frame metrics, so "replay" surfaces the real data that DOES exist
// (transcript + camera/voice metrics + flagged moments) rather than faking
// a video player with nothing behind it.
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
  transcript: ReplayTranscriptEntry[];
  voiceMetrics: ReplayVoiceMetrics | null;
  annotations: ReplayAnnotation[];
}

interface WireReplay {
  duration_ms?: number;
  transcript?: Array<{ role?: string; text?: string; t_ms?: number }>;
  voice_metrics?: { words_per_minute?: number; filler_count?: number; long_pauses?: number } | null;
  annotations?: Array<{ t_ms?: number; type?: string; label?: string }>;
}

export async function getSessionReplay(sessionId: string | number): Promise<SessionReplay> {
  const { data } = await apiClient.get<WireReplay>(`/api/v1/feedback/session/${sessionId}/replay`);
  return {
    durationMs: data.duration_ms ?? 0,
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
