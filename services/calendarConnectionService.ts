import {Linking} from 'react-native';
import apiClient from './apiClient';
import {CalendarConnectionProps} from 'constants/Types';

// ---------------------------------------------------------------------------
// Job Tracker Calendar auto-scan — "Connect Google Calendar" / "Connect
// Outlook Calendar", the inbox-free way to auto-detect the Interviewing
// stage (an interview invite almost always comes with a calendar event —
// see Saveur-Backend's app/services/google_calendar_service.py's module
// comment). Structurally identical to services/emailConnectionService.ts —
// see that file's own comment for the full OAuth flow this mirrors.
// ---------------------------------------------------------------------------

export type CalendarProvider = 'google' | 'outlook';

export interface CalendarConnectResult {
  ok: boolean;
  email?: string;
  error?: string;
}

async function getAuthorizeUrl(provider: CalendarProvider): Promise<string> {
  const path = provider === 'google' ? 'google-calendar' : 'outlook-calendar';
  const {data} = await apiClient.get<{url: string}>(`/api/v1/auth/${path}/start`);
  return data.url;
}

function parseRedirect(provider: CalendarProvider, url: string): CalendarConnectResult | null {
  const marker = provider === 'google' ? 'google-calendar-connected' : 'outlook-calendar-connected';
  if (!url.includes(marker)) return null;
  const okMatch = url.match(/[?&]ok=([^&]+)/);
  const emailMatch = url.match(/[?&]email=([^&]+)/);
  const errorMatch = url.match(/[?&]error=([^&]+)/);
  return {
    ok: okMatch ? okMatch[1] === '1' : false,
    email: emailMatch ? decodeURIComponent(emailMatch[1]) : undefined,
    error: errorMatch ? decodeURIComponent(errorMatch[1]) : undefined,
  };
}

let pendingResolve: {google?: (r: CalendarConnectResult) => void; outlook?: (r: CalendarConnectResult) => void} = {};

/** Called from App.tsx's Linking handler for every incoming URL — a no-op
 * for anything that isn't one of these two specific redirects. */
export function handleIncomingUrl(url: string | null | undefined): void {
  if (!url) return;
  (['google', 'outlook'] as CalendarProvider[]).forEach(provider => {
    const result = parseRedirect(provider, url);
    if (!result) return;
    const resolve = pendingResolve[provider];
    if (resolve) {
      resolve(result);
      pendingResolve[provider] = undefined;
    }
  });
}

const REDIRECT_TIMEOUT_MS = 5 * 60 * 1000;

/** Opens the provider's consent page in the system browser and resolves
 * once the app receives the callback redirect (or rejects on timeout/no
 * browser). */
export async function connect(provider: CalendarProvider): Promise<CalendarConnectResult> {
  const url = await getAuthorizeUrl(provider);
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error('This device cannot open the sign-in page.');
  }

  const resultPromise = new Promise<CalendarConnectResult>((resolve, reject) => {
    pendingResolve[provider] = resolve;
    setTimeout(() => {
      if (pendingResolve[provider]) {
        pendingResolve[provider] = undefined;
        reject(new Error('Connecting timed out.'));
      }
    }, REDIRECT_TIMEOUT_MS);
  });

  await Linking.openURL(url);
  return resultPromise;
}

interface CalendarConnectionWire {
  provider: CalendarProvider;
  email_address: string | null;
  is_active: boolean;
  connected_at: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

function fromWire(wire: CalendarConnectionWire): CalendarConnectionProps {
  return {
    provider: wire.provider,
    emailAddress: wire.email_address,
    isActive: wire.is_active,
    connectedAt: wire.connected_at ? new Date(wire.connected_at).getTime() : null,
    lastSyncedAt: wire.last_synced_at ? new Date(wire.last_synced_at).getTime() : null,
    lastSyncError: wire.last_sync_error,
  };
}

/** GET /api/v1/calendar-connections — every active calendar connection for
 * the signed-in user (0, 1, or 2 rows — Google and/or Outlook). */
export async function listConnections(): Promise<CalendarConnectionProps[]> {
  const {data} = await apiClient.get<{data: CalendarConnectionWire[]}>('/api/v1/calendar-connections');
  return (data.data ?? []).map(fromWire);
}

/** DELETE /api/v1/calendar-connections/{provider} — stops auto-scanning
 * that calendar immediately. */
export async function disconnect(provider: CalendarProvider): Promise<void> {
  await apiClient.delete(`/api/v1/calendar-connections/${provider}`);
}
